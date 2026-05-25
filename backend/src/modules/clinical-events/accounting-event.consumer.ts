import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as amqp from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';

import { ClinicalEventsConfig } from './clinical-events.config';
import { ProcessedClinicalEvent } from './processed-clinical-event.entity';
import { TenantSchemaContextService } from '../../database/tenant-schema-context.service';
import { TenantOpenbaoResolverService } from '../../database/tenant-openbao-resolver.service';
import { Treatment } from '../availability/entities/treatment.entity';
import { TreatmentBillingStatus } from '../availability/entities/treatment-billing-status.enum';
import {
  AccountingInboundEventType,
  BillableCancellationRejectedPayload,
  BillableInvoicedPayload,
  BillablePartiallyRefundedPayload,
  BillableReceivedPayload,
  BillableRecallAcceptedPayload,
  BillableRecallRejectedPayload,
  BillableRefundedPayload,
  BillableReissuedPayload,
  BillableReturnedToClinicalPayload,
  BillableUninvoicedPayload,
  CurandisEvent,
} from './clinical-events.types';

/**
 * Consumer RabbitMQ degli eventi pubblicati dall'accounting su
 * `ex.accounting.events` (binding `billable.*.<tenant>`, 10 routing key una
 * per evento). Aggiorna `Treatment.billingStatus` + colonne `accounting*` /
 * `billingAlert*` / `recall*` / `returnedFromAccounting*` in base allo
 * stato della fattura e all'esito dei recall.
 *
 * INFRASTRUTTURA:
 *   - Coda dedicata: `q.clinical.accounting-feedback` (durable, NON
 *     exclusive, NON auto-delete).
 *   - DLQ: `q.clinical.accounting-feedback.dlq` legata a `ex.dlq` (topic).
 *     I messaggi nack-ati con `noRequeue=true` vengono routati nella DLQ.
 *   - Prefetch: 10 (config-driven).
 *   - 10 binding key sull'exchange `ex.accounting.events`:
 *       billable.received.*, billable.invoiced.*, billable.uninvoiced.*,
 *       billable.refunded.*, billable.partially-refunded.*,
 *       billable.reissued.*, billable.cancellation-rejected.*,
 *       billable.recall-accepted.*, billable.recall-rejected.*,
 *       billable.returned-to-clinical.*
 *
 * IDEMPOTENCY:
 *   1. Parse JSON. Se malformato → reject DLQ.
 *   2. Validazione tenant: alias dal routing key → resolveTenant (OpenBao)
 *      → verifica schemaName esiste in information_schema.schemata.
 *      Se schema sconosciuto → reject DLQ + warn.
 *   3. `tenantSchemaContext.run({ schemaName, ... }, async () =>`
 *      transazione con:
 *        a) INSERT INTO processed_clinical_events ON CONFLICT DO NOTHING
 *        b) Se conflict (riga già esiste) → ack senza azione
 *        c) Altrimenti → handler-specifico (`UPDATE treatments ...`)
 *
 * ERRORI:
 *   - permanenti (parse, schema sconosciuto, eventType non gestito):
 *     `nack(msg, false, false)` → DLQ.
 *   - transitori (DB giù, OpenBao giù): `nack(msg, false, true)` → requeue.
 *
 * LOGGING: per ogni evento ricevuto: eventId, eventType, tenantAlias,
 * treatmentId (se presente), billableEventId (se presente).
 */
/**
 * Convenzione cross-modulo per consumer S2S: prefisso `system:` + nome consumer.
 * Aiuta il grep nei log audit (es. `system:registry-consumer`,
 * `system:gdpr-consumer`). Valore SOLO per popolare `TenantSchemaContextData.userId`,
 * MAI usato come FK app_users.
 */
export const SYSTEM_USER_ID = 'system:accounting-consumer';

