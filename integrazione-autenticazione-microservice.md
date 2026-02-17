# Integrazione Main App con Curandis Auth Microservice

## Contesto

La Main App (agenda.curandis.cloud) è un'applicazione Angular multi-tenant per gestione di agende mediche, operatori, pazienti. Attualmente ha un unico schema `public` PostgreSQL e accesso diretto al software senza autenticazione centralizzata.

L'**Auth Microservice** (`api.curandis.cloud`) è già operativo e gestisce:
- Autenticazione via Keycloak (Identity Provider)
- Internal JWT per comunicazione sicura tra frontend e backend
- Multi-tenancy con schema PostgreSQL separati per tenant
- User mapping con stato `pending` → `active` per il linking utenti
- Cookie HttpOnly `curandis_auth_token` per trasporto token sicuro
- Cifratura PHI (Protected Health Information) via Transit Engine

La Main App deve integrarsi con l'Auth Microservice per autenticazione, risoluzione tenant e gestione utenti/operatori.

---

## PARTE 1: Infrastruttura — Dominio e Risoluzione Tenant

### 1.1 Struttura domini

```
*.curandis.cloud          → Main App (Angular)
api.curandis.cloud        → Auth Microservice (NestJS)
tenants.curandis.cloud    → Frontend Auth (gestione tenant/utenti)
auth.curandis.cloud       → Frontend Auth (alternativo)
```

Ogni tenant ha un dominio di terzo livello:
```
demo4.curandis.cloud      → Main App per tenant "demo4"
clinica1.curandis.cloud   → Main App per tenant "clinica1"
```

### 1.2 Risoluzione tenant dal dominio

La Main App deve estrarre l'alias del tenant dall'hostname:

```typescript
// tenant-resolver.service.ts
@Injectable({ providedIn: 'root' })
export class TenantResolverService {
  private readonly NON_TENANT_SUBDOMAINS = [
    'api', 'auth', 'tenants', 'my', 'www', 'agenda'
  ];

  /**
   * Estrae l'alias del tenant dall'hostname corrente.
   * Es: "demo4.curandis.cloud" → "demo4"
   * Es: "api.curandis.cloud" → null (non è un tenant)
   * Es: "localhost:4200" → null (development)
   */
  getTenantAlias(): string | null {
    const hostname = window.location.hostname;

    // Development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // In development, usare env var o query param
      return environment.defaultTenant || null;
    }

    // Estrai il sottodominio
    const parts = hostname.split('.');
    if (parts.length < 3) return null; // no subdomain

    const subdomain = parts[0].toLowerCase();

    // Escludi domini di servizio
    if (this.NON_TENANT_SUBDOMAINS.includes(subdomain)) {
      return null;
    }

    return subdomain;
  }

  /**
   * Costruisce l'URL base dell'Auth API
   */
  getAuthApiUrl(): string {
    return environment.authApiUrl || 'https://api.curandis.cloud';
  }
}
```

### 1.3 Migrazione da schema `public` a schema per-tenant

Attualmente la Main App usa lo schema `public`. Deve migrare a schema separati per tenant.

**Cosa serve:**

1. **Lo schema viene creato dall'Auth Microservice** durante il provisioning del tenant
   - Schema naming: nuovi tenant → `t_` + random hex (es. `t_a1b2c3d4e5f6`)
   - Tenant esistenti → `tenant_${alias}` (es. `tenant_demo4`)

2. **L'Auth Microservice NON crea le tabelle** nello schema — lo schema è vuoto
   - La Main App riceve il nome dello schema dall'Internal JWT (campo `schemaName`)
   - La Main App è responsabile di creare le proprie tabelle nello schema tenant

3. **Conferma creazione schema**: dopo aver creato le tabelle nello schema, la Main App chiama:
   ```
   POST https://api.curandis.cloud/auth/api/confirm-schema-created
   Cookie: curandis_auth_token=<token>
   { "tenantId": "<keycloak_org_id o alias>" }
   ```

4. **Per il tenant `demo4` esistente**, lo schema è già `tenant_demo4`. Il backend Main App dovrà:
   - Migrare le tabelle da `public` a `tenant_demo4`
   - Configurare TypeORM/Sequelize per usare lo schema dal JWT

---

## PARTE 2: Autenticazione — Login, Token, Sessione

### 2.1 Pagina di Login

La Main App deve creare una pagina di login che chiama l'endpoint dell'Auth Microservice.

```typescript
// login.component.ts
@Component({
  selector: 'app-login',
  template: `
    <form (submit)="login()">
      <input [(ngModel)]="username" placeholder="Email" required />
      <input [(ngModel)]="password" type="password" placeholder="Password" required />
      @if (errorMessage()) {
        <div class="error">{{ errorMessage() }}</div>
      }
      <button type="submit" [disabled]="loading()">Accedi</button>
    </form>
  `
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly tenantResolver = inject(TenantResolverService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  errorMessage = signal<string | null>(null);
  loading = signal(false);

  async login() {
    const org = this.tenantResolver.getTenantAlias();
    if (!org) {
      this.errorMessage.set('Dominio non valido. Accedere da <tenant>.curandis.cloud');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.authService.loginApp(this.username, this.password, org);
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      if (error.error === 'org_mismatch') {
        this.errorMessage.set(`Il tuo account appartiene all'organizzazione "${error.tokenOrg}"`);
      } else if (error.error === 'access_denied') {
        this.errorMessage.set(error.message);
      } else {
        this.errorMessage.set('Credenziali non valide');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
```

### 2.2 AuthService — Gestione token e sessione

```typescript
// auth.service.ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tenantResolver = inject(TenantResolverService);
  private readonly router = inject(Router);

  private readonly AUTH_API = this.tenantResolver.getAuthApiUrl();

  // Stato utente corrente (dal token decodificato)
  currentUser = signal<UserInfo | null>(null);

  // Refresh token (salvato in localStorage — è l'unico modo per rinnovare)
  private refreshToken = signal<string | null>(
    localStorage.getItem('curandis_refresh_token')
  );

  /**
   * Login completo per la Main App.
   *
   * Chiama POST /auth/login-app → riceve token KC + cookie HttpOnly Internal JWT.
   * Il cookie viene impostato automaticamente dal browser (sameSite: 'lax', domain: .curandis.cloud).
   * La Main App NON ha accesso diretto al cookie (è HttpOnly).
   */
  async loginApp(username: string, password: string, org: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginAppResponse>(`${this.AUTH_API}/auth/login-app`, {
        username, password, org
      }, { withCredentials: true })  // IMPORTANTE: invia/riceve cookies cross-origin
    );

    // Salva refresh_token per il rinnovo
    localStorage.setItem('curandis_refresh_token', response.refresh_token);
    this.refreshToken.set(response.refresh_token);

    // Carica dati utente dal cookie appena impostato
    await this.loadCurrentUser();
  }

  /**
   * Carica i dati utente corrente validando il cookie Internal JWT.
   *
   * IMPORTANTE: Il cookie è HttpOnly → non leggibile da JavaScript.
   * Bisogna chiamare l'Auth API per ottenere il payload.
   */
  async loadCurrentUser(): Promise<UserInfo | null> {
    try {
      const result = await firstValueFrom(
        this.http.post<ValidateTokenResponse>(
          `${this.AUTH_API}/auth/api/validate-token`,
          {},
          { withCredentials: true }
        )
      );

      if (result.valid) {
        const user: UserInfo = {
          userId: result.payload.sub,
          email: result.payload.email,
          name: result.payload.name,
          roles: result.payload.roles,
          tenantId: result.payload.tenantId,
          orgId: result.payload.orgId,
          schemaName: result.payload.schemaName,
          mappingStatus: result.payload.mappingStatus,
        };
        this.currentUser.set(user);
        return user;
      }
    } catch {
      this.currentUser.set(null);
    }
    return null;
  }

  /**
   * Rinnova il token usando il Keycloak refresh_token.
   *
   * Il server imposta un nuovo cookie HttpOnly + restituisce un nuovo refresh_token.
   * NOTA: Il refresh_token Keycloak ha rotation — quello vecchio diventa invalido.
   */
  async renewToken(): Promise<boolean> {
    const rt = this.refreshToken();
    if (!rt) return false;

    try {
      const response = await firstValueFrom(
        this.http.post<RenewResponse>(`${this.AUTH_API}/auth/renew`, {
          refresh_token: rt
        }, { withCredentials: true })
      );

      // Aggiorna il refresh_token (rotation Keycloak)
      localStorage.setItem('curandis_refresh_token', response.refresh_token);
      this.refreshToken.set(response.refresh_token);

      // Ricarica dati utente dal nuovo cookie
      await this.loadCurrentUser();
      return true;
    } catch {
      // Refresh fallito → sessione scaduta
      this.clearSession();
      return false;
    }
  }

  /**
   * Logout completo.
   *
   * Chiama POST /auth/logout-app → revoca sessioni AuthDB + invalida SSO Keycloak + cancella cookie.
   */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.AUTH_API}/auth/logout-app`, {}, { withCredentials: true })
      );
    } catch {
      // Logout fallito → cancella comunque il lato client
    }
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /**
   * Verifica se l'utente è autenticato.
   */
  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  /**
   * Verifica se l'utente ha uno dei ruoli specificati.
   */
  hasRole(roles: string[]): boolean {
    const user = this.currentUser();
    if (!user) return false;
    return roles.some(r => user.roles.includes(r));
  }

  /**
   * Verifica se il mapping utente è completato (linked).
   * Un utente con mapping 'pending' è autenticato ma non abbinato a un operatore.
   */
  isLinked(): boolean {
    return this.currentUser()?.mappingStatus === 'active';
  }

  private clearSession(): void {
    localStorage.removeItem('curandis_refresh_token');
    this.refreshToken.set(null);
    this.currentUser.set(null);
  }
}

// Interfacce
interface LoginAppResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  kc_expires_in: number;
  internal_expires_in: number;
}

interface RenewResponse {
  success: boolean;
  expires_in: number;
  refresh_token: string;
  access_token: string;
}

interface ValidateTokenResponse {
  valid: boolean;
  payload: {
    sub: string;        // Keycloak user UUID
    email: string;
    name: string;
    roles: string[];    // Es: ['admin', 'medico', 'operatore']
    tenantId: string;   // Alias tenant (es. 'demo4')
    orgId: string;      // Uguale a tenantId
    schemaName: string; // Schema PostgreSQL (es. 'tenant_demo4' o 't_a1b2c3d4')
    mappingStatus: string; // 'pending' | 'active' | 'disabled'
  };
}

interface UserInfo {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  tenantId: string;
  orgId: string;
  schemaName: string;
  mappingStatus: string;
}
```

