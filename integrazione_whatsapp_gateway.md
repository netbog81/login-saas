# Prompt per l'agente: Integrazione WhatsApp Gateway nella Main App

## Contesto

La main-app è un'applicazione NestJS + TypeORM + GraphQL con frontend Angular Material e architettura a layer (module/resolver/service/repository). Deve integrarsi con un microservizio esterno chiamato **WhatsApp Gateway** già operativo.

Il gateway è raggiungibile sulla rete Docker interna tramite il container `message_gateway` sulla porta `3000` (esposto sull'host alla porta `3005`). È un servizio REST+Swagger che gestisce l'invio di messaggi WhatsApp via Evolution API, con code BullMQ, reminder automatici 24h prima degli appuntamenti e recap aggregati per paziente.

---

## Stack tecnico main-app

- **Backend**: NestJS, TypeORM, GraphQL (code-first con decoratori), PostgreSQL
- **Frontend**: Angular 17+, Angular Material, architettura a layer (smart/dumb components, services, store)
- **Auth**: JWT + ruoli
- **ORM**: TypeORM con migrations
- **Pattern**: repository pattern, domain services, DTOs separati per GraphQL input/output

---

## Parte 1: Schema database (TypeORM migrations)

### Tabella `whatsapp_tenant_config`
Configurazione per-tenant del gateway WhatsApp. Un tenant corrisponde a uno studio/cliente.

```sql
CREATE TABLE whatsapp_tenant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL UNIQUE,          -- ID tenant (deve corrispondere al nome istanza Evolution, es. "bdq")
  gateway_url VARCHAR(500) NOT NULL,               -- URL base del gateway (es. "http://message_gateway:3000")
  gateway_api_key VARCHAR(500) NOT NULL,           -- API key con cui la main-app chiama il gateway (CIFRATA a riposo)
  is_active BOOLEAN NOT NULL DEFAULT true,
  recap_delay_seconds INT NOT NULL DEFAULT 60,     -- Buffer recap (default 60s, non modificabile lato gateway)
  reminder_hours_before INT NOT NULL DEFAULT 24,   -- Ore prima per reminder (informativo, logica nel gateway)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tabella `whatsapp_message_template`
Template messaggi personalizzabili per-tenant.

```sql
CREATE TABLE whatsapp_message_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL,
  template_type VARCHAR(50) NOT NULL,              -- 'RECAP_SINGLE' | 'RECAP_MULTI' | 'REMINDER_24H'
  template_text TEXT NOT NULL,                     -- Testo con variabili: {name}, {date}, {time}, {appointments}
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_template UNIQUE (tenant_id, template_type)
);
```

**Template di default da inserire al seed:**
```
RECAP_SINGLE:  "Gentile {name}, confermiamo il suo appuntamento per il {date} alle {time}."
RECAP_MULTI:   "Gentile {name}, confermiamo i seguenti appuntamenti:\n{appointments}"
REMINDER_24H:  "Promemoria: il suo appuntamento è domani alle {time}."
```

La main-app è responsabile di **comporre il testo finale** prima di inviarlo al gateway, sostituendo le variabili `{name}`, `{date}`, `{time}`, `{appointments}` con i valori reali dell'appuntamento. Il testo composto viene passato nei campi `recapMessage` e `reminderMessage` del payload. Se omessi, il gateway usa testi di fallback hardcoded.

### Tabella `whatsapp_message_log`
Log di tutti i messaggi inviati/ricevuti tramite il gateway.

```sql
CREATE TABLE whatsapp_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL,
  correlation_id UUID,                             -- ID univoco dalla chiamata al gateway
  appointment_id VARCHAR(100),                     -- ID appuntamento referenziato
  patient_id VARCHAR(100),                         -- ID paziente
  patient_name VARCHAR(255),
  patient_phone VARCHAR(50),
  message_type VARCHAR(50) NOT NULL,               -- 'RECAP' | 'REMINDER_24H' | 'INBOUND' | 'STATUS_UPDATE'
  direction VARCHAR(10) NOT NULL,                  -- 'OUTBOUND' | 'INBOUND'
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',   -- 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
  evolution_message_id VARCHAR(255),               -- ID messaggio restituito da Evolution API
  raw_payload JSONB,                               -- Payload raw dell'evento Evolution (per debug)
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_log_tenant ON whatsapp_message_log(tenant_id);
CREATE INDEX idx_whatsapp_log_appointment ON whatsapp_message_log(appointment_id);
CREATE INDEX idx_whatsapp_log_patient ON whatsapp_message_log(patient_id);
CREATE INDEX idx_whatsapp_log_status ON whatsapp_message_log(status);
CREATE INDEX idx_whatsapp_log_correlation ON whatsapp_message_log(correlation_id);
```

### Tabella `whatsapp_webhook_event`
Archivio grezzo degli eventi ricevuti dal gateway (per audit e debug).

```sql
CREATE TABLE whatsapp_webhook_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL,
  correlation_id UUID,
  event_type VARCHAR(100) NOT NULL,               -- 'messages.upsert' | 'messages.update' | 'connection.update' | ecc.
  raw_event JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_event_tenant ON whatsapp_webhook_event(tenant_id);