@Injectable()
export class AccountingEventConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AccountingEventConsumer.name);
  private connection?: amqp.AmqpConnectionManager;
  private channelWrapper?: amqp.ChannelWrapper;

  /** Tutti i routing key cui ci interessa essere bound, deterministici. */
  private readonly bindingKeys: ReadonlyArray<string> = [
    'billable.received.*',
    'billable.invoiced.*',
    'billable.uninvoiced.*',
    'billable.refunded.*',
    'billable.partially-refunded.*',
    'billable.reissued.*',
    'billable.cancellation-rejected.*',
    'billable.recall-accepted.*',
    'billable.recall-rejected.*',
    'billable.returned-to-clinical.*',
  ];

  constructor(
    private readonly config: ClinicalEventsConfig,
    private readonly tenantContext: TenantSchemaContextService,
    private readonly tenantResolver: TenantOpenbaoResolverService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ProcessedClinicalEvent)
    private readonly processedRepo: Repository<ProcessedClinicalEvent>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn('AccountingEventConsumer disabilitato (RABBITMQ_ENABLED=false)');
      return;
    }

    this.connection = amqp.connect([this.config.url]);
    this.connection.on('connect', () => {
      this.logger.log(
        `Consumer connesso a RabbitMQ (${this.config.url.replace(/\/\/.*@/, '//***@')})`,
      );
    });
    this.connection.on('disconnect', ({ err }) => {
      this.logger.warn(`Consumer disconnesso: ${err?.message ?? 'unknown'}`);
    });

    this.channelWrapper = this.connection.createChannel({
      json: false,
      setup: async (channel: ConfirmChannel) => {
        // L'exchange `ex.accounting.events` è di proprietà dell'accounting:
        // permission READ-only per noi, NO assertExchange (idem registry).
        // Se manca, bindQueue fallirà con 404 e amqp-connection-manager
        // riproverà al re-connect.

        // 1) DLX + DLQ (li dichiariamo noi: i pattern dlx.* / q.*.dlq sono
        //    nei nostri permessi configure).
        const dlxName = 'ex.clinical.dlx';
        const dlqName = `${this.config.accountingFeedbackQueue}.dlq`;

        await channel.assertExchange(dlxName, 'topic', {
          durable: true,
          autoDelete: false,
          internal: false,
        });
        await channel.assertQueue(dlqName, {
          durable: true,
          autoDelete: false,
          exclusive: false,
        });
        await channel.bindQueue(
          dlqName,
          dlxName,
          `${this.config.accountingFeedbackQueue}.#`,
        );

        // 2) Coda principale con DLX configurato.
        await channel.assertQueue(this.config.accountingFeedbackQueue, {
          durable: true,
          autoDelete: false,
          exclusive: false,
          arguments: {
            'x-dead-letter-exchange': dlxName,
            'x-dead-letter-routing-key': `${this.config.accountingFeedbackQueue}.dead`,
          },
        });

        // 3) Bind dei 6 routing key sull'exchange accounting.
        for (const bindingKey of this.bindingKeys) {
          await channel.bindQueue(
            this.config.accountingFeedbackQueue,
            this.config.accountingExchange,
            bindingKey,
          );
        }

        await channel.prefetch(this.config.prefetch);

        await channel.consume(this.config.accountingFeedbackQueue, (msg) =>
          this.handleMessage(channel, msg),
        );

        this.logger.log(
          `Setup canale consumer OK: queue="${this.config.accountingFeedbackQueue}" ` +
            `exchange="${this.config.accountingExchange}" ` +
            `bindings=[${this.bindingKeys.join(', ')}] ` +
            `dlq="${dlqName}" prefetch=${this.config.prefetch}`,
        );
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channelWrapper?.close();
      await this.connection?.close();
      this.logger.log('Consumer chiuso');
    } catch (err) {
      this.logger.warn(`Errore chiusura consumer: ${(err as Error).message}`);
    }
  }

  // ============================================================================
  // Message dispatch
  // ============================================================================

  private async handleMessage(
    channel: ConfirmChannel,
    msg: ConsumeMessage | null,
  ): Promise<void> {
    if (!msg) return;
    const routingKey = msg.fields.routingKey;

    // 1) Parse JSON. Errore permanente → DLQ.
    let event: CurandisEvent<unknown> | null = null;
    try {
      event = JSON.parse(msg.content.toString('utf8')) as CurandisEvent<unknown>;
    } catch (err) {
      this.logger.error(
        `Payload JSON malformato (routingKey=${routingKey}): ${(err as Error).message}. DLQ.`,
      );
      channel.nack(msg, false, false);
      return;
    }

    if (!event.eventId || !event.eventType || !event.tenantAlias) {
      this.logger.error(
        `Payload incompleto (routingKey=${routingKey}): manca eventId/eventType/tenantAlias. DLQ.`,
      );
      channel.nack(msg, false, false);
      return;
    }

    const logCtx = this.buildLogContext(event, routingKey);

    // 2) Validazione tenant: alias → schemaName via OpenBao → schema esiste.
    let schemaName: string;
    try {
      const tenantInfo = await this.tenantResolver.resolveTenant(event.tenantAlias);
      if (!tenantInfo) {
        this.logger.warn(
          `${logCtx} tenant alias non trovato in OpenBao. DLQ.`,
        );
        channel.nack(msg, false, false);
        return;
      }
      if (tenantInfo.status === 'suspended' || tenantInfo.status === 'deleted') {
        this.logger.warn(
          `${logCtx} tenant status="${tenantInfo.status}". DLQ.`,
        );
        channel.nack(msg, false, false);
        return;
      }
      schemaName = tenantInfo.schemaName;

      const exists = await this.dataSource.query(
        `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1 LIMIT 1`,
        [schemaName],
      );
      if (!exists || exists.length === 0) {
        this.logger.warn(
          `${logCtx} schema "${schemaName}" non installato sul clinico. DLQ.`,
        );
        channel.nack(msg, false, false);
        return;
      }
    } catch (err) {
      // Errore transitorio (OpenBao giù, network) → requeue.
      this.logger.error(
        `${logCtx} errore validazione tenant (transitorio): ${(err as Error).message}. Requeue.`,
      );
      channel.nack(msg, false, true);
      return;
    }

    // 3) Eventuale early-skip su eventType sconosciuto: DLQ (caso permanente).
    if (!this.isHandledEventType(event.eventType)) {
      this.logger.warn(`${logCtx} eventType non gestito. DLQ.`);
      channel.nack(msg, false, false);
      return;
    }

    // 4) Run dentro contesto tenant (search_path) + transazione.
    try {
      await this.tenantContext.run(
        {
          schemaName,
          // Placeholder INTENZIONALE: il consumer S2S non ha un "tenantId numerico"
          // — l'alias è già un identificatore univoco e il TenantSchemaSubscriber
          // lo usa solo per logging verbose. NON sostituirlo con un lookup
          // (sarebbe overkill, aggiungerebbe latenza al consume e nessun
          // beneficio real-world).
          tenantId: event.tenantAlias,
          tenantAlias: event.tenantAlias,
          userId: SYSTEM_USER_ID,
          requestId: event.eventId,
        },
        async () => {
          await this.dataSource.transaction(async (manager) => {
            // 4a) Idempotency: INSERT processed_clinical_events ON CONFLICT DO NOTHING.
            const inserted = await manager
              .createQueryBuilder()
              .insert()
              .into(ProcessedClinicalEvent)
              .values({
                eventId: event!.eventId,
                eventType: event!.eventType,
                tenantAlias: event!.tenantAlias,
                treatmentId: this.extractTreatmentId(event!),
                billableEventId: this.extractBillableEventId(event!),
              })
              .orIgnore()
              .execute();

            const isDuplicate = (inserted.identifiers || []).length === 0;
            if (isDuplicate) {
              this.logger.debug(`${logCtx} duplicato (skip).`);
              return;
            }

            // 4b) Dispatch a handler specifico.
            await this.dispatch(event!, manager);
          });
        },
      );

      channel.ack(msg);
    } catch (err) {
      // Errore inatteso nel handler. Trattiamo come transitorio (requeue)
      // SOLO se l'errore non sembra dovuto a payload malformato. Per ora
      // usiamo una policy semplice: requeue una volta sola tramite redelivered.
      const isRedelivered = msg.fields.redelivered;
      if (isRedelivered) {
        // Marker grep-friendly per monitoring: distingue DLQ "applicative"
        // (handler fallito 2 volte) da DLQ per altre cause (parse, schema
        // sconosciuto, ecc.). Se la DLQ si riempie di redelivered-after-failure
        // c'è un bug nel handler; se si riempie di parse → bug nel publisher
        // accounting; se si riempie di unknown-tenant → desync OpenBao.
        this.logger.error(
          `[DLQ] eventId=${event.eventId} type=${event.eventType} ` +
            `reason=redelivered-after-failure error="${(err as Error).message}" ${logCtx}`,
        );
        channel.nack(msg, false, false);
      } else {
        this.logger.warn(
          `${logCtx} handler fallito (1° tentativo): ${(err as Error).message}. Requeue.`,
        );
        channel.nack(msg, false, true);
      }
    }
  }

  // ============================================================================
  // Dispatch
  // ============================================================================

  private isHandledEventType(eventType: string): eventType is AccountingInboundEventType {
    return (
      eventType === 'billable.received' ||
      eventType === 'billable.invoiced' ||
      eventType === 'billable.uninvoiced' ||
      eventType === 'billable.refunded' ||
      eventType === 'billable.partially-refunded' ||
      eventType === 'billable.reissued' ||
      eventType === 'billable.cancellation-rejected' ||
      eventType === 'billable.recall-accepted' ||
      eventType === 'billable.recall-rejected' ||
      eventType === 'billable.returned-to-clinical'
    );
  }

  private async dispatch(
    event: CurandisEvent<unknown>,
    manager: EntityManager,
  ): Promise<void> {
    switch (event.eventType) {
      case 'billable.received':
        return this.handleBillableReceived(
          event as CurandisEvent<BillableReceivedPayload>,
          manager,
        );
      case 'billable.invoiced':
        return this.handleBillableInvoiced(
          event as CurandisEvent<BillableInvoicedPayload>,
          manager,
        );
      case 'billable.uninvoiced':
        return this.handleBillableUninvoiced(
          event as CurandisEvent<BillableUninvoicedPayload>,
          manager,
        );
      case 'billable.refunded':
        return this.handleBillableRefunded(
          event as CurandisEvent<BillableRefundedPayload>,
          manager,
        );
      case 'billable.partially-refunded':
        return this.handleBillablePartiallyRefunded(
          event as CurandisEvent<BillablePartiallyRefundedPayload>,
          manager,
        );
      case 'billable.reissued':
        return this.handleBillableReissued(
          event as CurandisEvent<BillableReissuedPayload>,
          manager,
        );
      case 'billable.cancellation-rejected':
        return this.handleCancellationRejected(
          event as CurandisEvent<BillableCancellationRejectedPayload>,
          manager,
        );
      case 'billable.recall-accepted':
        return this.handleRecallAccepted(
          event as CurandisEvent<BillableRecallAcceptedPayload>,
          manager,
        );
      case 'billable.recall-rejected':
        return this.handleRecallRejected(
          event as CurandisEvent<BillableRecallRejectedPayload>,
          manager,
        );
      case 'billable.returned-to-clinical':
        return this.handleReturnedToClinical(
          event as CurandisEvent<BillableReturnedToClinicalPayload>,
          manager,
        );
    }
  }

  // ============================================================================
  // Handlers (1 per evento)
  // ============================================================================

  private async handleBillableReceived(
    event: CurandisEvent<BillableReceivedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const { treatmentId, billableEventId } = event.payload;
    if (!treatmentId) {
      // sale.completed standalone → niente Treatment da aggiornare.
      this.logger.debug(`billable.received senza treatmentId (sale standalone): ack senza update`);
      return;
    }

    const treatment = await this.findTreatmentOrWarn(manager, treatmentId, event);
    if (!treatment) return;

    treatment.billingStatus = TreatmentBillingStatus.PENDING;
    treatment.accountingBillableEventId = billableEventId;
    await manager.save(Treatment, treatment);
  }

  private async handleBillableInvoiced(
    event: CurandisEvent<BillableInvoicedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    if (!p.treatmentId) {
      this.logger.debug(`billable.invoiced senza treatmentId (sale standalone): ack senza update`);
      return;
    }

    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    // Anti-stale: se il treatment ha già un accountingBillableEventId valorizzato
    // e diverso da quello dell'evento, significa che un recall-accepted o un
    // returned-to-clinical ha azzerato il riferimento (o ne ha creato uno nuovo
    // via re-closure). Evento riferito a un billable obsoleto → scarta.
    if (
      treatment.accountingBillableEventId &&
      treatment.accountingBillableEventId !== p.billableEventId
    ) {
      this.logger.warn(
        `billable.invoiced stale: treatment.accountingBillableEventId=` +
          `${treatment.accountingBillableEventId} ≠ payload=${p.billableEventId}. Skip.`,
      );
      return;
    }

    treatment.billingStatus = TreatmentBillingStatus.INVOICED;
    treatment.accountingBillableEventId = p.billableEventId;
    treatment.accountingDocumentType = p.documentType;
    treatment.accountingInvoiceUrl = p.documentUrl ?? undefined;
    treatment.accountingInvoiceIssuedAt = new Date(p.issuedAt);
    treatment.patientInvoiceNumber = p.invoiceNumber;
    treatment.isInvoicedToPatient = true;
    treatment.invoicedToPatientAt = new Date(p.issuedAt);
    await manager.save(Treatment, treatment);
  }

  private async handleBillableUninvoiced(
    event: CurandisEvent<BillableUninvoicedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    if (!p.treatmentId) {
      // sale standalone: il clinico non ha billingStatus per i sales, skip.
      this.logger.debug(`billable.uninvoiced senza treatmentId (sale standalone): ack senza update`);
      return;
    }

    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    // Cancel pre-trasmissione: NON è un rimborso (no nota credito).
    // Il treatment torna disponibile a nuova fatturazione → riportiamo
    // lo snapshot accounting allo stato "PENDING fresco" (come dopo
    // billable.received), così la UI mostra "In attesa di fatturazione"
    // e i bottoni operativi tornano coerenti.
    treatment.billingStatus = TreatmentBillingStatus.PENDING;
    treatment.accountingBillableEventId = p.billableEventId;
    treatment.accountingInvoiceUrl = null as any;
    treatment.accountingInvoiceIssuedAt = null as any;
    treatment.accountingDocumentType = null as any;
    treatment.accountingCreditNoteNumber = null as any;
    treatment.accountingCreditNoteIssuedAt = null as any;
    treatment.accountingRefundReason = null as any;
    treatment.billingAlertMessage = null as any;
    treatment.billingAlertAt = null as any;
    treatment.billingAlertDismissedAt = null as any;
    treatment.patientInvoiceNumber = null as any;
    treatment.isInvoicedToPatient = false;
    treatment.invoicedToPatientAt = null as any;
    await manager.save(Treatment, treatment);
  }

  private async handleBillableRefunded(
    event: CurandisEvent<BillableRefundedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    if (!p.treatmentId) return;

    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    treatment.billingStatus = TreatmentBillingStatus.REFUNDED;
    treatment.accountingCreditNoteNumber = p.creditNoteNumber;
    treatment.accountingCreditNoteIssuedAt = new Date(p.refundedAt);
    treatment.accountingRefundReason = p.reason ?? undefined;
    await manager.save(Treatment, treatment);
  }

  private async handleBillablePartiallyRefunded(
    event: CurandisEvent<BillablePartiallyRefundedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    if (!p.treatmentId) return;

    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    treatment.billingStatus = TreatmentBillingStatus.PARTIALLY_REFUNDED;
    treatment.accountingCreditNoteNumber = p.creditNoteNumber;
    treatment.accountingCreditNoteIssuedAt = new Date(p.refundedAt);
    treatment.accountingRefundReason = p.reason ?? undefined;
    await manager.save(Treatment, treatment);
  }

  private async handleBillableReissued(
    event: CurandisEvent<BillableReissuedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    if (!p.treatmentId) return;

    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    // REISSUED → INVOICED con NUOVO invoiceNumber. Manteniamo la storia
    // del vecchio numero in accountingCreditNoteNumber (è la nota credito
    // di storno emessa per consentire la riemissione).
    treatment.billingStatus = TreatmentBillingStatus.INVOICED;
    treatment.patientInvoiceNumber = p.newInvoiceNumber;
    treatment.accountingDocumentType = 'INVOICE';
    treatment.accountingInvoiceIssuedAt = new Date(p.reissuedAt);
    treatment.accountingCreditNoteNumber = p.creditNoteNumber;
    treatment.accountingCreditNoteIssuedAt = new Date(p.reissuedAt);
    treatment.accountingRefundReason = p.reason ?? undefined;
    treatment.isInvoicedToPatient = true;
    treatment.invoicedToPatientAt = new Date(p.reissuedAt);
    await manager.save(Treatment, treatment);
  }

  private async handleCancellationRejected(
    event: CurandisEvent<BillableCancellationRejectedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    // Race condition: il clinico aveva spostato lo stato locale a NOT_READY
    // (sessione 7, prima era CANCELLED) al publish di treatment.cancelled,
    // ma accounting ha già emesso la fattura. Rollback verso INVOICED +
    // alert human-friendly all'operatore.
    treatment.billingStatus = TreatmentBillingStatus.INVOICED;
    treatment.accountingBillableEventId = p.billableEventId;
    treatment.patientInvoiceNumber = p.currentInvoiceNumber;
    treatment.isInvoicedToPatient = true;
    treatment.billingAlertMessage =
      `Non è stato possibile annullare il trattamento: nel frattempo è ` +
      `stata emessa la fattura ${p.currentInvoiceNumber}. Per stornare ` +
      `contatta l'amministrazione (serve nota di credito).`;
    treatment.billingAlertAt = new Date(p.rejectedAt);
    treatment.billingAlertDismissedAt = null as any; // riapre se era stato dismissato
    await manager.save(Treatment, treatment);
  }

  private async handleRecallAccepted(
    event: CurandisEvent<BillableRecallAcceptedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    // Anti-stale STRICT: skippa se il recall in volo non coincide. Caso 1:
    // utente ha lanciato un nuovo recall mentre il primo era in coda (req
    // diverso). Caso 2 (più subdolo): TreatmentRecallCleanupJob ha già
    // timeout-liberato il recall (recallRequestId = NULL). Applicare l'accept
    // in cieco modificherebbe il treatment che nel frattempo può essere
    // stato re-inviato o cancellato.
    if (treatment.recallRequestId !== p.requestId) {
      this.logger.warn(
        `recall-accepted orphan/stale: treatment.recallRequestId=` +
          `${treatment.recallRequestId ?? 'null'} ≠ payload.requestId=${p.requestId}. ` +
          `Skip (possibile cleanup post-timeout o multi-recall).`,
      );
      return;
    }

    // Treatment torna modificabile: NOT_READY (= "mai inviato"). Azzero anche
    // accountingBillableEventId così eventuali billable.invoiced "vecchi"
    // riferiti al billable appena cancellato lato accounting vengono scartati
    // dall'anti-stale check in handleBillableInvoiced.
    treatment.billingStatus = TreatmentBillingStatus.NOT_READY;
    treatment.accountingBillableEventId = null as any;
    treatment.accountingInvoiceUrl = null as any;
    treatment.accountingInvoiceIssuedAt = null as any;
    treatment.accountingDocumentType = null as any;
    treatment.accountingCreditNoteNumber = null as any;
    treatment.accountingCreditNoteIssuedAt = null as any;
    treatment.accountingRefundReason = null as any;
    treatment.billingAlertMessage = null as any;
    treatment.billingAlertAt = null as any;
    treatment.billingAlertDismissedAt = null as any;
    treatment.patientInvoiceNumber = null as any;
    treatment.isInvoicedToPatient = false;
    treatment.invoicedToPatientAt = null as any;

    // Chiudo il recall in volo + pulisco eventuale rejection precedente.
    treatment.recallRequestId = null as any;
    treatment.recallRequestedAt = null as any;
    treatment.lastRecallRejectionMessage = null as any;
    treatment.lastRecallRejectionAt = null as any;

    await manager.save(Treatment, treatment);

    this.logger.log(
      `Recall accettato per treatment ${p.treatmentId}` +
        (p.cancelledDraftDocumentNumber
          ? ` (fattura DRAFT ${p.cancelledDraftDocumentNumber} cancellata)`
          : ''),
    );
  }

  private async handleRecallRejected(
    event: CurandisEvent<BillableRecallRejectedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    // Anti-stale STRICT (vedi nota in handleRecallAccepted).
    if (treatment.recallRequestId !== p.requestId) {
      this.logger.warn(
        `recall-rejected orphan/stale: treatment.recallRequestId=` +
          `${treatment.recallRequestId ?? 'null'} ≠ payload.requestId=${p.requestId}. ` +
          `Skip (possibile cleanup post-timeout o multi-recall).`,
      );
      return;
    }

    // Lo stato del treatment NON cambia (resta INVOICED o quel che era).
    // Salviamo il messaggio user-friendly per il banner UI e chiudiamo
    // il recall in volo.
    treatment.lastRecallRejectionMessage = p.message;
    treatment.lastRecallRejectionAt = new Date(p.rejectedAt);
    treatment.recallRequestId = null as any;
    treatment.recallRequestedAt = null as any;

    await manager.save(Treatment, treatment);

    this.logger.log(
      `Recall rifiutato per treatment ${p.treatmentId}: reason=${p.reason}` +
        (p.blockingDocumentNumber ? ` (doc bloccante ${p.blockingDocumentNumber})` : ''),
    );
  }

  private async handleReturnedToClinical(
    event: CurandisEvent<BillableReturnedToClinicalPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    if (!p.treatmentId) {
      // sale standalone: il clinico non ha billingStatus per i sales, skip.
      this.logger.debug(
        `billable.returned-to-clinical senza treatmentId (sale standalone): ack senza update`,
      );
      return;
    }

    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    // Restituzione one-way: stesso effetto di recall-accepted sullo snapshot
    // accounting (treatment torna NOT_READY, riferimenti azzerati) + salva
    // il motivo per il banner UI dismissibile.
    treatment.billingStatus = TreatmentBillingStatus.NOT_READY;
    treatment.accountingBillableEventId = null as any;
    treatment.accountingInvoiceUrl = null as any;
    treatment.accountingInvoiceIssuedAt = null as any;
    treatment.accountingDocumentType = null as any;
    treatment.accountingCreditNoteNumber = null as any;
    treatment.accountingCreditNoteIssuedAt = null as any;
    treatment.accountingRefundReason = null as any;
    treatment.billingAlertMessage = null as any;
    treatment.billingAlertAt = null as any;
    treatment.billingAlertDismissedAt = null as any;
    treatment.patientInvoiceNumber = null as any;
    treatment.isInvoicedToPatient = false;
    treatment.invoicedToPatientAt = null as any;

    treatment.returnedFromAccountingReason = p.reason;
    treatment.returnedFromAccountingAt = new Date(p.returnedAt);
    treatment.returnedFromAccountingByEmail = p.returnedByEmail ?? undefined;
    treatment.returnedFromAccountingDismissedAt = null as any; // riapre se era stato dismissato

    // Se per qualche motivo c'era un recall in volo, lo chiudiamo
    // (returned-to-clinical raggiunge l'effetto desiderato del recall).
    treatment.recallRequestId = null as any;
    treatment.recallRequestedAt = null as any;

    await manager.save(Treatment, treatment);

    this.logger.log(
      `Treatment ${p.treatmentId} restituito da accounting` +
        (p.returnedByEmail ? ` (operatore=${p.returnedByEmail})` : '') +
        `: ${p.reason}`,
    );
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async findTreatmentOrWarn(
    manager: EntityManager,
    treatmentId: string,
    event: CurandisEvent<unknown>,
  ): Promise<Treatment | null> {
    const treatment = await manager.findOne(Treatment, { where: { id: treatmentId } });
    if (!treatment) {
      this.logger.warn(
        `Treatment ${treatmentId} non trovato (event ${event.eventType} ${event.eventId}). ` +
          `Probabilmente cancellato lato clinico, ack senza azione.`,
      );
      return null;
    }
    return treatment;
  }

  /** Estrae treatmentId dal payload se presente (per indicizzazione processed_clinical_events). */
  private extractTreatmentId(event: CurandisEvent<unknown>): string | undefined {
    const payload = event.payload as { treatmentId?: string } | undefined;
    return payload?.treatmentId;
  }

  /** Estrae billableEventId dal payload se presente. */
  private extractBillableEventId(event: CurandisEvent<unknown>): string | undefined {
    const payload = event.payload as { billableEventId?: string } | undefined;
    return payload?.billableEventId;
  }

  private buildLogContext(event: CurandisEvent<unknown>, routingKey: string): string {
    const treatmentId = this.extractTreatmentId(event);
    const billableEventId = this.extractBillableEventId(event);
    return (
      `[evt=${event.eventType} id=${event.eventId} tenant=${event.tenantAlias} rk=${routingKey}` +
      (treatmentId ? ` t=${treatmentId}` : '') +
      (billableEventId ? ` b=${billableEventId}` : '') +
      `]`
    );
  }
}