### 2.3 HTTP Interceptor — Auto-renew su 401

```typescript
// auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const tenantResolver = inject(TenantResolverService);

  // Aggiungi withCredentials per tutte le chiamate all'Auth API
  if (req.url.startsWith(tenantResolver.getAuthApiUrl())) {
    req = req.clone({ withCredentials: true });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/renew')) {
        // Token scaduto → prova a rinnovare
        return from(authService.renewToken()).pipe(
          switchMap(renewed => {
            if (renewed) {
              // Retry la richiesta originale (il nuovo cookie è già impostato)
              return next(req);
            }
            // Rinnovo fallito → redirect al login
            authService.logout();
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};

// Registrazione in app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    // ...
  ],
};
```

### 2.4 Route Guard — Protezione rotte

```typescript
// auth.guard.ts
export const authGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Se non abbiamo dati utente in memoria, prova a caricarli dal cookie
  if (!authService.isAuthenticated()) {
    const user = await authService.loadCurrentUser();
    if (!user) {
      router.navigate(['/login']);
      return false;
    }
  }

  // Verifica ruoli se la rotta li richiede
  const requiredRoles = route.data?.['roles'] as string[];
  if (requiredRoles && !authService.hasRole(requiredRoles)) {
    router.navigate(['/unauthorized']);
    return false;
  }

  return true;
};

// Guard per verificare il linking (mapping active)
export const linkedGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (!authService.isLinked()) {
    // Utente autenticato ma non abbinato → pagina di attesa
    router.navigate(['/pending-activation']);
    return false;
  }

  return true;
};

// Configurazione rotte
const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'pending-activation', component: PendingActivationComponent, canActivate: [authGuard] },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard, linkedGuard]
  },
  {
    path: 'admin/users',
    component: UserManagementComponent,
    canActivate: [authGuard, linkedGuard],
    data: { roles: ['admin', 'amministratore', 'superadmin'] }
  },
  {
    path: 'patients',
    component: PatientsComponent,
    canActivate: [authGuard, linkedGuard],
    data: { roles: ['medico', 'infermiere', 'admin'] }
  },
];
```

### 2.5 APP_INITIALIZER — Verifica sessione al caricamento

```typescript
// app.config.ts
function initializeAuth(authService: AuthService): () => Promise<void> {
  return async () => {
    // Al caricamento dell'app, verifica se il cookie Internal JWT è valido
    await authService.loadCurrentUser();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthService],
      multi: true,
    },
  ],
};
```

---

## PARTE 3: Internal JWT — Struttura e Uso

### 3.1 Payload dell'Internal JWT

Il cookie `curandis_auth_token` contiene un JWT con questo payload:

```json
{
  "sub": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "mario.rossi@clinic.it",
  "name": "Mario Rossi",
  "roles": ["medico", "admin"],
  "tenantId": "demo4",
  "orgId": "demo4",
  "schemaName": "tenant_demo4",
  "mappingStatus": "active",
  "iss": "curandis-auth",
  "iat": 1707753600,
  "exp": 1707757200
}
```

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `sub` | string | UUID Keycloak dell'utente |
| `email` | string | Email dell'utente |
| `name` | string | Nome completo |
| `roles` | string[] | Ruoli Keycloak filtrati (senza system roles) |
| `tenantId` | string | Alias del tenant (es. "demo4") |
| `orgId` | string | Uguale a tenantId |
| `schemaName` | string | Nome dello schema PostgreSQL per questo tenant |
| `mappingStatus` | string | `pending` / `active` / `disabled` |
| `iss` | string | Sempre `"curandis-auth"` |
| `iat` | number | Timestamp emissione (epoch seconds) |
| `exp` | number | Timestamp scadenza (epoch seconds) |

### 3.2 Trasporto del token

- **Cookie HttpOnly** `curandis_auth_token`:
  - `domain: .curandis.cloud` (condiviso tra tutti i sottodomini)
  - `httpOnly: true` (NON accessibile da JavaScript)
  - `secure: true` (solo HTTPS in produzione)
  - `sameSite: lax`
  - `maxAge: 3600000` (1 ora default, configurabile)

- Il browser **invia automaticamente** il cookie con ogni richiesta a `*.curandis.cloud` — basta usare `withCredentials: true` nelle chiamate HTTP.

### 3.3 Ciclo di vita del token

