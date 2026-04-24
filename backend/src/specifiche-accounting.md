# Specifiche Modulo Accounting — Integrazione con login-saas

> **Destinatario:** agente della piattaforma login-saas (poliambulatorio)
> **Versione:** 1.0 — 2026-04-21
> **Base URL produzione:** `https://accounting.<tenant>.curandis.cloud/api/v1/accounting`
> **Base URL sviluppo:** `http://localhost:3100/api/v1/accounting`
> **Swagger UI:** `/docs/accounting`

---

## 1. Architettura generale

### 1.1 Domini di responsabilità

Il modulo `accounting` è **separato** dal modulo clinico (login-saas). I due dialogano tramite due canali distinti:

| Canale | Direzione | Uso |
|---|---|---|
| **RabbitMQ** | clinico → accounting (async) | Sync anagrafica pazienti |
| **REST API** | clinico → accounting (sync) | Tutto il resto: eventi fatturabili, lookup documenti, registrazione pagamenti |

**Principio chiave:** l'accounting è la **source of truth contabile**. Il clinico è la **source of truth operativa** (prestazioni, cartelle cliniche). L'accounting non modifica mai dati clinici.

### 1.2 Multi-tenancy

Ogni poliambulatorio è un **tenant** con DB PostgreSQL dedicato.
- **Tenant alias esempio:** `bdq`, `demo4`
- **Risoluzione tenant:** header `X-Tenant-Alias: <alias>` oppure subdomain `accounting.{alias}.curandis.cloud`

### 1.3 Autenticazione

- **Schema:** OAuth2 / OIDC (Keycloak)
- **Header obbligatorio:** `Authorization: Bearer <JWT>`
- **Claim richiesti nel JWT:**
  - `sub` — userId (UUID)
  - `email`, `name`, `preferred_username`
  - `realm_access.roles` / `resource_access['curandis-app-angular'].roles`
  - `organization` o `org_id` — organizationId del tenant

Lo stesso JWT usato per il clinico è valido per l'accounting (SSO via Keycloak).

### 1.4 Convenzioni trasversali

| Feature | Dettaglio |
|---|---|
| **Content-Type** | `application/json` per body e risposte |
| **Date** | Formato ISO `YYYY-MM-DD` |
| **Timestamp** | ISO 8601 con timezone (`timestamptz`) |
| **Importi** | Stringhe numeriche (`"45.00"`) con 2 decimali, mai float |
| **UUID** | `uuid v4` |
| **Paginazione** | Query params `page` (default 1), `pageSize` (default 20, max 100) |
| **Idempotency** | Header opzionale `Idempotency-Key: <uuid>` sugli endpoint marcati |
| **Tracing** | Header opzionale `X-Correlation-Id` propagato nei log |

---

## 2. Come funziona la fatturazione (flusso end-to-end)

### 2.1 Diagramma concettuale

```
┌─────────────────┐        ┌──────────────────────────────────────────────┐
│  LOGIN-SAAS     │        │  ACCOUNTING                                  │
│  (clinico)      │        │                                              │
└────────┬────────┘        └───┬──────────────────────────────────────────┘
         │                     │
         │ 1. patient.created  │    RabbitMQ
         ├────────────────────▶│    Topic: clinical.events
         │                     │    → sync automatico anagrafica
         │                     │
         │ 2. POST /billable-events/import
         ├────────────────────▶│    Idempotency-Key: <uuid>
         │    (snapshot trattamento)
         │                     │
         │ 3. GET /billable-events/:id
         ├────────────────────▶│    (verifica stato)
         │◀────────────────────┤
         │                     │
         │ 4. POST /sales-documents/invoices  (o /proformas)
         ├────────────────────▶│    crea documento DRAFT
         │                     │
         │ 5. POST /sales-documents/:id/issue
         ├────────────────────▶│    numero assegnato + prima nota
         │                     │
         │ 6. POST /sales-documents/:id/send-sdi (opzionale)
         ├────────────────────▶│    accoda XML FatturaPA
         │                     │
         │ 7. POST /payments/receipts
         ├────────────────────▶│    registra incasso + allocazione
         │                     │
         └─────────────────────┘
```

### 2.2 Stati del ciclo

**BillableEvent (evento fatturabile):**
`pending` → `invoiced` → (`cancelled` / `corrected`)

**SalesDocument (fattura/proforma/nota credito):**
`DRAFT` → `ISSUED` → (`PAID` / `PARTIALLY_PAID` / `CANCELLED` / `CONVERTED`)

**DueItem (scadenza):**
`open` → `partially_paid` → `paid` (oppure `overdue` se passata la data, `cancelled` se annullata)

---