CREATE INDEX idx_webhook_event_type ON whatsapp_webhook_event(event_type);
CREATE INDEX idx_webhook_event_processed ON whatsapp_webhook_event(processed);
```

---

## Parte 2: Backend NestJS

### Modulo da creare: `WhatsappModule`

Struttura a layer:
```
src/
  whatsapp/
    whatsapp.module.ts
    config/
      whatsapp-config.entity.ts          (TypeORM entity per whatsapp_tenant_config)
      whatsapp-config.repository.ts
      whatsapp-config.service.ts
      whatsapp-config.resolver.ts        (GraphQL mutations/queries per configurazione)
    template/
      whatsapp-template.entity.ts
      whatsapp-template.repository.ts
      whatsapp-template.service.ts
      whatsapp-template.resolver.ts
    log/
      whatsapp-log.entity.ts
      whatsapp-log.repository.ts
      whatsapp-log.service.ts
      whatsapp-log.resolver.ts           (GraphQL queries per monitoraggio)
    webhook/
      whatsapp-webhook.controller.ts     (REST endpoint POST /api/webhooks/whatsapp)
      whatsapp-webhook.service.ts
    gateway/
      whatsapp-gateway.service.ts        (HTTP client verso il gateway esterno)
      whatsapp-gateway.dto.ts
```

---

### 2.1 Gateway Service (chiamate HTTP al gateway)

Il servizio `WhatsappGatewayService` usa `@nestjs/axios` per chiamare il gateway esterno.

**Metodo: dispatch appuntamento**
```typescript
async dispatchBooking(params: {
  tenantId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  phone: string;
  date: string; // ISO 8601, es. "2026-03-15T10:30:00+01:00"
  userId: string;
  correlationId?: string;
}): Promise<{ correlationId: string }>
```

**Chiamata HTTP generata:**
```
POST {gateway_url}/whatsapp/dispatch
Headers:
  Content-Type: application/json
  x-tenant-id: {tenantId}
  x-tenant-api-key: {gateway_api_key}   ← decifrata da DB prima dell'uso
  x-user-id: {userId}

Body:
{
  "type": "APPOINTMENT_BOOKING",
  "data": {
    "appointmentId": "string",
    "pazienteId": "string",
    "phone": "+39XXXXXXXXXX",
    "date": "2026-03-15T10:30:00+01:00",
    "name": "Mario Rossi"
  },
  "correlationId": "uuid-opzionale"
}
```

**Metodo: cancellazione reminder**
```
DELETE {gateway_url}/whatsapp/booking/{appointmentId}
Headers:
  x-tenant-id: {tenantId}
  x-tenant-api-key: {gateway_api_key}
  x-user-id: {userId}
```

**Importante:** Dopo ogni chiamata al gateway, salvare un record in `whatsapp_message_log` con status `PENDING` e il `correlationId` restituito.

---

### 2.2 Webhook Controller (ricezione eventi dal gateway)

```
POST /api/webhooks/whatsapp
Headers ricevuti:
  x-tenant-id: {tenantId}
  x-correlation-id: {correlationId}