```
Login (POST /auth/login-app)
  → Cookie impostato (HttpOnly) + refresh_token restituito nel body
  → Salva refresh_token in localStorage

Navigazione normale
  → Browser invia cookie automaticamente con ogni richiesta
  → Backend della Main App valida il cookie via POST /auth/api/validate-token

Token scaduto (401)
  → Interceptor cattura il 401
  → Chiama POST /auth/renew con il refresh_token salvato
  → Nuovo cookie impostato + nuovo refresh_token restituito
  → Retry della richiesta originale

Logout (POST /auth/logout-app)
  → Cookie cancellato dal server
  → Sessioni AuthDB revocate
  → SSO Keycloak invalidato
  → localStorage pulito
```

---

## PARTE 4: User Mapping e Linking Operatori

### 4.1 Il concetto di "mapping"

Ogni utente Keycloak che accede a un tenant ha un record `user_mapping` in AuthDB:

```
user_mapping:
  id: UUID
  keycloakUserId: "f47ac10b-..."     ← UUID Keycloak
  tenantId: UUID                      ← FK a tenant_auth
  appUserReference: "operator-uuid"   ← ID operatore nella Main App (NULL se pending)
  status: "pending" | "active" | "disabled"
  linkedAt: timestamp | null
```

### 4.2 Ciclo di vita del mapping

```
1. CREAZIONE UTENTE (dal frontend Auth o dalla Main App)
   → Utente creato in Keycloak + user_mapping con status='pending'

2. PRIMO LOGIN dell'utente
   → JwtStrategy crea il mapping se non esiste (backup)
   → mappingStatus='pending' nel JWT

3. LINKING (la Main App abbina l'utente a un operatore)
   → La Main App chiama POST /auth/api/link-mapping
   → user_mapping.status diventa 'active'
   → user_mapping.appUserReference = ID dell'operatore
   → Ai login successivi, mappingStatus='active' nel JWT

4. DISATTIVAZIONE (se necessario)
   → POST /auth/api/disable-user
   → user_mapping.status='disabled'
   → Account Keycloak disabilitato
   → Sessioni revocate
```

### 4.3 Cosa deve fare la Main App per il linking

La Main App gestisce operatori/medici/infermieri nel proprio database. Quando un utente auth viene creato, la Main App deve:

1. **Rilevare utenti pendenti**: chiamare periodicamente o on-demand:
   ```
   GET https://api.curandis.cloud/auth/api/pending-users
   Cookie: curandis_auth_token=<token di un admin>
   ```
   Response:
   ```json
   {
     "data": [
       {
         "id": "mapping-uuid",
         "keycloakUserId": "kc-user-uuid",
         "tenantId": "tenant-auth-uuid",
         "status": "pending",
         "createdAt": "2026-02-12T10:00:00.000Z"
       }
     ],
     "total": 1
   }
   ```

2. **Abbinare a un operatore esistente** (o crearne uno nuovo nel proprio DB), poi confermare il linking:
   ```
   POST https://api.curandis.cloud/auth/api/link-mapping
   Cookie: curandis_auth_token=<token admin>
   Content-Type: application/json

   {
     "userMappingId": "mapping-uuid",
     "appUserReference": "operator-uuid-nel-main-db"
   }
   ```
   Response:
   ```json
   {
     "success": true,
     "userMappingId": "mapping-uuid",
     "status": "active",
     "linkedAt": "2026-02-12T10:05:00.000Z"
   }
   ```

3. **Verificare lo stato completo di un utente**:
   ```
   GET https://api.curandis.cloud/auth/api/user-status/<keycloak-uuid>
   Cookie: curandis_auth_token=<token admin>
   ```
   Response:
   ```json
   {
     "keycloakUserId": "kc-user-uuid",
     "mapping": {
       "id": "mapping-uuid",
       "status": "active",
       "appUserReference": "operator-uuid",
       "linkedAt": "2026-02-12T10:05:00.000Z",
       "createdAt": "2026-02-12T10:00:00.000Z"
     },
     "keycloakEnabled": true,
     "activeSessions": 1
   }
   ```

---

## PARTE 5: Endpoint Auth API — Riferimento Completo

**Base URL**: `https://api.curandis.cloud`

Tutte le chiamate che usano il cookie richiedono `withCredentials: true` (Angular) o `credentials: 'include'` (fetch).

### 5.1 Autenticazione

| Metodo | Path | Auth | Descrizione |
|--------|------|------|-------------|
| `POST` | `/auth/login-app` | Nessuna | Login completo → cookie + tokens |
| `POST` | `/auth/renew` | Nessuna | Rinnovo token via refresh_token → nuovo cookie |
| `POST` | `/auth/logout-app` | Nessuna | Logout completo (revoca sessioni + KC + clear cookie) |
| `POST` | `/auth/logout` | Nessuna | Logout semplice (solo clear cookie) |
| `GET` | `/auth/health` | Nessuna | Health check |

#### `POST /auth/login-app`

**Request:**
```json
{
  "username": "mario.rossi@clinic.it",
  "password": "secret",
  "org": "demo4"
}
```

`org` = alias del tenant, estratto dal dominio di terzo livello.

**Response 200:**
```json
{
  "access_token": "<KC token>",
  "id_token": "<KC token>",
  "refresh_token": "<KC token>",
  "kc_expires_in": 300,
  "internal_expires_in": 3600
}
```
+ **Cookie** `curandis_auth_token` impostato (HttpOnly).

**Errori:**
- `401` — Credenziali non valide
- `403 { error: 'org_mismatch', tokenOrg: 'altro_tenant' }` — Utente appartiene a un altro tenant
- `403 { error: 'access_denied', message: '...' }` — Tenant sospeso o utente disabilitato

#### `POST /auth/renew`

**Request:**
```json
{ "refresh_token": "<KC refresh token salvato>" }
```

**Response 200:**
```json
{
  "success": true,
  "expires_in": 3600,
  "refresh_token": "<NUOVO KC refresh token>",
  "access_token": "<NUOVO KC access token>"
}
```
+ **Cookie** aggiornato.

**IMPORTANTE**: Il refresh_token ha rotation Keycloak — dopo ogni rinnovo, il vecchio refresh_token diventa invalido. Salvare sempre il nuovo.

#### `POST /auth/logout-app`

Non richiede autenticazione (funziona anche con token scaduto).

**Response 200:**
```json
{ "success": true, "revokedSessions": 3, "keycloakLogout": true }
```

### 5.2 API per la Main App (protette da Internal JWT cookie)

Tutti questi endpoint richiedono il cookie `curandis_auth_token` valido.

| Metodo | Path | Descrizione |
|--------|------|-------------|
| `POST` | `/auth/api/validate-token` | Valida cookie, ritorna payload JWT |
| `GET` | `/auth/api/pending-users` | Lista user_mapping pending per il tenant corrente |
| `POST` | `/auth/api/link-mapping` | Conferma linking operatore ↔ utente auth |
| `GET` | `/auth/api/user-status/:keycloakId` | Stato completo utente (mapping + KC + sessioni) |
| `POST` | `/auth/api/disable-user` | Disattiva utente (KC + mapping + revoca sessioni) |
| `POST` | `/auth/api/reactivate-user` | Riattiva utente disabilitato |
| `POST` | `/auth/api/confirm-schema-created` | Conferma che la Main App ha creato lo schema |

#### `POST /auth/api/validate-token`

**Non richiede InternalJwtGuard** (il token viene validato internamente). Usato dalla Main App per verificare se l'utente ha una sessione valida.

**Response 200:**
```json
{
  "valid": true,
  "payload": {
    "sub": "kc-user-uuid",
    "email": "mario@clinic.it",
    "name": "Mario Rossi",
    "roles": ["medico", "admin"],
    "tenantId": "demo4",
    "orgId": "demo4",
    "schemaName": "tenant_demo4",
    "mappingStatus": "active"
  }
}
```

