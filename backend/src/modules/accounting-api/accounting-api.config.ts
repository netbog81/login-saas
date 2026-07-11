import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Config dell'integrazione HTTP sincrona col modulo accounting.
 *
 * Finora il clinico parlava con accounting SOLO via RabbitMQ (eventi di stato).
 * Per il PDF stampabile (PARTE 3) e, in futuro, per leggere metodi di pagamento
 * e voucher (PARTE 2), serve un canale request/response on-demand: il binario
 * PDF e le liste di lookup non sono adatti a una coda.
 *
 * Esempio .env:
 *   ACCOUNTING_BASE_URL_PATTERN=https://accounting.{tenant}.curandis.cloud/api/v1/accounting
 *   ACCOUNTING_HTTP_TIMEOUT_MS=15000
 *
 * In dev locale:
 *   ACCOUNTING_BASE_URL_PATTERN=http://localhost:3002/api/v1/accounting
 *
 * IMPORTANTE (2026-07-01): il modulo accounting usa il prefisso globale
 * `/api/v1/accounting` (main.ts `setGlobalPrefix`). Il vecchio default `/api`
 * puntava a path inesistenti → 404 → Traefik restituiva la SPA (HTML) e il
 * dialog "Incassa" riceveva HTML invece del JSON dei metodi di pagamento.
 *
 * NB: accounting NON accetta service-account → ogni chiamata deve propagare il
 * JWT dell'operatore (stesso realm Keycloak, stesso org_id). Vedi
 * AccountingApiClient.
 */
@Injectable()
export class AccountingApiConfig {
  private readonly logger = new Logger(AccountingApiConfig.name);
  readonly baseUrlPattern: string;
  readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrlPattern = config.get<string>(
      'ACCOUNTING_BASE_URL_PATTERN',
      'https://accounting.{tenant}.curandis.cloud/api/v1/accounting',
    );
    this.timeoutMs = parseInt(
      config.get<string>('ACCOUNTING_HTTP_TIMEOUT_MS', '15000'),
      10,
    );

    this.logger.log(
      `Accounting API config: baseUrlPattern="${this.baseUrlPattern}", timeoutMs=${this.timeoutMs}`,
    );
  }

  /** Risolve il base URL effettivo per un tenant alias (sostituisce {tenant}). */
  resolveBaseUrl(tenantAlias: string): string {
    return this.baseUrlPattern.replace('{tenant}', tenantAlias);
  }
}
