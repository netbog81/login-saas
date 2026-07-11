import {
  Controller,
  Get,
  Req,
  Res,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpService } from '@nestjs/axios';
import { TenantContextService } from '@curandis/tenant-datasource';
import { AccountingApiConfig } from './accounting-api.config';

/**
 * Proxy per richiedeste alla API accounting.
 * Inoltra GET /api/v1/accounting/* → accounting backend.
 * Usato principalmente per SSE streams e chiamate che non hanno un wrapper TypedRPC
 * (come AccountingApiClient).
 */
@Controller('api/v1/accounting')
export class AccountingApiProxyController {
  private readonly logger = new Logger(AccountingApiProxyController.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: AccountingApiConfig,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Decodifica il payload del JWT senza validazione firma.
   * (validazione già fatta dal middleware auth-core)
   */
  private decodeJwtPayload(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Decodifica base64 del payload (secondo segment)
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(payload);
  }

  /**
   * Estrae il tenant alias dalla source of truth: il JWT.
   * In federation l'hostname è inaffidabile; il token è l'unica fonte autorevole.
   * Fallback: estrae dall'hostname riconoscendo pattern <app>.<tenant>.curandis.cloud.
   */
  private getTenantAliasFromToken(req: Request): string {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/Bearer\s+(.+)$/);
    if (!match) {
      throw new BadRequestException('Missing or invalid Authorization header');
    }

    const token = match[1];
    try {
      // Decodifica il JWT (payload only, senza validazione firma)
      const decoded = this.decodeJwtPayload(token);

      // Estrai il tenant dal claim organization (Keycloak)
      // Potrebbe essere una stringa (alias) o un array di org
      let tenantFromJwt: string | null = null;

      if (decoded.organization) {
        if (typeof decoded.organization === 'string') {
          tenantFromJwt = decoded.organization;
        } else if (Array.isArray(decoded.organization) && decoded.organization.length > 0) {
          const first = decoded.organization[0];
          tenantFromJwt = typeof first === 'string' ? first : first?.id || null;
        }
      }

      // Se il token ha un tenant, usalo (source of truth)
      if (tenantFromJwt) {
        this.logger.debug(`Tenant da JWT claim 'organization': ${tenantFromJwt}`);
        return tenantFromJwt;
      }
    } catch (err) {
      this.logger.warn(`Decodifica JWT fallita: ${(err as Error).message}. Fallback all'hostname.`);
    }

    // Fallback: estrai dall'hostname riconoscendo <app>.<tenant>.curandis.cloud
    // ed escludendo i subdomain che NON sono tenant (gestione, accounting, registry, clinico, agenda, ...)
    const nonTenantApps = ['api', 'auth', 'tenants', 'my', 'www', 'gestione', 'accounting', 'registry', 'clinico', 'agenda'];
    const hostname = req.hostname || req.headers.host || '';
    const parts = hostname.split('.');

    // Pattern: app.tenant.curandis.cloud (o localhost:port, etc.)
    if (parts.length >= 3 && parts[parts.length - 2] === 'curandis' && parts[parts.length - 1] === 'cloud') {
      const app = parts[0];
      const tenant = parts[1];

      // Se il primo segment è un app non-tenant, scarta e usa il tenant dal secondo
      if (nonTenantApps.includes(app)) {
        this.logger.debug(`Hostname: ${hostname} → skippa '${app}' (non-tenant), usa tenant: ${tenant}`);
        return tenant;
      }

      // Se il primo segment NON è un app noto, presumibilmente è il tenant stesso
      // (es. demo4.curandis.cloud → demo4)
      this.logger.debug(`Hostname: ${hostname} → tenant: ${app}`);
      return app;
    }

    throw new BadRequestException(
      `Impossibile risolvere il tenant da JWT o hostname "${hostname}"`,
    );
  }