**Response 401:** Token invalido o scaduto.

#### `POST /auth/api/link-mapping`

**Request:**
```json
{
  "userMappingId": "<uuid del record user_mapping>",
  "appUserReference": "<uuid dell'operatore nel DB della Main App>"
}
```

**Response 200:**
```json
{
  "success": true,
  "userMappingId": "...",
  "status": "active",
  "linkedAt": "2026-02-12T10:05:00.000Z"
}
```

#### `POST /auth/api/disable-user`

**Request:**
```json
{
  "keycloakUserId": "<kc-uuid>",
  "tenantId": "<alias-opzionale>"
}
```

**Response 200:**
```json
{
  "success": true,
  "revokedSessions": 2,
  "keycloakDisabled": true
}
```

#### `POST /auth/api/reactivate-user`

**Request:**
```json
{
  "keycloakUserId": "<kc-uuid>",
  "tenantId": "<alias-opzionale>"
}
```

**Response 200:**
```json
{ "success": true, "status": "active" }
```

### 5.3 Provisioning (per creare utenti dalla Main App)

| Metodo | Path | Descrizione |
|--------|------|-------------|
| `POST` | `/auth/provision-user` | Crea utente KC + mapping pending |
| `POST` | `/auth/provision-users/bulk` | Crea utenti in batch |
| `DELETE` | `/auth/provision-user/:keycloakId` | Elimina utente KC + disabilita mapping |
| `PATCH` | `/auth/provision-user/:keycloakId/roles` | Aggiorna ruoli KC |
| `POST` | `/auth/provision-user/:keycloakId/reset-password` | Reset password |

#### `POST /auth/provision-user`

Crea un utente in Keycloak e il relativo mapping pending. Protetto da InternalJwtGuard.

**Request:**
```json
{
  "email": "dr.rossi@clinic.it",
  "firstName": "Mario",
  "lastName": "Rossi",
  "roles": ["medico"],
  "tenantId": "<keycloak-org-id>",
  "temporaryPassword": "Temp123!"
}
```

**NOTA**: `tenantId` qui è il Keycloak Organization ID, non l'alias. Per ottenere l'org ID, usare l'alias dal JWT dell'utente admin corrente.

**Response 201:**
```json
{
  "success": true,
  "keycloakId": "<kc-uuid>",
  "temporaryPassword": "Temp123!",
  "email": "dr.rossi@clinic.it"
}
```

### 5.4 Cifratura PHI

| Metodo | Path | Descrizione |
|--------|------|-------------|
| `POST` | `/auth/encrypt` | Cifra dati PHI con chiave Transit del tenant |
| `POST` | `/auth/decrypt` | Decifra dati PHI |

**Encrypt request:**
```json
{ "data": "dato sensibile del paziente" }
```

**Response:**
```json
{ "ciphertext": "vault:v1:abc123..." }
```

**Decrypt request:**
```json
{ "ciphertext": "vault:v1:abc123..." }
```

**Response:**
```json
{ "plaintext": "dato sensibile del paziente" }
```

---

## PARTE 6: Schema Tenant e Backend Main App

### 6.1 Connessione al database — Credenziali da OpenBao

> **IMPORTANTE**: Le credenziali PostgreSQL NON vanno hardcodate nel `.env` in produzione.
> Vengono ottenute da OpenBao tramite la libreria `@curandis/openbao-core` (vedi PARTE 11).

Il bootstrap del backend Main App prevede:

1. `main.ts` crea `OpenbaoBaseService`, ottiene le credenziali DB da OpenBao
2. Le credenziali vengono passate a `AppModule.forRootAsync()` per configurare TypeORM
3. `MainDbCredentialManager` gestisce il hot-swap del DataSource quando le credenziali ruotano

Vedi **PARTE 11.3** per il codice di `main.ts` e **PARTE 11.10** per l'`AppModule`.

### 6.2 Risoluzione schema nel backend Main App

Il backend della Main App riceve lo `schemaName` dall'Internal JWT. Deve usarlo per tutte le query.

```typescript
// Per un backend NestJS della Main App:

// Middleware o Guard che estrae il tenant dallo Internal JWT
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly httpService: HttpService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const cookie = req.cookies?.curandis_auth_token;
    if (!cookie) {
      throw new UnauthorizedException('No auth cookie');
    }

    // Valida il token chiamando l'Auth Microservice
    const response = await firstValueFrom(
      this.httpService.post('https://api.curandis.cloud/auth/api/validate-token', {}, {
        headers: { Cookie: `curandis_auth_token=${cookie}` },
      })
    );

    if (!response.data.valid) {
      throw new UnauthorizedException('Invalid token');
    }

    // Salva il contesto tenant nella request
    req['tenantContext'] = {
      userId: response.data.payload.sub,
      email: response.data.payload.email,
      name: response.data.payload.name,
      roles: response.data.payload.roles,
      tenantId: response.data.payload.tenantId,
      schemaName: response.data.payload.schemaName,
      mappingStatus: response.data.payload.mappingStatus,
    };

    next();
  }
}
```

### 6.3 Uso dello schema nelle query

```typescript
// TypeORM: set search_path per ogni richiesta
const schemaName = req['tenantContext'].schemaName;
await queryRunner.query(`SET search_path TO "${schemaName}", public`);

// Oppure usa schemaName nelle query dirette
const users = await queryRunner.query(
  `SELECT * FROM "${schemaName}".operators WHERE is_active = true`
);
```

### 6.4 Tabelle da creare nello schema tenant

Lo schema tenant deve contenere le tabelle operative della Main App. Ad esempio:

```sql
-- Tabella operatori (già suggerita nella specifica dell'Auth Microservice)
CREATE TABLE IF NOT EXISTS "{schema}".operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_id varchar(255),
  operator_type varchar(50) NOT NULL,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  email varchar(255),
  phone varchar(50),
  fiscal_code varchar(20),
  specialization varchar(100),
  registration_number varchar(50),
  department varchar(100),
  qualification varchar(100),
  contract_type varchar(50),
  hire_date date,
  badge_number varchar(50),
  is_active boolean DEFAULT true,
  linked_at timestamp,
  notes text,
  metadata jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_operators_keycloak_id ON "{schema}".operators (keycloak_id);
CREATE INDEX IF NOT EXISTS idx_operators_email ON "{schema}".operators (email);
CREATE INDEX IF NOT EXISTS idx_operators_type ON "{schema}".operators (operator_type);

-- Altre tabelle della Main App (pazienti, appuntamenti, ecc.)
CREATE TABLE IF NOT EXISTS "{schema}".patients ( ... );
CREATE TABLE IF NOT EXISTS "{schema}".appointments ( ... );
```

La tabella `operators` è la **tabella ponte** tra gli utenti autenticati (Keycloak) e le entità operative della Main App.

**Campi chiave di `operators`:**
- `keycloak_id`: UUID Keycloak dell'utente auth (NULL se operatore non ancora abbinato)
- `operator_type`: 'medico', 'infermiere', 'amministrativo', 'tecnico', 'operatore'
- `linked_at`: timestamp dell'abbinamento (NULL se non abbinato)

### 6.5 Flusso di linking: operatore ↔ utente auth

