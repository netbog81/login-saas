# Sessione 6 — Stato implementazione integrazione clinico ↔ accounting

> Riferimento spec: `specifica-flusso-accounting-clinico.md` v1.0
> Owner: agent clinico
> Inizio sessione: 2026-05-05

## Decisioni di design (confermate da Marco)

1. **Site**: entità nuova senza `organizationId` (multi-tenant per schema). Bootstrap "Studio principale" per ogni `tenant_*` esistente.
2. **`executedByUserId`**: nuovo campo `TreatmentService.executedByOperatorId` (FK `app_users`). Default UI = `treatment.operator.appUserId`, modificabile per riga.
3. **Mapping Keycloak**: convenzione interna resta `AppUser.id`. Mapping `id → keycloakId` solo nel publisher (batch lookup, no N+1).
4. **`quantity` SERVICE**: hardcoded "1" (modello clinico non supporta qty>1 per `TreatmentService`).
5. **`requestImmediateInvoice`**: parametro runtime di `closeTreatment(id, { immediateInvoice })`, non colonna persistita.
6. **`totalAmount`**: ricalcolato al volo dalle `lines[]` con `decimal.js`, mai `treatment.price` cached.
7. **Alert `cancellation-rejected`**: 3 colonne su `Treatment` (`billingAlertMessage`, `billingAlertAt`, `billingAlertDismissedAt`). Mutation `dismissBillingAlert(treatmentId)`.
8. **UNIQUE su `service_code` / `product_code`**: solo singola colonna (lo schema isola già il tenant).
9. **Validazione consumer**: prima di `runInTenantContext`, verifica che `tenant_<alias>` esista in `information_schema.schemata` → drop con warn se assente.
10. **Naming tabelle idempotency**: convenzione interna `processed_clinical_events` (non `clinical_processed_events` della spec).

## Step di lavoro (riorganizzato)

| # | Step | Stato |
|---|---|---|
| 1 | Migrations + entità | ✅ COMPLETATO (build verde) |
| 2 | `ClinicalEventPublisher` | ✅ COMPLETATO (build verde, muto) |
| 3 | `AccountingEventConsumer` (6 handler) | ✅ COMPLETATO (build verde, DLQ + idempotency) |
| 4 | Smoke test script payload statico | 🟡 PARTE CLINICO OK (publish reale verde), 🛑 round-trip in attesa accounting Step 7 |
| 5 | Bootstrap script `sync-services-and-products` | ✅ COMPLETATO (build verde, non eseguito su DB perché migration Step 1 non ancora applicata) |
| 6 | UI (Service+code, Product CRUD, billingStatus, alert, vendita rapida, fattura subito) | ⬜ pending |
| 7 | Hook reali `closeTreatment` / `setReadyForBilling` / `cancelTreatment` | ⬜ pending |
| 8 | Aggiornamento CLAUDE.md / memory | ⬜ pending |

## Log
- 2026-05-05 — Inizio sessione, decisioni confermate, file di status creato.
- 2026-05-05 — Step 1.1 Site entity creata.
- 2026-05-05 — Step 1.2 Product entity creata.
- 2026-05-05 — Step 1.5 Migration in dry-run review nel chat (in attesa OK Marco su 6 punti: iter schemi, siteId NOT NULL appointments, naming snake/camel, 7vs8 col accounting, processed_accounting_events separata, bootstrap site dentro/fuori migration).
- 2026-05-05 — Marco approva: scope solo `t_4701c4aaba73713294696ae7ae46d21b`, camelCase puro, 7 col accounting, processed_clinical_events singola, bootstrap dentro migration.
- 2026-05-05 — Step 1 COMPLETATO. File creati/modificati:
  - NEW `backend/src/modules/availability/entities/site.entity.ts`
  - NEW `backend/src/modules/availability/entities/product.entity.ts`
  - NEW `backend/src/modules/availability/entities/treatment-billing-status.enum.ts`
  - NEW `backend/src/modules/clinical-events/processed-clinical-event.entity.ts`
  - NEW `backend/src/migrations/1783000000000-BillingIntegrationStep1.ts` (con guard schema target)
  - MOD `backend/src/modules/availability/entities/treatment.entity.ts` (siteId, billingStatus, 7 col accounting, 3 col alert, relation Site)
  - MOD `backend/src/modules/availability/entities/service.entity.ts` (serviceCode UNIQUE)
  - MOD `backend/src/modules/availability/entities/treatment-service.entity.ts` (executedByOperatorId + relation AppUser)
  - MOD `backend/src/modules/availability/entities/availability-appointment.entity.ts` (siteId + relation Site)
  - MOD `backend/src/modules/availability/availability.module.ts` (registrate Site + Product in TypeOrmModule.forFeature)
  - Build TS verde: `npm run build` + `npx tsc --noEmit` zero errori.
  - Migration NON ancora eseguita su DB. Da runnare manualmente:
    `cd backend && npx ts-node src/run-tenant-migration.ts t_4701c4aaba73713294696ae7ae46d21b`
