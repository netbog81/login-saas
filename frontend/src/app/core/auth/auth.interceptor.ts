import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { Observable, from, switchMap, catchError, throwError } from 'rxjs';
import { OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';
import { TenantResolverService } from './tenant-resolver.service';
import { OidcAuthService } from './oidc-auth.service';

/**
 * Soglia in millisecondi sotto la quale consideriamo il token "in scadenza imminente"
 * e forziamo un refresh proattivo prima di emettere la richiesta.
 * 30s copre clock-skew tra browser/server e silent-refresh che ha mancato la finestra
 * (es. browser in background/standby).
 */
const TOKEN_REFRESH_THRESHOLD_MS = 30_000;

/**
 * Il refresh NON si fa qui: passa da OidcAuthService.refreshNow(), che è
 * l'unico punto d'ingresso e deduplica sia dentro la scheda (single-flight
 * condiviso con timer e visibilitychange) sia fra schede (lock in
 * localStorage). Un refresh parallelo a un altro, con la rotation attiva su
 * Keycloak, invaliderebbe la sessione.
 */
function refreshAccessToken(
  auth: OidcAuthService,
  oauthService: OAuthService,
): Promise<boolean> {
  // Senza refresh_token in storage il refresh fallirebbe comunque: propaga
  // subito il 401 al guard, che manderà al login Keycloak.
  if (!oauthService.getRefreshToken()) {
    return Promise.resolve(false);
  }
  return auth.refreshNow();
}

/**
 * True se l'access token corrente è scaduto o sta per scadere entro la soglia.
 */
function tokenExpiringSoon(oauthService: OAuthService): boolean {
  const expiresAt = oauthService.getAccessTokenExpiration();
  if (!expiresAt) return false;
  return expiresAt - Date.now() <= TOKEN_REFRESH_THRESHOLD_MS;
}

/**
 * Costruisce gli header (Authorization + tenant) leggendo lo stato corrente
 * di OAuth/Tenant. Va richiamata DOPO un eventuale refresh, perché il token
 * potrebbe essere cambiato.
 */
function buildAuthHeaders(
  oauthService: OAuthService,
  tenantResolver: TenantResolverService,
): Record<string, string> | null {
  const token = oauthService.getAccessToken();
  if (!token) return null;

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  const tenantAlias = tenantResolver.getTenantAlias();
  if (tenantAlias) {
    headers['X-Tenant-Alias'] = tenantAlias;
  }

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

  return headers;
}

/**
 * Esegue la request applicando gli header auth correnti.
 * Se non c'è token disponibile, emette la request "nuda" (es. chiamate pre-login).
 */
function sendWithAuth(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  oauthService: OAuthService,
  tenantResolver: TenantResolverService,
): Observable<HttpEvent<unknown>> {
  const headers = buildAuthHeaders(oauthService, tenantResolver);
  if (!headers) {
    return next(req);
  }
  return next(req.clone({ setHeaders: headers }));
}

/**
 * Interceptor HTTP per autenticazione Keycloak OIDC.
 *
 * Aggiunge a ogni richiesta verso il backend:
 * - Authorization: Bearer <access_token>
 * - X-Tenant-Alias: subdomain corrente (es. "demo4" da demo4.curandis.cloud)
 * - X-Org-Id: UUID dell'organizzazione (dal claim "organization" dell'ID token)
 * - X-Org-Alias: alias dell'organizzazione dal token (es. "bdq")
 *
 * Gestione token expiry:
 * 1. Refresh proattivo: se il token sta per scadere (< 30s), attende refreshToken()
 *    prima di emettere la richiesta. Copre il caso in cui il silent refresh ha
 *    mancato la finestra (browser in background, sleep, clock skew).
 * 2. Recovery reattivo: se il backend risponde 401, prova un refresh e ritenta
 *    la richiesta una sola volta. Se anche il retry fallisce, l'errore propaga.
 * 3. Deduplica: il refresh passa da OidcAuthService.refreshNow(), condiviso
 *    con il timer e col rientro in foreground, e serializzato anche fra schede.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const oauthService = inject(OAuthService);
  const auth = inject(OidcAuthService);
  const tenantResolver = inject(TenantResolverService);
  const apiUrl = environment.apiUrl;

  // Lascia passare le richieste non dirette al backend (es. discovery OIDC, asset).
  // Whitelist:
  //   - apiUrl (backend clinico, es. https://api.curandis.cloud)
  //   - registry.<tenant>.curandis.cloud (modulo anagrafiche cross-modulo)
  const isClinicoApi = req.url.startsWith(apiUrl);
  const isRegistryApi = /^https:\/\/registry\.[^.]+\.curandis\.cloud\//.test(req.url);
  if (!isClinicoApi && !isRegistryApi) {
    return next(req);
  }

  // Se non c'è alcun token (es. chiamate pre-login), passa così com'è.
  if (!oauthService.getAccessToken()) {
    return next(req);
  }

  // 1. Refresh proattivo se il token è scaduto o sta per scadere.
  const proactive$: Observable<boolean> = tokenExpiringSoon(oauthService)
    ? from(refreshAccessToken(auth, oauthService))
    : from(Promise.resolve(true));

  return proactive$.pipe(
    switchMap(() => sendWithAuth(req, next, oauthService, tenantResolver)),
    catchError((error: unknown) => {
      // 2. Recovery reattivo sul 401: prova un refresh e ritenta una sola volta.
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!isUnauthorized) {
        return throwError(() => error);
      }

      return from(refreshAccessToken(auth, oauthService)).pipe(
        switchMap((ok) => {
          if (!ok) {
            return throwError(() => error);
          }
          return sendWithAuth(req, next, oauthService, tenantResolver);
        }),
      );
    }),
  );
};