```
Scenario A: Admin crea un utente auth, poi lo abbina a un operatore esistente
──────────────────────────────────────────────────────────────────────────────

1. Admin crea utente dal frontend Auth (gestione-utenti)
   → Keycloak: utente creato + org + ruoli
   → AuthDB: user_mapping creato (status='pending')

2. Admin nella Main App vede utente pendente
   → GET /auth/api/pending-users → lista utenti pending

3. Admin seleziona operatore da abbinare
   → Nel DB Main App: UPDATE operators SET keycloak_id='kc-uuid', linked_at=NOW()
   → POST /auth/api/link-mapping { userMappingId, appUserReference: operator.id }
   → AuthDB: user_mapping.status='active'

4. Al prossimo login, l'utente ha mappingStatus='active' nel JWT


Scenario B: Admin crea un operatore nella Main App, poi gli crea l'account auth
────────────────────────────────────────────────────────────────────────────────

1. Admin nella Main App crea operatore
   → INSERT INTO operators (... keycloak_id=NULL, linked_at=NULL ...)

2. Admin decide di creare l'account auth per l'operatore
   → POST /auth/provision-user { email, firstName, lastName, roles, tenantId }
   → Keycloak: utente creato
   → AuthDB: user_mapping creato (status='pending')

3. Abbina operatore ↔ utente auth
   → UPDATE operators SET keycloak_id='kc-uuid', linked_at=NOW()
   → POST /auth/api/link-mapping { userMappingId, appUserReference: operator.id }

4. Utente attivo


Scenario C: Auto-link al primo login (email match)
───────────────────────────────────────────────────

1. Utente Keycloak fa login per la prima volta
2. JwtStrategy cerca in AuthDB il mapping → non trovato
3. Crea pending mapping automaticamente
4. L'utente riceve mappingStatus='pending'
5. L'admin nella Main App deve fare il linking manuale (Scenario A, step 2-3)
```

---

## PARTE 7: Pagine da Creare nella Main App

### 7.1 Riepilogo pagine

| Pagina | Rotta | Guard | Ruoli | Descrizione |
|--------|-------|-------|-------|-------------|
| Login | `/login` | Nessuno | — | Form login con username/password |
| Attesa Attivazione | `/pending-activation` | authGuard | — | Utente autenticato ma non abbinato |
| Dashboard | `/dashboard` | authGuard + linkedGuard | — | Pagina principale |
| Gestione Utenti | `/admin/users` | authGuard + linkedGuard | admin, amministratore | Lista operatori + linking |
| Profilo | `/profile` | authGuard | — | Profilo utente corrente |
| Non Autorizzato | `/unauthorized` | Nessuno | — | Accesso negato |

### 7.2 Pagina Login

**Funzionalità:**
- Form con email e password
- Estrae automaticamente l'org dall'hostname (`demo4.curandis.cloud` → `org: "demo4"`)
- Se il dominio non ha tenant (es. `agenda.curandis.cloud`), mostra errore o campo org manuale
- Chiama `POST /auth/login-app` con `{ username, password, org }`
- Gestisce errori specifici:
  - `org_mismatch` → "Il tuo account appartiene a un'altra organizzazione"
  - `access_denied` → Messaggio dal server (tenant sospeso, utente disabilitato)
  - `401` → "Credenziali non valide"
- Dopo login riuscito, redirect a `/dashboard` o alla pagina richiesta prima del redirect

### 7.3 Pagina Attesa Attivazione

**Quando**: L'utente è autenticato (`authGuard` passa) ma `mappingStatus === 'pending'` (non è ancora abbinato a un operatore).

**Contenuto:**
- Messaggio: "Il tuo account è stato creato ma non è ancora attivo. L'amministratore deve completare l'attivazione."
- Pulsante "Riprova" → chiama `authService.loadCurrentUser()` per verificare se nel frattempo il mapping è stato aggiornato
- Pulsante "Logout"

### 7.4 Pagina Gestione Utenti (Admin)

**Funzionalità:**

Tab 1: **Operatori abbinati** (hanno `keycloak_id` NOT NULL)
- Lista operatori con nome, tipo, email, stato
- Azioni: Modifica, Disattiva

Tab 2: **Operatori non abbinati** (hanno `keycloak_id = NULL`)
- Lista operatori senza account auth
- Azioni:
  - "Crea account auth" → `POST /auth/provision-user` + poi link-mapping
  - "Abbina a utente esistente" → dialog con lista utenti pendenti

Tab 3: **Utenti auth pendenti** (user_mapping con status='pending')
- Dati da `GET /auth/api/pending-users`
- Per ogni utente pendente, mostra keycloakUserId e data creazione
- Per avere nome/email, la Main App può interrogare `GET /auth/api/user-status/:keycloakId`
- Azioni:
  - "Abbina a operatore" → dialog per selezionare un operatore non abbinato
  - "Crea nuovo operatore" → crea operatore nel DB Main App + link-mapping

### 7.5 Flusso "Crea account auth per operatore esistente"

```typescript
async createAuthForOperator(operator: Operator) {
  // 1. Crea utente in Keycloak via Auth Microservice
  const result = await firstValueFrom(
    this.http.post<ProvisionResponse>(`${AUTH_API}/auth/provision-user`, {
      email: operator.email,
      firstName: operator.firstName,
      lastName: operator.lastName,
      roles: [this.mapOperatorTypeToRole(operator.operatorType)],
      tenantId: this.getKeycloakOrgId(),  // Keycloak org UUID
      temporaryPassword: this.generateTempPassword(),
    }, { withCredentials: true })
  );

  // 2. Aggiorna operatore nel DB locale con keycloak_id
  await this.operatorService.updateKeycloakId(operator.id, result.keycloakId);

  // 3. Trova il mapping appena creato
  const pendingUsers = await firstValueFrom(
    this.http.get<PendingUsersResponse>(`${AUTH_API}/auth/api/pending-users`, { withCredentials: true })
  );
  const mapping = pendingUsers.data.find(m => m.keycloakUserId === result.keycloakId);

  // 4. Conferma il linking
  if (mapping) {
    await firstValueFrom(
      this.http.post(`${AUTH_API}/auth/api/link-mapping`, {
        userMappingId: mapping.id,
        appUserReference: operator.id,
      }, { withCredentials: true })
    );
  }

  // 5. Comunica la password temporanea all'admin
  alert(`Account creato. Password temporanea: ${result.temporaryPassword}`);
}
```

### 7.6 Flusso "Abbina utente pendente a operatore"

```typescript
async linkPendingUserToOperator(
  pendingMapping: PendingUser,
  operatorId: string
) {
  // 1. Aggiorna operatore nel DB locale
  await this.operatorService.updateKeycloakId(operatorId, pendingMapping.keycloakUserId);

  // 2. Conferma il linking nell'Auth Microservice
  await firstValueFrom(
    this.http.post(`${AUTH_API}/auth/api/link-mapping`, {
      userMappingId: pendingMapping.id,
      appUserReference: operatorId,
    }, { withCredentials: true })
  );
}
```

---

## PARTE 8: Redirect in base alle autorizzazioni

### 8.1 Post-login routing

Dopo il login riuscito, la Main App deve redirigere in base a:

```typescript
// post-login-redirect.service.ts
@Injectable({ providedIn: 'root' })
export class PostLoginRedirectService {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  redirect(): void {
    const user = this.authService.currentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    // 1. Utente non abbinato → pagina di attesa
    if (user.mappingStatus === 'pending') {
      this.router.navigate(['/pending-activation']);
      return;
    }

    // 2. Utente disabilitato → non dovrebbe arrivarci (bloccato al login)
    if (user.mappingStatus === 'disabled') {
      this.authService.logout();
      return;
    }

    // 3. Redirect in base al ruolo principale
    if (user.roles.includes('superadmin') || user.roles.includes('admin') || user.roles.includes('amministratore')) {
      this.router.navigate(['/admin/dashboard']);
    } else if (user.roles.includes('medico')) {
      this.router.navigate(['/agenda']);
    } else if (user.roles.includes('infermiere')) {
      this.router.navigate(['/agenda']);
    } else if (user.roles.includes('operatore')) {
      this.router.navigate(['/reception']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
```