## 3. Sync anagrafica paziente (RabbitMQ)

### 3.1 Configurazione

| | |
|---|---|
| **Exchange** | `clinical.events` (topic, durable) |
| **Queue** | `accounting.patient.sync` (durable) |
| **DLX** | `clinical.events.dlx` |
| **DLQ** | `accounting.dlq.patient.sync` |
| **Prefetch** | 10 messaggi |

### 3.2 Routing keys gestite

- `patient.created`
- `patient.updated`
- `patient.deactivated`

### 3.3 Schema del messaggio

```json
{
  "schemaVersion": "1.0",
  "occurredAt": "2026-04-21T14:30:00.000Z",
  "eventId": "uuid-v4",
  "eventType": "patient.created",
  "tenantAlias": "bdq",
  "correlationId": "uuid-v4",
  "producerVersion": "1.2.3",
  "payload": {
    "patientId": "uuid-del-paziente-nel-clinico",
    "organizationId": "uuid-organizzazione",
    "billingInfo": {
      "partyType": "INDIVIDUAL",
      "firstName": "Mario",
      "lastName": "Rossi",
      "legalName": null,
      "taxCode": "RSSMRA80A01H501Z",
      "vatNumber": null,
      "email": "mario.rossi@example.com",
      "phone": "+39 333 1234567",
      "birthDate": "1980-01-01",
      "sdiCode": "0000000",
      "pecEmail": null,
      "addresses": [
        {
          "addressType": "LEGAL",
          "street": "Via Roma 1",
          "zipCode": "12100",
          "city": "Cuneo",
          "province": "CN",
          "countryCode": "IT"
        }
      ]
    }
  }
}
```

**Headers consigliati:**
- `x-correlation-id: <uuid>` per tracing end-to-end

### 3.4 Behavior lato accounting

1. Cerca party per `(sourceSystem='CLINICAL', sourcePartyId=patientId)` → se esiste, aggiorna
2. Altrimenti: cerca per `taxCode` normalizzato → se match univoco, **auto-link** (associa il paziente clinico al party accounting esistente)
3. Altrimenti: crea nuovo party con `masteringMode=EXTERNAL_MASTER`
4. In caso di conflitto (stesso CF ma dati diversi) → stato `CONFLICT`, nessuna sovrascrittura, evento audit loggato

### 3.5 Cosa NON passa tramite RabbitMQ

- **Eventi fatturabili** (trattamenti): passano via REST `POST /billable-events/import` — servono risposta sincrona e idempotency
- **Richieste di fatturazione**: REST
- **Registrazione pagamenti**: REST
- **Query di stato**: REST

La regola: RabbitMQ solo per **dati master asincroni** (anagrafica). Tutto il resto è REST.

---

## 4. Flusso di fatturazione — step-by-step

### 4.1 Import di un evento fatturabile

Quando il clinico finalizza un trattamento e vuole renderlo fatturabile:

**`POST /api/v1/accounting/billable-events/import`**

Headers:
```
Authorization: Bearer <JWT>
Content-Type: application/json
X-Tenant-Alias: bdq
Idempotency-Key: <uuid-v4-della-operazione>
```

Body:
```json
{
  "sourceSystem": "clinical-app",
  "sourceOperationalSnapshotId": "uuid-del-trattamento-nel-clinico",
  "billableType": "TREATMENT",
  "itemDescription": "Prestazione fisioterapica eseguita da Dr. Rossi",
  "executionDate": "2026-04-21",
  "quantity": "1",
  "finalUnitPrice": "55.00",
  "grossAmount": "55.00",
  "discountAmount": "0",
  "surchargeAmount": "0",
  "netAmount": "55.00",
  "taxCodeId": "uuid-del-taxcode",
  "isHealthcare": true,
  "tsReportable": true,
  "feExcluded": false,
  "sourcePatientId": "uuid-del-paziente-nel-clinico",
  "siteId": "uuid-della-sede",
  "payerAllocations": [
    {
      "payerPartyId": "uuid-del-party-pagatore",
      "payerRole": "PATIENT",
      "amount": "55.00",
      "percentage": "100",
      "isPrimary": true
    }
  ],
  "billingInfo": {
    "partyType": "INDIVIDUAL",
    "firstName": "Mario",
    "lastName": "Rossi",
    "taxCode": "RSSMRA80A01H501Z",
    "addresses": [
      {
        "addressType": "LEGAL",
        "street": "Via Roma 1",
        "zipCode": "12100",
        "city": "Cuneo",
        "province": "CN"
      }
    ]
  }
}
```

