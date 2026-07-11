import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

import { AccountingApiConfig } from './accounting-api.config';

/**
 * Contesto minimo per una chiamata HTTP verso accounting. Derivato dal
 * CurandisTenantContext (popolato dal middleware auth-core) + rawToken estratto
 * dall'header Authorization della request.
 */
export interface AccountingRequestContext {
  tenantAlias: string;
  rawToken: string;
  orgId: string | null;
  requestId?: string;
}

/**
 * Client HTTP sincrono verso il modulo accounting.
 *
 * Propaga il JWT dell'operatore (accounting NON accetta service-account) e gli
 * header di tenant, coerente col pattern già usato da RegistryClient.
 */
@Injectable()
export class AccountingApiClient {
  private readonly logger = new Logger(AccountingApiClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: AccountingApiConfig,
  ) {}

  private buildHeaders(ctx: AccountingRequestContext): Record<string, string> {
    if (!ctx.tenantAlias) {
      throw new BadRequestException('Accounting call senza tenantAlias');
    }
    if (!ctx.rawToken) {
      throw new UnauthorizedException('Accounting call senza rawToken (JWT mancante)');
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${ctx.rawToken}`,
      'X-Tenant-Alias': ctx.tenantAlias,
    };
    if (ctx.requestId) headers['X-Request-Id'] = ctx.requestId;
    if (ctx.orgId) headers['X-Org-Id'] = ctx.orgId;
    return headers;
  }

  /** GET generico JSON verso accounting (propaga JWT + tenant). */
  private async getJson<T>(path: string, ctx: AccountingRequestContext): Promise<T> {
    const baseUrl = this.config.resolveBaseUrl(ctx.tenantAlias);
    const url = `${baseUrl}${path}`;
    try {
      const resp = await firstValueFrom(
        this.http.get<T>(url, {
          headers: this.buildHeaders(ctx),
          timeout: this.config.timeoutMs,
        }),
      );
      return resp.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      this.logger.warn(`GET ${path} fallito (status=${status ?? 'n/a'}): ${axiosErr.message}`);
      if (status === 401 || status === 403) {
        throw new UnauthorizedException('Accesso negato da accounting (token/tenant non validi).');
      }
      throw new BadRequestException(`Errore accounting su ${path}: ${axiosErr.message}`);
    }
  }

  /** Risolve il partyId accounting da un registrySubjectId (paziente). */
  async resolvePartyIdBySubject(
    subjectId: string,
    ctx: AccountingRequestContext,
  ): Promise<string | null> {
    const res = await this.getJson<{ partyId?: string }>(
      `/parties/by-subject/${subjectId}`,
      ctx,
    );
    return res.partyId ?? null;
  }

  /** Metodi di pagamento attivi configurati lato accounting per il tenant. */
  async fetchPaymentMethods(ctx: AccountingRequestContext): Promise<unknown[]> {
    return this.getJson<unknown[]>('/payments/methods', ctx);
  }

  /** Voucher utilizzabili (attivi, residuo>0, non scaduti) di un party paziente. */
  async fetchUsableVouchers(
    partyId: string,
    ctx: AccountingRequestContext,
  ): Promise<unknown[]> {
    return this.getJson<unknown[]>(`/vouchers/usable/${partyId}`, ctx);
  }

  /** Fatture di un paziente (per emettere voucher TIPO_2 — referenceInvoiceId). */
  async fetchPatientInvoices(
    partyId: string,
    ctx: AccountingRequestContext,
  ): Promise<unknown[]> {
    return this.getJson<unknown[]>(
      `/sales-documents?documentType=INVOICE&beneficiaryPartyId=${partyId}`,
      ctx,
    );
  }

  /**
   * Scarica il PDF di un SalesDocument (fattura) da accounting.
   * Ritorna il buffer binario + il content-type effettivo.
   *
   * @throws BadRequestException 404 se il documento non esiste lato accounting.
   */
  async fetchSalesDocumentPdf(
    documentId: string,
    ctx: AccountingRequestContext,
  ): Promise<{ data: Buffer; contentType: string }> {
    const baseUrl = this.config.resolveBaseUrl(ctx.tenantAlias);
    const url = `${baseUrl}/sales-documents/${documentId}/pdf`;
    try {
      const resp = await firstValueFrom(
        this.http.get(url, {
          headers: this.buildHeaders(ctx),
          responseType: 'arraybuffer',
          timeout: this.config.timeoutMs,
        }),
      );
      return {
        data: Buffer.from(resp.data),
        contentType:
          (resp.headers['content-type'] as string) || 'application/pdf',
      };
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      this.logger.warn(
        `fetchSalesDocumentPdf fallito (doc=${documentId}, status=${status ?? 'n/a'}): ${axiosErr.message}`,
      );
      if (status === 404) {
        throw new BadRequestException(
          `Documento fiscale ${documentId} non trovato lato accounting.`,
        );
      }
      if (status === 401 || status === 403) {
        throw new UnauthorizedException(
          'Accesso al documento fiscale negato da accounting (token/tenant non validi).',
        );
      }
      throw new BadRequestException(
        `Errore nel recupero del PDF della fattura: ${axiosErr.message}`,
      );
    }
  }
}