### 8.2 Menu/Navbar in base ai ruoli

```typescript
// navbar.component.ts
@Component({
  template: `
    <nav>
      <a routerLink="/dashboard">Dashboard</a>

      @if (authService.hasRole(['medico', 'admin'])) {
        <a routerLink="/agenda">Agenda</a>
      }

      @if (authService.hasRole(['medico', 'infermiere'])) {
        <a routerLink="/patients">Pazienti</a>
      }

      @if (authService.hasRole(['admin', 'amministratore'])) {
        <a routerLink="/admin/users">Gestione Utenti</a>
      }

      @if (authService.hasRole(['admin'])) {
        <a routerLink="/admin/settings">Impostazioni</a>
      }

      <button (click)="authService.logout()">Esci</button>

      <span>{{ authService.currentUser()?.name }}</span>
      <span class="badge">{{ authService.currentUser()?.roles?.join(', ') }}</span>
    </nav>
  `
})
export class NavbarComponent {
  readonly authService = inject(AuthService);
}
```

---

## PARTE 9: Ruoli Keycloak Disponibili

I ruoli che l'Auth Microservice conosce e filtra:

| Ruolo | Descrizione |
|-------|-------------|
| `superadmin` | Accesso a tutti i tenant, gestione globale |
| `admin` | Amministratore del tenant |
| `amministratore` | Alias italiano di admin |
| `medico` | Medico — accesso agenda, pazienti, referti |
| `infermiere` | Infermiere — accesso agenda, pazienti |
| `operatore` | Operatore generico — reception, accettazione |
| `tecnico` | Tecnico sanitario |

Ruoli di sistema Keycloak (filtrati automaticamente, **non** inviati nel JWT):
- `default-roles-curandis`
- `offline_access`
- `uma_authorization`

---

## PARTE 10: Checklist di Implementazione

### Frontend Angular

- [ ] `TenantResolverService` — estrae alias tenant dall'hostname
- [ ] `AuthService` — login, logout, renew, loadCurrentUser, isLinked, hasRole
- [ ] `authInterceptor` — aggiunge withCredentials, auto-renew su 401
- [ ] `authGuard` — protezione rotte con verifica sessione
- [ ] `linkedGuard` — verifica che il mapping sia active
- [ ] `APP_INITIALIZER` — verifica sessione al caricamento app
- [ ] `LoginComponent` — form login
- [ ] `PendingActivationComponent` — pagina di attesa abbinamento
- [ ] `UserManagementComponent` — gestione operatori + linking (admin)
- [ ] `PostLoginRedirectService` — redirect post-login in base a ruoli e mappingStatus
- [ ] `NavbarComponent` — menu dinamico in base ai ruoli
- [ ] Configurazione rotte con guard e ruoli

### Backend Main App

- [ ] Middleware/Guard per validazione cookie via `/auth/api/validate-token`
- [ ] Risoluzione `schemaName` dal JWT e `SET search_path` per query
- [ ] Tabella `operators` nello schema tenant (con keycloak_id, linked_at)
- [ ] API interne per CRUD operatori
- [ ] Logica di linking: update operators + call `/auth/api/link-mapping`
- [ ] Migrazione da schema `public` a schema tenant (`tenant_demo4`)
- [ ] `POST /auth/api/confirm-schema-created` dopo migrazione

### Configurazione

- [ ] Environment: `authApiUrl: 'https://api.curandis.cloud'`
- [ ] CORS: l'Auth Microservice accetta `*.curandis.cloud` con credentials
- [ ] Cookie domain `.curandis.cloud` funziona per tutti i sottodomini
- [ ] Verificare che `withCredentials: true` sia su tutte le chiamate all'Auth API

---

## PARTE 11: Libreria Condivisa `@curandis/openbao-core`

### 11.1 Contesto

L'Auth Microservice e la Main App condividono la stessa infrastruttura OpenBao per:
- **Autenticazione AppRole**: login con `role_id` + `secret_id` che ruotano ogni 24h via cron
- **Credenziali PostgreSQL**: rotate via OpenBao static roles con DataSource hot-swap
- **Resilienza**: .env hot-reload quando le credenziali scadono, retry con exponential backoff

Tutta questa logica è estratta nella libreria `@curandis/openbao-core` (in `libs/openbao-core/`) per evitare duplicazione.

La libreria supporta **due modalità di autenticazione**:

| Modalità | Quando usarla | Credenziali nell'app |
|----------|---------------|---------------------|
| **AppRole diretto** | Development, deployment semplici | `role_id` + `secret_id` nel `.env` |
| **Agent proxy** (consigliato) | Produzione | Nessuna — l'Agent gestisce tutto |

### 11.2 Cosa fornisce la libreria

| Export | Tipo | Descrizione |
|--------|------|-------------|
| `OpenbaoBaseService` | Classe | AppRole/Agent auth, token renewal, N database credential sources |
| `DatabaseCredentialManagerBase` | Classe | DataSource hot-swap su evento di rotazione credenziali |
| `OpenbaoBaseModule` | NestJS Module | `forRoot(service)` per registrare il servizio |
| `createOpenbaoService()` | Factory | Helper per bootstrap pre-NestJS |
| `OpenbaoBaseConfig` | Interface | Config (endpoint, agentMode, roleId, secretId, agentTokenPath) |
| `DatabaseCredentialConfig` | Interface | Config per sorgente credenziali DB |
| `DbRotationConfig` | Interface | Config per DataSource rotation handler |

### 11.3 Uso nella Main App — Bootstrap con Agent proxy (CONSIGLIATO per produzione)

```typescript
import { createOpenbaoService } from '@curandis/openbao-core';

// L'Agent gira sulla stessa VM e gestisce l'autenticazione
// Nessun role_id/secret_id necessario nell'app
const { service: openbaoService, credentials } = await createOpenbaoService({
  config: {
    endpoint: 'http://127.0.0.1:8200',  // Agent proxy locale
    agentMode: true,
    // opzionale: leggere il token dal file sink dell'Agent
    // agentTokenPath: '/var/run/openbao-agent/main-token',
  },
  credentialSources: [
    {
      name: 'main-db',
      staticCredsPath: 'database/static-creds/postgres-main-service-account',
      rotationEventName: 'credentials.main-db.rotated',
      credentialRefreshIntervalMs: 6 * 60 * 60 * 1000,
    },
  ],
});

const mainDbCreds = credentials['main-db'];

const app = await NestFactory.create(
  AppModule.forRootAsync({ mainDbCredentials: mainDbCreds, openbaoService })
);

const eventEmitter = app.get(EventEmitter2);
openbaoService.setEventEmitter(eventEmitter);
```

### 11.3b Alternativa — Bootstrap con AppRole diretto (development)

