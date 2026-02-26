import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantSchemaContextData {
  schemaName: string;
  tenantId: string;
  userId: string;
  requestId: string;
}

/**
 * Mantiene il contesto dello schema tenant per ogni richiesta HTTP.
 *
 * Usa AsyncLocalStorage di Node.js: ogni catena di callback asincrona
 * originata da una richiesta HTTP ha il proprio store isolato.
 * Richieste concorrenti di tenant diversi NON interferiscono mai.
 *
 * UTILIZZO:
 * - Il middleware imposta il contesto con run() all'inizio di ogni richiesta
 * - Il TenantSchemaSubscriber legge il contesto prima di ogni query TypeORM
 * - Nessun codice applicativo deve leggere/scrivere questo service direttamente
 *
 * COMPLIANCE:
 * - ISO 27001 A.9: Garantisce l'isolamento dei dati tra tenant
 * - ISO 13485 §4.2.1: Previene cross-tenant data leakage su PHI
 */
@Injectable()
export class TenantSchemaContextService {
  private readonly storage = new AsyncLocalStorage<TenantSchemaContextData>();

  /**
   * Esegue fn nel contesto del tenant specificato.
   * Chiamato dal middleware per ogni richiesta HTTP.
   */
  run<T>(ctx: TenantSchemaContextData, fn: () => T): T {
    return this.storage.run(ctx, fn);
  }

  /**
   * Restituisce il contesto del tenant corrente.
   * Restituisce undefined se chiamato fuori da un contesto HTTP (es. cron job).
   */
  getContext(): TenantSchemaContextData | undefined {
    return this.storage.getStore();
  }

  /**
   * Restituisce lo schemaName del tenant corrente o null.
   */
  getSchemaName(): string | null {
    return this.storage.getStore()?.schemaName ?? null;
  }

  /**
   * Restituisce il tenantId corrente o null.
   */
  getTenantId(): string | null {
    return this.storage.getStore()?.tenantId ?? null;
  }
}
