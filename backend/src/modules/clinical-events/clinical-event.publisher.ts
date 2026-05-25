import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import * as amqp from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';

import { ClinicalEventsConfig } from './clinical-events.config';
import { TenantSchemaContextService } from '../../database/tenant-schema-context.service';
import {
  ClinicalOutboundEventType,
  CurandisEvent,
} from './clinical-events.types';
import { PendingClinicalEvent } from './clinical-event-buffer.service';

/** Nome dell'event-bus event emesso dal buffer post-commit. */
export const CLINICAL_PUBLISH_PENDING_EVENT = 'clinical.publish-pending';

/**
 * Pubblica eventi del clinico su `ex.clinical.events` (topic, durable).
 *
 * Connection RabbitMQ DEDICATA (separata dal consumer registry): canali con
 * cicli di vita diversi (consume vs publish-confirm), `amqp-connection-manager`
 * riconnette singolarmente.
 *
 * Routing key: `<eventType>.<tenantAlias>` (es. `treatment.closed.bdq`).
 *
 * Headers AMQP:
 *   - x-correlation-id     : event.correlationId ?? event.eventId
 *   - x-tenant-alias       : event.tenantAlias
 *   - x-schema-version     : "1.0"
 *   - x-source-module      : "clinico"
 *
 * Properties AMQP:
 *   - persistent     : true (durable)
 *   - contentType    : application/json
 *   - messageId      : eventId (per dedup lato consumer)
 *   - timestamp      : epoch seconds
 *
 * USO:
 *   await publisher.publish({
 *     eventType: 'treatment.closed',
 *     payload: { ... },
 *   });
 *
 * `tenantAlias` è opzionale: se omesso viene letto da
 * `TenantSchemaContextService` (request HTTP attiva). Per CLI/cron passare
 * esplicitamente.
 *
 * Per Step 2 il publisher è "muto" — esposto come servizio injectable, ma
 * nessuno lo invoca. Hook reali su closeTreatment ecc. arrivano a Step 7,
 * dopo lo smoke test.
 *
 * Pattern publish-after-commit: NON pubblicare dentro una transazione (se
 * la tx fa rollback hai un fantasma). I caller HTTP devono usare il pattern
 * `tx.commit() → emit('tx.committed') → publisher.publish(...)` (cablato a
 * Step 7).
 */