```typescript
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createOpenbaoService } from '@curandis/openbao-core';

const envFilePath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envFilePath });

// AppRole diretto — role_id e secret_id nel .env
const { service: openbaoService, credentials } = await createOpenbaoService({
  config: {
    endpoint: process.env.OPENBAO_ADDR || 'https://openbao.curandis.cloud',
    roleId: process.env.CURANDIS_OPENBAO_ROLE_ID,
    secretId: process.env.CURANDIS_OPENBAO_SECRET_ID,
    envFilePath,  // per hot-reload quando il cron rigenera le chiavi
  },
  credentialSources: [
    {
      name: 'main-db',
      staticCredsPath: 'database/static-creds/postgres-main-service-account',
      rotationEventName: 'credentials.main-db.rotated',
      credentialRefreshIntervalMs: 6 * 60 * 60 * 1000, // 6h
      fallbackEnvUsername: 'MAIN_DB_USERNAME',
      fallbackEnvPassword: 'MAIN_DB_PASSWORD',
    },
  ],
});

// credentials['main-db'] contiene { username, password }
const mainDbCreds = credentials['main-db'];

// Passa a NestJS
const app = await NestFactory.create(
  AppModule.forRootAsync({ mainDbCredentials: mainDbCreds, openbaoService })
);

// IMPORTANTE: Attach EventEmitter DOPO la creazione dell'app
const eventEmitter = app.get(EventEmitter2);
openbaoService.setEventEmitter(eventEmitter);
```

### 11.4 Credential Rotation Handler nella Main App

```typescript
// main-db-credential-manager.service.ts
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseCredentialManagerBase } from '@curandis/openbao-core';

@Injectable()
export class MainDbCredentialManager extends DatabaseCredentialManagerBase {
  constructor(
    @InjectDataSource() mainDataSource: DataSource,   // default DataSource
    eventEmitter: EventEmitter2,
  ) {
    super(mainDataSource, eventEmitter, {
      dataSourceName: 'main',
      eventName: 'credentials.main-db.rotated',
    });
  }
}
```

### 11.5 Due livelli di rotazione automatica

```
Livello 1: OpenBao AppRole (role_id + secret_id)
  └── Cron VM alle 3:00 → rigenera chiavi → aggiorna .env
  └── OpenbaoBaseService rileva "invalid role or secret ID" →
      ricarica .env → ri-autentica automaticamente
  └── Token renewal ogni 30 min con 5 retry + exponential backoff

Livello 2: PostgreSQL Static Roles (username + password)
  └── OpenBao ruota credenziali DB automaticamente
  └── OpenbaoBaseService refresh ogni 6h → se cambiate → emette evento
  └── DatabaseCredentialManagerBase riceve evento →
      destroy DataSource → mutate options → initialize → SELECT 1
```

### 11.6 Configurazione TypeScript

Per usare `@curandis/openbao-core` nella Main App, aggiungere al `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@curandis/openbao-core": ["libs/openbao-core/src/index.ts"]
    }
  }
}
```

E nel `tsconfig.app.json` del backend Main App:
```json
{
  "include": ["src/**/*.ts", "../libs/openbao-core/src/**/*.ts"]
}
```

### 11.7 Configurazione OpenBao — GIA' COMPLETATA

La configurazione OpenBao per la Main App è stata completata. Ecco i dettagli operativi:

#### AppRole dedicato: `nestjs-main-app`

```
Nome ruolo:     nestjs-main-app
Policy:         nestjs-main-app
Token TTL:      1h
Token Max TTL:  4h
```

Il `role_id` e `secret_id` sono stati generati e vanno inseriti nel `.env` della Main App:

```env
# OpenBao AppRole — Main App
OPENBAO_ADDR=https://openbao.curandis.cloud
CURANDIS_OPENBAO_ROLE_ID=<role_id generato>
CURANDIS_OPENBAO_SECRET_ID=<secret_id generato>
```

#### Database Engine — Connessione `postgresql-main`

```
Connessione:    postgresql-main
Server:         saas.curandis.cloud:5432
Database:       curandis_main_db
SSL:            disable
Utente gestito: postgres
```

#### Static Role: `postgres-main-service-account`

```
Path OpenBao:     database/static-creds/postgres-main-service-account
DB name:          postgresql-main
Rotation period:  86400s (24h)
```

Per leggere le credenziali correnti:
```bash
bao read database/static-creds/postgres-main-service-account
```

#### Policy: `nestjs-main-app`

```hcl
# Database credentials — Main DB
path "database/static-creds/postgres-main-service-account" {
  capabilities = ["read"]
}

# AppRole login
path "auth/approle/login" {
  capabilities = ["create", "update"]
}

# KV v2 — lettura config Main DB
path "kv/data/config/main-db" {
  capabilities = ["read"]
}

# KV v2 — lettura tenant mapping (risolvere schema da orgId)
path "kv/data/tenant-map/*" {
  capabilities = ["read"]
}
path "kv/metadata/tenant-map" {
  capabilities = ["list"]
}
```

#### KV Config: `kv/config/main-db`

Parametri di connessione salvati in KV (opzionale, leggibili dal backend):
```json
{
  "host": "saas.curandis.cloud",
  "port": "5432",
  "database": "curandis_main_db",
  "ssl_mode": "disable"
}
```

#### Cron rotazione credenziali (solo modalità AppRole diretto)

Il cron sulla VM rigenera `secret_id` ogni 24h alle 3:00 e aggiorna il `.env`.
La libreria `@curandis/openbao-core` gestisce automaticamente il reload quando il token scade.

> **Con Agent proxy**: il cron NON è necessario. L'Agent rinnova il token autonomamente.

### 11.8 OpenBao Agent — Setup per Produzione (CONSIGLIATO)

L'Agent è un processo che gira sulla stessa VM dell'app. Si autentica con AppRole
una sola volta all'avvio, poi rinnova il token automaticamente ed espone un proxy
locale. L'app si connette al proxy **senza credenziali**.

#### Architettura

```
VM1 (Main App)
├── Container: Main App (NestJS)
│   └── connette a http://127.0.0.1:8200 (Agent proxy)
│   └── .env: NESSUN role_id/secret_id
└── OpenBao Agent (systemd service)
    └── auto_auth: AppRole 'nestjs-main-app'
    └── proxy: 127.0.0.1:8200 → openbao.curandis.cloud
    └── token sink: /var/run/openbao-agent/main-token

VM2 (Auth Microservice + OpenBao Server)
├── Container: OpenBao Server (:8200)
├── Container: Auth App (NestJS)
│   └── connette a http://127.0.0.1:8100 (Agent proxy)
└── OpenBao Agent (systemd service)
    └── auto_auth: AppRole 'nestjs-app'
    └── proxy: 127.0.0.1:8100 → openbao.curandis.cloud
    └── token sink: /var/run/openbao-agent/auth-token
```

#### Setup VM1 (Main App)

```bash
# 1. Installare OpenBao (solo il binario, non il server)
apt install openbao
# oppure: curl -fsSL https://releases.openbao.org/... | tar xz

# 2. Creare directory
mkdir -p /etc/openbao /var/run/openbao-agent

# 3. Inserire credenziali iniziali (una sola volta)
echo "<role_id>" > /etc/openbao/main-role-id
echo "<secret_id>" > /etc/openbao/main-secret-id
chmod 640 /etc/openbao/main-*

# 4. Copiare la configurazione
cp deploy/openbao-agent/agent-main-vm.hcl /etc/openbao/agent-main.hcl

# 5. Copiare e abilitare il servizio systemd
cp deploy/openbao-agent/openbao-agent-main.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now openbao-agent-main

# 6. Verificare che funziona
VAULT_ADDR=http://127.0.0.1:8200 bao token lookup
```

#### Setup VM2 (Auth App)

```bash
# 1-2. Creare directory
mkdir -p /var/run/openbao-agent

# 3. Inserire credenziali iniziali
echo "<role_id>" > /etc/openbao/auth-role-id
echo "<secret_id>" > /etc/openbao/auth-secret-id
chmod 640 /etc/openbao/auth-*

# 4. Copiare la configurazione
cp deploy/openbao-agent/agent-auth-vm.hcl /etc/openbao/agent-auth.hcl

# 5. Copiare e abilitare il servizio systemd
cp deploy/openbao-agent/openbao-agent-auth.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now openbao-agent-auth

# 6. Verificare
VAULT_ADDR=http://127.0.0.1:8100 bao token lookup
```

