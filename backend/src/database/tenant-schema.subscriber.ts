import {
  EventSubscriber,
  EntitySubscriberInterface,
  TransactionStartEvent,
  DataSource,
  BeforeQueryEvent,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { TenantSchemaContextService } from './tenant-schema-context.service';

/**
 * TypeORM Subscriber per l'isolamento multi-tenant via schema PostgreSQL.
 *
 * Intercetta OGNI query TypeORM (beforeQuery) e imposta il search_path
 * sullo schema del tenant corrente, letto da AsyncLocalStorage.
 *
 * - Per query fuori transazione: SET search_path TO "schema"
 *   (vale per la connessione; sicuro perché il search_path viene
 *    reimpostato per ogni query in base al contesto della request)
 *
 * - Per transazioni: SET LOCAL search_path TO "schema"
 *   (vale solo per la transazione corrente, safe per il pool)
 *
 * COMPLIANCE:
 * - ISO 27001 A.9.4.1: Isolamento accesso alle informazioni
 * - ISO 13485 §7.5.9: Tracciabilità - ogni operazione DB è nel contesto tenant
 */
@Injectable()
@EventSubscriber()
export class TenantSchemaSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(TenantSchemaSubscriber.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantContext: TenantSchemaContextService,
  ) {
    // Registrazione manuale necessaria perché NestJS non inietta automaticamente
    // i subscriber TypeORM quando sono provider NestJS (necessario per DI)
    this.dataSource.subscribers.push(this);
  }

  /**
   * Si attiva prima di OGNI query TypeORM.
   * Imposta il search_path sullo schema del tenant corrente.
   *
   * Ignora le query SET search_path per evitare ricorsione infinita.
   */
  async beforeQuery(event: BeforeQueryEvent<any>): Promise<void> {
    // Evita ricorsione: non intercettare le nostre stesse SET search_path
    if (event.query?.startsWith('SET ')) {
      return;
    }

    const schemaName = this.tenantContext.getSchemaName();
    if (!schemaName) {
      return;
    }

    try {
      // Se siamo in una transazione, usa SET LOCAL (scoped alla transazione)
      // Altrimenti usa SET (scoped alla connessione, reimpostato ad ogni query)
      const isInTransaction = event.queryRunner.isTransactionActive;
      const setCmd = isInTransaction ? 'SET LOCAL' : 'SET';
      this.logger.debug(
        `beforeQuery: ${setCmd} search_path TO "${schemaName}" (query: ${event.query?.substring(0, 60)}...)`,
      );
      await event.queryRunner.query(
        `${setCmd} search_path TO "${schemaName}"`,
      );
    } catch (error: any) {
      this.logger.error(
        `Impossibile impostare search_path per schema "${schemaName}": ${error?.message}`,
      );
    }
  }

  /**
   * Si attiva prima dell'inizio di ogni transazione TypeORM.
   * Imposta SET LOCAL search_path per la transazione.
   */
  async beforeTransactionStart(event: TransactionStartEvent): Promise<void> {
    const schemaName = this.tenantContext.getSchemaName();
    if (!schemaName) {
      return;
    }

    try {
      await event.queryRunner.query(
        `SET LOCAL search_path TO "${schemaName}"`,
      );
      this.logger.verbose(
        `SET LOCAL search_path TO "${schemaName}" [tenant: ${this.tenantContext.getTenantId()}]`,
      );
    } catch (error: any) {
      this.logger.error(
        `Impossibile impostare search_path per schema "${schemaName}": ${error?.message}`,
      );
    }
  }
}