**Risposta 201:**
```json
{
  "id": "uuid-billable-event",
  "accountingStatus": "pending",
  "sourceSystem": "clinical-app",
  "sourceOperationalSnapshotId": "uuid-del-trattamento",
  "netAmount": "55.00",
  ...
}
```

**IMPORTANTE:**
- L'`Idempotency-Key` è **fortemente consigliato**. Se il clinico reinvia la stessa richiesta (retry), lo stesso evento viene restituito senza creare duplicati
- Il sistema è idempotente anche su `(sourceSystem, sourceOperationalSnapshotId)`: anche senza Idempotency-Key, un secondo import dello stesso snapshot restituisce l'evento esistente
- Se `feExcluded=true` → errore 422 (l'evento è escluso dalla fatturazione)

### 4.2 Verifica stato di un trattamento

Il clinico vuole sapere "questo trattamento è stato fatturato? a che documento?"

**`GET /api/v1/accounting/billable-events/:id`**

Risposta:
```json
{
  "id": "uuid-billable-event",
  "accountingStatus": "invoiced",
  "executionDate": "2026-04-21",
  "netAmount": "55.00",
  "itemDescription": "...",
  "sourceOperationalSnapshotId": "uuid-del-trattamento"
}
```

**Campi chiave:**
- `accountingStatus`:
  - `pending` → non ancora fatturato
  - `invoiced` → inserito in una fattura o proforma
  - `cancelled` → annullato
  - `corrected` → corretto tramite nota credito

> **Nota per login-saas:** per risalire dall'evento alla fattura, usa `GET /sales-documents` con filtro (non implementato ora come relazione diretta). **Alternativa raccomandata:** il clinico memorizza localmente la coppia `(treatmentId → billableEventId)` al momento dell'import, e poi fa `GET /sales-documents` con pivot client-side. Vedi §9 per proposta migliorativa.

### 4.3 Creazione fattura da eventi

Il clinico chiede di fatturare uno o più eventi pending:

**`POST /api/v1/accounting/sales-documents/invoices`**

Body:
```json
{
  "accountingPartyId": "uuid-intestatario-fattura",
  "siteId": "uuid-sede",
  "issueDate": "2026-04-21",
  "billableEventIds": [
    "uuid-evento-1",
    "uuid-evento-2"
  ]
}
```

Risposta (201):
```json
{
  "id": "uuid-documento",
  "documentType": "INVOICE",
  "status": "DRAFT",
  "documentNumber": null,
  "totalAmount": "110.00",
  "billedPartySnapshot": { ... },
  "lines": [ ... ]
}
```

Il documento è **DRAFT**: non ha ancora numero fattura, non è registrato in prima nota, gli eventi sono già marcati `invoiced`.

### 4.4 Creazione proforma

**`POST /api/v1/accounting/sales-documents/proformas`**

Stesso body della fattura. Differenze:
- Gli eventi **restano `pending`** (non vengono marcati `invoiced`)
- La proforma non genera prima nota all'emissione
- Non viene inviata al SDI

### 4.5 Conversione proforma → fattura

**`POST /api/v1/accounting/sales-documents/:id/convert-to-invoice`**

Body:
```json
{
  "issueDate": "2026-04-21"
}
```

Crea un **nuovo** documento fattura `DRAFT` riferito agli stessi eventi; la proforma originale passa a `CONVERTED`.

### 4.6 Emissione del documento

**`POST /api/v1/accounting/sales-documents/:id/issue`**

Nessun body. Azioni eseguite:
1. Valida che lo snapshot intestatario sia completo
2. Assegna numero progressivo per sede/tipo/anno
3. Cambia `status` in `ISSUED`
4. Genera prima nota automatica (solo fatture, non proforma)
5. Crea le scadenze (`DueItemEntity`) in base ai payer allocations
6. Popola `issuedByUserId` / `issuedByEmail`

**Dopo l'emissione:** il documento è **immutabile**. Modifiche possibili solo tramite:
- Annullamento (`POST /:id/cancel`) → reverse posting
- Nota credito (nuova fattura con `documentType=CREDIT_NOTE`)

### 4.7 Invio al SDI (FatturaPA)

**`POST /api/v1/accounting/electronic-invoicing/send-sdi`**

Body:
```json
{
  "salesDocumentId": "uuid-documento"
}
```

Accoda un job BullMQ che:
1. Genera l'XML conforme FatturaPA 1.2.2
2. Assegna il progressivo univoco nel nome file (`IT{piva}_{progressivo}.xml`)
3. Invia al SDI tramite provider configurato

Stato consultabile con `GET /electronic-invoicing/document/:salesDocumentId`.

### 4.8 Registrazione incasso

Quando il paziente paga (in cassa, bonifico, POS):

**`POST /api/v1/accounting/payments/receipts`**

Body:
```json
{
  "direction": "RECEIPT",
  "payerPartyId": "uuid-pagatore",
  "payerRole": "PATIENT",
  "totalAmount": "55.00",
  "paymentDate": "2026-04-21",
  "paymentMethodId": "uuid-metodo-pagamento",
  "siteId": "uuid-sede",
  "reference": "POS-20260421-001",
  "allocations": [
    {
      "dueItemId": "uuid-scadenza",
      "amount": "55.00"
    }
  ]
}
```

Azioni:
1. Crea `PaymentAllocation` con link alle scadenze
2. Aggiorna `outstandingAmount` delle `DueItem` collegate
3. Se tutte le scadenze del documento sono saldate → `SalesDocument.status = PAID`
4. Genera prima nota "Cassa a Crediti"

### 4.9 Recuperare lo stato pagato di una fattura

**`GET /api/v1/accounting/sales-documents/:id`**

Campi rilevanti nella risposta:
```json
{
  "totalAmount": "55.00",
  "outstandingAmount": "0.00",
  "status": "PAID",
  ...
}
```

**`GET /api/v1/accounting/due-items/document/:salesDocumentId`**

Risposta:
```json
[
  {
    "id": "uuid-scadenza",
    "originalAmount": "55.00",
    "paidAmount": "55.00",
    "outstandingAmount": "0.00",
    "dueDate": "2026-05-21",
    "status": "paid",
    "payerPartyId": "uuid-paziente",
    "payerRole": "PATIENT"
  }
]
```

---

## 5. Endpoint rilevanti per il clinico (login-saas)

Tabella riassuntiva degli endpoint che il clinico userà direttamente.

### 5.1 Anagrafica

| Metodo | Endpoint | Uso |
|---|---|---|
| `POST` | `/parties` | Crea party manualmente (raro, solo se non c'è sync clinico) |
| `GET` | `/parties` | Lista party (ricerca/filtro per tipo/search) |
| `GET` | `/parties/:id` | Dettaglio party |
| `PUT` | `/parties/:id` | Aggiorna party (rispetta ownership EXTERNAL_MASTER) |

### 5.2 Eventi fatturabili

| Metodo | Endpoint | Uso |
|---|---|---|
| `POST` | `/billable-events/import` | **Import trattamento dal clinico** |
| `GET` | `/billable-events` | Lista eventi (filtro `status`) |
| `GET` | `/billable-events/ready` | Eventi pronti per fatturazione |
| `GET` | `/billable-events/:id` | **Stato di un trattamento specifico** |

### 5.3 Documenti di vendita

| Metodo | Endpoint | Uso |
|---|---|---|
| `POST` | `/sales-documents/invoices` | **Crea fattura da eventi** |
| `POST` | `/sales-documents/proformas` | **Crea proforma da eventi** |
| `POST` | `/sales-documents/:id/convert-to-invoice` | Converti proforma in fattura |
| `POST` | `/sales-documents/:id/issue` | **Emetti (numero + prima nota)** |
| `POST` | `/sales-documents/:id/cancel` | Annulla documento |
| `GET` | `/sales-documents` | Lista (filtri: `documentType`, `status`) |
| `GET` | `/sales-documents/:id` | **Dettaglio documento** |

### 5.4 Scadenze

| Metodo | Endpoint | Uso |
|---|---|---|
| `GET` | `/due-items` | Lista scadenze (filtri: status, payer, date) |
| `GET` | `/due-items/overdue` | Scadenze scadute |
| `GET` | `/due-items/document/:salesDocumentId` | **Scadenze di una fattura** |
| `GET` | `/due-items/:id` | Dettaglio scadenza |

### 5.5 Pagamenti

| Metodo | Endpoint | Uso |
|---|---|---|
| `POST` | `/payments/receipts` | **Registra incasso** |
| `POST` | `/payments/:id/allocate` | Alloca pagamento su scadenza |
| `GET` | `/payments` | Lista pagamenti |
| `GET` | `/payments/methods` | **Lista metodi di pagamento disponibili** |
| `GET` | `/payments/:id` | Dettaglio pagamento |

### 5.6 Lookup di supporto

| Metodo | Endpoint | Uso |
|---|---|---|
| `GET` | `/tax/codes` | Lista codici IVA (per picker) |
| `GET` | `/services-catalog` | Lista servizi catalogati |
| `GET` | `/address-lookup/autocomplete?query=...` | Autocompletamento indirizzi |
| `GET` | `/address-lookup/cadastral-codes?city=...` | Lookup codice catastale |

### 5.7 Convenzioni/Sconti

| Metodo | Endpoint | Uso |
|---|---|---|
| `GET` | `/conventions` | Lista convenzioni |
| `GET` | `/conventions/party/:partyId` | **Convenzioni attive di un paziente** |
| `POST` | `/conventions/:id/parties` | Associa paziente a convenzione |

---

## 6. Webhook e conferme (stato implementazione)

### 6.1 Stato attuale

**Non ci sono ancora webhook incoming implementati.** Il flusso di ritorno dai provider esterni (SDI, TS) al momento è **polling-based**: il clinico (o il frontend contabilità) interroga lo stato.

### 6.2 Consultazione stato SDI

**`GET /api/v1/accounting/electronic-invoicing/document/:salesDocumentId`**

Risposta:
```json
{
  "id": "uuid-submission",
  "salesDocumentId": "uuid-documento",
  "sdiDocumentType": "TD01",
  "fileName": "IT03952610040_A00042.xml",
  "sdiStatus": "DELIVERED",
  "sentAt": "2026-04-21T14:30:00Z",
  "deliveredAt": "2026-04-21T14:32:00Z"
}
```

Stati possibili di `sdiStatus`:
- `PENDING` → in coda
- `GENERATING` → generazione XML in corso
- `GENERATED` → XML pronto
- `SENDING` → invio al SDI in corso
- `SENT` → inviato, in attesa di ricevute
- `DELIVERED` → consegnato al destinatario
- `REJECTED` → scartato dal SDI
- `ERROR` → errore tecnico

### 6.3 Roadmap webhook

**Non ancora implementato, ma pianificato:**

L'accounting esporrà due endpoint per ricevere notifiche dal SDI/TS:

```
POST /api/v1/accounting/webhooks/sdi/callback
POST /api/v1/accounting/webhooks/ts/callback
```

Il login-saas potrà registrare un suo webhook per essere notificato dei cambi di stato:

```
POST /api/v1/accounting/webhooks/subscriptions
Body: {
  "url": "https://clinical.bdq.curandis.cloud/api/accounting-events",
  "events": ["invoice.issued", "invoice.paid", "invoice.sdi_delivered"],
  "secret": "<hmac-shared-secret>"
}
```

**Per ora:** il clinico fa polling sui GET endpoint o si iscrive a un'eventuale RabbitMQ exchange reverse (da definire).

---

## 7. Impostazioni da configurare nel modulo contabilità

Prima di poter fatturare, un nuovo tenant deve avere configurato:

### 7.1 Organizzazione e sede

```
POST /organizations
{
  "code": "BDQ",
  "legalName": "BDQ Fisio&Medical Center S.N.C."
}

POST /organizations/:id/sites
{
  "code": "MAIN",
  "name": "Sede Madonna dell'Olmo"
}
```

### 7.2 Codici IVA

```
POST /tax/codes
{
  "code": "ES10",
  "description": "Esente art. 10 (prestazioni sanitarie)",
  "vatRate": "0",
  "natureCode": "N4",
  "isExempt": true,
  "isHealthcareExempt": true,
  "stampDutyEligible": true,
  "tsEligible": true
}
```

Codici comuni per un poliambulatorio: `ES10`, `IVA4`, `IVA10`, `IVA22`.

### 7.3 Piano dei conti (GL)

Minimo richiesto:
- `1.3.01` Cassa (ASSET, `CASH`)
- `1.2.01` Crediti vs clienti (ASSET, `CURRENT_ASSET`)
- `2.2.01` Debiti vs fornitori (LIABILITY, `CURRENT_LIABILITY`)
- `4.1.01` Ricavi prestazioni sanitarie (REVENUE, `OPERATING_REVENUE`)
- `3.1.01` Stipendi (EXPENSE, `LABOR_COST`)

### 7.4 Profili di posting GL

Per ogni `eventType` (INVOICE_ISSUED, CREDIT_NOTE_ISSUED, PAYMENT_RECEIVED, ecc.) configurare i conti dare/avere predefiniti.

### 7.5 Metodi di pagamento

```
POST /payments/methods (endpoint interno - da attivare via seeder)
{
  "code": "BANCOMAT",
  "name": "Bancomat",
  "sdiCode": "MP08"
}
```

Standard: `MP01` (contanti), `MP05` (bonifico), `MP08` (carta di pagamento generica).

### 7.6 Progressivo SDI

**Obbligatorio** per chi emette fatture elettroniche:

```
POST /electronic-invoicing/progressive-config
{
  "vatNumber": "03952610040",
  "prefix": "A",
  "counter": 0,
  "counterPadding": 5
}
```

Il counter si incrementa automaticamente a ogni XML generato.

### 7.7 Convenzioni (opzionale)

```
POST /conventions
{
  "code": "SEVEN_STAR",
  "name": "Convenzione Seven Star",
  "discountType": "PERCENTAGE",
  "discountValue": "10.00",
  "partnerName": "Seven Star ASD"
}
```

---

## 8. Gestione errori

### 8.1 Formato standard

Tutte le risposte di errore seguono questo formato:

```json
{
  "statusCode": 422,
  "message": "Evento escluso da fatturazione (fe_excluded)",
  "error": "FeExcluded"
}
```

### 8.2 Codici di errore comuni

| HTTP | `error` | Significato |
|---|---|---|
| 400 | `ValidationError` | DTO non valido (campi mancanti/formato errato) |
| 401 | `Unauthorized` | JWT mancante/invalido |
| 403 | `Forbidden` | Utente autenticato ma senza permessi |
| 404 | `EntityNotFound` | Risorsa non esiste |
| 409 | `IdempotencyConflict` | Stessa Idempotency-Key con payload diverso |
| 409 | `DocumentAlreadyIssued` | Modifica richiesta su documento già emesso |
| 422 | `AmountMismatch` | Somma allocazioni ≠ totale pagamento |
| 422 | `FeExcluded` | Evento con `fe_excluded=true` non fatturabile |
| 500 | `InternalError` | Errore server generico |

### 8.3 Retry policy consigliata

- **Errori 4xx**: NON ritentare (eccetto 408 timeout, 429 rate limit)
- **Errori 5xx**: retry con backoff esponenziale (max 3 tentativi)
- **Idempotency-Key**: sempre valorizzato sulle POST critiche (import eventi, creazione pagamenti)

---

## 9. Feature consigliate per l'interfaccia clinico (risposta alla richiesta)

Il login-saas vuole poter:

### 9.1 "Questo trattamento è stato fatturato?"

**Implementazione raccomandata lato clinico:**

1. Al momento dell'import evento (§4.1), il clinico salva localmente:
   ```
   treatmentId → billableEventId
   ```

2. Per verificare lo stato, chiama:
   ```
   GET /api/v1/accounting/billable-events/:billableEventId
   ```
   Se `accountingStatus === 'invoiced'` → trattamento fatturato.

3. Per risalire al documento, pattern suggerito (non richiede nuova API):
   - Fare `GET /sales-documents?status=ISSUED` filtrando per data vicina
   - Ciascun documento ha `lines[].billableEventId` — pivot client-side

**Proposta di miglioramento API** (da valutare con il team accounting):

```
GET /api/v1/accounting/billable-events/:id/document
→ restituisce { salesDocumentId, documentNumber, documentType, status, totalAmount }
```

Questo endpoint risolverebbe il lookup in una chiamata sola. Se ritenuto utile, può essere aggiunto nel modulo `billable-events`.

### 9.2 "A che fattura/proforma corrisponde?"

Oggi il dato è raggiungibile via:
```
GET /sales-documents/:id
→ lines[].billableEventId
```

Lato clinico, dopo aver trovato l'id del documento (vedi 9.1), mostra:
- `documentNumber`, `documentType`, `issueDate`
- `billedPartySnapshot.legalName` o `firstName + lastName`
- `totalAmount`, `status`

### 9.3 "È stato incassato?"

```
GET /api/v1/accounting/sales-documents/:id
```

Campi:
- `status === 'PAID'` → pagato completamente
- `status === 'PARTIALLY_PAID'` → pagato parzialmente
- `outstandingAmount` → quanto manca
- `outstandingAmount === '0.00'` → saldato

Per dettagli sulle singole scadenze:
```
GET /api/v1/accounting/due-items/document/:salesDocumentId
```

### 9.4 "Segna il pagamento"

UX suggerita nel clinico:

1. **Fetch metodi pagamento:** `GET /payments/methods`
2. **Fetch scadenze aperte:** `GET /due-items/document/:salesDocumentId?status=open`
3. **Form utente** con:
   - Data pagamento (default oggi)
   - Metodo pagamento (dropdown)
   - Importo
   - Riferimento (es. numero POS, causale bonifico)
4. **POST /payments/receipts** con le allocazioni

### 9.5 "Invia richiesta di fatturazione di un trattamento"

UX suggerita:

1. Utente clinico seleziona uno o più trattamenti `pending`
2. Sceglie intestatario (paziente, assicurazione, azienda) → `accountingPartyId`
3. Sceglie tipo documento: fattura o proforma
4. `POST /sales-documents/invoices` (o `/proformas`)
5. Mostra conferma con `documentNumber` (se issued) o "In bozza"
6. Opzionale: chiamata automatica a `POST /:id/issue` subito dopo

**Pattern raccomandato:**

```typescript
// Pseudo-codice lato clinico
const ev = await POST('/billable-events/import', eventPayload, { idempotencyKey });

// ...più tardi, l'utente clicca "Fattura"...
const doc = await POST('/sales-documents/invoices', {
  accountingPartyId,
  siteId,
  billableEventIds: [ev.id],
});

// Emetti subito
const issued = await POST(`/sales-documents/${doc.id}/issue`);

// Mostra conferma all'utente
showConfirmation({
  number: issued.documentNumber,
  total: issued.totalAmount,
  url: `https://accounting.${tenant}.curandis.cloud/documents/${issued.id}`,
});
```

### 9.6 "Conferma della fatturazione"

La risposta 201 del `POST /sales-documents/.../issue` è **sincrona**. Contiene:
- `documentNumber` (definitivo)
- `status: ISSUED`
- `totalAmount`
- `issueDate`

Questo è il punto di conferma. Se l'utente vuole anche il PDF della fattura, non è ancora implementato un endpoint di download: in roadmap.

---

## 10. Esempi di integrazione end-to-end

### 10.1 Flusso "fattura emessa subito dopo il trattamento"

```
1. Clinico completa trattamento
   ↓