Body: payload raw dell'evento Evolution
```

**Struttura payload ricevuto:**
```json
{
  "event": "messages.update",
  "instance": "bdq",
  "data": {
    "key": {
      "remoteJid": "393515847659@s.whatsapp.net",
      "fromMe": true,
      "id": "EVOLUTION_MESSAGE_ID"
    },
    "update": {
      "status": "READ"
    }
  }
}
```

**Logica nel webhook service:**

1. Salvare evento grezzo in `whatsapp_webhook_event`
2. In base a `event`:
   - `messages.upsert` → aggiorna `whatsapp_message_log.status = 'SENT'`, salva `evolution_message_id`, `sent_at = NOW()`
   - `messages.update` con `status = 'DELIVERY_ACK'` → aggiorna status `DELIVERED`, `delivered_at = NOW()`
   - `messages.update` con `status = 'READ'` → aggiorna status `READ`, `read_at = NOW()`
   - `connection.update` → log solo (utile per alert se istanza si disconnette)
   - `send.message` → conferma invio, aggiorna `evolution_message_id`
3. Rispondere sempre **200 OK** (anche in caso di errore interno — logga ma non far ritentare il gateway inutilmente)

**Matching del log:** usa `correlationId` dall'header o `data.key.id` (evolution_message_id) per trovare il record in `whatsapp_message_log`.

---

### 2.3 Integrazione con il modulo Appuntamenti

Nei punti del codice dove vengono gestiti gli appuntamenti, iniettare `WhatsappGatewayService` e chiamare:

**Creazione appuntamento:**
```typescript
// Dopo il salvataggio in DB
await this.whatsappGatewayService.dispatchBooking({
  tenantId: tenant.whatsappTenantId,  // es. "bdq"
  appointmentId: appointment.id,
  patientId: patient.id,
  patientName: `${patient.firstName} ${patient.lastName}`,
  phone: patient.phone,               // formato +39XXXXXXXXXX
  date: appointment.startTime.toISOString(),
  userId: currentUser.id,
});
```

**Modifica appuntamento (cambio data/ora):**
1. Prima cancella il reminder precedente:
   ```typescript
   await this.whatsappGatewayService.cancelBooking(tenantId, appointment.id, userId);
   ```
2. Poi crea un nuovo dispatch con la nuova data.

**Cancellazione appuntamento:**
```typescript
await this.whatsappGatewayService.cancelBooking(tenantId, appointment.id, userId);
// Aggiorna anche il log: status = 'CANCELLED'
```

**Importante:** Tutte queste chiamate devono essere **fire-and-forget con gestione errori** — un errore del gateway non deve bloccare il salvataggio dell'appuntamento nel DB principale. Usa `try/catch` e loga l'errore senza rilanciarlo.

---

## Parte 3: GraphQL API

### Query per il monitoraggio

```graphql
type WhatsappMessageLog {
  id: ID!
  tenantId: String!
  correlationId: String
  appointmentId: String
  patientId: String
  patientName: String
  patientPhone: String
  messageType: String!
  direction: String!
  status: String!
  evolutionMessageId: String
  errorMessage: String
  sentAt: DateTime
  deliveredAt: DateTime
  readAt: DateTime
  createdAt: DateTime!
}

type WhatsappMessageLogPage {
  items: [WhatsappMessageLog!]!
  total: Int!
}

type Query {
  whatsappMessageLogs(
    tenantId: String!
    patientId: String
    appointmentId: String
    status: String
    messageType: String
    dateFrom: DateTime
    dateTo: DateTime
    page: Int = 1
    limit: Int = 50
  ): WhatsappMessageLogPage!

  whatsappMessageLog(id: ID!): WhatsappMessageLog
}
```

### Mutation per la configurazione

```graphql
input WhatsappConfigInput {
  tenantId: String!
  gatewayUrl: String!
  gatewayApiKey: String!
  isActive: Boolean
}

input WhatsappTemplateInput {
  tenantId: String!
  templateType: String!    # 'RECAP_SINGLE' | 'RECAP_MULTI' | 'REMINDER_24H'
  templateText: String!
}

