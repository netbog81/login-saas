# Curandis clinico — note per lo sviluppo

Questo file è il punto di ingresso per chi tocca il backend del modulo
clinico. Documenta integrazioni cross-modulo, decisioni architetturali
non-ovvie e tech-debt noto.

Per dettagli operativi del flusso fatturazione cross-modulo: leggere
`/home/marco/agenda/login-saas/specifica-flusso-accounting-clinico.md`
(documento autoritativo, vincolante per entrambi gli agenti clinico e
accounting).

---

## Integrazione Accounting (sessione 6, chiusa 2026-05-09)

Il modulo clinico pubblica eventi del ciclo fatturazione su RabbitMQ
verso il modulo `curandis-accounting` e ne consuma le risposte di stato.

### Architettura del trasporto

```
ex.clinical.events     ← clinico pubblica  → accounting consuma
ex.accounting.events   ← accounting pubbl. → clinico consuma
ex.clinical.dlx        ← DLX condiviso, asseriato da entrambi i moduli
```

Tutti gli exchange sono `topic` `durable=true`. Routing key:
`<entity>.<action>.<tenantAlias>` (es. `treatment.closed.bdq`).

Wrapper `CurandisEvent` standardizzato (vedi spec §4): `schemaVersion`,
`eventId` UUID v4, `occurredAt`, `eventType`, `tenantAlias`,
`correlationId?`, `producerVersion`, `payload`.

### 8 eventi pubblicati dal clinico

| Evento | Quando |
|---|---|
| `service.upserted.<t>` | CRUD `Service` (Step 7.6) |
| `service.deleted.<t>` | soft-delete `Service` (`isActive=false`) |
| `product.upserted.<t>` | CRUD `Product` (Step 7.6) |
| `product.deleted.<t>` | soft-delete `Product` |
| `treatment.closed.<t>` | `setReadyForBilling([id], true, _)` (Step 7.3) |
| `treatment.amended.<t>` | `updateBySecretary({...amendmentReason})` quando billingStatus IN SENT/PENDING (Step 7.4) |
| `treatment.cancelled.<t>` | `cancelTreatment(id, reason)` quando billingStatus IN SENT/PENDING |
| `sale.completed.<t>` | `recordProductSale(input)` (Step 7.5) |

Pubblicazione **publish-after-commit** (Step 7.1):
- `ClinicalEventBuffer` (AsyncLocalStorage) accumula eventi dentro la transazione DB
- `ClinicalEventBufferMiddleware` HTTP wrappa ogni request in `runInScope`
- Per entry-point non-HTTP (script/cron/consumer) wrappare manualmente in
  `eventBuffer.runInScope(() => ...)` — l'`add()` esplode rumorosamente
  fuori scope (decisione difensiva)
- Dopo commit OK: `flushBufferedEvents()` emette su EventEmitter2 →
  `@OnEvent` listener nel publisher → publish reale al broker
- Errori publish post-commit: log strutturato `[OUTBOX-MISSING]
  eventType=... eventId=... correlationId=... treatmentId=...
  tenant=... err=...` per investigation post-incident. Outbox pattern
  resiliente è roadmap post-MVP

### 6 eventi consumati dal clinico

| Evento | Effetto su Treatment |
|---|---|
| `billable.received` | `billingStatus = PENDING` |
| `billable.invoiced` | `billingStatus = INVOICED` + numeroFattura + URL + data emissione |
| `billable.refunded` | `billingStatus = REFUNDED` + creditNote* + reason |
| `billable.partially-refunded` | `billingStatus = PARTIALLY_REFUNDED` + creditNote* |
| `billable.reissued` | `billingStatus = INVOICED` con nuovo numero, vecchio salvato |
| `billable.cancellation-rejected` | rollback `CANCELLED → INVOICED` + popola `billingAlertMessage` (race condition: clinico cancella mentre accounting fattura) |

