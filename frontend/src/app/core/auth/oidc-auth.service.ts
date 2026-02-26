import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserInfo, UserMeResponse } from './auth.models';
import { TenantResolverService } from './tenant-resolver.service';

/**
 * Servizio di autenticazione basato su Keycloak OIDC.
 *
 * Flusso: Authorization Code + PKCE
 * 1. login() → redirect a Keycloak con hint del tenant (kc_org)
 * 2. Keycloak autentica → redirect a /callback con ?code=...
 * 3. angular-oauth2-oidc scambia code → access_token JWT Keycloak
 * 4. loadCurrentUser() chiama GET /api/me → riceve schemaName, tenantStatus da OpenBao
 *
 * ISO 27001: credenziali utente non transitano per la Main App.
 * Il silent refresh del token è gestito automaticamente dalla libreria.
 */
@Injectable({ providedIn: 'root' })
export class OidcAuthService {
  private readonly oauthService = inject(OAuthService);
  private readonly http = inject(HttpClient);
  private readonly tenantResolver = inject(TenantResolverService);

  readonly currentUser = signal<UserInfo | null>(null);
  /** True se il token è per un'org diversa dal subdomain corrente. */
  readonly isTenantMismatch = signal(false);

  /**
   * Configura angular-oauth2-oidc con le coordinate Keycloak.
   * Deve essere chiamato nell'APP_INITIALIZER prima di qualsiasi altra operazione auth.
   *
   * Gli endpoint OIDC sono configurati staticamente come fallback:
   * se la discovery fallisce (es. CORS, rete), initCodeFlow()
   * può comunque costruire l'URL di redirect a Keycloak.
   */
  configure(): void {
    const orgAlias = this.tenantResolver.getTenantAlias();
    const realmUrl = `${environment.keycloakUrl}/realms/${environment.keycloakRealm}`;
    const oidcBase = `${realmUrl}/protocol/openid-connect`;

    const authConfig: AuthConfig = {
      issuer: realmUrl,
      clientId: environment.keycloakClientId,
      redirectUri: window.location.origin + '/callback',
      postLogoutRedirectUri: window.location.origin,
      responseType: 'code',
      scope: 'openid profile email organization',
      showDebugInformation: !environment.production,
      customQueryParams: orgAlias ? { kc_org: orgAlias } : {},
      // Endpoint statici: fallback se la discovery OIDC non riesce
      loginUrl: `${oidcBase}/auth`,
      logoutUrl: `${oidcBase}/logout`,
      tokenEndpoint: `${oidcBase}/token`,
      userinfoEndpoint: `${oidcBase}/userinfo`,
      strictDiscoveryDocumentValidation: false,
      requireHttps: environment.production,
    };

    console.log('[OIDC] configure:', {
      subdomain: orgAlias,
      kc_org: authConfig.customQueryParams,
      redirectUri: authConfig.redirectUri,
      hostname: window.location.hostname,
    });

    this.oauthService.configure(authConfig);
    this.oauthService.setupAutomaticSilentRefresh();
  }