type Mutation {
  saveWhatsappConfig(input: WhatsappConfigInput!): WhatsappTenantConfig!
  saveWhatsappTemplate(input: WhatsappTemplateInput!): WhatsappMessageTemplate!
  testWhatsappConnection(tenantId: String!): Boolean!  # chiama GET {gateway_url}/docs e verifica 200
}
```

---

## Parte 4: Frontend Angular

### 4.1 Pagina Configurazione WhatsApp
**Route:** `/settings/whatsapp` (sezione Impostazioni, solo per ADMIN)

**Componenti (architettura a layer):**

```
whatsapp-settings/
  whatsapp-settings.module.ts
  containers/
    whatsapp-settings-page/           ← smart component
      whatsapp-settings-page.component.ts
  components/
    whatsapp-config-form/             ← dumb component
      Input: config: WhatsappConfig
      Output: save: EventEmitter<WhatsappConfigInput>
    whatsapp-template-editor/         ← dumb component
      Input: templates: WhatsappTemplate[]
      Output: saveTemplate: EventEmitter<WhatsappTemplateInput>
```

**Layout pagina configurazione (Angular Material):**

```
┌─────────────────────────────────────────────────┐
│  Configurazione WhatsApp Gateway                │
├─────────────────────────────────────────────────┤
│  [mat-card] Connessione Gateway                 │
│  ┌─────────────────────────────────────────┐   │
│  │ URL Gateway:     [mat-form-field]       │   │
│  │ API Key:         [mat-form-field] 👁    │   │
│  │ Tenant ID:       [mat-form-field]       │   │
│  │ Stato:           ● Attivo / ○ Inattivo  │   │
│  │                                         │   │
│  │  [Testa Connessione]    [Salva]         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [mat-card] Template Messaggi                   │
│  ┌─────────────────────────────────────────┐   │
│  │ [mat-tab-group]                         │   │
│  │  Tab: Recap singolo                     │   │
│  │  Tab: Recap multiplo                    │   │
│  │  Tab: Promemoria 24h                    │   │
│  │                                         │   │
│  │  [mat-form-field textarea] template     │   │
│  │  Variabili disponibili: {name} {date}   │   │
│  │  {time} {appointments}                  │   │
│  │                                         │   │
│  │  [Anteprima]    [Salva Template]        │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

### 4.2 Pagina Monitoraggio Messaggi WhatsApp
**Route:** `/whatsapp/monitor` (sezione operativa, per ADMIN e STAFF)

**Componenti:**

```
whatsapp-monitor/
  whatsapp-monitor.module.ts
  containers/
    whatsapp-monitor-page/           ← smart component
  components/
    whatsapp-filter-bar/             ← dumb: filtri ricerca
    whatsapp-message-table/          ← dumb: tabella mat-table
    whatsapp-message-detail/         ← dumb: dialog dettaglio
```

**Layout pagina monitoraggio:**

```
┌─────────────────────────────────────────────────────────┐
│  Monitoraggio Messaggi WhatsApp                         │
├─────────────────────────────────────────────────────────┤
│  [Filtri]                                               │
│  Paziente: [input]  Stato: [select]  Data: [datepicker] │
│  Tipo: [select]                          [Cerca]        │
├─────────────────────────────────────────────────────────┤
│  [mat-table]                                            │
│  │ Data/Ora │ Paziente │ Tipo │ Stato │ Telefono │ … │  │
│  ├──────────┼──────────┼──────┼───────┼──────────┤   │  │
│  │ 06/03 …  │ M.Rossi  │RECAP │  ✅   │+39351... │ 👁 │  │
│  │ 06/03 …  │ L.Gior…  │REM.  │  📬   │+39348... │ 👁 │  │
│  │ 05/03 …  │ A.Verdi  │RECAP │  ❌   │+39335... │ 👁 │  │
│                                                         │
│  Legenda: ✅ Letto  📬 Consegnato  📤 Inviato  ❌ Errore │
│                                                         │
│  [mat-paginator]                                        │
└─────────────────────────────────────────────────────────┘
```

**Dialog dettaglio messaggio:**
- Dati paziente e appuntamento
- Timeline stati (PENDING → SENT → DELIVERED → READ)
- Payload raw evento Evolution (expandibile per debug)
- Pulsante "Ri-invia" (chiama nuovamente dispatch, solo per ADMIN)

