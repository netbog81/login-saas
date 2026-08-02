#!/usr/bin/env bash
#
# Provisioning infrastruttura "Documenti paziente" (S3 MicroCeph + Transit).
#
# Modello PER TENANT: ogni tenant ha il proprio utente RGW (credenziali
# separate) e il proprio bucket. Gli utenti RGW si creano sulla VM
# MicroCeph (radosgw-admin, vedi output); questo script gestisce la parte
# OpenBao ed è IDEMPOTENTE — rilanciarlo a ogni onboarding tenant.
#
# Uso (token ADMIN sul MAIN OpenBao, non l'agent):
#
#   export BAO_ADDR=http://127.0.0.1:8200
#   export BAO_TOKEN=<admin token>
#   ./provision-docs-infra.sh
#
# Cosa fa:
#  1. Per ogni tenant in kv/tenant-clinico-db/: crea la chiave Transit
#     clinico-docs-<alias> (aes256-gcm96) se manca.
#  2. Verifica quali tenant hanno già kv/tenant-clinico-s3/<alias> e
#     stampa i comandi (radosgw-admin + bao kv put) per quelli mancanti.
#  3. Stampa lo snippet di policy per l'agent clinico.
#
# I bucket NON vanno creati a mano: curandis-clinico-docs-<alias> si
# auto-crea al primo upload (owned dall'utente RGW del tenant).
#
set -euo pipefail

BAO_ADDR="${BAO_ADDR:-http://127.0.0.1:8200}"
KEY_PREFIX="${DOCS_TRANSIT_KEY_PREFIX:-clinico-docs}"

if [[ -z "${BAO_TOKEN:-}" ]]; then
  echo "ERRORE: esporta BAO_TOKEN (token admin OpenBao)" >&2
  exit 1
fi

bao_api() {
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sf -X "$method" -H "X-Vault-Token: $BAO_TOKEN" \
      -H "Content-Type: application/json" -d "$body" "$BAO_ADDR/v1/$path"
  else
    curl -sf -X "$method" -H "X-Vault-Token: $BAO_TOKEN" "$BAO_ADDR/v1/$path"
  fi
}

echo "Elenco tenant da kv/tenant-clinico-db/..."
TENANTS=$(bao_api GET "kv/metadata/tenant-clinico-db/?list=true" | python3 -c \
  "import sys,json; print('\n'.join(json.load(sys.stdin)['data']['keys']))")

MISSING_S3=()

for alias in $TENANTS; do
  alias="${alias%/}"

  # ── 1. Chiave Transit per tenant ────────────────────────────
  key="${KEY_PREFIX}-${alias}"
  if bao_api GET "transit/keys/$key" > /dev/null 2>&1; then
    echo "  transit/keys/$key: esiste già"
  else
    echo "  transit/keys/$key: creo (aes256-gcm96)..."
    bao_api POST "transit/keys/$key" '{"type":"aes256-gcm96"}' > /dev/null
    echo "    OK"
  fi

  # ── 2. Secret S3 per tenant ─────────────────────────────────
  if bao_api GET "kv/data/tenant-clinico-s3/$alias" > /dev/null 2>&1; then
    echo "  kv/tenant-clinico-s3/$alias: esiste già"
  else
    echo "  kv/tenant-clinico-s3/$alias: MANCANTE"
    MISSING_S3+=("$alias")
  fi
done

if [[ ${#MISSING_S3[@]} -gt 0 ]]; then
  cat <<'EOF'

============================================================
TENANT SENZA CREDENZIALI S3 — per ognuno:

1) Sulla VM MicroCeph crea l'utente RGW dedicato:

     radosgw-admin user create \
       --uid=curandis-clinico-<alias> \
       --display-name="Curandis clinico <alias>"

   (annota access_key e secret_key dall'output; quota opzionale:
    radosgw-admin quota set --uid=curandis-clinico-<alias> \
      --quota-scope=user --max-size=50G && \
    radosgw-admin quota enable --uid=curandis-clinico-<alias> --quota-scope=user)

2) Salva le credenziali in OpenBao:

     bao kv put kv/tenant-clinico-s3/<alias> \
       endpoint="http://<ip-vm-microceph>:80" \
       access_key="<access key>" \
       secret_key="<secret key>" \
       region="us-east-1"

Tenant mancanti:
EOF
  for alias in "${MISSING_S3[@]}"; do
    echo "  - $alias"
  done
fi

cat <<'EOF'

============================================================
POLICY dell'agent clinico (aggiungi e ricarica):

  # Documenti paziente — envelope encryption
  path "transit/datakey/plaintext/clinico-docs-*" {
    capabilities = ["update"]
  }
  path "transit/decrypt/clinico-docs-*" {
    capabilities = ["update"]
  }
  path "transit/rewrap/clinico-docs-*" {
    capabilities = ["update"]
  }
  # Credenziali S3 per tenant (+ eventuale fallback di modulo)
  path "kv/data/tenant-clinico-s3/*" {
    capabilities = ["read"]
  }
  path "kv/data/clinico/s3" {
    capabilities = ["read"]
  }
============================================================

Rotazione credenziali RGW di un tenant: rigenera le key con radosgw-admin,
aggiorna kv/tenant-clinico-s3/<alias> — il backend le rilegge entro 10 min
(TTL cache client) senza riavvio.

Rotazione chiave Transit (poi rewrap batch delle DEK wrapped):
  bao write -f transit/keys/clinico-docs-<alias>/rotate
EOF
