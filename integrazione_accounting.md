# Integrazione Modulo Contabilità (Accounting Microservice)

## 1. Panoramica architetturale

Il modulo contabilità è un microservizio NestJS separato con il proprio database PostgreSQL. Riceve **billable events** dall'app clinica (main app) quando un trattamento/prestazione viene chiuso, e si occupa di:

- Emissione fatture
- Registrazione pagamenti
- Calcolo liquidazioni
- Reportistica contabile

### Differenza chiave rispetto all'app clinica

| | App clinica (attuale) | Modulo contabilità |
|---|---|---|
| **Isolamento dati** | 1 DB, N schemi (uno per tenant) | 1 DB per tenant |
| **OpenBao path** | `kv/data/tenant-map/{alias}` → `schema_name` | `kv/data/tenant-accounting-db/{alias}` → `db_host, db_name, db_port, db_username` |
| **Connessione** | Singolo DataSource + `SET search_path` | DataSource per tenant (pool di connessioni) |
| **Cache** | `Map<alias, schemaName>` (TTL 5min) | `Map<alias, DataSource>` (idle timeout 10min) |
| **Credenziali DB** | Static role OpenBao + rotazione | Static role per-tenant OpenBao (1 utente PostgreSQL per tenant DB) |

> **Nota**: in futuro l'app clinica adotterà lo stesso pattern DB-per-tenant del modulo contabilità. Il componente `TenantDataSourceManager` sarà estratto come libreria condivisa `@curandis/tenant-datasource` fin da subito.

---

## 2. Architettura

```
App Clinica (Main App)                     Modulo Contabilità
━━━━━━━━━━━━━━━━━━━━━                     ━━━━━━━━━━━━━━━━━━

Trattamento chiuso
      │
      ▼
RabbitMQ Exchange
  "billing.events"
  routing_key: "treatment.closed"
  payload:
    - JWT (nel header AMQP)
    - billableEvent (body)
                          ─────────►       1. Consuma messaggio dalla coda
                                           2. Valida JWT (JWKS Keycloak)
                                           3. Estrae tenantAlias dal JWT
                                           4. TenantDataSourceManager:
                                              cache.get(alias)
                                                ├─ hit → DataSource attivo
                                                └─ miss → OpenBao
                                                    /kv/data/tenant-accounting-db/{alias}
                                                    → { db_host, db_name, db_port, db_username }
                                                    → static-creds/postgres-{db_username}
                                                    → crea DataSource + cache
                                           5. Connessione al DB tenant
                                           6. Processa billable event
                                           7. ACK messaggio
```

### Comunicazione via RabbitMQ

L'app clinica dispone già di RabbitMQ per la gestione dei messaggi interni e WhatsApp. Lo stesso broker viene riutilizzato per i billable events con i seguenti vantaggi:

- **Resilienza**: se il modulo contabilità è down, i messaggi restano in coda
- **Retry automatico**: dead letter queue per eventi falliti
- **Disaccoppiamento**: l'app clinica non sa nulla dell'implementazione contabile
- **Audit trail**: i messaggi in coda sono tracciabili

#### Topologia RabbitMQ

```
Exchange: billing.events (topic)
├── Queue: accounting.treatment.closed
│     binding: treatment.closed
│     DLX: billing.events.dlx
├── Queue: accounting.payment.received
│     binding: payment.received
│     DLX: billing.events.dlx
└── Queue: accounting.invoice.requested
      binding: invoice.requested
      DLX: billing.events.dlx

Exchange: billing.events.dlx (fanout)
└── Queue: billing.events.dead-letter
      (messaggi falliti per analisi)
```

#### Formato messaggio AMQP

