import { Injectable, Logger } from '@nestjs/common';

/**
 * Risolve lo schemaName e il tenantStatus di un tenant tramite OpenBao.
 *
 * Path KV v2: kv/data/tenant-map/{tenantAlias}
 * Formato reale: { schema_name: "tenant_demo4", status?: "active" | ... }
 *
 * Cache in-memory con TTL 5 minuti per i tenant attivi.
 * I tenant sospesi non vengono mai cachati (sicurezza: blocco immediato).
 */

export interface TenantInfo {
  schemaName: string;
  status: string;
}

interface CacheEntry {
  info: TenantInfo;
  cachedAt: number;
}

@Injectable()
export class TenantOpenbaoResolverService {
  private readonly logger = new Logger(TenantOpenbaoResolverService.name);
  private readonly OPENBAO_ADDR = process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200';
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuti
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Risolve schemaName e status del tenant da OpenBao.
   * @param tenantAlias - Alias del tenant (es. "demo4") estratto dal JWT Keycloak
   * @returns TenantInfo con schemaName e status, oppure null se non trovato
   */
  async resolveTenant(tenantAlias: string): Promise<TenantInfo | null> {
    // 1. Controlla cache (solo per tenant non-sospesi)
    const cached = this.cache.get(tenantAlias);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.info;
    }

    // 2. Legge da OpenBao Agent (KV v2: /v1/kv/data/tenant-map/{alias})
    try {
      const url = `${this.OPENBAO_ADDR}/v1/kv/data/tenant-map/${encodeURIComponent(tenantAlias)}`;
      // No X-Vault-Token header: the OpenBao Agent proxy auto-injects its own token
      const response = await fetch(url);

      if (response.status === 404) {
        // 404 può essere un errore legittimo (utente con tenant nel JWT non
        // mappato in OpenBao) oppure normale (webhook gateway con instance
        // ignota). Lasciamo decidere il caller: noi logghiamo a debug e
        // ritorniamo null. I caller "critici" (middleware) loggano da soli.
        this.logger.debug(`Tenant non trovato in OpenBao: alias="${tenantAlias}"`);
        return null;
      }

      if (!response.ok) {
        this.logger.error(`OpenBao errore ${response.status} per alias="${tenantAlias}"`);
        return null;
      }

      const body = await response.json() as any;
      // KV v2: body.data.data
      const data = body?.data?.data;
      // Il campo in OpenBao è "schema_name" (snake_case)
      const schemaName = (data?.schema_name || data?.schemaName) as string;
      if (!schemaName) {
        this.logger.warn(`OpenBao: schema_name mancante per alias="${tenantAlias}". Dati: ${JSON.stringify(data)}`);
        return null;
      }

      const info: TenantInfo = {
        schemaName,
        status: (data.status as string) || 'active',
      };

      // 3. Casha solo se tenant non sospeso (sicurezza: blocco immediato su suspended)
      if (info.status !== 'suspended' && info.status !== 'deleted') {
        this.cache.set(tenantAlias, { info, cachedAt: Date.now() });
      }

      return info;
    } catch (error: any) {
      this.logger.error(`Impossibile leggere OpenBao per alias="${tenantAlias}": ${error?.message}`);
      return null;
    }
  }

  /**
   * Invalida la cache per un tenant.
   */
  invalidateCache(tenantAlias: string): void {
    this.cache.delete(tenantAlias);
    this.logger.log(`Cache invalidata per alias="${tenantAlias}"`);
  }
}
