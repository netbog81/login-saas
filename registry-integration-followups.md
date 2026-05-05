# Registry Integration — Follow-ups

Task non urgenti emersi durante il refactor di integrazione col Curandis
Registry (chiuso 2026-05-02). Niente blocca il prodotto oggi: ognuno è
pianificabile a parte quando decidi di affrontarlo.

---

## ⏳ Aperti

### 1. Multi-realm Keycloak

**Cosa**: passare da un singolo realm `curandis` (oggi) a un realm per tenant
(`curandis-bdq`, `curandis-demo4`, …). Isolamento completo utenti / branding /
SSO / password policy per cliente.

**Perché aspettare**: ha senso solo quando ci saranno più clienti reali in
produzione, oppure se un cliente chiede branding loro / SSO aziendale (SAML,
LDAP, ecc.). Oggi con 1 cliente attivo non serve.

**Cosa comporta**: cambio coordinato su tutti i moduli (login-saas, registry,
accounting, gateway WhatsApp, frontend Angular discovery OIDC, TMS provisioning).
Stima 1-2 settimane di lavoro distribuito + finestra di migrazione utenti.

**Trigger per affrontarlo**:
- Secondo cliente in produzione che chiede branding / SSO proprio
- Oppure decisione strategica di hardening multi-tenant

---

### 2. Hot-swap credenziali tenant DB lato registry (multi-DB)

**Cosa**: l'agent registry ha implementato in `@curandis/tenant-datasource@1.0.0`
un fix difensivo (health-check lazy + recovery automatico su 28P01) per la
finestra fra rotation OpenBao e prossimo refresh-check.

**Lato clinico**: NON serve oggi (single-DB, traffico continuo, finestra di
vulnerabilità non visibile). Ho applicato il pattern equivalente solo agli
endpoint `GET /health/status` e `GET /health/db-credentials` via
`MainDbCredentialManager.safeQuery()` per evitare falsi negativi del load
balancer durante la finestra.

**Trigger per estenderlo**:
- Se il clinico migrerà a multi-tenant DB (oggi è single-DB)
- Se vediamo "password authentication failed" sporadico in produzione
  (oggi non lo vediamo)

**Riferimento**: `MainDbCredentialManager.safeQuery()` è disponibile come API
opt-in. Per estendere il fix: wrappare ulteriori `dataSource.query` critiche
con `safeQuery` (es. cron job notturni se mai aggiunti).

---

### 3. Cleanup istanza WhatsApp `marco4` di test

**Cosa**: il gateway WhatsApp esterno ha un'istanza `marco4` (test personale)
che invia webhook al backend clinico. I webhook vengono droppati silently
(logica già implementata 2026-05-01), ma la chiamata HTTP comunque arriva.

**Fix definitivo**: rimuovere l'istanza `marco4` dalla config del gateway
(non è codice, è admin del gateway WhatsApp).

**Priorità**: bassa. Il drop silent è gratis a livello di costo runtime.

---

### 4. Verifica Audit GDPR cross-modulo

**Cosa**: il registry traccia `actorType=service`/`actorType=user` nell'audit
log per le letture subject. Per la conformità GDPR (chi ha letto cosa, quando)
in futuro vorremo:

- Una vista admin nel clinico che mostri "chi ha letto i miei pazienti" leggendo
  dall'audit log del registry
- Eventuale anonimizzazione dei `subject_id` nel log clinico (`clinical_subject_index`)
  quando un soggetto chiede oblio GDPR via registry

**Trigger**: quando userai il modulo per pazienti veri in produzione e/o
serve risposta a richiesta DPO.

---

### 5. Encryption key WhatsApp per altri tenant

**Cosa**: oggi `kv/data/whatsapp/bdq/encryption_key` è popolata. Per ogni
tenant futuro va creata una sua `kv/data/whatsapp/<tenantApiId>/encryption_key`
con una chiave AES-256 (hex 64-char o base64 di 32 byte — entrambi accettati
da `CryptoService.parseKey()` aggiornato 2026-05-01).

**Documentazione mancante**: nessuna procedura scritta per il provisioning di
un nuovo tenant lato WhatsApp. Da scrivere quando arriva il secondo cliente.

---

## ✅ Done (storia recente)

- [x] **Refactor registry-integration** chiuso 2026-05-02 — anagrafica unificata,
  service-account S2S, WhatsApp end-to-end, autocomplete indirizzi
- [x] **Hardening auth-core service-account** (rimosso fallback `orgId = tenantAlias`,
  whitelist `serviceAccountClientIds`, `actorType: 'user' | 'service'`) — coordinato
  con agent registry 2026-05-01
- [x] **CryptoService accetta hex e base64** (era hardcoded hex 64-char) 2026-05-02
- [x] **Webhook gateway con instance non mappata silenziati** (era WARN, ora drop
  graceful) 2026-05-01
- [x] **Bug latente `UPDATE patients` su tabella droppata** corretto:
  `incrementPatientCancellation` / `incrementPatientNoShow` ora scrivono su
  `clinical_attendance_log` via `ClinicalAttendanceService.recordEvent()` 2026-05-02
- [x] **Recovery automatico 28P01 su health-check endpoint** via
  `MainDbCredentialManager.safeQuery()` 2026-05-02
