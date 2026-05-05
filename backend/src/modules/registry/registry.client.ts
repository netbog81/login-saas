import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

import { RegistryConfig } from './registry.config';
import { RegistryServiceTokenService } from './registry-service-token.service';
import {
  RegistryRequestContext,
  RegistrySubjectResponse,
  CreateIndividualDto,
  UpdateIndividualDto,
  GlobalSearchRequest,
  GlobalSearchResponse,
  BulkSubjectsResponse,
  RegistryPrivacyConsent,
  UpdatePrivacyConsentDto,
  CreateRelationshipDto,
  RegistryRelationshipResponse,
  PrivacyConsentType,
} from './registry.types';

const RETRYABLE_STATUS = new Set([502, 503, 504]);

@Injectable()
export class RegistryClient {
  private readonly logger = new Logger(RegistryClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: RegistryConfig,
    private readonly serviceTokenService: RegistryServiceTokenService,
  ) {}

  // ==================== SUBJECTS ====================

  async getSubject(id: string, ctx: RegistryRequestContext): Promise<RegistrySubjectResponse | null> {
    return this.request<RegistrySubjectResponse | null>(
      'GET',
      `/subjects/${id}`,
      undefined,
      ctx,
      { allow404AsNull: true },
    );
  }

  /**
   * Variante S2S: usa il service-account Keycloak invece del JWT utente.
   * Per fire-and-forget e contesti senza utente nella request HTTP corrente
   * (cron, dispatch WhatsApp post-mutation, consumer RabbitMQ refresh, ...).
   *
   * Il caller deve passare esplicitamente `tenantAlias` perché qui non c'è
   * una request utente da cui dedurlo.
   */
  async getSubjectAsService(
    subjectId: string,
    tenantAlias: string,
    requestId?: string,
  ): Promise<RegistrySubjectResponse | null> {
    const token = await this.serviceTokenService.getToken();
    const ctx: RegistryRequestContext = {
      rawToken: token,
      tenantAlias,
      orgId: null, // service-account: il registry risolve via X-Tenant-Alias
      requestId: requestId || `s2s-${Date.now()}`,
    };
    return this.request<RegistrySubjectResponse | null>(
      'GET',
      `/subjects/${subjectId}`,
      undefined,
      ctx,
      { allow404AsNull: true },
    );
  }

  async bulkSubjects(ids: string[], ctx: RegistryRequestContext): Promise<BulkSubjectsResponse> {
    if (ids.length === 0) return [];
    if (ids.length > 200) {
      throw new BadRequestException(`bulkSubjects: max 200 IDs per call, ricevuti ${ids.length}`);
    }
    return this.request<BulkSubjectsResponse>('POST', '/subjects/bulk', { ids }, ctx);
  }

  async globalSearch(req: GlobalSearchRequest, ctx: RegistryRequestContext): Promise<GlobalSearchResponse> {
    return this.request<GlobalSearchResponse>('POST', '/subjects/global-search', req, ctx);
  }

  // ==================== INDIVIDUALS ====================

  async createIndividual(dto: CreateIndividualDto, ctx: RegistryRequestContext): Promise<RegistrySubjectResponse> {
    return this.request<RegistrySubjectResponse>('POST', '/individuals', dto, ctx);
  }

  async updateIndividual(
    id: string,
    dto: UpdateIndividualDto,
    ctx: RegistryRequestContext,
  ): Promise<RegistrySubjectResponse> {
    return this.request<RegistrySubjectResponse>('PUT', `/individuals/${id}`, dto, ctx);
  }

  // ==================== PRIVACY ====================

  async getPrivacyConsents(
    subjectId: string,
    ctx: RegistryRequestContext,
  ): Promise<Record<PrivacyConsentType, RegistryPrivacyConsent | null>> {
    return this.request('GET', `/subjects/${subjectId}/privacy-consents`, undefined, ctx);
  }

  async updatePrivacyConsent(
    subjectId: string,
    type: PrivacyConsentType,
    dto: UpdatePrivacyConsentDto,
    ctx: RegistryRequestContext,
  ): Promise<RegistryPrivacyConsent> {
    return this.request<RegistryPrivacyConsent>(
      'PUT',
      `/subjects/${subjectId}/privacy-consents/${type}`,
      dto,
      ctx,
    );
  }

  // ==================== RELATIONSHIPS ====================

  async getSubjectRelationships(
    subjectId: string,
    ctx: RegistryRequestContext,
  ): Promise<RegistryRelationshipResponse[]> {
    return this.request<RegistryRelationshipResponse[]>(
      'GET',
      `/subjects/${subjectId}/relationships`,
      undefined,
      ctx,
    );
  }

  async createRelationship(
    dto: CreateRelationshipDto,
    ctx: RegistryRequestContext,
  ): Promise<RegistryRelationshipResponse> {
    return this.request<RegistryRelationshipResponse>('POST', '/relationships', dto, ctx);
  }

