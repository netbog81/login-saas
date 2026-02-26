import { Injectable, Logger } from '@nestjs/common';
import { TenantSchemaContextService } from './tenant-schema-context.service';

export type AuditOperation = 'SCHEMA_SET' | 'SCHEMA_SET_FAILED' | 'SCHEMA_PROVISION' | 'CROSS_TENANT_ATTEMPT';

/**
 * Audit log per le operazioni di isolamento schema tenant.
 *
 * Registra ogni cambio di search_path con: tenantId, userId, schemaName,
 * timestamp, requestId. Fornisce tracciabilità per:
 *
 * - ISO 27001 A.12.4.1: Registrazione degli eventi di sicurezza
 * - ISO 27001 A.9.4.2: Procedure di log-on sicure
 * - ISO 13485 §4.2.5: Controllo dei record - traccia chi accede ai dati PHI
 *
 * In produzione questi log devono essere inviati a un sistema SIEM esterno
 * (es. Elasticsearch, Splunk) per la conservazione a lungo termine.
 * Il metodo logToSiem() è il punto di estensione per questa integrazione.
 */
@Injectable()
export class TenantAuditService {
  private readonly logger = new Logger('TenantAudit');

  constructor(private readonly tenantContext: TenantSchemaContextService) {}

  /**
   * Registra un'operazione sullo schema tenant.
   */
  log(
    operation: AuditOperation,
    details?: Record<string, unknown>,
  ): void {
    const ctx = this.tenantContext.getContext();
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      tenantId: ctx?.tenantId ?? 'system',
      userId: ctx?.userId ?? 'system',
      schemaName: ctx?.schemaName ?? 'public',
      requestId: ctx?.requestId ?? 'n/a',
      ...details,
    };

    if (operation === 'SCHEMA_SET_FAILED' || operation === 'CROSS_TENANT_ATTEMPT') {
      this.logger.error(JSON.stringify(entry));
    } else {
      this.logger.log(JSON.stringify(entry));
    }

    // Punto di estensione per SIEM esterno (ES, Splunk, ecc.)
    this.logToSiem(entry).catch(() => { /* non bloccare */ });
  }

  /**
   * Override questo metodo per inviare i log a un SIEM esterno.
   * In produzione: POST a Elasticsearch, Splunk, ecc.
   */
  protected async logToSiem(_entry: Record<string, unknown>): Promise<void> {
    // TODO Fase SIEM: implementare invio a sistema di audit esterno
  }
}