```json
{
  "properties": {
    "headers": {
      "Authorization": "Bearer <JWT>",
      "x-tenant-alias": "demo4",
      "x-correlation-id": "uuid-v4",
      "x-event-type": "treatment.closed"
    },
    "contentType": "application/json",
    "timestamp": 1711800000,
    "messageId": "uuid-v4"
  },
  "content": {
    "treatmentId": "uuid",
    "patientId": "uuid",
    "practitionerId": "uuid",
    "treatmentType": "visita_specialistica",
    "completedAt": "2026-03-30T10:30:00Z",
    "lineItems": [
      {
        "description": "Visita cardiologica",
        "code": "89.01",
        "quantity": 1,
        "unitPrice": 150.00,
        "vatRate": 0.00,
        "exemptionCode": "N4"
      }
    ],
    "notes": "Controllo di routine"
  }
}
```

---

## 3. Autenticazione e autorizzazione

### Principio: ogni microservizio risolve autonomamente le proprie risorse

Il modulo contabilità **non riceve il nome del database nel payload**. Riceve solo:
1. Il **JWT** nell'header AMQP — per autenticazione e identificazione tenant
2. Il **billable event** nel body — i dati di business

### Flusso di validazione per ogni messaggio consumato

```
Messaggio RabbitMQ
      │
      ▼
1. Estrai JWT dall'header AMQP "Authorization"
      │
      ▼
2. Valida JWT con JWKS (stessa JWKS di Keycloak: api.curandis.cloud)
   ├─ Token scaduto → NACK + DLQ (o discard)
   ├─ Firma invalida → NACK + DLQ
   └─ Valido → continua
      │
      ▼
3. Estrai tenantAlias dal claim "organization" del JWT
      │
      ▼                           
4. Risolvi tenant → DataSource via TenantDataSourceManager
   (OpenBao + cache in-memory)
      │
      ▼
5. Verifica stato tenant (active) → processa evento
   ├─ suspended/deleted → NACK + log
   └─ active → ACK dopo processing
```

### Nota su JWT e messaggi asincroni

I billable events arrivano via coda, quindi il JWT potrebbe essere scaduto al momento del consumo. Due strategie possibili:

1. **JWT con TTL lungo dedicato** (consigliata): l'app clinica genera un JWT specifico per eventi asincroni con TTL di 24h, firmato con la stessa chiave Keycloak
2. **Service-to-service token**: l'app clinica usa un client credential grant OAuth2 per ottenere un token di servizio senza scadenza utente

> **Raccomandazione**: per la prima iterazione, usare il tenant alias dall'header `x-tenant-alias` validato contro una whitelist OpenBao (senza JWT), poi aggiungere JWT service-to-service in un secondo momento.

---

## 4. TenantDataSourceManager — Gestione connessioni DB per tenant

Questo componente viene sviluppato come libreria condivisa `@curandis/tenant-datasource` pubblicata sul registry GitLab, così da essere riutilizzabile quando l'app clinica migrerà a DB separati.

### Responsabilità

- Risolvere `tenantAlias → informazioni connessione DB` via OpenBao (con cache)
- Creare e cachare `DataSource` TypeORM per tenant
- Cleanup automatico DataSource idle
- Gestire rotazione credenziali DB via static roles OpenBao (1 utente per tenant)

### Struttura cache

```
Map<tenantAlias, {
  dataSource: DataSource;    // Connessione TypeORM inizializzata
  dbInfo: {                  // Info da OpenBao
    host: string;
    port: number;
    dbName: string;
    dbUsername: string;       // Utente PostgreSQL dedicato per tenant
    status: string;
  };
  lastUsed: number;          // Timestamp ultimo utilizzo
}>
```

### Logica di risoluzione

```
getDataSource(tenantAlias)
      │
      ├─ cache hit + DataSource.isInitialized + non idle?
      │     └─ aggiorna lastUsed → return DataSource
      │
      └─ cache miss o DataSource non valido
            │
            ▼
      OpenBao GET /kv/data/tenant-accounting-db/{alias}
      → { db_host, db_name, db_port, db_username, status }
            │
            ├─ status = suspended/deleted → throw TenantSuspendedError
            └─ status = active
                  │
                  ▼
            OpenBao GET /database/static-creds/postgres-{db_username}
            (static role → username + password con rotazione giornaliera)
                  │
                  ▼
            new DataSource({ host, port, database, username, password })
            → initialize() → cache.set() → return DataSource
```

### Cleanup connessioni idle

