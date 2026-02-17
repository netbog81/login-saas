# Auth Integration - TODO Tasks

## Fase 2: Autenticazione Frontend
- [ ] TenantResolverService
- [ ] AuthService (login, logout, renew, loadCurrentUser)
- [ ] authInterceptor (withCredentials, auto-renew 401)
- [ ] authGuard + linkedGuard
- [ ] APP_INITIALIZER per verifica sessione
- [ ] LoginComponent (Angular Material, responsivo, architettura 5 layer)
- [ ] PendingActivationComponent
- [ ] PostLoginRedirectService
- [ ] Configurazione rotte con guard

## Fase 3: Backend Auth Integration
- [ ] TenantContextMiddleware (valida cookie via Auth API)
- [ ] SET search_path per tenant
- [ ] Migrazione schema public -> tenant_demo4
