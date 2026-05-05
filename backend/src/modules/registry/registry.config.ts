import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Config dell'integrazione col Curandis Registry.
 *
 * Esempio .env:
 *   REGISTRY_BASE_URL_PATTERN=https://registry.{tenant}.curandis.cloud/api/v1/registry
 *   REGISTRY_DEFAULT_TENANT=bdq
 *   REGISTRY_HTTP_TIMEOUT_MS=7000
 *   REGISTRY_HTTP_RETRY_COUNT=2
 *
 * In dev locale puntare al registry locale:
 *   REGISTRY_BASE_URL_PATTERN=http://localhost:3001/api/v1/registry
 */
@Injectable()
export class RegistryConfig {
  private readonly logger = new Logger(RegistryConfig.name);
  readonly baseUrlPattern: string;
  readonly defaultTenant: string;
  readonly timeoutMs: number;
  readonly retryCount: number;

  constructor(config: ConfigService) {
    this.baseUrlPattern = config.get<string>(
      'REGISTRY_BASE_URL_PATTERN',
      'https://registry.{tenant}.curandis.cloud/api/v1/registry',
    );
    this.defaultTenant = config.get<string>('REGISTRY_DEFAULT_TENANT', 'bdq');
    this.timeoutMs = parseInt(config.get<string>('REGISTRY_HTTP_TIMEOUT_MS', '7000'), 10);
    this.retryCount = parseInt(config.get<string>('REGISTRY_HTTP_RETRY_COUNT', '2'), 10);

    this.logger.log(
      `Registry config: baseUrlPattern="${this.baseUrlPattern}", defaultTenant="${this.defaultTenant}", timeoutMs=${this.timeoutMs}, retry=${this.retryCount}`,
    );
  }

  /**
   * Risolve il base URL effettivo per un dato tenant alias.
   * Se il pattern contiene {tenant}, lo sostituisce; altrimenti
   * ritorna il pattern as-is (utile in dev quando si punta a localhost).
   */
  resolveBaseUrl(tenantAlias: string): string {
    return this.baseUrlPattern.replace('{tenant}', tenantAlias);
  }
}