```
@Cron('*/5 * * * *')   // Ogni 5 minuti
cleanupIdle():
  per ogni entry nella cache:
    se (now - lastUsed > IDLE_TIMEOUT_MS):
      dataSource.destroy()
      cache.delete(alias)
      log "[TenantDS] Chiuso DataSource idle per {alias}"
```

**IDLE_TIMEOUT**: 10 minuti (configurabile). Bilancia tra performance (evita ri-connessione) e risorse (non tiene connessioni aperte inutilmente).

### AsyncLocalStorage per contesto request

Stesso pattern dell'app clinica: il DataSource del tenant viene propagato attraverso la request via `AsyncLocalStorage`:

```
Middleware/Consumer
      │
      ▼
TenantDataSourceManager.getDataSource(alias)
      │
      ▼
tenantContext.run({ dataSource, tenantAlias, ... }, () => {
  // Tutto il codice downstream accede al DataSource
  // tramite tenantContext.getDataSource()
})
```

---

## 5. Struttura OpenBao

### 5.1 KV secrets — Mapping tenant → DB contabilità

Ogni entry KV include `db_username`: l'utente PostgreSQL dedicato per quel tenant.
Il server PostgreSQL è lo stesso per tutti i tenant (`saas.curandis.cloud:5432`),
cambia solo il nome del DB e l'utente.

```
kv/
├── tenant-map/                    # App clinica (esistente)
│   ├── demo4 → { schema_name: "t_demo4", status: "active" }
│   └── bdq   → { schema_name: "t_bdq", status: "active" }
│
├── tenant-accounting-db/          # Modulo contabilità (NUOVO)
│   ├── bdq   → {
│   │     "db_host": "saas.curandis.cloud",
│   │     "db_name": "acct_79810d361b97ecd8684307cf1cd09401",
│   │     "db_port": 5432,
│   │     "db_username": "acct_bdq_svc",
│   │     "status": "active"
│   │   }
│   └── demo4 → {
│         "db_host": "saas.curandis.cloud",
│         "db_name": "acct_2acbced9061271459895fbde3c9a0585",
│         "db_port": 5432,
│         "db_username": "acct_demo4_svc",
│         "status": "active"
│       }
│
└── tenant-db/                     # Futuro: app clinica migrata a DB separati
    ├── demo4 → { db_host, db_name, db_port, db_username, status }
    └── bdq   → { db_host, db_name, db_port, db_username, status }
```

### 5.2 Static roles — Credenziali DB per tenant

Ogni tenant ha il proprio utente PostgreSQL gestito come static role in OpenBao
con rotazione automatica della password ogni 24 ore.