2. POST /billable-events/import  (Idempotency-Key: T-20260421-001)
   → billableEventId = e-abc123
   ↓
3. POST /sales-documents/invoices
   {
     accountingPartyId: "party-paziente",
     billableEventIds: ["e-abc123"]
   }
   → documentId = d-xyz789, status: DRAFT
   ↓
4. POST /sales-documents/d-xyz789/issue
   → documentNumber: "42", status: ISSUED, totalAmount: "55.00"
   ↓
5. POST /payments/receipts
   {
     direction: "RECEIPT",
     payerPartyId: "party-paziente",
     payerRole: "PATIENT",
     totalAmount: "55.00",
     paymentDate: "2026-04-21",
     paymentMethodId: "pm-bancomat",
     allocations: [{ dueItemId: "...", amount: "55.00" }]
   }
   → pagamento registrato, documento ora status: PAID
   ↓
6. (Opzionale) POST /electronic-invoicing/send-sdi
   { salesDocumentId: "d-xyz789" }
   → XML accodato per invio SDI
```

### 10.2 Flusso "proforma → pagamento → conversione in fattura"

```
1. POST /billable-events/import  → e-abc123
   ↓
2. POST /sales-documents/proformas
   {
     accountingPartyId: "party-paziente",
     billableEventIds: ["e-abc123"]
   }
   → proforma draft, l'evento resta "pending"
   ↓
