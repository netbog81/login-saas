# Frontend Clinico — note per gli agenti

## Link cross-modulo (registry / accounting)

I link UI verso i moduli **Anagrafiche (registry)** e **Contabilità
(accounting)** NON puntano ai frontend standalone (`registry.{tenant}...`,
`accounting.{tenant}...`) ma alla **suite unificata**
(`gestione.{tenant}.curandis.cloud`), così l'utente naviga tutto in
un'unica interfaccia con sidebar a sezioni:

```
Scheda paziente     → https://gestione.{tenant}.curandis.cloud/anagrafiche/subjects/{id}
Elenco anagrafiche  → https://gestione.{tenant}.curandis.cloud/anagrafiche/subjects
Elenco fatture      → https://gestione.{tenant}.curandis.cloud/contabilita/sales-documents
Da fatturare        → https://gestione.{tenant}.curandis.cloud/contabilita/billable-events/pending
```

Regole:

- **Path della sezione sempre esplicito**: `/anagrafiche/...` per le route
  del registry, `/contabilita/...` per quelle dell'accounting. (La suite ha
  un fallback che riscrive i path standalone come `/subjects/...`, ma non
  fare affidamento su di esso: i segmenti presenti in entrambi i moduli —
  `dashboard`, `organizations`, `settings` — sono ambigui senza prefisso.)
- **`target="_blank"` con `rel="noopener"`**: il clinico è lo strumento di
  lavoro principale, i link cross-modulo aprono in nuova tab.
- Il tenant si ricava dal sottodominio corrente (vedi
  `TenantResolverService.getTenantAlias()` o i getter esistenti); su
  localhost i link vanno nascosti (alias null).
- L'utente entra nella suite senza ri-autenticarsi (SSO Keycloak, stesso
  client `curandis-app-angular`).

Punti esistenti da usare come riferimento:
- `src/app/app.component.ts` → `registryUrl` / `accountingUrl` (toolbar)
- `features/operators-new/components/patient-header/patient-header.component.ts` → `registrySubjectUrl`
- `features/trattamenti/components/trattamento-detail/trattamento-detail.component.ts` → `registryPatientUrl`

Le **chiamate API** invece restano dirette ai backend dei moduli
(`https://registry.{tenant}.curandis.cloud/api/v1/registry/...`): la suite
riguarda solo la navigazione UI, non il piano dati (vedi
`core/auth/auth.interceptor.ts` per gli host API riconosciuti).

La suite vive nel repo `/home/marco/curandis-suite` (host micro-frontend
con native federation): il suo README documenta architettura e vincoli
(versioni Angular in lock-step tra i tre frontend).