Consumer:
- Coda dedicata `q.clinical.accounting-feedback` (durable, no exclusive)
- DLX `ex.clinical.dlx` + DLQ `q.clinical.accounting-feedback.dlq`
- Idempotency: tabella `processed_clinical_events` con UNIQUE su `eventId`
- Tenant context: validazione preventiva `schema_name LIKE 'tenant_%'`
  esiste in `information_schema.schemata` → drop con warn se assente
- `userId='system:accounting-consumer'` come marker (convenzione per
  consumer S2S)
- `tenantId = tenantAlias` placeholder INTENZIONALE (consumer S2S non
  ha tenantId numerico — vedi commento `accounting-event.consumer.ts:240`)
- Errore handler: 1° tentativo requeue (`!msg.fields.redelivered`),
  2° tentativo `[DLQ] reason=redelivered-after-failure`

### State machine `Treatment.billingStatus`

```
NOT_READY → READY_FOR_BILLING → SENT → PENDING → INVOICED → ...
                ↓ (cancel)         ↓ (cancel)    ↓ (cancel)
              NOT_READY         CANCELLED      [bloccato — serve nota credito]

  INVOICED → REFUNDED                     (billable.refunded)
  INVOICED → PARTIALLY_REFUNDED           (billable.partially-refunded)
  INVOICED → REISSUED → INVOICED' (new)   (billable.reissued)
  CANCELLED → INVOICED (rollback alert)   (billable.cancellation-rejected)
```

Implementato in [`treatment-billing-status.enum.ts`](src/modules/availability/entities/treatment-billing-status.enum.ts).

### Migration storiche (sessione 6)

| Migration | Step | Cosa fa |
|---|---|---|
| `1783000000000-BillingIntegrationStep1` | Step 1 | Crea entity `Site` + `Product`, estende `Treatment` con `siteId`+`billingStatus`+10 col accounting/alert, estende `Service.serviceCode` UNIQUE, crea `processed_clinical_events`, bootstrap "Studio principale" |
| `1784000000000-AddTreatmentAmendmentRevision` | Step 7.2 | colonna `Treatment.amendmentRevision int NOT NULL DEFAULT 0` per increment atomico |
| `1785000000000-AddTreatmentCancellationAudit` | Step 7.4 | 3 colonne dedicate `cancelledAt`, `cancelledByUserId`, `cancellationReason` (NON riusare `deletedByUserId`/`accountingRefundReason`) |

Tutte applicate solo su `t_4701c4aaba73713294696ae7ae46d21b` (tenant `bdq`).
Guard interna alla migration rifiuta esecuzione su altri schemi.

### Smoke test cascade (Step 7.7)

`npm run smoke:2-cascade -- --tenant bdq --treatmentId <uuid>` lancia
in sequenza setReady → amend → cancel su un treatment in
`READY_FOR_BILLING`. Verifica round-trip end-to-end con accounting
consumer. Pre-requisito: treatment fresco in `READY_FOR_BILLING`.

`npm run smoke:2-cascade -- --tenant bdq --sale-test --productId <uuid>
--purchaserSubjectId <uuid>` per testare `sale.completed`.

### Bootstrap iniziale catalogo (Step 5)

`npm run sync:services -- --tenant bdq` pubblica `service.upserted` per
tutti i `Service` esistenti (e `product.upserted` se ce ne sono). Va
runnato una volta sola al go-live per popolare la mapping table di
accounting. Re-run idempotente.

---

## AutoIssue accounting (chiarimento operativo)

Quando il clinico pubblica `treatment.closed` o `sale.completed` con
`requestImmediateInvoice=true` (UX "Fattura subito + incassa"):

- **Mapping fiscalmente configurato** (`isFiscallyConfigured=true` lato
  accounting clinical-services-sync) → AutoIssue scatta automaticamente,
  INVOICE emessa entro pochi secondi
- **Mapping pending** (`isFiscallyConfigured=false`) → AutoIssue skippa,
  ma riparte automaticamente quando admin configura il mapping
  (event-driven via `LOCAL_BILLABLE_MAPPING_COMPLETED`, vedi smoke 9.B
  accounting 2026-05-08)