```bash
# ═══════════════════════════════════════════════════════════════
# STEP 1: Creare i database PostgreSQL (eseguire come postgres)
# ═══════════════════════════════════════════════════════════════

# Tenant bdq
createdb -h saas.curandis.cloud -U postgres acct_79810d361b97ecd8684307cf1cd09401

# Tenant demo4
createdb -h saas.curandis.cloud -U postgres acct_2acbced9061271459895fbde3c9a0585

# ═══════════════════════════════════════════════════════════════
# STEP 2: Creare gli utenti PostgreSQL dedicati
# ═══════════════════════════════════════════════════════════════

# Connettiti al DB di bdq
psql -h saas.curandis.cloud -U postgres -d acct_79810d361b97ecd8684307cf1cd09401 <<'SQL'
CREATE ROLE acct_bdq_svc WITH LOGIN PASSWORD 'initial_change_me';
GRANT USAGE ON SCHEMA public TO acct_bdq_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO acct_bdq_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO acct_bdq_svc;
SQL

# Connettiti al DB di demo4
psql -h saas.curandis.cloud -U postgres -d acct_2acbced9061271459895fbde3c9a0585 <<'SQL'
CREATE ROLE acct_demo4_svc WITH LOGIN PASSWORD 'initial_change_me';
GRANT USAGE ON SCHEMA public TO acct_demo4_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO acct_demo4_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO acct_demo4_svc;
SQL

# ═══════════════════════════════════════════════════════════════
# STEP 3: Creare le static roles in OpenBao (rotazione 1 giorno)
# ═══════════════════════════════════════════════════════════════

# Static role per tenant bdq
openbao write database/static-roles/postgres-acct_bdq_svc \
  db_name=postgres \
  username="acct_bdq_svc" \
  rotation_period=86400

# Static role per tenant demo4
openbao write database/static-roles/postgres-acct_demo4_svc \
  db_name=postgres \
  username="acct_demo4_svc" \
  rotation_period=86400

# ═══════════════════════════════════════════════════════════════
# STEP 4: Salvare il mapping in OpenBao KV
# ═══════════════════════════════════════════════════════════════

# Tenant bdq
openbao kv put kv/tenant-accounting-db/bdq \
  db_host="saas.curandis.cloud" \
  db_name="acct_79810d361b97ecd8684307cf1cd09401" \
  db_port="5432" \
  db_username="acct_bdq_svc" \
  status="active"

# Tenant demo4
openbao kv put kv/tenant-accounting-db/demo4 \
  db_host="saas.curandis.cloud" \
  db_name="acct_2acbced9061271459895fbde3c9a0585" \
  db_port="5432" \
  db_username="acct_demo4_svc" \
  status="active"

# ═══════════════════════════════════════════════════════════════
# STEP 5: Verifiche
# ═══════════════════════════════════════════════════════════════

# Verifica KV
openbao kv get kv/tenant-accounting-db/bdq
openbao kv get kv/tenant-accounting-db/demo4

# Verifica static credentials
openbao read database/static-creds/postgres-acct_bdq_svc
openbao read database/static-creds/postgres-acct_demo4_svc
```

### 5.3 Provisioning automatico nuovo tenant

Quando viene creato un nuovo tenant, lo script di provisioning deve:

```bash
#!/bin/bash
# provision-accounting-tenant.sh
# Uso: ./provision-accounting-tenant.sh <TENANT_ALIAS> <DB_NAME>
# Es:  ./provision-accounting-tenant.sh clinica1 acct_a1b2c3d4e5f6...

TENANT_ALIAS=$1
DB_NAME=$2
DB_HOST="saas.curandis.cloud"
DB_PORT=5432
DB_USERNAME="acct_${TENANT_ALIAS}_svc"

# 1. Creare il database PostgreSQL
createdb -h $DB_HOST -U postgres $DB_NAME

# 2. Creare l'utente PostgreSQL dedicato
psql -h $DB_HOST -U postgres -d $DB_NAME <<SQL
CREATE ROLE $DB_USERNAME WITH LOGIN PASSWORD 'initial_change_me';
GRANT USAGE ON SCHEMA public TO $DB_USERNAME;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $DB_USERNAME;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $DB_USERNAME;
SQL

# 3. Creare la static role in OpenBao (rotazione giornaliera)
openbao write database/static-roles/postgres-$DB_USERNAME \
  db_name=postgres \
  username="$DB_USERNAME" \
  rotation_period=86400

# 4. Salvare il mapping in OpenBao KV
openbao kv put kv/tenant-accounting-db/$TENANT_ALIAS \
  db_host="$DB_HOST" \
  db_name="$DB_NAME" \
  db_port="$DB_PORT" \
  db_username="$DB_USERNAME" \
  status="active"

echo "[OK] Tenant $TENANT_ALIAS provisionato per modulo contabilità"
echo "     DB: $DB_NAME"
echo "     User: $DB_USERNAME"
echo "     Static role: postgres-$DB_USERNAME"
```

---

## 6. Policy OpenBao per il modulo contabilità

### 6.1 Policy: accounting-service

