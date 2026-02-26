# Auth Integration - Completed Tasks

## Fase 1: Credenziali DB via OpenBao (Agent mode)
- [x] Installate dipendenze backend: `@curandis/openbao-core`, `@nestjs/event-emitter`, `eventemitter2`, `cookie-parser`, `node-vault`, `dotenv`
- [x] Creato `MainDbCredentialManager` service (`backend/src/database/main-db-credential-manager.service.ts`) per hot-swap DataSource su rotazione credenziali
- [x] Refactoring `AppModule` in `forRootAsync()` con credenziali dinamiche da OpenBao + `EventEmitterModule` + `OpenbaoBaseModule`
- [x] Refactoring `main.ts` con bootstrap `createOpenbaoService()` in Agent mode + fallback development + cookie-parser
- [x] Configurato `.env` con `OPENBAO_AGENT_MODE=true` e `OPENBAO_ADDR=http://127.0.0.1:8200`
- [x] Aggiornato `typeorm.config.ts` per compatibilita' con nuovi nomi variabili env
- [x] Testato con successo: credenziali recuperate da OpenBao Agent, DB connesso, MainDbCredentialManager in ascolto per rotazione, app avviata correttamente

## Fase 2: Autenticazione Frontend
- [x] `environment.ts` / `environment.prod.ts` - aggiunto `authApiUrl` e `defaultTenant`
- [x] `TenantResolverService` - estrae alias tenant dall'hostname (demo4.curandis.cloud -> "demo4")
- [x] `AuthService` - login, logout, renewToken, loadCurrentUser, isAuthenticated, hasRole, isLinked
- [x] `authInterceptor` - withCredentials per Auth API + auto-renew su 401
- [x] `authGuard` - protezione rotte con verifica sessione + ruoli opzionali
- [x] `linkedGuard` - verifica mapping utente attivo
- [x] `LoginContainer` (smart) + `LoginFormComponent` (dumb) - architettura 5 layer, Material, responsivo
- [x] `PendingActivationComponent` - pagina attesa attivazione con verifica stato
- [x] `UnauthorizedComponent` - pagina accesso negato
- [x] `PostLoginRedirectService` - redirect post-login in base a ruoli e mappingStatus
- [x] `app.config.ts` - aggiunto authInterceptor + APP_INITIALIZER per verifica sessione
- [x] `app.routes.ts` - tutte le rotte protette con authGuard + linkedGuard
- [x] `AppComponent` - navbar condizionale (mostra solo se autenticato + linked), menu utente con ruoli e logout
- [x] Build frontend OK (zero errori)

## Fase 2b: Backend Auth Middleware
- [x] `TenantContextMiddleware` - valida cookie via Auth API, estrae tenantContext nella request
- [x] `HttpModule` (@nestjs/axios) installato e importato in AppModule
- [x] Middleware applicato a tutte le rotte operative (escluso health, events)
- [x] Compile backend OK (zero errori)

## Fase 3: Multi-Tenant DB
- [x] `TenantSchemaService` (`backend/src/database/tenant-schema.service.ts`) - provisioning schema: riceve schemaName dal JWT, CREATE SCHEMA, migrazioni TypeORM, notifica Auth API (`confirm-schema-created`)
- [x] `TenantContextMiddleware` (`backend/src/middleware/tenant-context.middleware.ts`) - validazione JWT locale (JWKS) + fallback validate-token HTTP, gestione tenantStatus (pending_schema/active/suspended/deleted), auto-provisioning schema, SET search_path
- [x] `JwksService` (`backend/src/auth/jwks.service.ts`) - fetch/cache public key ECDSA-P256 da Auth API via JWKS, validazione JWT locale zero-latency
- [x] Rimosso `TenantKvService` - il mapping tenant->schema e' gestito dall'Auth App in OpenBao KV, la Main App riceve lo schemaName gia' risolto nel JWT
- [x] Installata libreria `jose` per validazione JWT/JWKS
- [x] Token estratto da cookie `curandis_auth_token` O header `Authorization: Bearer`
- [x] Utente `migrator` dedicato per migrazioni CLI (separato da credenziali OpenBao runtime)
- [x] `typeorm.config.ts` e `data-source.ts` aggiornati per usare credenziali migrator
- [x] Compile backend OK (zero errori)

## Fase 4: Sistema Gestione Utenti + RBAC (predisposizione OPA)
- [x] Enum `AppUserType`: OPERATOR, SECRETARY, PRIVACY_OFFICER, IT_MANAGER
- [x] Entita' `AppUser` (tabella base): id, keycloak_id, name, surname, email, phone, user_type, is_active, linked_at, attributes JSONB
- [x] Entita' RBAC: `Role`, `Permission`, `UserRole` (N:N), `RolePermission` (N:N)
- [x] Entita' specializzate: `Secretary`, `PrivacyOfficer`, `ItManager` (ognuna con FK 1:1 a AppUser)
- [x] `Operator` entity aggiornata: +appUserId (uuid, nullable) + relazione OneToOne con AppUser
- [x] Migrazione `1771000000000-CreateAppUsersSystem`: crea tutte le tabelle, migra operatori esistenti in app_users, seed ruoli e permessi base con associazioni
- [x] DTOs: CreateAppUser, UpdateAppUser, CreateSecretary, CreatePrivacyOfficer, CreateItManager, LinkKeycloakUser, AssignRole, ProvisionUser
- [x] Servizi core: `AppUserService` (CRUD + getUserPermissions), `RoleService` (CRUD + assign/revoke), `UserLinkingService` (link Keycloak + provision)
- [x] Servizi specializzati: `SecretaryService`, `PrivacyOfficerService`, `ItManagerService`
- [x] Resolvers GraphQL: AppUser, Role, Secretary, PrivacyOfficer, ItManager (query + mutations complete)
- [x] `AuthorizationGuard` predisposto OPA: valutazione locale permessi da DB, switch `USE_OPA=true` per sidecar futuro
- [x] Decorator `@RequirePermissions('patient_read', ...)` per protezione granulare resolver
- [x] `AppUsersModule` registrato in AppModule, entita' in ALL_ENTITIES
- [x] `OperatorService` aggiornato: crea app_user automaticamente su create(), sync campi identita' su update()
- [x] `AvailabilityModule` aggiornato: AppUser in TypeOrmModule.forFeature per iniezione in OperatorService
- [x] Compile backend OK (zero errori)