**Mai passo manuale operatore accounting.** Il flusso è sempre
event-driven.

---

## Robustezza al boot rispetto a RabbitMQ giù (post-incident 2026-05-13)

Se il broker RabbitMQ è giù o rifiuta auth al momento del boot del
backend, il `ClinicalEventPublisher.onApplicationBootstrap` **NON
deve bloccare** il bootstrap di NestJS. Pattern applicato:

```typescript
// NO: await this.channelWrapper.waitForConnect()
//   → la Promise resta pending all'infinito se broker rifiuta auth,
//     try/catch non aiuta. NestJS aspetta tutti gli OnApplicationBootstrap
//     prima di chiamare app.listen() → backend mai sulla porta 3000.

// SI (fire-and-forget):
this.channelWrapper.waitForConnect()
  .then(() => this.logger.log('Publisher channel ready'))
  .catch((err) => this.logger.error(`Connection iniziale fallita: ${err.message}`));
```

Inoltre: `publishTimeout: 10_000` sul channel evita che `publish()`
chiamato senza connection blocchi indefinitamente. I messaggi
bufferizzati restano in memoria del processo node — se backend
muore, si perdono, log `[OUTBOX-MISSING]` lo cattura. Accettabile MVP.

Pattern identico già usato dal consumer (`AccountingEventConsumer`)
che NON ha mai chiamato `waitForConnect` esplicito —
`amqp-connection-manager` esegue il `setup` async automaticamente
quando la connection è pronta.

**Incident di riferimento**: 2026-05-13 — broker `curandis-rabbitmq`
ha perso lo state degli users (management plugin in errore
`noproc`). Backend clinico (e accounting, registry) sono rimasti
bloccati al boot perché in attesa della connection AMQP. Sintomo
lato frontend: reload loop su login (auth guard interpretava
backend-down come "non autenticato"). Fix temporaneo: `docker
restart curandis-rabbitmq` per ricaricare `definitions.json`. Fix
strutturale: pattern fire-and-forget sopra.

---

## Limitazioni MVP note (sessione 6)

1. **TreatmentInvoiceLine `quantity` hardcoded "1"** nel mapper payload
   (Step 7.2). MVP: il modello clinico non supporta qty>1 per riga
   custom. Per supportarlo: aggiungere colonna `quantity` a
   `treatment_invoice_lines` + UI multi-qty.

2. **`mandatory: false` sul publish** RabbitMQ. Se accounting non ha
   bind-ato la queue, il messaggio viene droppato silenziosamente dal
   broker. Per produzione valutare `mandatory: true` con return-callback.

3. **Idempotency doppio-click "Vendita rapida"**: scenario edge in cui
   l'operatore clicca 2 volte → 2 saleId diversi → 2 fatture. Lato
   clinico nessuna entità Sale persistita per dedup. Mitigazione MVP:
   debounce + disable bottone in-flight nella UI. Per Sessione 7+
   valutare `correlationId` client-side stoppato lato service
   (idempotency token).

4. **`TREATMENT_FRAGMENT` legacy con 14 campi billing additivi**: query
   consumer che non li usano li ignorano silently — niente runtime
   impact, ma payload GraphQL leggermente più grosso. Pattern accettato
   per semplicità (vedi `app/graphql/operations/treatment.queries.ts`).

5. **Persistenza filtro `billingStatus` URL queryparam**: NON
   implementata. **BACKLOG PRIORITÀ ALTA Sprint 7** (quick win 30 min,
   beneficio UX shareability + back/forward + refresh consistency).

6. **`window.prompt` per cancellation reason**: usato per MVP nel
   container trattamenti. Refactor a Material Dialog dedicato post-MVP
   (UX più curata + character counter + validazione length).