  /**
   * Costruisce gli header per il proxy verso accounting.
   * Propaga JWT, X-Tenant-Alias, org-id dalla request originale.
   * NOTA (2026-07-03): X-Tenant-Alias deve essere coerente tra SSE e REST
   * per garantire che stream e chiamate REST risolvano il tenant per la stessa strada.
   */
  private buildProxyHeaders(req: Request, tenantAlias: string): Record<string, string> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new BadRequestException('Missing Authorization header');
    }

    const headers: Record<string, string> = {
      Authorization: authHeader,
      'X-Tenant-Alias': tenantAlias,
    };

    const orgId = req.headers['x-org-id'] as string | undefined;
    if (orgId) {
      headers['X-Org-Id'] = orgId;
    }
    if (req.headers['x-org-alias']) {
      headers['X-Org-Alias'] = req.headers['x-org-alias'] as string;
    }

    if (req.headers.accept) {
      headers.Accept = req.headers.accept as string;
    }

    return headers;
  }

  /**
   * Effettua il forward della response dal backend accounting al client.
   * Gestisce SSE streams e risposte JSON.
   */
  private forwardResponse(axiosRes: any, res: Response, relativePath: string): void {
    // Copia gli header della response (soprattutto Content-Type per SSE)
    Object.entries(axiosRes.headers).forEach(([key, value]: [string, any]) => {
      // Skip hop-by-hop headers
      if (!['connection', 'keep-alive', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(axiosRes.status);

    // Se è uno stream, pipe direttamente la response
    if (relativePath.includes('stream') && axiosRes.data) {
      axiosRes.data.pipe(res);
    } else {
      res.send(axiosRes.data);
    }
  }

  /**
   * Prova a raggiungere il backend accounting con fallback idempotente.
   * Tenta prima `accounting.{tenant}.curandis.cloud`, poi fallback a `gestione.{tenant}.curandis.cloud`.
   * Così il clinico funziona indipendentemente da dove è deployato il backend accounting.
   */
  private async proxyWithFallback(
    relativePath: string,
    tenantAlias: string,
    proxyHeaders: Record<string, string>,
    queryString: string,
    isStream: boolean,
  ): Promise<any> {
    // Tenta prima su accounting.{tenant}
    const accountingUrl =
      `https://accounting.${tenantAlias}.curandis.cloud/api/v1/accounting${relativePath}${queryString}`;

    try {
      this.logger.debug(`Proxying GET ${relativePath} → accounting.${tenantAlias} (primary)`);
      const res = await this.http
        .get(accountingUrl, {
          headers: proxyHeaders,
          timeout: this.config.timeoutMs,
          responseType: isStream ? 'stream' : 'json',
        })
        .toPromise();
      return res;
    } catch (primaryErr: any) {
      const primaryStatus = primaryErr.response?.status;
      this.logger.warn(
        `Primary URL fallito (status=${primaryStatus}): ${accountingUrl}. Tentando fallback...`,
      );

      // Fallback: prova su gestione.{tenant} (suite federation)
      const suiteUrl =
        `https://gestione.${tenantAlias}.curandis.cloud/api/v1/accounting${relativePath}${queryString}`;

      try {
        this.logger.debug(`Proxying GET ${relativePath} → gestione.${tenantAlias} (fallback)`);
        const res = await this.http
          .get(suiteUrl, {
            headers: proxyHeaders,
            timeout: this.config.timeoutMs,
            responseType: isStream ? 'stream' : 'json',
          })
          .toPromise();
        return res;
      } catch (fallbackErr: any) {
        const fallbackStatus = fallbackErr.response?.status;
        this.logger.error(
          `Fallback URL anche fallito (status=${fallbackStatus}): ${suiteUrl}. ` +
            `Primary: ${primaryStatus}, Fallback: ${fallbackStatus}`,
        );

        // Ritorna l'errore del primary (non aggiungere rumore di fallback)
        throw primaryErr;
      }
    }
  }

  /**
   * Proxy GET generico per SSE streams e altre richieste verso accounting.
   * Idempotente: raggiunge il backend accounting ovunque sia deployato
   * (accounting.{tenant} oppure gestione.{tenant} via suite federation).
   *
   * Tenant resolution: estrae dal JWT (source of truth in federation),
   * fallback sull'hostname riconoscendo pattern <app>.<tenant>.curandis.cloud
   * e escludendo subdomain non-tenant (gestione, registry, accounting, ecc).
   */
  @Get('*')
  async proxyGet(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // Estrai il path relativo (es. /billable-events/stream da /api/v1/accounting/billable-events/stream)
      const originalPath = req.originalUrl;
      const pathMatch = originalPath.match(/^\/api\/v1\/accounting(.*)/);
      if (!pathMatch) {
        throw new BadRequestException('Invalid accounting path');
      }
      const relativePath = pathMatch[1];

      // Estrai il tenant dal JWT (source of truth in federation), fallback hostname
      const tenantAlias = this.getTenantAliasFromToken(req);
      if (!tenantAlias) {
        throw new BadRequestException('Missing tenant context');
      }

      // Costruisci gli header per il proxy
      const proxyHeaders = this.buildProxyHeaders(req, tenantAlias);

      // Estrai query string se presente
      const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
      const isStream = relativePath.includes('stream');

      // Proxy con fallback idempotente: tenta accounting.{tenant}, poi gestione.{tenant}
      const axiosRes = await this.proxyWithFallback(
        relativePath,
        tenantAlias,
        proxyHeaders,
        queryString,
        isStream,
      );

      // Forward della response
      this.forwardResponse(axiosRes, res, relativePath);
    } catch (error: any) {
      this.logger.error(`Proxy fallito: ${error.message}`, error.stack);

      if (error.response?.status === 403) {
        res.status(403).json({
          statusCode: 403,
          message: 'Accesso negato dal backend accounting (token/tenant non validi)',
          error: 'Forbidden',
        });
      } else if (error.response?.status === 404) {
        res.status(404).json({
          statusCode: 404,
          message: 'Endpoint accounting non trovato',
          error: 'Not Found',
        });
      } else {
        res.status(502).json({
          statusCode: 502,
          message: `Errore nel proxy accounting: ${error.message}`,
          error: 'Bad Gateway',
        });
      }
    }
  }
}