- 2026-05-05 — Step 2 COMPLETATO. ClinicalEventPublisher pronto (muto: nessun caller per ora). File:
  - NEW `backend/src/modules/clinical-events/clinical-events.config.ts` (env vars: clinicalExchange, accountingExchange, feedbackQueue, billableBindingPattern, prefetch, producerVersion da package.json)
  - NEW `backend/src/modules/clinical-events/clinical-events.types.ts` (CurandisEvent + 8 outbound payload + 6 inbound payload completi)
  - NEW `backend/src/modules/clinical-events/clinical-event.publisher.ts` (connection dedicata amqp-connection-manager, channel confirm-mode, assertExchange topic durable, headers x-correlation-id/x-tenant-alias/x-schema-version/x-source-module, properties persistent/messageId/timestamp, resolveTenantAlias da explicit→TSCS→error)
  - NEW `backend/src/modules/clinical-events/clinical-events.module.ts` (@Global, ConfigModule, esporta publisher + config)
  - MOD `backend/src/app.module.ts` (import ClinicalEventsModule)
  - Build TS verde: `npm run build` + `npx tsc --noEmit` zero errori
  - Publisher NON connesso al broker in questa sessione (richiede `RABBITMQ_ENABLED=true` + broker raggiungibile). A boot dell'app proverà connect; in dev senza broker logga warn e disabilita.
  - PROMEMORIA STEP 7 (hook su amend): righe TreatmentService con executedByOperatorId=NULL devono mappare executedByUserId=null nel payload (non omettere il campo, lo schema lo richiede sempre).
- 2026-05-05 — Step 3 COMPLETATO. AccountingEventConsumer pronto, build verde. File:
  - NEW `backend/src/modules/clinical-events/accounting-event.consumer.ts` (connection dedicata, channel con DLX `ex.dlq` + DLQ `q.clinical.accounting-feedback.dlq` + 6 binding key `billable.*.*` + prefetch 10 + 6 handler)
  - MOD `backend/src/modules/clinical-events/clinical-events.module.ts` (added TypeOrmModule.forFeature[ProcessedClinicalEvent] + AccountingEventConsumer provider)
  - Build verde.
  - Sequenza handler unitaria: parse JSON → validazione tenant (alias→OpenBao→schema esiste) → run dentro tenantSchemaContext → transaction → INSERT processed_clinical_events ON CONFLICT → dispatch → ack.
  - Errori: parse/payload-incompleto/tenant-sconosciuto/eventType-sconosciuto → DLQ. Handler fallisce: 1° tentativo requeue, redelivered → DLQ.
  - Cancellation-rejected handler: rollback billingStatus CANCELLED→INVOICED + popola billingAlertMessage/At + reset billingAlertDismissedAt (riapre alert se era stato dismissato).
  - Reissued handler: salva newInvoiceNumber come patientInvoiceNumber + creditNoteNumber/IssuedAt come storico nota di storno.

