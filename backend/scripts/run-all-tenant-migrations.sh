#!/bin/bash
#
# Esegue le migrazioni TypeORM su tutti i tenant del clinico.
#
# La lista tenant viene letta da OpenBao (LIST kv/metadata/tenant-clinico-db),
# come fa il cron AutoAttendance: i tenant nuovi sono inclusi automaticamente.
# Override manuale: TENANTS="bdq demo4" ./scripts/run-all-tenant-migrations.sh
#
# Usage:
#   ./scripts/run-all-tenant-migrations.sh
#   ./scripts/run-all-tenant-migrations.sh --check     # solo elenco pendenti
#   OPENBAO_ADDR=http://10.0.0.5:8203 ./scripts/run-all-tenant-migrations.sh
#
# Default: agent proxy clinico su 8203 (openbao-agent-clinico.service), che
# ha la policy per tenant-clinico-db. NON l'8200 (agent main app → 403).
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BACKEND_DIR"

OPENBAO_ADDR="${OPENBAO_ADDR:-http://127.0.0.1:8203}"
export OPENBAO_ADDR
EXTRA_ARGS=("$@")

if [ -n "$TENANTS" ]; then
  # Override esplicito via env (separati da spazio)
  read -r -a TENANTS <<< "$TENANTS"
else
  # LIST sul KV metadata; filtra le sotto-cartelle (chiavi con "/" finale)
  mapfile -t TENANTS < <(
    curl -sf "$OPENBAO_ADDR/v1/kv/metadata/tenant-clinico-db/?list=true" \
      | python3 -c "import json,sys; [print(k) for k in json.load(sys.stdin).get('data',{}).get('keys',[]) if not k.endswith('/')]"
  )
fi

if [ "${#TENANTS[@]}" -eq 0 ]; then
  echo "[ERRORE] Nessun tenant trovato (OpenBao: $OPENBAO_ADDR). Usa TENANTS=\"alias1 alias2\" per override."
  exit 1
fi

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Clinico — Migrazione multi-tenant"
echo "  Tenants: ${TENANTS[*]}"
echo "══════════════════════════════════════════════════════════"
echo ""

FAILED=0
SUCCEEDED=0

for tenant in "${TENANTS[@]}"; do
  echo "──────────────────────────────────────────────────────────"
  echo "  Tenant: $tenant"
  echo "──────────────────────────────────────────────────────────"

  if npx ts-node scripts/run-migration.ts "$tenant" "${EXTRA_ARGS[@]}"; then
    if [[ " ${EXTRA_ARGS[*]} " == *" --check "* ]]; then
      echo "[OK] Tenant $tenant verificato."
    else
      echo "[OK] Tenant $tenant migrato con successo."
    fi
    # NB: forma "var=$((var+1))" e non "((var++))": con set -e l'aritmetica
    # che valuta 0 (primo incremento da 0) termina lo script silenziosamente.
    SUCCEEDED=$((SUCCEEDED + 1))
  else
    echo "[ERRORE] Migrazione fallita per tenant $tenant!"
    FAILED=$((FAILED + 1))
  fi

  echo ""
done

echo "══════════════════════════════════════════════════════════"
echo "  Risultato: $SUCCEEDED OK, $FAILED FALLITI su ${#TENANTS[@]} tenants"
echo "══════════════════════════════════════════════════════════"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