---

## Parte 5: Sicurezza

### Cifratura gateway_api_key
La `gateway_api_key` salvata in `whatsapp_tenant_config` **deve essere cifrata a riposo** nel database. Usa lo stesso pattern AES-256-GCM già presente nel gateway o il meccanismo di column encryption già in uso nella main-app.

### Validazione webhook in ingresso
L'endpoint `POST /api/webhooks/whatsapp` è chiamato dal gateway interno (rete Docker) — non è esposto su internet. Non serve HMAC signature per ora, ma:
- Validare che `x-tenant-id` esista nel DB
- Limitare l'accesso a IP della rete interna se possibile (tramite firewall/nginx)

### Rate limiting
Non applicare rate limiting sull'endpoint webhook — il gateway già gestisce il proprio throttling.

---

## Parte 6: Checklist implementazione

**Backend:**
- [ ] Creare migration TypeORM per le 4 tabelle
- [ ] Creare entities TypeORM
- [ ] Creare `WhatsappGatewayService` con metodi `dispatchBooking` e `cancelBooking`
- [ ] Creare `WhatsappWebhookController` con endpoint `POST /api/webhooks/whatsapp`
- [ ] Creare `WhatsappLogService` con metodi di query per GraphQL
- [ ] Creare `WhatsappConfigService` con CRUD per configurazione tenant
- [ ] Creare resolvers GraphQL per configurazione e monitoraggio
- [ ] Integrare `WhatsappGatewayService` nel service degli appuntamenti (creazione/modifica/cancellazione)
- [ ] Seed dei template di default

**Frontend:**
- [ ] Pagina configurazione `/settings/whatsapp`
- [ ] Pagina monitoraggio `/whatsapp/monitor`
- [ ] Aggiungere voci di menu nelle sezioni appropriate
- [ ] Guard ruoli per le pagine (ADMIN per configurazione, ADMIN+STAFF per monitoraggio)

---

## Note importanti

1. **Il `tenantId` passato al gateway deve corrispondere esattamente al nome dell'istanza Evolution API** (es. se l'istanza si chiama `bdq`, il `tenantId` deve essere `bdq`). Questo è il campo `tenant_id` in `whatsapp_tenant_config`.

2. **Il numero di telefono** deve essere nel formato internazionale senza `+`: es. `393515847659` (non `+39...`). Verificare il formato prima di inviare.

3. **Fire-and-forget obbligatorio**: le chiamate al gateway non devono mai bloccare le operazioni sugli appuntamenti. Usare sempre `try/catch` e loggare gli errori senza rilanciare.

4. **Il gateway risponde immediatamente** con 201 quando accoda il job — non aspettare la conferma dell'invio effettivo su WhatsApp. Lo stato reale arriva tramite webhook.

5. **CorrelationId**: generarlo nella main-app (UUID v4) e passarlo al gateway. Usarlo per tracciare il ciclo di vita del messaggio nel log.



6. **Riepilogo**:
Database (4 tabelle):

whatsapp_tenant_config — URL gateway + API key cifrata per-tenant
whatsapp_message_template — template messaggi personalizzabili (RECAP_SINGLE, RECAP_MULTI, REMINDER_24H)
whatsapp_message_log — log di tutti i messaggi con stati (PENDING→SENT→DELIVERED→READ)
whatsapp_webhook_event — archivio grezzo eventi Evolution per audit
Backend:

WhatsappGatewayService — chiamate HTTP al gateway (dispatch + cancel)
WhatsappWebhookController — endpoint POST /api/webhooks/whatsapp
Integrazione nel service appuntamenti (crea/modifica/cancella) con fire-and-forget
Frontend Angular Material:

Pagina configurazione /settings/whatsapp — form connessione + editor template con anteprima
Pagina monitoraggio /whatsapp/monitor — tabella con filtri, stati con icone, dialog dettaglio con timeline
Note critiche incluse:

Il tenantId deve corrispondere al nome istanza Evolution
Il telefono deve essere senza + (es. 393515847659)
Le chiamate al gateway non devono mai bloccare il salvataggio appuntamenti