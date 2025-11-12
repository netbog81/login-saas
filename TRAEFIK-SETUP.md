# Configurazione Traefik per agenda.curandis.cloud

Questa guida spiega come configurare Traefik per esporre il calendario su `agenda.curandis.cloud` con certificato SSL automatico.

## 📋 Prerequisiti

- Traefik v2+ installato e funzionante
- DNS configurato: `agenda.curandis.cloud` → IP del server
- Let's Encrypt configurato in Traefik per certificati SSL
- Backend in esecuzione su `192.168.88.24:3000`
- Frontend in esecuzione su `192.168.88.24:4200`

## 🎯 Obiettivo

Configurare Traefik per:
- **Frontend**: `https://agenda.curandis.cloud` → `http://192.168.88.24:4200`
- **Backend**: `https://agenda.curandis.cloud/api` → `http://192.168.88.24:3000`
- Certificato SSL automatico con Let's Encrypt
- Redirect HTTP → HTTPS

## 🔧 Opzione 1: Path-based routing (Raccomandato)

Usa un singolo dominio con path `/api` per il backend.

### Configurazione Traefik (Docker Labels)

Vedi `traefik-example.yml` per la configurazione completa con Docker Compose.

### Configurazione Traefik (File statici)

Se usi file di configurazione invece di Docker labels:

```yaml
# File: /etc/traefik/dynamic/calendar.yml
http:
  routers:
    calendar-frontend:
      rule: "Host(`agenda.curandis.cloud`)"
      entryPoints:
        - websecure
      service: calendar-frontend
      tls:
        certResolver: letsencrypt

    calendar-backend:
      rule: "Host(`agenda.curandis.cloud`) && PathPrefix(`/api`)"
      entryPoints:
        - websecure
      service: calendar-backend
      middlewares:
        - calendar-backend-stripprefix
      tls:
        certResolver: letsencrypt

  services:
    calendar-frontend:
      loadBalancer:
        servers:
          - url: "http://192.168.88.24:4200"

    calendar-backend:
      loadBalancer:
        servers:
          - url: "http://192.168.88.24:3000"

  middlewares:
    calendar-backend-stripprefix:
      stripPrefix:
        prefixes:
          - "/api"
```

### Perché stripPrefix?

Il middleware `stripPrefix` rimuove `/api` dal path prima di inoltrare la richiesta al backend:
- Browser chiama: `https://agenda.curandis.cloud/api/users`
- Traefik forwarda: `http://192.168.88.24:3000/users`

Questo permette al backend di rimanere invariato senza dover aggiungere un prefisso globale.

## 🔧 Opzione 2: Subdomain routing

Usa un subdomain separato per il backend.

### Prerequisiti aggiuntivi
- Record DNS: `api.curandis.cloud` → stesso IP

### Modifica configurazione

1. **Traefik**: Cambia la regola del backend da:
   ```yaml
   rule: "Host(`agenda.curandis.cloud`) && PathPrefix(`/api`)"
   ```
   a:
   ```yaml
   rule: "Host(`api.curandis.cloud`)"
   ```
   E rimuovi il middleware `stripPrefix`.

2. **Frontend**: In `environment.ts` e `environment.prod.ts`, attiva OPZIONE B:
   ```typescript
   // Commenta OPZIONE A
   // return `${protocol}//${hostname}/api`;

   // Decommenta OPZIONE B
   const apiDomain = hostname.replace(/^([^.]+)\./, 'api.');
   return `${protocol}//${apiDomain}`;
   ```

## ✅ Verifica configurazione

### Test manuale

```bash
# Frontend
curl -I https://agenda.curandis.cloud
# Dovrebbe ritornare 200

# Backend
curl https://agenda.curandis.cloud/api/users
# Dovrebbe ritornare JSON con lista utenti
```

### Test automatico

```bash
./test-traefik-setup.sh
```

Questo script testa:
- ✅ Frontend HTTPS accessibile
- ✅ Backend API accessibile
- ✅ CORS headers corretti
- ✅ Certificato SSL valido
- ✅ Redirect HTTP → HTTPS

## 🐛 Troubleshooting

### Problema: Frontend carica ma non recupera dati

**Sintomo**: La pagina Angular si vede ma appare vuota, console mostra errori CORS o 404.

**Causa**: Backend non accessibile tramite `/api` o CORS non configurato.

**Soluzione**:
1. Verifica che il backend sia in esecuzione: `curl http://192.168.88.24:3000/users`
2. Verifica configurazione Traefik per il backend
3. Verifica che il middleware `stripPrefix` sia configurato
4. Controlla i log di Traefik: `docker logs traefik` o `journalctl -u traefik`

### Problema: Errore CORS nel browser

**Sintomo**: Console mostra "Access-Control-Allow-Origin" error.

**Causa**: Backend non permette richieste da `agenda.curandis.cloud`.

**Soluzione**: Verificato - il backend è già configurato per accettare richieste da `agenda.curandis.cloud`. Se continui a vedere errori:
1. Riavvia il backend: `npm run start:dev`
2. Verifica che la configurazione CORS sia attiva controllando i log

### Problema: Certificato SSL non valido

**Sintomo**: Browser mostra errore certificato.

**Causa**: Let's Encrypt non ha generato il certificato.

**Soluzione**:
1. Verifica DNS: `dig agenda.curandis.cloud` deve puntare al tuo IP
2. Verifica configurazione Let's Encrypt in Traefik
3. Controlla i log: `docker logs traefik | grep -i "certificate"`
4. Assicurati che porta 80 e 443 siano aperte nel firewall

### Problema: 404 su /api

**Sintomo**: `curl https://agenda.curandis.cloud/api/users` ritorna 404.

**Causa**: Router backend non configurato o middleware stripPrefix mancante.

**Soluzione**:
1. Verifica che la regola Traefik includa `PathPrefix(/api)`
2. Verifica che il middleware `stripPrefix` sia applicato al router
3. Riavvia Traefik dopo modifiche alla configurazione

## 📝 Comandi utili

```bash
# Riavvia Traefik (Docker)
docker restart traefik

# Riavvia Traefik (systemd)
sudo systemctl restart traefik

# Vedi log Traefik
docker logs -f traefik

# Test endpoint
curl -v https://agenda.curandis.cloud/api/users

# Verifica certificato
echo | openssl s_client -connect agenda.curandis.cloud:443 -servername agenda.curandis.cloud
```

## 🚀 Deploy

Dopo aver configurato Traefik:

```bash
# 1. Avvia backend
cd backend
npm run start:dev

# 2. Avvia frontend
cd frontend
npm run start:lan

# 3. Verifica
./test-traefik-setup.sh

# 4. Apri browser
open https://agenda.curandis.cloud
```

## 📚 Riferimenti

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Traefik StripPrefix Middleware](https://doc.traefik.io/traefik/middlewares/http/stripprefix/)
- [Let's Encrypt with Traefik](https://doc.traefik.io/traefik/https/acme/)
