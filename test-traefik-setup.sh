#!/bin/bash

# Script per testare la configurazione Traefik

echo "🧪 Test configurazione Traefik per agenda.curandis.cloud"
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Frontend accessibile
echo "1️⃣  Test frontend HTTPS..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://agenda.curandis.cloud)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend OK${NC} (Status: $FRONTEND_STATUS)"
else
    echo -e "${RED}❌ Frontend FAIL${NC} (Status: $FRONTEND_STATUS)"
fi
echo ""

# Test 2: Backend accessibile via /api
echo "2️⃣  Test backend HTTPS tramite /api..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://agenda.curandis.cloud/api/users)
if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend OK${NC} (Status: $BACKEND_STATUS)"
else
    echo -e "${RED}❌ Backend FAIL${NC} (Status: $BACKEND_STATUS)"
    echo -e "${YELLOW}⚠️  Verifica che Traefik sia configurato per esporre il backend su /api${NC}"
fi
echo ""

# Test 3: CORS headers
echo "3️⃣  Test CORS headers..."
CORS_HEADER=$(curl -s -I https://agenda.curandis.cloud/api/users | grep -i "access-control-allow-origin")
if [ -n "$CORS_HEADER" ]; then
    echo -e "${GREEN}✅ CORS OK${NC}"
    echo "   $CORS_HEADER"
else
    echo -e "${YELLOW}⚠️  CORS headers non trovati${NC}"
fi
echo ""

# Test 4: Certificato SSL
echo "4️⃣  Test certificato SSL..."
SSL_EXPIRY=$(echo | openssl s_client -connect agenda.curandis.cloud:443 -servername agenda.curandis.cloud 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$SSL_EXPIRY" ]; then
    echo -e "${GREEN}✅ Certificato SSL valido${NC}"
    echo "   Scadenza: $SSL_EXPIRY"
else
    echo -e "${RED}❌ Certificato SSL non valido${NC}"
fi
echo ""

# Test 5: Redirect HTTP → HTTPS
echo "5️⃣  Test redirect HTTP → HTTPS..."
HTTP_LOCATION=$(curl -s -I -L http://agenda.curandis.cloud | grep -i "location:" | head -1)
if echo "$HTTP_LOCATION" | grep -q "https://"; then
    echo -e "${GREEN}✅ Redirect HTTPS attivo${NC}"
else
    echo -e "${YELLOW}⚠️  Redirect HTTPS non configurato${NC}"
fi
echo ""

# Summary
echo "================================================"
echo "📋 RIEPILOGO"
echo "================================================"
echo ""
echo "Se vedi errori:"
echo ""
echo "1. Backend non accessibile su /api:"
echo "   - Verifica configurazione Traefik (vedi traefik-example.yml)"
echo "   - Assicurati che il middleware stripPrefix sia configurato"
echo "   - Verifica che il backend sia in esecuzione su 192.168.88.24:3000"
echo ""
echo "2. CORS errors nel browser:"
echo "   - Verifica backend/src/main.ts - CORS deve permettere agenda.curandis.cloud"
echo "   - Il backend è già configurato per accettare qualsiasi host su porta 4200"
echo "   - Potrebbe servire aggiungere esplicitamente agenda.curandis.cloud"
echo ""
echo "3. Alternativa: usa subdomain api.curandis.cloud"
echo "   - Crea record DNS: api.curandis.cloud → stesso IP"
echo "   - Modifica traefik per usare Host(\`api.curandis.cloud\`) invece di PathPrefix"
echo "   - In environment.ts/prod.ts attiva OPZIONE B (commentata)"
echo ""