  async closeRelationship(
    relationshipId: string,
    validTo: string,
    ctx: RegistryRequestContext,
  ): Promise<RegistryRelationshipResponse> {
    return this.request<RegistryRelationshipResponse>(
      'PUT',
      `/relationships/${relationshipId}/close`,
      { validTo },
      ctx,
    );
  }

  async deleteRelationship(relationshipId: string, ctx: RegistryRequestContext): Promise<void> {
    await this.request<void>('DELETE', `/relationships/${relationshipId}`, undefined, ctx);
  }

  // ==================== INTERNAL ====================

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body: unknown,
    ctx: RegistryRequestContext,
    options?: { allow404AsNull?: boolean },
  ): Promise<T> {
    if (!ctx.tenantAlias) {
      throw new BadRequestException('Registry call senza tenantAlias');
    }
    if (!ctx.rawToken) {
      throw new UnauthorizedException('Registry call senza rawToken');
    }

    const baseUrl = this.config.resolveBaseUrl(ctx.tenantAlias);
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${ctx.rawToken}`,
      'X-Tenant-Alias': ctx.tenantAlias,
      'X-Request-Id': ctx.requestId,
      'Content-Type': 'application/json',
    };
    // Inviamo X-Org-Id solo se presente (per service-account è null e
    // il registry risolve il tenant via X-Tenant-Alias).
    if (ctx.orgId) headers['X-Org-Id'] = ctx.orgId;

    const reqConfig: AxiosRequestConfig = {
      method,
      url,
      data: body,
      timeout: this.config.timeoutMs,
      headers,
    };

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      const startedAt = Date.now();
      try {
        const res: AxiosResponse<T> = await firstValueFrom(this.http.request<T>(reqConfig));
        const elapsed = Date.now() - startedAt;
        this.logger.debug(
          `Registry ${method} ${path} → ${res.status} in ${elapsed}ms (tenant=${ctx.tenantAlias}, requestId=${ctx.requestId})`,
        );
        return res.data;
      } catch (err) {
        lastErr = err;
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;
        const elapsed = Date.now() - startedAt;
        // Log diagnostico: status reale + body (anche se non JSON) — utile per
        // 5xx/ERR_BAD_RESPONSE dove altrimenti vedremmo solo il code axios.
        this.logger.warn(
          `Registry ${method} ${path} ← status=${status ?? '(no-status)'} ` +
            `code=${axiosErr.code ?? '-'} body=${this.formatAxiosBody(axiosErr).substring(0, 300)}`,
        );

        if (status === 404 && options?.allow404AsNull) {
          this.logger.debug(
            `Registry ${method} ${path} → 404 (treated as null) in ${elapsed}ms`,
          );
          return null as unknown as T;
        }

        if (status === 401) {
          throw new UnauthorizedException(
            `Registry ${method} ${path} → 401 unauthorized`,
          );
        }
        if (status === 403) {
          throw new ForbiddenException(`Registry ${method} ${path} → 403 forbidden`);
        }
        if (status === 404) {
          throw new NotFoundException(`Registry ${method} ${path} → 404 not found`);
        }
        if (status === 400 || status === 422) {
          throw new BadRequestException(
            `Registry ${method} ${path} → ${status}: ${this.formatAxiosBody(axiosErr)}`,
          );
        }

        const isRetryable =
          !status ||
          axiosErr.code === 'ECONNREFUSED' ||
          axiosErr.code === 'ECONNABORTED' ||
          axiosErr.code === 'ETIMEDOUT' ||
          (typeof status === 'number' && RETRYABLE_STATUS.has(status));

        if (isRetryable && attempt < this.config.retryCount) {
          const delay = 200 * Math.pow(3, attempt);
          this.logger.warn(
            `Registry ${method} ${path} fallita (${axiosErr.code || status}), retry tra ${delay}ms (tentativo ${attempt + 1}/${this.config.retryCount})`,
          );
          await this.sleep(delay);
          continue;
        }

        this.logger.error(
          `Registry ${method} ${path} → fallita dopo ${attempt + 1} tentativi in ${elapsed}ms: ${axiosErr.message}`,
        );
        if (status && status >= 500) {
          throw new ServiceUnavailableException(
            `Registry ${method} ${path} → ${status}: ${this.formatAxiosBody(axiosErr)}`,
          );
        }
        throw new InternalServerErrorException(
          `Registry ${method} ${path} fallita: ${axiosErr.message}`,
        );
      }
    }

    throw lastErr instanceof Error
      ? lastErr
      : new InternalServerErrorException('Registry call fallita');
  }

  private formatAxiosBody(err: AxiosError): string {
    const data = err.response?.data;
    if (!data) return err.message;
    if (typeof data === 'string') return data;
    try {
      return JSON.stringify(data);
    } catch {
      return err.message;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