## Env vars nuove da aggiungere a backend/.env (tutti hanno default nel codice)
```
RABBITMQ_CLINICAL_EXCHANGE=ex.clinical.events
RABBITMQ_ACCOUNTING_EXCHANGE=ex.accounting.events
RABBITMQ_QUEUE_ACCOUNTING_FEEDBACK=q.clinical.accounting-feedback
RABBITMQ_BINDING_PATTERN_BILLABLE=billable.*.*
# PRODUCER_VERSION=  # opzionale, default = package.json version
```
Nessuna modifica a env esistenti (RABBITMQ_URL, RABBITMQ_ENABLED, RABBITMQ_PREFETCH già presenti e condivisi col consumer registry).
- 2026-05-05 — Step 3 polish: aggiunta `SYSTEM_USER_ID` const exportata, commento su tenantId placeholder INTENZIONALE, log esplicito `[DLQ] reason=redelivered-after-failure` quando handler fallisce 2 volte.
- 2026-05-05 — Step 4.1 + 4.2 COMPLETATI lato clinico. File:
  - NEW `backend/src/scripts/test-publish-treatment-closed.ts` (Nest standalone minimale, no DB; CLI args --tenant --treatmentId --beneficiarySubjectId --immediate)
  - MOD `backend/package.json` (npm script `smoke:publish-treatment-closed`)
  - END-TO-END VERIFICATO: `npm run smoke:publish-treatment-closed -- --tenant bdq` → connessione TCP+AMQP OK, assertExchange `ex.clinical.events` OK, publish → broker ack, exit 0.
  - Exchange `ex.clinical.events` ora persistente sul broker (durable=true, dichiarato la prima volta dal mio publisher).
  - Code esistenti su vhost curandis: q.clinico.subjects, q.accounting.subjects, q.registry.audit-log, q.accounting.dlq.subjects, q.test.sniffer (sniffer bind solo a ex.registry.events). NESSUNA queue accounting bind-ata a ex.clinical.events ancora — round-trip impossibile finché accounting non chiude Step 7.
- 2026-05-05 — Step 4.3 BLOCCATO: aspetta accounting consumer ready. Quando pronto, ri-lanciare lo smoke e verificare:
  1. accounting log mostra consume di treatment.closed.bdq
  2. DB accounting: BillableEvent in PENDING per treatmentId=11111111...
  3. accounting publish billable.received.bdq → consumato da clinico se app full è in `npm run start:dev` con migration applicata.
- 2026-05-05 — Migration 1783000000000 APPLICATA su `t_4701c4aaba73713294696ae7ae46d21b` (auto-applicata al primo `start:dev` prima del fix ALL_ENTITIES). Verificato: tabelle `sites`, `products`, `processed_clinical_events` esistono; colonne `siteId`, `billingStatus`, `accountingBillableEventId`, `billingAlertMessage` su `treatments`; "Studio principale" id=1b6f8c43-7054-4545-aa82-608c40e6a5fc creato.
- 2026-05-05 — Fix boot error `Entity metadata for AvailabilityAppointment#site was not found`: aggiunte `Site`, `Product`, `ProcessedClinicalEvent` a `ALL_ENTITIES` in app.module.ts. Build verde.
- 2026-05-05 — DLX rinominata `ex.dlq` → `ex.clinical.dlx` (decisione Marco). File: accounting-event.consumer.ts:126.
- 2026-05-05 — Fix script sync:services (3 bug rilevati lanciandolo davvero):
  1. password authentication failed → integrato `createOpenbaoService` per leggere creds da OpenBao Agent (replica pattern main.ts).
  2. dotenv injecting (0) → path .env errato `../../../.env` → fixed `../../.env`. Stesso fix applicato anche a smoke step 4.
  3. Entity metadata Service#subcategory not found → entities glob `src/**/*.entity.ts` invece di lista esplicita (catena relations transitiva troppo lunga).
- 2026-05-05 — `npm run sync:services -- --tenant bdq --dry-run` END-TO-END OK: 17 services letti, 0 errori, 0 prodotti. WARN current_schema=public è falso positivo (TypeORM applica schema per query, non sulla connection). Script pronto per publish reale quando accounting bind-erà la sua queue.
- 2026-05-05 — Step 5 COMPLETATO. Bootstrap sync script. File:
  - NEW `backend/src/scripts/sync-services-and-products.ts` (Nest standalone CON DB single-tenant: TypeOrmModule.forRootAsync con schema target, ClinicalEventPublisher reale, SyncRunner che fa find+publish per Service e Product)
  - MOD `backend/package.json` (npm script `sync:services`)
  - CLI: `--tenant <alias>` (richiesto se non `--schema`), `--schema <name>` bypass OpenBao, `--only services|products|both` (default both), `--dry-run`
  - Idempotency: usa `serviceCode`/`productCode` come business key, accounting upserta sulla mapping table.
  - Decimali: `toDecimalString(v)` normalizza number|string → "N.NN" (decimal Postgres ritorna string in TypeORM, parseFloat difensivo per altri driver).
  - Exit codes: 0 OK, 1 publish parziali falliti, 2 errore setup.
  - NON eseguito su DB reale: la migration Step 1 (che aggiunge `serviceCode`) NON è ancora applicata. Quando la applicherai, lancia: `npm run sync:services -- --tenant bdq --dry-run` (test) e poi senza `--dry-run` per il publish reale.
  - Build TS verde: `npm run build` + `npx tsc --noEmit` zero errori.