#### Configurazione NestJS con Agent

```typescript
// main.ts — Produzione con Agent (zero credenziali nel codice)
const openbaoService = new OpenbaoService({
  endpoint: 'http://127.0.0.1:8200',  // Agent proxy locale
  agentMode: true,
  // opzionale: se l'Agent scrive il token su file
  // agentTokenPath: '/var/run/openbao-agent/main-token',
});
```

### 11.9 File `.env` della Main App

#### Produzione (con Agent proxy)

```env
# === OpenBao Agent ===
# Nessun role_id/secret_id necessario — l'Agent gestisce l'autenticazione
OPENBAO_ADDR=http://127.0.0.1:8200
OPENBAO_AGENT_MODE=true

# === Main DB Config ===
DB_HOST=saas.curandis.cloud
DB_PORT=5432
DB_NAME=curandis_main_db

# === Auth Microservice ===
AUTH_API_URL=https://api.curandis.cloud

# === Keycloak ===
KEYCLOAK_URL=https://keycloak.curandis.cloud
KEYCLOAK_REALM=curandis
KEYCLOAK_CLIENT_ID=curandis-app-angular
```

#### Development (senza Agent, AppRole diretto)

```env
# === OpenBao AppRole ===
OPENBAO_ADDR=https://openbao.curandis.cloud
CURANDIS_OPENBAO_ROLE_ID=<da bao read auth/approle/role/nestjs-main-app/role-id>
CURANDIS_OPENBAO_SECRET_ID=<da bao write -f auth/approle/role/nestjs-main-app/secret-id>

# === Fallback DB (solo development) ===
MAIN_DB_USERNAME=postgres
MAIN_DB_PASSWORD=postgres

# === Main DB Config ===
DB_HOST=saas.curandis.cloud
DB_PORT=5432
DB_NAME=curandis_main_db

# === Auth Microservice ===
AUTH_API_URL=https://api.curandis.cloud

# === Keycloak ===
KEYCLOAK_URL=https://keycloak.curandis.cloud
KEYCLOAK_REALM=curandis
KEYCLOAK_CLIENT_ID=curandis-app-angular
```

### 11.10 AppModule — Configurazione TypeORM con credenziali OpenBao

L'`AppModule` della Main App deve ricevere le credenziali DB dal bootstrap (`main.ts`) e configurare TypeORM dinamicamente.

```typescript
// app.module.ts
import { Module, DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import { OpenbaoBaseModule, OpenbaoBaseService } from '@curandis/openbao-core';
import { MainDbCredentialManager } from './database/main-db-credential-manager.service';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';

interface AppModuleOptions {
  mainDbCredentials: { username: string; password: string };
  openbaoService: OpenbaoBaseService;
}

@Module({})
export class AppModule implements NestModule {
  /**
   * Metodo statico chiamato da main.ts con le credenziali ottenute da OpenBao.
   * Le credenziali vengono usate per la connessione iniziale a TypeORM.
   * Quando OpenBao ruota le credenziali, MainDbCredentialManager fa il hot-swap
   * del DataSource automaticamente (destroy → mutate options → initialize).
   */
  static forRootAsync(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        EventEmitterModule.forRoot(),
        HttpModule,

        // TypeORM con credenziali da OpenBao
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'saas.curandis.cloud',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          database: process.env.DB_NAME || 'curandis_main_db',
          username: options.mainDbCredentials.username,
          password: options.mainDbCredentials.password,
          // NON usare synchronize in produzione — usa migrations
          synchronize: false,
          // Entities della Main App
          autoLoadEntities: true,
        }),

        // Registra OpenbaoBaseService nel DI container
        OpenbaoBaseModule.forRoot(options.openbaoService),

        // ... altri moduli della Main App
      ],
      providers: [
        // Gestisce il hot-swap del DataSource quando le credenziali DB ruotano
        MainDbCredentialManager,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    // Applica TenantContextMiddleware a tutte le rotte operative
    consumer
      .apply(TenantContextMiddleware)
      .exclude('health', 'auth/(.*)')
      .forRoutes('*');
  }
}
```

#### main.ts completo (produzione con Agent)

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createOpenbaoService } from '@curandis/openbao-core';
import { AppModule } from './app/app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  // 1. Ottieni credenziali DB da OpenBao (via Agent proxy)
  const { service: openbaoService, credentials } = await createOpenbaoService({
    config: {
      endpoint: process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200',
      agentMode: process.env.OPENBAO_AGENT_MODE === 'true',
      // Se NON in agent mode (development), serve AppRole
      roleId: process.env.CURANDIS_OPENBAO_ROLE_ID,
      secretId: process.env.CURANDIS_OPENBAO_SECRET_ID,
      envFilePath: process.env.OPENBAO_AGENT_MODE === 'true'
        ? undefined
        : require('path').resolve(__dirname, '../../.env'),
    },
    credentialSources: [
      {
        name: 'main-db',
        staticCredsPath: 'database/static-creds/postgres-main-service-account',
        rotationEventName: 'credentials.main-db.rotated',
        credentialRefreshIntervalMs: 6 * 60 * 60 * 1000, // 6h
        fallbackEnvUsername: 'MAIN_DB_USERNAME',
        fallbackEnvPassword: 'MAIN_DB_PASSWORD',
      },
    ],
  });

  const mainDbCreds = credentials['main-db'];
  console.log(`[Bootstrap] DB credentials obtained (user: ${mainDbCreds.username})`);

  // 2. Crea l'app NestJS con le credenziali
  const app = await NestFactory.create(
    AppModule.forRootAsync({ mainDbCredentials: mainDbCreds, openbaoService }),
  );

  // 3. Attach EventEmitter per eventi di rotazione credenziali
  const eventEmitter = app.get(EventEmitter2);
  openbaoService.setEventEmitter(eventEmitter);

  // 4. Configurazione standard
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  app.enableCors({
    origin: /\.curandis\.cloud$/,
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[Main App] Running on port ${port}`);
}

bootstrap();
```

### 11.11 Checklist aggiornata — Backend Main App con OpenBao

Aggiunta alla checklist di PARTE 10:

#### Backend Main App — Integrazione OpenBao

- [ ] Installare `@curandis/openbao-core` da GitLab registry
- [ ] `main.ts` — Bootstrap con `createOpenbaoService()` (Agent o AppRole)
- [ ] `AppModule.forRootAsync()` — Riceve credenziali e configura TypeORM
- [ ] `MainDbCredentialManager` — Extends `DatabaseCredentialManagerBase` per hot-swap
- [ ] `TenantContextMiddleware` — Estrae schemaName dal cookie via Auth API
- [ ] `SET search_path` per ogni richiesta in base al tenant
- [ ] Setup OpenBao Agent sulla VM (vedi PARTE 11.8)
- [ ] Verificare che la rotazione credenziali funziona (log: `credentials.main-db.rotated`)
- [ ] Verificare che il DataSource si riconnette dopo rotazione (log: `SELECT 1` OK)

#### Installazione libreria

```bash
# Configurare registry GitLab (una sola volta)
npm config set @curandis:registry https://gitlab.netbog.it/api/v4/projects/5/packages/npm/
npm config set -- '//gitlab.netbog.it/api/v4/projects/5/packages/npm/:_authToken' '<DEPLOY_TOKEN>'

# Installare
npm install @curandis/openbao-core
# La libreria ha peerDependencies — assicurarsi di avere:
#   @nestjs/common, @nestjs/event-emitter, typeorm, node-vault, dotenv
```