  /**
   * Carica il documento di discovery OIDC da Keycloak.
   * Da chiamare dopo configure() nell'APP_INITIALIZER.
   * @returns true se l'utente è già autenticato (token valido in sessione)
   */
  async initialize(): Promise<boolean> {
    try {
      await this.oauthService.loadDiscoveryDocumentAndTryLogin();
    } catch (err) {
      console.warn('[OIDC] Discovery fallita, si usano gli endpoint statici:', err);
    }

    const hasToken = this.oauthService.hasValidAccessToken();
    const idClaims = this.oauthService.getIdentityClaims() as any;
    const tokenOrg = this.extractOrgAlias(idClaims);
    const subdomain = this.tenantResolver.getTenantAlias();

    console.log('[OIDC] initialize result:', {
      hasToken,
      tokenOrg,
      subdomain,
      sub: idClaims?.['sub'],
      email: idClaims?.['email'],
    });

    if (hasToken) {
      // Verifica immediata: l'org nel token deve corrispondere al subdomain.
      // Se non corrisponde (es. "apri in nuova scheda" ha ereditato il token di un altro tenant,
      // oppure la sessione SSO Keycloak ha restituito un token per l'org sbagliata),
      // segnaliamo il mismatch e lasciamo che il guard rediriga a /unauthorized.
      // NON fare forceLogin() qui: causerebbe un loop infinito.
      if (subdomain && tokenOrg && subdomain !== tokenOrg) {
        console.warn(`[OIDC] Token org "${tokenOrg}" != subdomain "${subdomain}" → tenant mismatch`);
        this.isTenantMismatch.set(true);
        return true; // token valido ma org sbagliata — il guard gestirà il redirect
      }

      try {
        await this.loadCurrentUser();
      } catch (err: any) {
        if (err?.type === 'TENANT_MISMATCH') {
          console.warn('[OIDC] Tenant mismatch da /api/me');
          this.isTenantMismatch.set(true);
          return true;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Avvia il flusso Authorization Code + PKCE verso Keycloak.
   * Fa redirect completo alla pagina di login Keycloak.
   */
  login(): void {
    this.oauthService.initCodeFlow();
  }

  /**
   * Esegue il logout da Keycloak e pulisce lo stato locale.
   */
  logout(): void {
    this.currentUser.set(null);
    this.oauthService.revokeTokenAndLogout();
  }

  /**
   * Chiama GET /api/me per ottenere schemaName e tenantStatus dal backend.
   * Il backend risolve questi dati da OpenBao usando org_id dal JWT Keycloak.
   *
   * @throws {{ type: 'TENANT_MISMATCH', message: string }} se l'utente non appartiene al subdomain corrente
   */
  async loadCurrentUser(): Promise<UserInfo | null> {
    if (!this.oauthService.hasValidAccessToken()) {
      return null;
    }

    try {
      const me = await firstValueFrom(
        this.http.get<UserMeResponse>(`${environment.apiUrl}/api/me`)
      );

      // Estrai tenantId (alias) dal claim "organization" del JWT Keycloak
      // Formato: [ { "demo4": { "id": "uuid" } }, "demo4" ]
      const claims = this.oauthService.getIdentityClaims() as any;
      const tenantId = this.extractOrgAlias(claims) || me.orgId;

      const user: UserInfo = {
        userId: me.userId,
        email: me.email,
        name: me.name,
        roles: me.roles,
        tenantId,
        orgId: me.orgId,
        schemaName: me.schemaName,
        tenantStatus: me.tenantStatus,
      };

      this.currentUser.set(user);
      return user;
    } catch (err: any) {
      if (err?.status === 403) {
        // Tenant mismatch: l'utente non appartiene a questo subdomain
        const msg = err?.error?.message || 'Accesso negato per questo tenant';
        console.warn('[OIDC] Tenant mismatch:', msg);
        throw { type: 'TENANT_MISMATCH', message: msg };
      }
      // Altri errori (401, rete, ecc.): token scaduto o backend irraggiungibile
      return null;
    }
  }

  /**
   * Forza un nuovo login invalidando la sessione SSO Keycloak.
   * Usato quando l'utente è autenticato ma con l'organizzazione sbagliata.
   * logOut() senza parametri: pulisce i token locali + redirect al logout endpoint
   * di Keycloak → invalida SSO → redirect a postLogoutRedirectUri (window.location.origin)
   * → app si ricarica senza token → auth guard → login() → form Keycloak.
   */
  forceLogin(): void {
    this.currentUser.set(null);
    this.isTenantMismatch.set(false);
    this.oauthService.logOut();
  }

  /**
   * Restituisce l'alias dell'org dal token corrente (per messaggi di errore).
   */
  getTokenOrgAlias(): string | null {
    const claims = this.oauthService.getIdentityClaims() as any;
    return this.extractOrgAlias(claims);
  }

  /** Restituisce l'access token JWT Keycloak per le richieste API. */
  getAccessToken(): string {
    return this.oauthService.getAccessToken() || '';
  }

  /** True se c'è un access token valido in sessione. */
  isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  /** Verifica se l'utente corrente ha almeno uno dei ruoli specificati. */
  hasRole(roles: string[]): boolean {
    const user = this.currentUser();
    if (!user) return false;
    return roles.some(r => user.roles.includes(r));
  }

  /** True se lo schema tenant è attivo. */
  isSchemaReady(): boolean {
    return this.currentUser()?.tenantStatus === 'active';
  }

  /** Aggiorna il tenantStatus nell'utente corrente (dopo provisioning schema). */
  updateTenantStatus(status: string): void {
    const user = this.currentUser();
    if (user) {
      this.currentUser.set({ ...user, tenantStatus: status });
    }
  }

  /**
   * Estrae l'alias dell'organizzazione dal claim "organization" del JWT Keycloak.
   * Formato: [ { "demo4": { "id": "uuid" } }, "demo4" ]
   */
  private extractOrgAlias(claims: any): string | null {
    const org = claims?.['organization'];
    if (!Array.isArray(org)) return null;
    // La stringa nell'array è l'alias
    for (const item of org) {
      if (typeof item === 'string') return item;
    }
    // Fallback: la prima key dell'oggetto nell'array
    for (const item of org) {
      if (item && typeof item === 'object') {
        const keys = Object.keys(item);
        if (keys.length > 0) return keys[0];
      }
    }
    return null;
  }
}
