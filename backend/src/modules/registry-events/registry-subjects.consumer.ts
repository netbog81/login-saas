import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';

import {
  TenantContextService,
  TenantDataSourceManager,
} from '@curandis/tenant-datasource';
import { RegistryEventsConfig } from './registry-events.config';
import { RegistryEvent, SubjectEventPayload } from './registry-events.types';
import { ProcessedRegistryEvent } from './processed-event.entity';
import { ClinicalSubjectIndexService } from '../../patients/services/clinical-subject-index.service';

/**
 * Consumer RabbitMQ del registry. Si connette al broker condiviso, ascolta
 * gli eventi `subject.*.*` (tutti i tenant) e mantiene aggiornata la cache
 * locale `clinical_subject_index`:
 *
 * - subject.updated.<tenant>     → marca stale=true (refresh al prossimo accesso utente)
 * - subject.deactivated.<tenant> → marca stale=true, is_active=false
 * - subject.reactivated.<tenant> → marca stale=true, is_active=true
 * - subject.created.<tenant>     → no-op (la cache si popola lazy al primo lookup)
 *
 * Idempotency: ogni eventId è tracciato in processed_registry_events.
 * Il duplicato viene skippato all'INSERT (ON CONFLICT DO NOTHING).
 *
 * Per gli eventi relationship.* nessuna logica per ora; vengono solo loggati
 * (binding `subject.*.*` non li cattura, sono qui per estensione futura).
 */
@Injectable()
export class RegistrySubjectsConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RegistrySubjectsConsumer.name);
  private connection?: amqp.AmqpConnectionManager;
  private channelWrapper?: amqp.ChannelWrapper;

  constructor(
    private readonly config: RegistryEventsConfig,
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
    private readonly indexService: ClinicalSubjectIndexService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn('Consumer registry events disabilitato (RABBITMQ_ENABLED=false)');
      return;
    }

    this.connection = amqp.connect([this.config.url]);
    this.connection.on('connect', () => {
      this.logger.log(`Connesso a RabbitMQ (${this.config.url.replace(/\/\/.*@/, '//***@')})`);
    });
    this.connection.on('disconnect', ({ err }) => {
      this.logger.warn(`Disconnesso da RabbitMQ: ${err?.message ?? 'unknown'}`);
    });

    this.channelWrapper = this.connection.createChannel({
      json: false,
      setup: async (channel: ConfirmChannel) => {
        // L'exchange ex.registry.events è di proprietà del registry: il clinico
        // ha permesso solo di leggerlo, non di dichiararlo. Saltiamo
        // assertExchange e ci affidiamo all'esistenza dell'exchange (creato
        // dal registry al boot). Se manca, bindQueue fallirà con 404 e il
        // consumer si riconnetterà finché non sarà disponibile.
        await channel.assertQueue(this.config.queue, { durable: true });
        await channel.bindQueue(
          this.config.queue,
          this.config.exchange,
          this.config.bindingPattern,
        );
        await channel.prefetch(this.config.prefetch);
        await channel.consume(this.config.queue, (msg) => this.handleMessage(channel, msg));
        this.logger.log(
          `Setup canale OK: queue="${this.config.queue}" bind="${this.config.bindingPattern}" prefetch=${this.config.prefetch}`,
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

  private async handleMessage(channel: ConfirmChannel, msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;
    const routingKey = msg.fields.routingKey;
    let event: RegistryEvent<SubjectEventPayload> | null = null;
    try {
      event = JSON.parse(msg.content.toString()) as RegistryEvent<SubjectEventPayload>;
    } catch (err) {
      this.logger.error(
        `Payload JSON malformato (routingKey=${routingKey}): ${(err as Error).message}. Drop senza requeue.`,
      );
      channel.nack(msg, false, false);
      return;
    }

    // Risolve il DataSource del tenant dal pool. Tenant non onboarded → DLQ.
    let ds: import('typeorm').DataSource;
    try {
      ds = await this.tenantDsManager.getDataSource(event.tenantAlias);
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(
        `Tenant non risolvibile alias="${event.tenantAlias}" (${message}). DLQ.`,
      );
      channel.nack(msg, false, false);
      return;
    }

    try {
      const processedRepo = ds.getRepository(ProcessedRegistryEvent);

      // Idempotency: INSERT ON CONFLICT DO NOTHING.
      const inserted = await processedRepo
        .createQueryBuilder()
        .insert()
        .into(ProcessedRegistryEvent)
        .values({
          eventId: event.eventId,
          eventType: event.eventType,
          subjectId: event.payload?.subjectId,
          tenantAlias: event.tenantAlias,
        })
        .orIgnore()
        .execute();
      const isDuplicate = (inserted.identifiers || []).length === 0;
      if (isDuplicate) {
        this.logger.debug(`Evento duplicato eventId=${event.eventId} (skip)`);
        channel.ack(msg);
        return;
      }

      // Run il dispatch dentro AsyncLocalStorage del tenant context così
      // l'indexService (e altri service downstream) trovano il DataSource giusto.
      await new Promise<void>((resolve, reject) => {
        this.tenantContext.run(
          {
            dataSource: ds,
            tenantAlias: event!.tenantAlias,
            dbName: (ds.options as { database?: string }).database || '',
            requestId: event!.eventId,
          },
          () => {
            this.dispatch(event!, routingKey)
              .then(() => resolve())
              .catch((err) => reject(err));
          },
        );
      });
      channel.ack(msg);
    } catch (err) {
      this.logger.error(
        `Handler fallito eventId=${event.eventId} type=${event.eventType}: ${(err as Error).message}`,
      );
      // No requeue: evita poison-loop. In iter 2 si potrà aggiungere DLQ esplicita.
      channel.nack(msg, false, false);
    }
  }

  private async dispatch(
    event: RegistryEvent<SubjectEventPayload>,
    routingKey: string,
  ): Promise<void> {
    const subjectId = event.payload?.subjectId;
    if (!subjectId) {
      this.logger.warn(`Evento senza subjectId (routingKey=${routingKey}): drop`);
      return;
    }

    switch (event.eventType) {
      case 'subject.created':
        // Niente da fare: la cache si popola lazy al primo lookup utente.
        this.logger.debug(`subject.created ${subjectId} (no-op)`);
        return;

      case 'subject.updated':
        await this.indexService.markStale(subjectId);
        return;

      case 'subject.deactivated':
        await this.indexService.markStale(subjectId, false);
        return;

      case 'subject.reactivated':
        await this.indexService.markStale(subjectId, true);
        return;

      case 'subject.role.added':
      case 'subject.role.removed':
        // Le role del registry non influenzano la cache locale clinica.
        this.logger.debug(`Role event ${event.eventType} ${subjectId} (no-op)`);
        return;

      default:
        this.logger.warn(
          `Evento non gestito: type=${event.eventType} routingKey=${routingKey}`,
        );
    }
  }
}
