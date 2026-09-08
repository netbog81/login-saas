import { AsyncLocalStorage } from 'async_hooks';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import * as amqp from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';

import {
  TenantContextService,
  TenantDataSourceManager,
} from '@curandis/tenant-datasource';
import { ClinicalEventsConfig } from './clinical-events.config';
import { ProcessedClinicalEvent } from './processed-clinical-event.entity';
import { Treatment } from '../availability/entities/treatment.entity';
import { PaymentMethod } from '../availability/entities/treatment-enums';
import { TreatmentBillingStatus } from '../availability/entities/treatment-billing-status.enum';
import { EventsService, CalendarEvent } from '../events/events.service';
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
  BillablePaymentRecordedPayload,
  BillablePaymentReversedPayload,
  BillableInvoiceBlockedPayload,
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
 *   2. Risoluzione DataSource tenant via TenantDataSourceManager (legge
 *      kv/tenant-clinico-db/<alias> + static-cred postgres-clinico_*_svc).
 *      Tenant non configurato → reject DLQ + warn.
 *   3. `tenantContext.run({ dataSource, tenantAlias, ... }, async () =>`
 *      ds.transaction:
 *        a) INSERT INTO processed_clinical_events ON CONFLICT DO NOTHING
 *        b) Se conflict (riga già esiste) → ack senza azione
 *        c) Altrimenti → handler-specifico (`UPDATE treatments ...`)
 *
 * ERRORI:
 *   - permanenti (parse, tenant non onboarded/suspended, eventType non gestito):
 *     `nack(msg, false, false)` → DLQ.
 *   - transitori (DB giù, OpenBao giù): `nack(msg, false, true)` → requeue.
 *
 * LOGGING: per ogni evento ricevuto: eventId, eventType, tenantAlias,
 * treatmentId (se presente), billableEventId (se presente).
 */
