# Documenti paziente — architettura e runbook

> Feature introdotta il 2026-07-23. Documenti della scheda paziente su
> S3 MicroCeph, cifrati a riposo con envelope encryption (OpenBao Transit).

## Architettura

```
Browser (Angular)
  │  metadati: GraphQL (patientDocuments, deletePatientDocument, ...)
  │  binari:   REST multipart/blob (api/patient-documents/...)
  ▼
clinico-backend (modulo patient-documents)
  │  busboy → MeteredHashStream (sha256+bytes) → AES-256-GCM → S3 multipart
  │           └── DEK per documento da Transit datakey (mai persistita)
  ▼                                      ▼
OpenBao (via agent :8203)          VM MicroCeph (S3/RGW, rete privata)
  transit/datakey|decrypt|rewrap     bucket per tenant:
  clinico-docs-<tenantAlias>         curandis-clinico-docs-<alias>
  kv/tenant-clinico-s3/<alias>       utente RGW dedicato per tenant
  (fallback: kv/clinico/s3)          object key: patients/<subjectId>/<docId>
```

- **Librerie condivise**: `@curandis/storage-core` 1.1.0 (S3 client
  bucket-per-tenant con **credenziali per tenant**, cache client TTL 10
  min per la rotazione, pipeline crypto streaming) e
  `@curandis/encryption-core` 1.2.0 (`generateDataKey`/`unwrapDataKey`).
  Riusabili da qualunque backend (es. allegati fattura in accounting).
- **Isolamento S3 per tenant**: ogni tenant ha un utente RGW dedicato
  (`radosgw-admin user create --uid=curandis-clinico-<alias>`), con
  credenziali in `kv/tenant-clinico-s3/<alias>` (path speculare a
  `kv/tenant-clinico-db/<alias>`). Fallback opzionale al secret di
  modulo `kv/clinico/s3` (dev/transizione). Il bucket si auto-crea al
  primo upload con l'utente del tenant come owner.
- **Metadati**: tabella per-tenant `patient_documents` (migration
  `1809000000000-CreatePatientDocuments`). La vecchia `path_documents` è
  stata rinominata `path_documents_legacy` (mai avuto file reali dietro;
  drop manuale dopo verifica).
- **3 livelli di associazione**: generale / percorso / trattamento. Con
  `treatment_id` il percorso è denormalizzato e validato server-side
  (CHECK constraint + verifica che il trattamento appartenga al percorso
  e il percorso al paziente).
- **Permessi**: riusa `patient_read` (elenco/download) e `patient_write`
  (upload/update/delete) — nessun seeding nuovo.
- **Cestino**: delete = soft delete → RecycleBin (`PATIENT_DOCUMENT`);
  il purge (manuale o retention) elimina anche l'oggetto S3.

## Envelope encryption

1. **Upload**: `POST transit/datakey/plaintext/clinico-docs-<alias>` →
   DEK 32B in chiaro + wrap `vault:vN:...`. Il file viene cifrato in
   streaming (AES-256-GCM, IV 12B random) mentre viene caricato su S3 in
   multipart. In DB: `enc_wrapped_dek`, `enc_iv`, `enc_auth_tag`,
   `enc_key_name`, `enc_key_version`, `sha256` del plaintext. La DEK in
   chiaro viene azzerata a fine upload.
2. **Download**: `transit/decrypt` del wrap → decipher streaming → HTTP.
3. **Crypto-shredding tenant**: distruggendo la chiave Transit
   `clinico-docs-<alias>` tutti i documenti del tenant diventano
   illeggibili (offboarding GDPR).

## Provisioning (Fase 0)

Per ogni tenant servono tre cose: utente RGW, secret KV, chiave Transit.

```bash
# 1. Sulla VM MicroCeph — utente RGW dedicato al tenant:
radosgw-admin user create --uid=curandis-clinico-<alias> \
  --display-name="Curandis clinico <alias>"
# (quota opzionale: radosgw-admin quota set/enable --quota-scope=user)

# 2. Su OpenBao MAIN (token admin) — credenziali del tenant:
bao kv put kv/tenant-clinico-s3/<alias> \
  endpoint="http://<ip-vm-microceph>:80" \
  access_key="<access key>" secret_key="<secret key>" region="us-east-1"

# 3. Chiave Transit del tenant:
bao write -f transit/keys/clinico-docs-<alias> type=aes256-gcm96
```

In alternativa `backend/scripts/provision-docs-infra.sh` (con BAO_ADDR +
BAO_TOKEN admin) fa il punto 3 per tutti i tenant, verifica quali secret
S3 mancano stampando i comandi pronti, e stampa la policy. Poi:

1. Aggiornare la policy dell'agent clinico con lo snippet stampato.
2. Verificare che il container `curandis-clinico-backend` raggiunga la VM
   MicroCeph (`docker exec curandis-clinico-backend wget -qO- <endpoint>`
   deve rispondere, anche con errore S3 XML — conta la raggiungibilità).
3. Migration per-tenant:
   `npx ts-node scripts/run-migration.ts <alias>` (o
   `scripts/run-all-tenant-migrations.sh`).
4. Env opzionali in `.env` compose: `DOCS_BUCKET_PREFIX`,
   `DOCS_TRANSIT_KEY_PREFIX`, `DOCS_MAX_FILE_MB` (default 500).

**Onboarding nuovo tenant**: utente RGW + `bao kv put
kv/tenant-clinico-s3/<alias>` + chiave Transit (o rilanciare lo script,
che segnala cosa manca); il bucket si auto-crea al primo upload.

**Rotazione credenziali RGW**: rigenera le key con radosgw-admin e
aggiorna il secret KV — il backend le rilegge entro 10 minuti (TTL cache
client S3) senza riavvio.

## Rotazione chiave (runbook)

```bash
bao write -f transit/keys/clinico-docs-<alias>/rotate
```

I nuovi upload usano la versione nuova. Le DEK wrapped esistenti restano
decifrabili (Transit conserva le versioni); per portarle alla versione
corrente fare rewrap batch delle righe (`TransitEncryptionService.rewrap`
su `enc_wrapped_dek`, aggiornando `enc_key_version`). I blob su S3 NON si
toccano mai — è il vantaggio dell'envelope. Non impostare
`min_decryption_version` prima di aver rewrappato tutto.

## Limiti e note

- Max upload: `DOCS_MAX_FILE_MB` (default 500MB), enforcement busboy con
  abort dello stream (la multipart S3 viene abortita, niente orfani).
- GCM streaming: in download l'auth tag è verificato a fine stream — un
  blob manomesso produce una risposta troncata lato client, non un 500;
  l'integrità end-to-end è verificabile anche con `sha256`.
- Oggetti orfani possibili solo se il purge S3 fallisce dopo il delete
  riga (loggato WARN) — eventuale sweep periodico confrontando i bucket
  con `patient_documents` è un miglioramento futuro.
- Il tab Documenti nella scheda paziente mostra TUTTI i documenti del
  paziente con filtri Tutti/Generali/Percorso/Trattamento + categoria +
  tipo contenuto + ricerca; l'upload multi-file (drag & drop) condivide
  l'associazione per batch, con DEK/progress/retry per singolo file.