3. POST /sales-documents/proforma-id/issue
   → proforma numerata (es. "PROF-042"), nessuna prima nota
   ↓
4. Il paziente paga
   POST /payments/receipts  (allocato sulla proforma)
   ↓
5. POST /sales-documents/proforma-id/convert-to-invoice
   → nuova fattura DRAFT riferita agli stessi eventi
   → proforma originale → status: CONVERTED
   ↓
6. POST /sales-documents/new-invoice-id/issue
   → fattura definitiva emessa, evento ora "invoiced"
```

---

## 11. Dati tecnici utili

### 11.1 Swagger/OpenAPI

Documentazione live disponibile su:
```
https://accounting.<tenant>.curandis.cloud/docs/accounting
```

Include tutti gli endpoint con schema DTO completi e possibilità di testare direttamente (con JWT).

### 11.2 Health check

Endpoint pubblico (senza auth):
```
GET /api/v1/accounting/health/status
→ { "status": "ok", "service": "accounting", "timestamp": "..." }
```

### 11.3 CORS

Origini consentite:
- `http://localhost:4200` / `4300` (sviluppo)
- `https://*.curandis.cloud` (produzione)

### 11.4 Rate limiting

Non attivo al momento. Futuro: limite per tenant, non per utente.

---

## 12. Feature presenti nel modulo (panoramica completa)