/**
 * Convenzione cross-modulo per consumer S2S: prefisso `system:` + nome consumer.
 * Aiuta il grep nei log audit (es. `system:registry-consumer`,
 * `system:gdpr-consumer`). Valore SOLO per popolare `TenantContextData.userId`,
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
    'billable.payment-recorded.*',
    'billable.payment-reversed.*',
    'billable.invoice-blocked.*',
  ];

  constructor(
    private readonly config: ClinicalEventsConfig,
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Sessione 7 — Emette SSE `treatment_status_changed` per notificare i
   * client UI aperti del cambio billingStatus / campi accounting. Chiamato
   * da tutti gli handler dopo `manager.save(Treatment, ...)`. Il payload
   * minimo (treatmentId + newStatus) è sufficiente perché il frontend
   * faccia un refetch mirato del singolo treatment.
   */
  /**
   * Notifiche SSE accumulate durante la transazione, emesse SOLO dopo il
   * commit.
   *
   * 2026-09-02 — Prima venivano emesse dentro la transazione, subito dopo il
   * `save()`. Il browser le riceveva e rileggeva il trattamento da un'altra
   * connessione, che la riga aggiornata non la vedeva ancora: si ritrovava
   * lo stato VECCHIO e restava lì, perché altri eventi non ne arrivavano.
   * L'interfaccia mostrava "Invio in corso…" e non faceva comparire
   * "Incassa" su una fattura già emessa.
   *
   * Era una corsa fra due tempi che il commit di solito vinceva. Ha smesso
   * di vincerla quando l'outbox transazionale ha aggiunto una INSERT prima
   * del commit: da 6-12ms a 30ms, abbastanza da far arrivare prima la
   * richiesta del browser. La causa vera però è l'ordine, non la latenza:
   * una notifica "il dato è cambiato" non va mandata prima che il dato sia
   * visibile a chi la riceve.
   */
  private readonly pendingSse = new AsyncLocalStorage<CalendarEvent[]>();

  private emitTreatmentChanged(treatment: Treatment): void {
    const event: CalendarEvent = {
      type: 'treatment_status_changed',
      treatmentId: treatment.id,
      operatorId: treatment.operatorId,
      newStatus: treatment.billingStatus,
      timestamp: new Date(),
    };
    const pending = this.pendingSse.getStore();
    if (pending) {
      pending.push(event);
      return;
    }
    // Fuori da una transazione gestita: nessuna attesa da rispettare.
    this.eventsService.emit(event);
  }

  /** Emette le notifiche accumulate. Da chiamare DOPO il commit. */
  private flushPendingSse(pending: CalendarEvent[]): void {
    for (const event of pending) this.eventsService.emit(event);
  }

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

    // 2) Risolve il DataSource del tenant via @curandis/tenant-datasource.
    // La lib internamente legge kv/tenant-clinico-db/<alias> + static-cred
    // postgres-clinico_<alias>_svc e ritorna un DataSource cached per pool.
    // - 404 KV → "Tenant not configured" (permanente, DLQ)
    // - errore connessione (DB / OpenBao) → transitorio, requeue
    let ds: import('typeorm').DataSource;
    try {
      ds = await this.tenantDsManager.getDataSource(event.tenantAlias);
    } catch (err) {
      const message = (err as Error).message;
      const isPermanent = /not configured|status.*suspended|status.*deleted/i.test(message);
      if (isPermanent) {
        this.logger.warn(`${logCtx} tenant non risolvibile (${message}). DLQ.`);
        channel.nack(msg, false, false);
      } else {
        this.logger.error(`${logCtx} errore resolve tenant (transitorio): ${message}. Requeue.`);
        channel.nack(msg, false, true);
      }
      return;
    }

    // 3) Eventuale early-skip su eventType sconosciuto: DLQ (caso permanente).
    if (!this.isHandledEventType(event.eventType)) {
      this.logger.warn(`${logCtx} eventType non gestito. DLQ.`);
      channel.nack(msg, false, false);
      return;
    }

    // 4) Run dentro contesto tenant (DataSource per-tenant) + transazione.
    try {
      await new Promise<void>((resolve, reject) => {
        this.tenantContext.run(
          {
            dataSource: ds,
            tenantAlias: event!.tenantAlias,
            dbName: (ds.options as { database?: string }).database || '',
            userId: SYSTEM_USER_ID,
            requestId: event!.eventId,
          },
          () => {
            // Le notifiche SSE si accumulano qui e partono solo a commit
            // avvenuto: vedi `pendingSse`.
            const pendingSse: CalendarEvent[] = [];
            this.pendingSse.run(pendingSse, () => {
            ds
              .transaction(async (manager) => {
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
              })
              .then(() => {
                // Commit avvenuto: ora il dato è visibile a chi rileggerà.
                this.flushPendingSse(pendingSse);
                resolve();
              })
              .catch((err) => reject(err));
            });
          },
        );
      });

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
      eventType === 'billable.returned-to-clinical' ||
      eventType === 'billable.payment-recorded' ||
      eventType === 'billable.payment-reversed' ||
      eventType === 'billable.invoice-blocked'
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
      case 'billable.payment-recorded':
        return this.handleBillablePaymentRecorded(
          event as CurandisEvent<BillablePaymentRecordedPayload>,
          manager,
        );
      case 'billable.payment-reversed':
        return this.handleBillablePaymentReversed(
          event as CurandisEvent<BillablePaymentReversedPayload>,
          manager,
        );
      case 'billable.invoice-blocked':
        return this.handleBillableInvoiceBlocked(
          event as CurandisEvent<BillableInvoiceBlockedPayload>,
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

    // 2026-09-04 — Non retrocedere un trattamento già fatturato.
    //
    // `billable.received` dice "la prestazione è arrivata in contabilità", ed
    // è normalmente il primo evento del ciclo. Ma l'ordine di arrivo non è
    // garantito: una prestazione coperta per intero da un voucher "anticipo
    // fattura" nasce già fatturata, e il suo `billable.invoiced` può
    // precedere il received. Applicandolo alla lettera, il trattamento
    // tornava PENDING e ricompariva fra quelli da fatturare pur avendo già
    // numero fattura e incasso (verificato su bdq: trattamento fatturato
    // sull'anticipo 3650, rimasto PENDING).
    //
    // Il controllo è sullo STESSO billable: un id diverso significa che la
    // prestazione è stata rimandata in contabilità dopo un richiamo, e lì il
    // ritorno a PENDING è corretto.
    const sameBillable = treatment.accountingBillableEventId === billableEventId;
    if (sameBillable && treatment.billingStatus === TreatmentBillingStatus.INVOICED) {
      this.logger.log(
        `billable.received per ${treatmentId} già fatturato sullo stesso billable `
          + `${billableEventId}: stato INVOICED conservato (evento fuori ordine).`,
      );
      return;
    }

    treatment.billingStatus = TreatmentBillingStatus.PENDING;
    treatment.accountingBillableEventId = billableEventId;
    await manager.save(Treatment, treatment);
    this.emitTreatmentChanged(treatment);
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
    //
    // 2026-07-08 — membership: con più billable per treatment (una riga
    // documento per servizio) il billable "primario" del payload può non
    // coincidere con quello memorizzato da billable.received. Se il payload
    // porta `billableEventIds`, basta che quello memorizzato appartenga
    // all'insieme. Fallback sull'uguaglianza per producer vecchi.
    const knownBillableIds =
      p.billableEventIds && p.billableEventIds.length > 0
        ? p.billableEventIds
        : [p.billableEventId];
    if (
      treatment.accountingBillableEventId &&
      !knownBillableIds.includes(treatment.accountingBillableEventId)
    ) {
      this.logger.warn(
        `billable.invoiced stale: treatment.accountingBillableEventId=` +
          `${treatment.accountingBillableEventId} ∉ payload=[${knownBillableIds.join(', ')}]. Skip.`,
      );
      return;
    }

    // 2026-09-03 — Documento ESTERNO: la prestazione è stata scalata da un
    // voucher "anticipo fattura" che fa capo a una fattura del gestionale
    // precedente. È fatturata a tutti gli effetti, ma non esiste un
    // SalesDocument da cui tirare il PDF: `accountingDocumentId` resta NULL e
    // il riferimento vive nei due campi dedicati. La UI se ne accorge da lì e
    // nasconde la stampa invece di offrire un bottone che fallirebbe.
    const external = p.externalDocumentRef;

    treatment.billingStatus = TreatmentBillingStatus.INVOICED;
    treatment.accountingBillableEventId = p.billableEventId;
    treatment.accountingDocumentId = (p.documentId ?? null) as any;
    treatment.accountingExternalRefNumber = (external?.number ?? null) as any;
    treatment.accountingExternalRefDate = (external?.date?.slice(0, 10) ?? null) as any;
    treatment.accountingDocumentType = p.documentType;
    treatment.accountingInvoiceUrl = p.documentUrl ?? undefined;
    treatment.accountingInvoiceIssuedAt = new Date(p.issuedAt);
    treatment.patientInvoiceNumber = p.invoiceNumber;
    treatment.isInvoicedToPatient = true;
    treatment.invoicedToPatientAt = new Date(p.issuedAt);
    // Totale REALE confermato da accounting (marca da bollo INCLUSA). Il clinico
    // lo salva e lo mostra; sul totale confermato si registra poi l'incasso.
    // Invariante: accountingTotalAmount non-null ⟺ esiste un documento accounting
    // corrente. Se l'evento non porta il totale, azzeriamo (fallback su price)
    // invece di lasciare in piedi quello della fattura precedente.
    treatment.accountingTotalAmount =
      p.totalAmount != null ? Number(p.totalAmount) : (null as any);
    // 2026-07-08 — Fatture multi-trattamento: quota di questo treatment nel
    // documento + numero di treatment coperti (campi additivi, null da
    // producer vecchi). Stesso invariante di accountingTotalAmount.
    treatment.accountingTreatmentLinesAmount =
      p.treatmentLinesAmount != null
        ? Number(p.treatmentLinesAmount)
        : (null as any);
    treatment.accountingDocumentTreatmentCount =
      p.documentTreatmentCount ?? (null as any);
    // 2026-09-04 — Quota coperta da un anticipo: sta FUORI dal documento
    // corrente, e senza di essa il valore della prestazione si confondeva col
    // totale del residuo. Stesso invariante degli altri campi accounting:
    // se l'evento non la porta, si azzera invece di lasciare in piedi quella
    // di un documento precedente.
    treatment.accountingAdvanceCoveredAmount =
      p.advanceCoveredAmount != null && Number(p.advanceCoveredAmount) > 0
        ? Number(p.advanceCoveredAmount)
        : (null as any);
    // L'emissione è andata a buon fine → azzera l'eventuale motivo di blocco
    // (es. era bloccato per indirizzo mancante, ora risolto e fatturato).
    treatment.billingHoldReason = undefined;
    treatment.billingHoldReasonCode = undefined;
    treatment.billingHoldReasonAt = undefined;
    await manager.save(Treatment, treatment);
    this.emitTreatmentChanged(treatment);
  }

  /**
   * 2026-06-30 — `billable.invoice-blocked`: l'auto-emissione fattura è
   * bloccata da una causa risolvibile (indirizzo paziente mancante, P.IVA
   * mancante, mapping pending). Salva il motivo reale sul treatment e notifica
   * via SSE, così la UI mostra il banner + pulsante "Verifica risoluzione e
   * riprova". billingStatus resta invariato (PENDING): la fattura NON è stata
   * emessa.
   */
  private async handleBillableInvoiceBlocked(
    event: CurandisEvent<BillableInvoiceBlockedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    if (!p.treatmentId) {
      this.logger.debug(`billable.invoice-blocked senza treatmentId (sale): ack senza update`);
      return;
    }

    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    treatment.billingHoldReasonCode = p.reasonCode;
    treatment.billingHoldReason = p.reasonMessage;
    treatment.billingHoldReasonAt = new Date(p.blockedAt);
    await manager.save(Treatment, treatment);
    this.emitTreatmentChanged(treatment);
    this.logger.log(
      `Treatment ${p.treatmentId} fattura bloccata (reason=${p.reasonCode}, ` +
        `tentativi=${p.retriesAttempted}): "${p.reasonMessage}"`,
    );
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
    treatment.accountingDocumentId = null as any;
    // Anche il riferimento esterno se ne va: la prestazione non è più
    // fatturata da nessuna parte.
    treatment.accountingExternalRefNumber = null as any;
    treatment.accountingExternalRefDate = null as any;
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
    // La fattura non esiste più: il totale con bollo che ne derivava è stale.
    // Va azzerato o la UI continuerebbe a mostrarlo (icona "totale fattura") e
    // a proporre l'incasso su un importo di un documento cancellato.
    treatment.accountingTotalAmount = null as any;
    treatment.accountingTreatmentLinesAmount = null as any;
    treatment.accountingDocumentTreatmentCount = null as any;
    // 2026-09-02 — Via anche l'eventuale "richiamo rifiutato". Quei rifiuti
    // dicono sempre la stessa cosa ("esiste già la fattura N: annullala
    // prima"), e questo evento è proprio la notizia che il documento è stato
    // annullato: tenerlo a video lascia in pagina un allarme rosso che
    // chiede di fare una cosa già fatta.
    treatment.lastRecallRejectionMessage = null as any;
    treatment.lastRecallRejectionAt = null as any;
    await manager.save(Treatment, treatment);
    this.emitTreatmentChanged(treatment);
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
    this.emitTreatmentChanged(treatment);
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
    this.emitTreatmentChanged(treatment);
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
    this.emitTreatmentChanged(treatment);
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
    this.emitTreatmentChanged(treatment);
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
    // Coerenza con reopen(): il richiamo smarca anche "pronto per
    // fatturazione", così CTA "Invia" e filtri lista non lo vedono più
    // come pronto/inviato.
    treatment.readyForBilling = false;
    treatment.readyForBillingAt = null as any;
    treatment.accountingBillableEventId = null as any;
    treatment.accountingDocumentId = null as any;
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
    // Documento cancellato lato accounting: il totale con bollo è stale.
    treatment.accountingTotalAmount = null as any;
    treatment.accountingTreatmentLinesAmount = null as any;
    treatment.accountingDocumentTreatmentCount = null as any;

    // Chiudo il recall in volo + pulisco eventuale rejection precedente.
    treatment.recallRequestId = null as any;
    treatment.recallRequestedAt = null as any;
    treatment.lastRecallRejectionMessage = null as any;
    treatment.lastRecallRejectionAt = null as any;

    await manager.save(Treatment, treatment);
    this.emitTreatmentChanged(treatment);

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
    this.emitTreatmentChanged(treatment);

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
    treatment.readyForBilling = false;
    treatment.readyForBillingAt = null as any;
    treatment.accountingBillableEventId = null as any;
    treatment.accountingDocumentId = null as any;
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
    // Documento cancellato lato accounting: il totale con bollo è stale.
    treatment.accountingTotalAmount = null as any;
    treatment.accountingTreatmentLinesAmount = null as any;
    treatment.accountingDocumentTreatmentCount = null as any;

    treatment.returnedFromAccountingReason = p.reason;
    treatment.returnedFromAccountingAt = new Date(p.returnedAt);
    treatment.returnedFromAccountingByEmail = p.returnedByEmail ?? undefined;
    treatment.returnedFromAccountingDismissedAt = null as any; // riapre se era stato dismissato

    // Se per qualche motivo c'era un recall in volo, lo chiudiamo
    // (returned-to-clinical raggiunge l'effetto desiderato del recall).
    treatment.recallRequestId = null as any;
    treatment.recallRequestedAt = null as any;
    // 2026-09-02 — E con lui l'esito dei tentativi precedenti: la
    // restituzione ottiene ciò che il richiamo non era riuscito a ottenere,
    // quindi un "richiamo rifiutato" a video sarebbe una risposta a una
    // domanda che non si pone più. Stesso discorso per l'annullamento
    // dell'invio: descrive un giro precedente, e qui il trattamento torna
    // indietro pulito come dopo `billable.received`.
    treatment.lastRecallRejectionMessage = null as any;
    treatment.lastRecallRejectionAt = null as any;
    treatment.cancelledAt = null as any;
    treatment.cancelledByUserId = null as any;
    treatment.cancellationReason = null as any;

    await manager.save(Treatment, treatment);
    this.emitTreatmentChanged(treatment);

    this.logger.log(
      `Treatment ${p.treatmentId} restituito da accounting` +
        (p.returnedByEmail ? ` (operatore=${p.returnedByEmail})` : '') +
        `: ${p.reason}`,
    );
  }

  /**
   * Incasso registrato lato accounting → propaga al clinico (isPaid).
   *
   * Idempotenza first-write-wins: applichiamo l'UPDATE solo se isPaid è ancora
   * false (row lock Postgres). Se l'incasso era già stato registrato nel clinico
   * (o da un evento precedente), l'UPDATE non tocca righe e scartiamo senza errore.
   */
  private async handleBillablePaymentRecorded(
    event: CurandisEvent<BillablePaymentRecordedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    if (!p.treatmentId) {
      this.logger.debug(
        `billable.payment-recorded senza treatmentId (sale standalone): ack senza update`,
      );
      return;
    }

    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    // Anti-stale: se il treatment è legato a un billable diverso, l'evento è
    // riferito a un billable obsoleto (es. recall ha azzerato il riferimento).
    if (
      treatment.accountingBillableEventId &&
      p.billableEventId &&
      treatment.accountingBillableEventId !== p.billableEventId
    ) {
      this.logger.warn(
        `billable.payment-recorded stale: treatment.accountingBillableEventId=` +
          `${treatment.accountingBillableEventId} ≠ payload=${p.billableEventId}. Skip.`,
      );
      return;
    }

    const res = await manager
      .createQueryBuilder()
      .update(Treatment)
      .set({
        isPaid: true,
        paymentId: p.paymentId,
        paymentRecordedSource: 'accounting',
        paymentMethod: this.mapAccountingPaymentMethod(p.paymentMethod),
        paidAt: new Date(p.paidAt),
        // 2026-09-04 — Se l'incasso è la copertura di un voucher "anticipo
        // fattura", il metodo da solo non dice niente: 'voucher' non esiste
        // fra i cinque metodi del clinico e finisce in "altro". La riga di
        // tender porta il nome del buono, e il dettaglio pagamento mostra
        // quella invece di una parola generica.
        ...(p.voucherCode
          ? {
              paymentTenderLines: [
                {
                  kind: 'voucher',
                  voucherId: p.voucherId ?? null,
                  amount: p.amount,
                  label: `Voucher anticipo fattura n. ${p.voucherCode}`,
                },
              ],
            }
          : {}),
      })
      .where('id = :id AND "isPaid" = false', { id: p.treatmentId })
      .returning('id')
      .execute();

    if (!res.raw || res.raw.length === 0) {
      this.logger.debug(
        `billable.payment-recorded: incasso già registrato per ${p.treatmentId} ` +
          `(first-write-wins), skip.`,
      );
      return;
    }

    // Re-fetch per SSE coerente.
    const fresh = await manager.getRepository(Treatment).findOne({ where: { id: p.treatmentId } });
    if (fresh) this.emitTreatmentChanged(fresh);
    this.logger.log(`Incasso registrato da accounting su treatment ${p.treatmentId}.`);
  }

  /**
   * 2026-07-03 — `billable.payment-reversed`: un incasso è stato cancellato in
   * accounting. Reset di isPaid SOLO se il paymentId sul treatment combacia
   * con l'allocazione stornata (o col pagamento clinico che l'aveva
   * originata), oppure se il treatment non ha un paymentId tracciato (dati
   * legacy). Un pagamento diverso da quello stornato non si tocca.
   */
  private async handleBillablePaymentReversed(
    event: CurandisEvent<BillablePaymentReversedPayload>,
    manager: EntityManager,
  ): Promise<void> {
    const p = event.payload;
    if (!p.treatmentId) {
      this.logger.debug(
        `billable.payment-reversed senza treatmentId (sale standalone): ack senza update`,
      );
      return;
    }

    const treatment = await this.findTreatmentOrWarn(manager, p.treatmentId, event);
    if (!treatment) return;

    const ids = [p.paymentId, p.sourcePaymentId].filter((v): v is string => !!v);
    const res = await manager
      .createQueryBuilder()
      .update(Treatment)
      .set({
        isPaid: false,
        paymentId: null,
        paymentRecordedSource: null,
        paymentMethod: null,
        paidAt: null,
        collectedBy: null,
      })
      .where('id = :id AND "isPaid" = true', { id: p.treatmentId })
      .andWhere('("paymentId" IS NULL OR "paymentId" IN (:...ids))', { ids })
      .returning('id')
      .execute();

    if (!res.raw || res.raw.length === 0) {
      this.logger.debug(
        `billable.payment-reversed per ${p.treatmentId}: nessun reset ` +
          `(non pagato o pagamento diverso da quello stornato), skip.`,
      );
      return;
    }

    const fresh = await manager.getRepository(Treatment).findOne({ where: { id: p.treatmentId } });
    if (fresh) this.emitTreatmentChanged(fresh);
    this.logger.log(
      `Incasso STORNATO da accounting su treatment ${p.treatmentId}` +
        (p.reason ? ` (${p.reason})` : '') + '.',
    );
  }

  /**
   * Mappa il code metodo accounting sull'enum PaymentMethod clinico in modo
   * difensivo. I code accounting sono configurabili per tenant: se non
   * riconosciuto, fallback OTHER (l'importante è isPaid; il metodo è indicativo).
   */
  private mapAccountingPaymentMethod(code?: string | null): PaymentMethod {
    if (!code) return PaymentMethod.OTHER;
    const c = code.toUpperCase();
    if (c.includes('CASH') || c.includes('CONTANT')) return PaymentMethod.CASH;
    if (c.includes('CARD') || c.includes('BANCOMAT') || c.includes('POS')) return PaymentMethod.CARD;
    if (c.includes('TRANSFER') || c.includes('BONIFIC')) return PaymentMethod.TRANSFER;
    if (c.includes('SATISPAY')) return PaymentMethod.SATISPAY;
    return PaymentMethod.OTHER;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async findTreatmentOrWarn(
    manager: EntityManager,
    treatmentId: string,
    event: CurandisEvent<unknown>,
  ): Promise<Treatment | null> {
    // 2026-09-04 — Lock sulla riga: gli eventi dello STESSO trattamento vanno
    // applicati uno alla volta.
    //
    // I tre eventi di una prestazione coperta da anticipo (`invoiced`,
    // `payment-recorded`, `received`) arrivano insieme e il consumer li
    // processa in parallelo, ognuno nella sua transazione. Senza lock ognuno
    // legge il trattamento com'era PRIMA che gli altri committassero, e
    // l'ultimo a scrivere cancella il lavoro degli altri: su bdq il
    // `received` ha riportato a PENDING un trattamento che l'`invoiced`
    // aveva appena marcato fatturato, 0,2 millisecondi prima. Le guardie
    // "non retrocedere" c'erano già: leggevano solo uno stato vecchio.
    //
    // Il lock è su una riga sola e sempre la stessa: non introduce ordini di
    // acquisizione incrociati, quindi niente deadlock.
    const treatment = await manager.findOne(Treatment, {
      where: { id: treatmentId },
      lock: { mode: 'pessimistic_write' },
    });
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
    const id = payload?.billableEventId;
    // Difensivo: accounting storicamente inviava '' su billable.payment-recorded
    // ("non rilevante"); '' non è un uuid valido e faceva fallire l'INSERT di
    // idempotenza (colonna uuid) mandando l'evento in DLQ. Normalizza a undefined
    // qualsiasi valore che non sia un uuid.
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return undefined;
    }
    return id;
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