@Injectable()
export class ClinicalEventPublisher implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ClinicalEventPublisher.name);
  private connection?: amqp.AmqpConnectionManager;
  private channelWrapper?: amqp.ChannelWrapper;
  private exchangeAsserted = false;

  constructor(
    private readonly config: ClinicalEventsConfig,
    private readonly tenantContext: TenantSchemaContextService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn('ClinicalEventPublisher disabilitato (RABBITMQ_ENABLED=false)');
      return;
    }

    this.connection = amqp.connect([this.config.url]);
    this.connection.on('connect', () => {
      this.logger.log(
        `Publisher connesso a RabbitMQ (${this.config.url.replace(/\/\/.*@/, '//***@')})`,
      );
    });
    this.connection.on('disconnect', ({ err }) => {
      this.logger.warn(`Publisher disconnesso: ${err?.message ?? 'unknown'}`);
      this.exchangeAsserted = false;
    });

    this.channelWrapper = this.connection.createChannel({
      json: false,
      // confirmSelect: il channel si mette in confirm mode automaticamente
      // perché useremo `publish` di amqp-connection-manager che ritorna
      // Promise<void> risolta solo dopo l'ack del broker.
      //
      // PublishTimeout: se broker giù al momento del publish, fail dopo
      // 10s invece di aspettare indefinitamente. Il messaggio resta
      // bufferizzato lato amqp-connection-manager finché la connection
      // non si ristabilisce (in-memory, perso al restart del backend —
      // accettabile per MVP, log `[OUTBOX-MISSING]` cattura il caso).
      publishTimeout: 10_000,
      setup: async (channel: ConfirmChannel) => {
        // L'exchange `ex.clinical.events` è dichiarato come "owned" dal
        // clinico (configure permission). Lo asseriamo idempotentemente
        // con i parametri standard; se già esiste con altri parametri,
        // RabbitMQ ritorna PRECONDITION_FAILED → si vedrà nei log.
        await channel.assertExchange(this.config.clinicalExchange, 'topic', {
          durable: true,
          autoDelete: false,
          internal: false,
        });
        this.exchangeAsserted = true;
        this.logger.log(
          `Setup canale publisher OK: exchange="${this.config.clinicalExchange}"`,
        );
      },
    });

    // ROBUSTEZZA AL BOOT (fix post-incident 2026-05-13):
    // NON aspettiamo `waitForConnect()` con await: se il broker è giù o
    // rifiuta auth, `waitForConnect()` resta pending per sempre (il
    // try/catch precedente NON aiutava — la Promise non viene mai
    // rejected, solo pending). Risultato: tutto `onApplicationBootstrap`
    // bloccato → NestJS non chiama mai `app.listen()` → backend mai sulla
    // porta 3000 → frontend in reload loop.
    //
    // Pattern fire-and-forget: il publisher resta in stato non-pronto
    // (`isReady() = false`), `amqp-connection-manager` continua a tentare
    // riconnessione in background. Quando il broker torna su, il publisher
    // si connette automaticamente. I publish chiamati prima della
    // connection vengono bufferizzati (in-memory) e flushati al primo
    // connect; se backend muore prima, log `[OUTBOX-MISSING]` lo cattura.
    this.channelWrapper.waitForConnect()
      .then(() => {
        this.logger.log('Publisher channel ready (waitForConnect resolved)');
      })
      .catch((err) => {
        this.logger.error(
          `Connection iniziale RabbitMQ fallita (non-bloccante): ${(err as Error).message}. ` +
            `Riprovo in background. Publish chiamati nel frattempo restano in coda.`,
        );
      });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channelWrapper?.close();
      await this.connection?.close();
      this.logger.log('Publisher chiuso');
    } catch (err) {
      this.logger.warn(`Errore chiusura publisher: ${(err as Error).message}`);
    }
  }

  /**
   * Pubblica un evento clinico su `ex.clinical.events`.
   *
   * @throws Error se il publisher è disabilitato e l'evento non è opzionale,
   *               o se il broker non risponde con ack entro il timeout di
   *               `amqp-connection-manager` (default ~60s).
   */
  async publish<P>(input: {
    eventType: ClinicalOutboundEventType;
    payload: P;
    tenantAlias?: string;
    correlationId?: string;
  }): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn(
        `publish() chiamato con RABBITMQ_ENABLED=false: evento "${input.eventType}" droppato`,
      );
      return;
    }

    const tenantAlias = this.resolveTenantAlias(input.tenantAlias);
    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();
    const routingKey = `${input.eventType}.${tenantAlias}`;

    const event: CurandisEvent<P> = {
      schemaVersion: '1.0',
      eventId,
      occurredAt,
      eventType: input.eventType,
      tenantAlias,
      correlationId: input.correlationId,
      producerVersion: this.config.producerVersion,
      payload: input.payload,
    };

    const body = Buffer.from(JSON.stringify(event), 'utf8');

    if (!this.channelWrapper) {
      throw new Error(
        'ClinicalEventPublisher non inizializzato (channelWrapper assente). ' +
          'Verifica che onApplicationBootstrap sia stato eseguito.',
      );
    }

    try {
      await this.channelWrapper.publish(
        this.config.clinicalExchange,
        routingKey,
        body,
        {
          persistent: true,
          contentType: 'application/json',
          messageId: eventId,
          timestamp: Math.floor(Date.now() / 1000),
          headers: {
            'x-correlation-id': event.correlationId ?? eventId,
            'x-tenant-alias': tenantAlias,
            'x-schema-version': '1.0',
            'x-source-module': 'clinico',
          },
        },
      );
      this.logger.debug(
        `Publish OK eventType="${input.eventType}" routingKey="${routingKey}" eventId="${eventId}"`,
      );
    } catch (err) {
      this.logger.error(
        `Publish FALLITO eventType="${input.eventType}" routingKey="${routingKey}": ` +
          `${(err as Error).message}`,
      );
      throw err;
    }
  }

  /**
   * Risolve il tenantAlias per il payload. Precedenza:
   *   1. parametro esplicito (smoke test, bootstrap CLI)
   *   2. TenantSchemaContextService (request HTTP attiva)
   *   3. errore
   */
  private resolveTenantAlias(explicit?: string): string {
    if (explicit) return explicit;
    const fromContext = this.tenantContext.getTenantAlias();
    if (fromContext) return fromContext;
    throw new Error(
      'tenantAlias non risolvibile: nessun parametro esplicito e nessun ' +
        'contesto HTTP attivo. Per chiamate da CLI/cron passa tenantAlias esplicito.',
    );
  }

  /**
   * Per smoke test / debug: indica se il channel è pronto a pubblicare.
   */
  isReady(): boolean {
    return this.config.enabled && this.exchangeAsserted && !!this.channelWrapper;
  }

  /**
   * Listener post-commit del pattern publish-after-commit.
   *
   * Il `ClinicalEventBuffer` accumula eventi dentro la transazione DB e li
   * emette uno-per-uno su `CLINICAL_PUBLISH_PENDING_EVENT` SOLO dopo il
   * commit OK (vedi `flushBufferedEvents` di `clinical-event-buffer.helpers`).
   *
   * Errori qui NON vengono propagati al chiamante (la transazione DB è già
   * committata; un publish fallito significa solo che broker non ha
   * ricevuto l'evento). MVP: log strutturato `[OUTBOX-MISSING]` con
   * eventId/correlationId/treatmentId per investigation post-incident.
   * Outbox pattern resiliente è roadmap post-MVP (vedi spec §11 nota outbox).
   */
  @OnEvent(CLINICAL_PUBLISH_PENDING_EVENT)
  async handlePublishPending(event: PendingClinicalEvent): Promise<void> {
    // Generiamo l'eventId qui (e non dentro publish()) per averlo nei log
    // di outbox-missing anche quando il publish fallisce.
    // Eccezione: se il caller ha passato un eventId esplicito (vedi
    // PendingClinicalEvent.eventId, es. recall-requested), usiamo quello
    // così il valore salvato lato clinico coincide con quello che accounting
    // riceve nell'envelope.
    const eventId = event.eventId ?? randomUUID();
    const treatmentId =
      (event.payload as { treatmentId?: string } | null)?.treatmentId ?? '-';

    try {
      await this.publishWithEventId(eventId, event);
    } catch (err) {
      this.logger.error(
        `[OUTBOX-MISSING] eventType=${event.eventType} eventId=${eventId} ` +
          `correlationId=${event.correlationId ?? '-'} treatmentId=${treatmentId} ` +
          `tenant=${event.tenantAlias} err="${(err as Error).message}"`,
      );
      // NON re-throw: il flusso di business (es. closeTreatment) è già
      // committato. Outbox manuale: ops.
    }
  }

  /**
   * Variante interna di publish() che accetta un eventId pre-generato dal
   * caller. Usata da `handlePublishPending` per garantire che l'eventId
   * loggato (sia in `[OUTBOX-MISSING]` su error, sia nei log debug su
   * successo) coincida con quello effettivamente inviato al broker come
   * AMQP messageId.
   */
  private async publishWithEventId<P>(
    eventId: string,
    input: {
      eventType: ClinicalOutboundEventType;
      payload: P;
      tenantAlias: string;
      correlationId?: string;
    },
  ): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn(
        `publishWithEventId() chiamato con RABBITMQ_ENABLED=false: evento "${input.eventType}" droppato`,
      );
      return;
    }

    const occurredAt = new Date().toISOString();
    const routingKey = `${input.eventType}.${input.tenantAlias}`;

    const event: CurandisEvent<P> = {
      schemaVersion: '1.0',
      eventId,
      occurredAt,
      eventType: input.eventType,
      tenantAlias: input.tenantAlias,
      correlationId: input.correlationId,
      producerVersion: this.config.producerVersion,
      payload: input.payload,
    };

    const body = Buffer.from(JSON.stringify(event), 'utf8');

    if (!this.channelWrapper) {
      throw new Error(
        'ClinicalEventPublisher non inizializzato (channelWrapper assente).',
      );
    }

    await this.channelWrapper.publish(
      this.config.clinicalExchange,
      routingKey,
      body,
      {
        persistent: true,
        contentType: 'application/json',
        messageId: eventId,
        timestamp: Math.floor(Date.now() / 1000),
        headers: {
          'x-correlation-id': event.correlationId ?? eventId,
          'x-tenant-alias': input.tenantAlias,
          'x-schema-version': '1.0',
          'x-source-module': 'clinico',
        },
      },
    );

    this.logger.debug(
      `Publish OK eventType="${input.eventType}" routingKey="${routingKey}" eventId="${eventId}"`,
    );
  }
}
