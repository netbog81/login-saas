import { Injectable, Injector, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserInfo, UserMeResponse } from './auth.models';
import { TenantResolverService } from './tenant-resolver.service';
import { Router } from '@angular/router';

/**
 * Servizio di autenticazione basato su Keycloak OIDC.
 *
 * Flusso: Authorization Code + PKCE
 * 1. login() → redirect a Keycloak (senza hint kc_org: romperebbe il silent SSO)
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

  private readonly injector = inject(Injector);

  readonly currentUser = signal<UserInfo | null>(null);
  /** True se il token è per un'org diversa dal subdomain corrente. */
  readonly isTenantMismatch = signal(false);
  private sessionWatchersAttached = false;

  /**
   * Tetto ai login consecutivi falliti, contati PER SCHEDA (sessionStorage).
   *
   * Ogni percorso d'errore di questo modulo chiama login(), che rimanda a
   * Keycloak; se la sessione SSO è viva Keycloak risponde subito con un nuovo
   * code, l'app ritenta, fallisce di nuovo e riparte. Con un fallimento
   * permanente dello scambio del code — nonce sovrascritto da un'altra scheda
   * dello stesso gestionale, storage del browser bloccato, orologio del PC
   * fuori tolleranza — il risultato è la pagina che si ricarica all'infinito
   * senza mai caricare e senza dire perché. Oltre la soglia ci fermiamo e
   * mandiamo su /unauthorized?reason=login_loop con il motivo tecnico.
   */
  private static readonly LOGIN_ATTEMPTS_KEY = 'curandis.oidc.login_attempts';
  private static readonly MAX_LOGIN_ATTEMPTS = 3;
  /** Motivo dell'ultimo fallimento, per mostrarlo nella pagina d'errore. */
  private static readonly LOGIN_ERROR_KEY = 'curandis.oidc.login_error';
  /**
   * Lock cross-scheda sul giro di login. nonce e code_verifier vivono in
   * localStorage, che è UNO per origin: due schede del clinico che partono
   * insieme verso Keycloak si sovrascrivono a vicenda e nessuna delle due
   * riesce più a validare il proprio state → loop permanente a due voci.
   * Chi trova il lock fresco di un'altra scheda aspetta il suo token invece
   * di partire a sua volta.
   */
  private static readonly FLOW_LOCK_KEY = 'curandis.oidc.flow_lock';
  private static readonly FLOW_LOCK_TTL_MS = 20_000;

  /** Identificativo di questa scheda, per riconoscere il proprio lock. */
  private readonly tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  /** True mentre stiamo aspettando che un'altra scheda completi il login. */
  readonly waitingForOtherTab = signal(false);

  /** Lock cross-scheda sul refresh: vedi refreshNow(). */
  private static readonly REFRESH_LOCK_KEY = 'curandis.oidc.refresh_lock';
  private static readonly REFRESH_LOCK_TTL_MS = 12_000;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshInFlight: Promise<boolean> | null = null;

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
      // NIENTE `offline_access`: gli offline token (30 giorni) sopravvivono
      // alla sessione SSO, quindi il modulo sembrava loggato anche a sessione
      // Keycloak morta — l'ingresso in un altro modulo chiedeva le credenziali
      // e il logout non si propagava. Col refresh token legato alla sessione
      // SSO (idle/max del realm, alzati a 10h/12h) tutti i moduli vivono e
      // muoiono insieme.
      scope: 'openid profile email organization',
      showDebugInformation: !environment.production,
      // NB: NON usiamo `kc_org` come customQueryParam.
      // È un hint di organizzazione che pre-seleziona un'org in Keycloak,
      // utile se un utente appartiene a più org (gli risparmia il selector).
      // MA in alcuni casi (cambio subdomain in nuova tab dopo SSO già fatto
      // su altra org) può forzare un re-prompt invece di rispettare il
      // cookie KEYCLOAK_IDENTITY → silent SSO rotto.
      // Il modulo registry non lo usa, e nel nostro setup ogni utente ha
      // una sola org → nessun beneficio. Tolto per non ostacolare l'SSO.
      // Endpoint statici: fallback se la discovery OIDC non riesce
      loginUrl: `${oidcBase}/auth`,
      logoutUrl: `${oidcBase}/logout`,
      tokenEndpoint: `${oidcBase}/token`,
      userinfoEndpoint: `${oidcBase}/userinfo`,
      strictDiscoveryDocumentValidation: false,
      requireHttps: environment.production,
      // Tolleranza disallineamento clock (es. server vs client) — stesso
      // valore del registry.
      clockSkewInSec: 30,
      // Disabilita il check periodico della session via iframe — non
      // necessario col silent refresh attivo, evita falsi positivi
      // sessionChanged dovuti a cookie cross-subdomain.
      sessionChecksEnabled: false,
    };

    console.log('[OIDC] configure:', {
      subdomain: orgAlias,
      redirectUri: authConfig.redirectUri,
      hostname: window.location.hostname,
      scope: authConfig.scope,
    });

    this.oauthService.configure(authConfig);
    // localStorage invece del default sessionStorage: una nuova tab riusa la
    // sessione senza rifare il giro di redirect. Allineato al registry.
    this.oauthService.setStorage(localStorage);
    // NIENTE setupAutomaticSilentRefresh(): lo scheduler della libreria chiama
    // refreshToken() per conto suo, fuori dal single-flight di questo service.
    // Con la rotation dei refresh token attiva su Keycloak, due refresh
    // paralleli sullo stesso token fanno leggere al secondo un riuso e la
    // sessione viene invalidata — dati che smettono di caricarsi senza
    // redirect. Schedula tutto refreshNow(), unico punto d'ingresso.
    // Stessa forma dell'host della suite (curandis-suite/.../auth.service.ts).
    this.attachSessionWatchers();
  }

  /**
   * Spegnimento proattivo a sessione SSO morta (logout da un altro modulo o
   * idle/max del realm scaduti), allineato a registry e accounting.
   * Senza, il clinico resta "zombie" con token scaduto finché l'utente non
   * naviga o riceve un 401.
   */
  private attachSessionWatchers(): void {
    if (this.sessionWatchersAttached) return;
    this.sessionWatchersAttached = true;

    // Ogni token nuovo (login o refresh) ri-arma il timer sulla sua scadenza.
    this.oauthService.events.subscribe((event) => {
      if (event.type === 'token_received' || event.type === 'token_refreshed') {
        this.scheduleRefresh();
      }
      if (event.type === 'logout' || event.type === 'session_terminated') {
        this.cancelRefresh();
      }
    });

    // Tab in background: il browser throttla i timer, al rientro il token può
    // essere già scaduto senza che il refresh sia mai partito.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (this.oauthService.hasValidAccessToken()) {
          // Ri-arma: il timer potrebbe essere stato droppato in background.
          this.scheduleRefresh();
          return;
        }
        if (this.oauthService.getRefreshToken()) {
          this.attemptRefresh();
        }
      });
    }
  }

  /**
   * Refresh deduplicato: **unico** punto da cui parte un refreshToken().
   *
   * Deduplica su due livelli, perché la rotation dei refresh token di Keycloak
   * punisce il secondo refresh partito con lo stesso token (lo legge come
   * riuso e invalida la sessione):
   *
   *  - nella scheda: single-flight, i chiamanti concorrenti (timer,
   *    visibilitychange, interceptor su N richieste parallele) condividono
   *    la stessa promessa;
   *  - fra schede: lock in localStorage. Il refresh token è uno solo per
   *    origin, quindi due schede che rinfrescano insieme fanno esattamente il
   *    danno di cui sopra. Chi trova il lock aspetta il token dell'altra
   *    scheda — che compare in localStorage, da cui la libreria rilegge.
   */
  async refreshNow(): Promise<boolean> {
    if (this.refreshLockHeldByOtherTab()) {
      const expiration = this.oauthService.getAccessTokenExpiration();
      if (await this.waitForTokenFromOtherTab(expiration)) {
        this.scheduleRefresh();
        return true;
      }
      // Lock orfano (scheda chiusa a metà refresh): proseguiamo noi.
    }

    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = (async () => {
      this.takeRefreshLock();
      try {
        await this.oauthService.refreshToken();
        return true;
      } catch (err) {
        // Con la rotation un invalid_grant può voler dire solo "un'altra
        // scheda mi ha battuto sul tempo": prima di dare la sessione per
        // morta, rileggi lo storage — il token nuovo potrebbe essere già lì.
        if (this.oauthService.hasValidAccessToken()) return true;
        console.warn('[OIDC] refreshToken fallito:', err);
        return false;
      } finally {
        this.releaseRefreshLock();
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  /** Timer di refresh a (scadenza - 60s), mai prima di 5s. */
  private scheduleRefresh(): void {
    this.cancelRefresh();
    const expiresAt = this.oauthService.getAccessTokenExpiration();
    if (!expiresAt) return;
    const delay = Math.max(expiresAt - Date.now() - 60_000, 5_000);
    this.refreshTimer = setTimeout(() => void this.attemptRefresh(), delay);
  }

  private cancelRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Refresh + gestione dell'esito. Un fallimento con token ancora valido è
   * transitorio (rete assente, timer throttlato): si riprova fra poco invece
   * di lasciar morire la sessione in silenzio. Senza più token si va al login.
   */
  private async attemptRefresh(): Promise<void> {
    const ok = await this.refreshNow();
    if (ok) return;

    if (!this.oauthService.hasValidAccessToken()) {
      console.warn('[OIDC] Refresh fallito e token scaduto → redirect al login');
      this.currentUser.set(null);
      this.login();
      return;
    }
    this.cancelRefresh();
    this.refreshTimer = setTimeout(() => void this.attemptRefresh(), 20_000);
  }

  private refreshLockHeldByOtherTab(): boolean {
    try {
      const raw = localStorage.getItem(OidcAuthService.REFRESH_LOCK_KEY);
      if (!raw) return false;
      const lock = JSON.parse(raw);
      return (
        typeof lock?.tabId === 'string' &&
        lock.tabId !== this.tabId &&
        typeof lock?.ts === 'number' &&
        Date.now() - lock.ts < OidcAuthService.REFRESH_LOCK_TTL_MS
      );
    } catch {
      return false;
    }
  }

  private takeRefreshLock(): void {
    try {
      localStorage.setItem(
        OidcAuthService.REFRESH_LOCK_KEY,
        JSON.stringify({ tabId: this.tabId, ts: Date.now() }),
      );
    } catch {
      /* storage non disponibile: resta il single-flight di scheda */
    }
  }

  private releaseRefreshLock(): void {
    try {
      localStorage.removeItem(OidcAuthService.REFRESH_LOCK_KEY);
    } catch {
      /* niente da fare */
    }
  }

  /**
   * Aspetta che la scheda col lock scriva un token con scadenza più avanti di
   * quella che avevamo. Torna false se non arriva entro il TTL: il lock era
   * orfano e tocca a noi.
   */
  private async waitForTokenFromOtherTab(previousExpiration: number | null): Promise<boolean> {
    const deadline = Date.now() + OidcAuthService.REFRESH_LOCK_TTL_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const now = this.oauthService.getAccessTokenExpiration();
      if (now && (!previousExpiration || now > previousExpiration)) return true;
      if (!this.refreshLockHeldByOtherTab()) break;
    }
    return false;
  }

  /**
   * Carica il documento di discovery OIDC da Keycloak.
   * Da chiamare dopo configure() nell'APP_INITIALIZER.
   * @returns true se l'utente è già autenticato (token valido in sessione)
   */
  async initialize(): Promise<boolean> {
    try {
      await this.oauthService.loadDiscoveryDocument();
    } catch (err) {
      console.warn('[OIDC] Discovery fallita, si usano gli endpoint statici:', err);
    }

    // tryLogin() a parte, e non più incatenato alla discovery: prima un
    // errore qui veniva loggato come "discovery fallita" e ingoiato, quindi
    // il code tornato da Keycloak non veniva mai scambiato e l'app ripartiva
    // verso il login all'infinito. Ora il motivo vero viene registrato e
    // mostrato all'utente quando i tentativi finiscono.
    try {
      await this.oauthService.tryLogin();
    } catch (err) {
      const detail = this.describeLoginError(err);
      console.error('[OIDC] Scambio del code fallito:', detail, err);
      this.storeLoginError(detail);
    }

    let hasToken = this.oauthService.hasValidAccessToken();

    // Access token scaduto ma refresh token ancora in storage: la sessione
    // può essere ancora buona. Rinfrescala QUI, prima che parta il router,
    // o il guard manderebbe a Keycloak un utente che non aveva bisogno di
    // rifare il giro (e in background, a timer throttlati, è il caso normale
    // del rientro sulla scheda).
    if (!hasToken && this.oauthService.getRefreshToken()) {
      await this.refreshNow();
      hasToken = this.oauthService.hasValidAccessToken();
    }

    if (hasToken) {
      // Login riuscito (o sessione già valida): riparti da zero col contatore
      // e libera il lock, così le altre schede possono proseguire.
      this.resetLoginAttempts();
      this.clearFlowLock();
      // Arma il timer: al session restore `token_received` non viene emesso,
      // quindi senza questa chiamata nessuno lo farebbe partire.
      this.scheduleRefresh();
    }
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
    // Un'altra scheda è già in volo verso Keycloak: se partissimo anche noi
    // ci sovrascriveremmo nonce e code_verifier a vicenda (localStorage è uno
    // per origin) e nessuna delle due completerebbe mai il login.
    const lock = this.readFlowLock();
    if (lock && lock.tabId !== this.tabId && Date.now() - lock.ts < OidcAuthService.FLOW_LOCK_TTL_MS) {
      console.warn('[OIDC] Login già in corso in un\'altra scheda: attendo il suo token');
      this.waitForOtherTabLogin();
      return;
    }

    const attempts = this.bumpLoginAttempts();
    if (attempts > OidcAuthService.MAX_LOGIN_ATTEMPTS) {
      console.error(`[OIDC] ${attempts - 1} tentativi di login falliti di fila: mi fermo`);
      this.waitingForOtherTab.set(false);
      this.clearFlowLock();
      this.injector
        .get(Router)
        .navigate(['/unauthorized'], { queryParams: { reason: 'login_loop' } });
      return;
    }

    this.writeFlowLock();
    this.oauthService.initCodeFlow();
  }

  /**
   * Riprova il login azzerando contatore e lock. Usato dal bottone "Riprova"
   * della pagina d'errore, dopo che l'utente ha chiuso le altre schede.
   */
  retryLogin(): void {
    this.resetLoginAttempts();
    this.clearFlowLock();
    this.clearLoginError();
    this.login();
  }

  /** Motivo tecnico dell'ultimo login fallito (per la pagina d'errore). */
  getLoginErrorDetail(): string | null {
    try {
      return sessionStorage.getItem(OidcAuthService.LOGIN_ERROR_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Aspetta che la scheda che ha preso il lock porti a casa il token: appena
   * compare in localStorage ricarichiamo e proseguiamo con la sua sessione.
   * Se non arriva entro il TTL riprendiamo il giro per conto nostro, così un
   * lock orfano (scheda chiusa a metà login) non blocca l'app.
   */
  private waitForOtherTabLogin(): void {
    if (this.waitingForOtherTab()) return;
    this.waitingForOtherTab.set(true);

    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (this.oauthService.hasValidAccessToken()) {
        clearInterval(timer);
        window.location.reload();
        return;
      }
      const lock = this.readFlowLock();
      const lockStale = !lock || Date.now() - lock.ts > OidcAuthService.FLOW_LOCK_TTL_MS;
      if (lockStale && Date.now() - startedAt > OidcAuthService.FLOW_LOCK_TTL_MS) {
        clearInterval(timer);
        this.waitingForOtherTab.set(false);
        this.clearFlowLock();
        this.login();
      }
    }, 1000);
  }

  private readFlowLock(): { tabId: string; ts: number } | null {
    try {
      const raw = localStorage.getItem(OidcAuthService.FLOW_LOCK_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed?.tabId === 'string' && typeof parsed?.ts === 'number' ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeFlowLock(): void {
    try {
      localStorage.setItem(
        OidcAuthService.FLOW_LOCK_KEY,
        JSON.stringify({ tabId: this.tabId, ts: Date.now() }),
      );
    } catch {
      /* storage non disponibile: si prosegue senza lock */
    }
  }

  private clearFlowLock(): void {
    try {
      localStorage.removeItem(OidcAuthService.FLOW_LOCK_KEY);
    } catch {
      /* niente da fare */
    }
  }

  private bumpLoginAttempts(): number {
    const next = this.readLoginAttempts() + 1;
    try {
      sessionStorage.setItem(OidcAuthService.LOGIN_ATTEMPTS_KEY, String(next));
    } catch {
      /* senza storage il tetto non è applicabile: meglio provare che bloccare */
    }
    return next;
  }

  private readLoginAttempts(): number {
    try {
      return Number(sessionStorage.getItem(OidcAuthService.LOGIN_ATTEMPTS_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  private resetLoginAttempts(): void {
    try {
      sessionStorage.removeItem(OidcAuthService.LOGIN_ATTEMPTS_KEY);
    } catch {
      /* niente da fare */
    }
  }

  private storeLoginError(detail: string): void {
    try {
      sessionStorage.setItem(OidcAuthService.LOGIN_ERROR_KEY, detail);
    } catch {
      /* niente da fare */
    }
  }

  private clearLoginError(): void {
    try {
      sessionStorage.removeItem(OidcAuthService.LOGIN_ERROR_KEY);
    } catch {
      /* niente da fare */
    }
  }

  /** Rende leggibile l'errore di angular-oauth2-oidc (che emette OAuthErrorEvent). */
  private describeLoginError(err: any): string {
    const type = err?.type;
    if (type === 'invalid_nonce_in_state') {
      return 'state/nonce non corrispondente (invalid_nonce_in_state): il login è stato ' +
        'iniziato da un\'altra scheda o lo storage del browser è stato ripulito';
    }
    if (type === 'code_error') {
      return `Keycloak ha rifiutato il code: ${err?.params?.error || 'code_error'}`;
    }
    if (type === 'token_error') {
      return `scambio del code fallito al token endpoint: ${err?.params?.error || 'token_error'}`;
    }
    return err?.message || type || 'errore sconosciuto durante il login';
  }

  /**
   * Esegue il logout da Keycloak e pulisce lo stato locale.
   */
  logout(): void {
    this.currentUser.set(null);
    this.resetLoginAttempts();
    this.clearFlowLock();
    this.cancelRefresh();
    this.releaseRefreshLock();
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
      // Sessione completa: il giro di login è chiuso davvero.
      this.resetLoginAttempts();
      this.clearLoginError();
      this.clearFlowLock();
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
    // Ripartenza voluta dall'utente: azzera contatore, lock ed errore, o la
    // pagina d'errore si ripresenterebbe al ritorno da Keycloak.
    this.resetLoginAttempts();
    this.clearFlowLock();
    this.clearLoginError();
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