| Area | Feature |
|---|---|
| **Anagrafiche** | Party multi-tipo (paziente, azienda, PA, assicurazione, collaboratore), profili fiscali, multi-indirizzo, multi-conto bancario, billing profile |
| **Convenzioni/Sconti** | Convenzioni con sconto fisso o percentuale, associazione N:M a party, validità temporale, attivazione/disattivazione |
| **Fatturazione** | Fatture, proforma, note credito, conversione proforma→fattura, numerazione per sede/tipo/anno, immutabilità post-issue, storno automatico |
| **Fatturazione elettronica** | Generazione XML FatturaPA 1.2.2, progressivo univoco configurabile, invio SDI (BullMQ) |
| **Sistema Tessera Sanitaria** | Coda invio prestazioni sanitarie, flag opposizione |
| **Ciclo passivo** | Fatture fornitori, autofatture (reverse charge, intra-EU, extra-EU), ritenuta d'acconto |
| **Compensi collaboratori** | Registrazione compensi per evento, liquidazioni periodiche con ritenuta, link a fattura passiva |
| **Contabilità generale** | Piano dei conti gerarchico (4 livelli), prima nota automatica in partita doppia, storno, periodi contabili |
| **Centri di costo** | Contabilità analitica gerarchica (area→reparto), imputazione automatica su journal entries |
| **Spese operative** | Spese manuali, categorie gerarchiche, spese ricorrenti (mensile/trimestrale/annuale) con generazione automatica |
| **Banking** | Conti bancari, movimenti, riconciliazione manuale/automatica |
| **Scadenze/Incassi** | Scadenzario per pagatore e ruolo, pagamenti parziali, multi-allocazione |
| **Assicurazioni** | Gestione sinistri (claimed/approved/paid/rejected) |
| **Reportistica** | Fatturato, IVA, scadenzario, **CE riclassificato, SP, EBITDA, EBIT, ROI, ROE, Working Capital, Current Ratio, analisi margini per CdC** |
| **Audit** | Log completo di ogni operazione con user/email/timestamp/IP, tracciamento `createdBy` e `issuedBy` su tutti i documenti |
| **Multi-tenancy** | DB-per-tenant con credenziali OpenBao, middleware tenant-aware |
| **Idempotency** | Header `Idempotency-Key` supportato su operazioni critiche |