7. **8 sezioni inline in `trattamento-detail.component.ts`** (1090
   linee): tech debt esistente. Sessione 6 ha estratto solo "billing"
   come dumb component (`treatment-billing-section`). Le altre 7
   sezioni (servizi, righe fattura, pagamento, ecc.) restano inline.
   Estrazione futura per testabilità + separation cleaner.

8. **Operations duplicate `Get*Evaluation*`/`UpdatePatientAnamnesis`/4
   mutation `*Treatment`**: risolto rinominando l'operation name dentro
   il `gql\`...\`` template (suffisso `Legacy` per i file legacy,
   `*ForPath`/`*Scope`/`*Simple` per i mismatch fragment). Const TS
   invariate, niente caller toccato. Pattern "feature wins":
   `features/<name>/graphql/` tiene il nome originale.

9. **Codegen glob esteso a `features/**/graphql/**`** (codegen.yml):
   ora i types delle operations per-feature sono tipizzati nel
   `generated/types.ts`. Vedi nota `// NOTA TECNICA — niente commenti
   dentro gql template` in `treatment.queries.ts`.

10. **82 errori `tsc` preesistenti** in 2 file frontend
    (`calendar.component.ts`, `anamnesis-dialog.container.ts`). Tutti
    di drift tipi, fuori scope sessione 6. Da indirizzare in cleanup
    debt dedicato.

---

## Decisione consapevole — `accountingPreviousInvoiceNumber`

NON aggiunto nello schema `Treatment`. Per il caso REISSUED il vecchio
`patientInvoiceNumber` viene sovrascritto dal nuovo. Lo storico fiscale
completo della catena fattura → nota credito → nuova fattura vive lato
accounting, NON nel clinico. Se UI Sezione 6 emerge necessità
("trattamento riemesso, prima era fattura X"), aggiungere colonna in
migration successiva. Non in scope Step 1.

---

## Comandi quotidiani

```bash
# Build
cd backend && npm run build

# Type-check strict
cd backend && npx tsc --noEmit

# Migration su tenant target (NON usare run-all-tenant-migrations
# perché toccherebbe schemi test/backup non-target)
cd backend && npx ts-node src/run-tenant-migration.ts t_4701c4aaba73713294696ae7ae46d21b

# Smoke #1 (publisher solo, no DB)
cd backend && npm run smoke:publish-treatment-closed -- --tenant bdq

# Smoke #2 cascade (chiamate vere ai service del clinico)
cd backend && npm run smoke:2-cascade -- --tenant bdq --treatmentId <uuid>

# Bootstrap sync catalogo (one-shot al go-live)
cd backend && npm run sync:services -- --tenant bdq --dry-run
cd backend && npm run sync:services -- --tenant bdq

# Codegen frontend (legge schema.gql + glob features/**/graphql/)
cd frontend && npm run codegen
```

---

## Architettura frontend per nuove feature

Pattern obbligatorio (file `architettura-componenti-ref.md`):

```
src/app/features/<feature>/
├── components/        # Layer 1 - Dumb (OnPush, Input/Output, no Apollo)
├── containers/        # Layer 2 - Smart (state UI, no business logic)
├── services/          # Layer 3 - Business + GraphQL (estende BaseGraphQLService)
├── models/            # TS interfaces domain-level (NO re-export generated/types
│                       per ridurre coupling al codegen)
├── graphql/           # Operations gql (queries, mutations, fragments)
└── <feature>.routes.ts  # Standalone routes lazy
```

Esempi recenti: `features/products/` (sessione 6 Step 6.2),
`features/operators-new/`, `features/trattamenti/`.

NON usare il pattern legacy `app/components/<feature>/` (gruppo dei 34
file legacy preesistente).

---

## Riferimenti

- Specifica autoritativa: `specifica-flusso-accounting-clinico.md`
- Architettura frontend: `/home/marco/curandis-registry/docs/architettura-componenti-ref.md`
- Status sessione 6: `sessione-6-billing-status.md`
- Memory persistente: `~/.claude/projects/-home-marco-agenda-login-saas/memory/MEMORY.md`