```hcl
# Policy: accounting-service
# Permette al modulo contabilità di:
# - Leggere il mapping tenant → DB contabilità (incluso db_username)
# - Leggere le credenziali static role per gli utenti acct_*_svc
# - Leggere configurazioni specifiche del modulo

# Mapping tenant → database contabilità (KV v2)
path "kv/data/tenant-accounting-db/*" {
  capabilities = ["read", "list"]
}

# Metadata KV (necessario per list)
path "kv/metadata/tenant-accounting-db/*" {
  capabilities = ["read", "list"]
}

# Static credentials per gli utenti contabilità (pattern: postgres-acct_*_svc)
path "database/static-creds/postgres-acct_*" {
  capabilities = ["read"]
}

# Configurazione specifica del modulo contabilità (API keys, parametri, ecc.)
path "kv/data/accounting-service/*" {
  capabilities = ["read"]
}

# Metadata per configurazione modulo
path "kv/metadata/accounting-service/*" {
  capabilities = ["read", "list"]
}
```

### 6.2 Policy: accounting-service-admin (per provisioning)

```hcl
# Policy: accounting-service-admin
# Usata solo dallo script di provisioning tenant, NON dal microservizio runtime.
# Permette di scrivere mapping e configurare database secret engine.

# Scrivere mapping tenant → DB
path "kv/data/tenant-accounting-db/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "kv/metadata/tenant-accounting-db/*" {
  capabilities = ["read", "delete", "list"]
}

# Creare/gestire static roles per utenti contabilità
path "database/static-roles/postgres-acct_*" {
  capabilities = ["create", "read", "update", "delete"]
}

# Leggere static credentials (per verifica)
path "database/static-creds/postgres-acct_*" {
  capabilities = ["read"]
}

# Forzare rotazione password (per manutenzione)
path "database/rotate-role/postgres-acct_*" {
  capabilities = ["update"]
}
```

### 6.3 Associare le policy e configurare l'Agent

Il modulo contabilità gira sulla stessa VM dell'app clinica, quindi riusa lo stesso
Agent OpenBao sulla porta 8200. Basta aggiungere la policy all'AppRole dell'Agent.

```bash
# 1. Creare le policy su OpenBao Server
openbao policy write accounting-service - <<'EOF'
# Mapping tenant → database contabilità (KV v2)
path "kv/data/tenant-accounting-db/*" {
  capabilities = ["read", "list"]
}
path "kv/metadata/tenant-accounting-db/*" {
  capabilities = ["read", "list"]
}
# Static credentials per gli utenti contabilità
path "database/static-creds/postgres-acct_*" {
  capabilities = ["read"]
}
# Configurazione specifica del modulo
path "kv/data/accounting-service/*" {
  capabilities = ["read"]
}
path "kv/metadata/accounting-service/*" {
  capabilities = ["read", "list"]
}
EOF

openbao policy write accounting-service-admin - <<'EOF'
# Scrivere mapping tenant → DB
path "kv/data/tenant-accounting-db/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "kv/metadata/tenant-accounting-db/*" {
  capabilities = ["read", "delete", "list"]
}
# Creare/gestire static roles per utenti contabilità
path "database/static-roles/postgres-acct_*" {
  capabilities = ["create", "read", "update", "delete"]
}
path "database/static-creds/postgres-acct_*" {
  capabilities = ["read"]
}
# Forzare rotazione password
path "database/rotate-role/postgres-acct_*" {
  capabilities = ["update"]
}
EOF

# 2. Leggere le policy attuali dell'Agent per non perderle
openbao read auth/approle/role/agent-role

# 3. Aggiungere accounting-service alle policy dell'Agent esistente
openbao write auth/approle/role/agent-role \
  token_policies="main-app-policy,whatsapp-gateway-policy,accounting-service" \
  token_ttl=1h \
  token_max_ttl=4h

# 4. Verificare
openbao read auth/approle/role/agent-role
```

> **Nota**: non serve un Agent dedicato né un AppRole separato.
> Il modulo contabilità si connette allo stesso proxy `http://127.0.0.1:8200`.

---

## 7. Libreria condivisa @curandis/tenant-datasource

### Perché crearla subito

- Il `TenantDataSourceManager` è identico per il modulo contabilità e per la futura migrazione dell'app clinica a DB separati
- Pubblicata su GitLab registry (`gitlab.netbog.it/marco/curandis`) come `@curandis/tenant-datasource`
- Nessuna dipendenza da `@curandis/openbao-core` — comunica direttamente con l'Agent proxy via fetch