---

## 13. Domande aperte / Punti di discussione

Da concordare tra team clinico e accounting:

1. **Endpoint lookup `billable-event → document`:** vale la pena aggiungere `GET /billable-events/:id/document` per semplificare il clinico?
2. **Webhook outbound:** quando vuoi iniziare a ricevere push di notifiche (pagamento effettuato, SDI delivered)? Se sì, propongo protocollo REST+HMAC o topic RabbitMQ dedicato.
3. **PDF fattura:** serve endpoint `GET /sales-documents/:id/pdf`? Se sì, layout concordato con il cliente.
4. **Bulk import eventi:** oggi import è 1 evento per chiamata. Se il clinico importa molti eventi giornalieri, pattern batch più efficiente?
5. **Reverse sync party → clinico:** se l'operatore contabile modifica un party (es. aggiunge un IBAN), come viene propagato al clinico? Oggi non c'è sync inverso.
6. **Cache/invalidation:** il clinico può voler cachare lista `/payments/methods`, `/tax/codes`, `/conventions`. Aggiungere ETag/Last-Modified?

---

## 14. Changelog

| Data | Versione | Modifiche |
|---|---|---|
| 2026-04-21 | 1.0 | Prima stesura completa |

---

## Allegato A — Mapping enum

### PartyType
`INDIVIDUAL`, `COMPANY`, `PUBLIC_ADMINISTRATION`, `INSURANCE`, `COLLABORATOR`

