# Auth Integration - TODO Tasks

## Fase 3b: Migrazione dati esistenti
- [ ] Migrazione dati schema public -> tenant bdq
- [ ] Configurare DEFAULT_TENANT nel .env per development

## Fase 4b: Frontend Gestione Utenti
- [ ] UserManagementComponent (tab: abbinati, non abbinati, pendenti)
- [ ] Componenti CRUD per Secretary, PrivacyOfficer, ItManager
- [ ] Flusso "Crea account auth per utente" (provision Keycloak)
- [ ] Flusso "Abbina utente pendente a app_user"
- [ ] Pagina gestione ruoli e permessi

## Fase 5: Cifratura PHI
- [ ] Integrazione Transit Engine per dati sensibili pazienti

## Fase 6: OPA (Open Policy Agent)
- [ ] Deploy sidecar OPA
- [ ] Scrivere policy Rego per RBAC/ABAC
- [ ] Attivare USE_OPA=true e testare AuthorizationGuard con OPA