### API pubblica della libreria

```typescript
// @curandis/tenant-datasource

export interface TenantDbInfo {
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUsername: string;     // Utente PostgreSQL dedicato per tenant
  status: string;
}

export interface TenantDsConfig {
  /** Path KV OpenBao per il mapping tenant → DB info */
  openbaoKvPath: string;                    // es. "tenant-accounting-db"

  /** Pattern path static credentials. {username} viene sostituito con db_username dal KV */
  openbaoStaticCredsPathPattern: string;    // es. "database/static-creds/postgres-{username}"

  /** Entità TypeORM da registrare sui DataSource */
  entities: Function[];

  /** Timeout idle per chiusura DataSource (ms, default 10min) */
  idleTimeoutMs?: number;

  /** TTL cache info tenant da OpenBao (ms, default 5min) */
  tenantInfoTtlMs?: number;

  /** Migrazioni TypeORM (opzionale) */
  migrations?: (Function | string)[];

  /** Opzioni aggiuntive TypeORM */
  extraTypeOrmOptions?: Partial<DataSourceOptions>;
}

export class TenantDataSourceManager {
  /** Ottiene (o crea) un DataSource per il tenant */
  getDataSource(tenantAlias: string): Promise<DataSource>;

  /** Invalida cache e chiude DataSource per un tenant */
  evict(tenantAlias: string): Promise<void>;

  /** Chiude tutti i DataSource idle */
  cleanupIdle(): Promise<void>;

  /** Chiude tutti i DataSource (shutdown graceful) */
  destroyAll(): Promise<void>;
}

export class TenantContextService {
  /** Esegue una funzione nel contesto di un tenant */
  run<T>(ctx: TenantContextData, fn: () => T): T;

  /** Ottiene il DataSource del tenant corrente */
  getDataSource(): DataSource | null;

  /** Ottiene l'alias del tenant corrente */
  getTenantAlias(): string | null;
}

/** Modulo NestJS per registrazione globale */
export class TenantDataSourceModule {
  static forRoot(config: TenantDsConfig): DynamicModule;
  static forRootAsync(options: TenantDsModuleAsyncOptions): DynamicModule;
}
```

### Utilizzo nel modulo contabilità

```typescript
// accounting-service/src/app.module.ts
import { TenantDataSourceModule } from '@curandis/tenant-datasource';
import { Invoice, Payment, LedgerEntry } from './entities';

@Module({})
export class AppModule {
  static forRootAsync(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        EventEmitterModule.forRoot(),

        TenantDataSourceModule.forRoot({
          openbaoKvPath: 'tenant-accounting-db',
          openbaoStaticCredsPathPattern: 'database/static-creds/postgres-{username}',
          entities: [Invoice, Payment, LedgerEntry],
          idleTimeoutMs: 10 * 60 * 1000,
          migrations: [__dirname + '/migrations/*.{ts,js}'],
        }),

        // ... moduli business
      ],
    };
  }
}
```

### Utilizzo futuro nell'app clinica (dopo migrazione a DB separati)

```typescript
// login-saas/backend/src/app.module.ts (futuro)
TenantDataSourceModule.forRoot({
  openbaoKvPath: 'tenant-db',
  openbaoStaticCredsPathPattern: 'database/static-creds/postgres-{username}',
  entities: [Patient, Appointment, Treatment, /* ... */],
  idleTimeoutMs: 15 * 60 * 1000,  // più lungo, più traffico
})
```

---

## 8. Struttura file del modulo contabilità

```
accounting-service/
├── src/
│   ├── main.ts                                  # Bootstrap con OpenBao
│   ├── app.module.ts                            # Module con TenantDataSourceModule
│   ├── consumers/
│   │   └── billing-event.consumer.ts            # Consumer RabbitMQ
│   ├── modules/
│   │   ├── invoices/                            # Fatturazione
│   │   │   ├── entities/
│   │   │   ├── services/
│   │   │   └── invoices.module.ts
│   │   ├── payments/                            # Pagamenti
│   │   │   ├── entities/
│   │   │   ├── services/
│   │   │   └── payments.module.ts
│   │   └── settlements/                         # Liquidazioni
│   │       ├── entities/
│   │       ├── services/
│   │       └── settlements.module.ts
│   ├── migrations/                              # TypeORM migrations
│   └── shared/
│       └── dto/
│           └── billable-event.dto.ts            # DTO eventi ricevuti
├── .env
├── package.json
└── tsconfig.json
```