### PayerRole
`PATIENT`, `INSURANCE`, `COMPANY`, `OTHER`

### DocumentType
`PROFORMA`, `INVOICE`, `CREDIT_NOTE`, `RECEIPT`

### DocumentStatus
`DRAFT`, `ISSUED`, `SENT`, `PAID`, `PARTIALLY_PAID`, `CANCELLED`, `CONVERTED`

### DueItemStatus
`open`, `partially_paid`, `paid`, `overdue`, `cancelled`

### PaymentDirection
`RECEIPT`, `DISBURSEMENT`

### GlAccountType
`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`

### BalanceSheetSection
`OPERATING_REVENUE`, `OTHER_REVENUE`, `RAW_MATERIALS`, `SERVICE_COSTS`, `LABOR_COST`, `OTHER_OPERATING_COST`, `DEPRECIATION`, `FINANCIAL_INCOME`, `FINANCIAL_EXPENSE`, `EXTRAORDINARY`, `TAX`, `FIXED_ASSET`, `CURRENT_ASSET`, `CASH`, `EQUITY`, `LONG_TERM_LIABILITY`, `CURRENT_LIABILITY`

### DiscountType
`FIXED` (importo in euro), `PERCENTAGE` (percentuale)

### TaxTreatmentType
`VAT_TAXABLE`, `VAT_EXEMPT_ART10`, `OUT_OF_SCOPE`, `REVERSE_CHARGE`, `SPLIT_PAYMENT`

### SdiDocumentType
`TD01` (Fattura), `TD04` (Nota credito), `TD17` (Servizi estero), `TD18` (Acquisti intra UE)
