import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';
import { TenantResolverService } from './tenant-resolver.service';

/**
 * Interceptor HTTP per autenticazione Keycloak OIDC.
 *
 * Aggiunge a ogni richiesta verso il backend:
 * - Authorization: Bearer <access_token>
 * - X-Tenant-Alias: subdomain corrente (es. "demo4" da demo4.curandis.cloud)
 * - X-Org-Id: UUID dell'organizzazione (dal claim "organization" dell'ID token)
 * - X-Org-Alias: alias dell'organizzazione dal token (es. "bdq")
 *
 * Il backend confronta X-Tenant-Alias con X-Org-Alias: se non corrispondono → 403.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const oauthService = inject(OAuthService);
  const tenantResolver = inject(TenantResolverService);
  const apiUrl = environment.apiUrl;

  if (req.url.startsWith(apiUrl)) {
    const token = oauthService.getAccessToken();
    if (token) {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

      // Subdomain corrente = tenant richiesto
      const tenantAlias = tenantResolver.getTenantAlias();
      if (tenantAlias) {
        headers['X-Tenant-Alias'] = tenantAlias;
      }

      // Estrai org dall'ID token: [ { "demo4": { "id": "uuid" } }, "demo4" ]
      const claims = oauthService.getIdentityClaims() as any;
      const org = claims?.['organization'];

      if (Array.isArray(org)) {
        for (const item of org) {
          if (typeof item === 'string') {
            headers['X-Org-Alias'] = item;
          } else if (item && typeof item === 'object') {
            const keys = Object.keys(item);
            if (keys.length > 0 && item[keys[0]]?.id) {
              headers['X-Org-Id'] = item[keys[0]].id;
              if (!headers['X-Org-Alias']) {
                headers['X-Org-Alias'] = keys[0];
              }
            }
          }
        }
      }

      console.log('[AuthInterceptor]', {
        url: req.url,
        tenantAlias,
        orgAlias: headers['X-Org-Alias'] || null,
        orgId: headers['X-Org-Id'] || null,
        hasToken: !!token,
        claims: claims?.['organization'],
      });

      req = req.clone({ setHeaders: headers });
    }
  }

  return next(req);
};