---

## 9. Configurazione (.env) del modulo contabilità

```env
# === OpenBao Agent (stessa VM, stesso Agent della main app) ===
OPENBAO_AGENT_MODE=true
OPENBAO_ADDR=http://127.0.0.1:8200

# === RabbitMQ ===
RABBITMQ_URL=amqp://accounting_svc:password@rabbitmq.internal:5672
RABBITMQ_EXCHANGE=billing.events
RABBITMQ_QUEUE_PREFIX=accounting

# === Application ===
PORT=3002
NODE_ENV=production

# === Fallback (solo development) ===
# Non servono credenziali DB statiche: le static roles OpenBao
# gestiscono le credenziali per-tenant con rotazione automatica
```

---

## 10. Checklist di integrazione

### OpenBao Server
- [ ] Creare policy `accounting-service` (sezione 6.3)
- [ ] Creare policy `accounting-service-admin` per provisioning (sezione 6.3)
- [ ] Aggiungere policy `accounting-service` all'AppRole dell'Agent esistente (stessa VM)

### OpenBao + PostgreSQL — Per ogni tenant
- [ ] Creare database PostgreSQL `acct_{hash}` (sezione 5.2 STEP 1)
- [ ] Creare utente PostgreSQL `acct_{alias}_svc` con permessi (sezione 5.2 STEP 2)
- [ ] Creare static role `postgres-acct_{alias}_svc` con rotation_period=86400 (sezione 5.2 STEP 3)
- [ ] Salvare mapping in `kv/tenant-accounting-db/{alias}` con db_username (sezione 5.2 STEP 4)
- [ ] Verificare con `openbao kv get` e `openbao read database/static-creds/...` (sezione 5.2 STEP 5)

### Libreria @curandis/tenant-datasource
- [x] Creare progetto libreria
- [x] Implementare `TenantDataSourceManager` con static roles
- [x] Implementare `TenantContextService` (AsyncLocalStorage)
- [x] Implementare `TenantOpenbaoResolverService` (con db_username)
- [x] Implementare `TenantDataSourceModule` (NestJS DynamicModule)
- [ ] Upload su GitLab (`gitlab.netbog.it/marco/curandis`)
- [ ] Pubblicare su GitLab package registry
- [ ] Integrare nel modulo contabilità
- [ ] (Futuro) Integrare nell'app clinica per migrazione a DB separati

### Modulo contabilità
- [ ] Creare progetto NestJS `accounting-service`
- [ ] Installare `@curandis/tenant-datasource`
- [ ] Implementare consumer RabbitMQ per billable events
- [ ] Implementare validazione tenant (x-tenant-alias + OpenBao whitelist)
- [ ] Configurare `TenantDataSourceModule` con entità contabili

### App clinica (main app)
- [ ] Aggiungere publisher RabbitMQ per billable events
- [ ] Emettere evento `treatment.closed` alla chiusura trattamento
- [ ] Includere tenant alias nell'header AMQP del messaggio

### RabbitMQ
- [ ] Creare exchange `billing.events` (topic)
- [ ] Creare coda `accounting.treatment.closed`
- [ ] Configurare DLX `billing.events.dlx` per dead letter
- [ ] Creare utente `accounting_svc` con permessi sulla coda

### Test
- [ ] Verificare che il modulo contabilità consuma eventi dalla coda
- [ ] Verificare risoluzione tenant → DataSource via OpenBao
- [ ] Verificare cleanup DataSource idle
- [ ] Verificare gestione tenant suspended (rifiuto evento)
- [ ] Verificare dead letter queue per eventi falliti
- [ ] Verificare rotazione credenziali DB (static role rotation)
