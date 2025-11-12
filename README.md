# 📅 Calendario Multiutente per Poliambulatorio

Sistema completo di gestione calendario con **Angular** e **NestJS** per poliambulatori, con funzionalità avanzate di drag & drop, gestione disponibilità operatori e prenotazioni pazienti.

## 🎯 Funzionalità Principali

### ✨ Features Implementate

1. **📅 Calendario Multiutente**
   - Vista giornaliera con slot da 5 minuti
   - Selezione multipla operatori/medici
   - Colori personalizzati per ogni operatore
   - Zoom dinamico della vista

2. **🖱️ Drag & Drop Avanzato**
   - **Creazione appuntamenti**: Clicca e trascina per creare nuovi appuntamenti con durata variabile
   - **Spostamento appuntamenti** (Feature 1): Clicca sulla prima cella (orario+titolo) e trascina per spostare l'intero appuntamento con conferma
   - **Ridimensionamento** (Feature 2): Clicca sull'ultima cella e trascina verso l'alto/basso per modificare la durata (minimo 5 minuti)
   - **Visual Feedback** (Feature 3): Colori diversi durante il drag - tonalità più chiara per riduzione, stesso colore per allungamento

3. **👥 Gestione Pazienti**
   - Ricerca pazienti esistenti
   - Aggiunta rapida nuovi pazienti
   - Dati paziente: nome, cognome, telefono, email

4. **⏰ Gestione Disponibilità**
   - Modalità dedicata per modificare disponibilità operatori
   - Drag & drop per definire fasce orarie disponibili
   - Blocco automatico slot non disponibili

5. **🔄 Appuntamenti Ricorrenti**
   - Ripetizione giornaliera, settimanale, mensile
   - Selezione giorni specifici
   - Opzioni di termine: mai, dopo N volte, fino a data

6. **📝 Gestione Appuntamenti**
   - Modal di editing completo
   - Tipo visita/prestazione
   - Note aggiuntive
   - Modifica orari e data
   - Eliminazione con conferma

## 🏗️ Architettura

```
login-saas/
├── backend/              # NestJS Backend
│   ├── src/
│   │   ├── entities/    # Entità TypeORM
│   │   ├── users/       # Modulo Utenti
│   │   ├── patients/    # Modulo Pazienti
│   │   ├── appointments/# Modulo Appuntamenti
│   │   ├── availabilities/# Modulo Disponibilità
│   │   ├── seed/        # Dati iniziali
│   │   └── main.ts
│   └── package.json
│
├── frontend/            # Angular Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   └── calendar/  # Componente Calendario
│   │   │   ├── models/        # Modelli TypeScript
│   │   │   ├── services/      # Servizi API
│   │   │   └── app.module.ts
│   │   ├── styles.scss
│   │   └── index.html
│   └── package.json
│
└── package.json         # Root package
```

## 🚀 Setup e Installazione

### Prerequisiti

- **Node.js** >= 18.x
- **PostgreSQL** >= 13.x
- **npm** o **yarn**

### 1. Clona il Repository

```bash
git clone <repository-url>
cd login-saas
```

### 2. Setup Database PostgreSQL

Crea un database PostgreSQL:

```bash
# Accedi a PostgreSQL
psql -U postgres

# Crea il database
CREATE DATABASE calendar_db;

# Esci
\q
```

### 3. Configura Backend

```bash
cd backend

# Installa dipendenze
npm install

# Copia il file di environment
cp .env.example .env

# Modifica .env con le tue credenziali database
# DB_HOST=localhost
# DB_PORT=5432
# DB_USERNAME=postgres
# DB_PASSWORD=postgres
# DB_DATABASE=calendar_db
# PORT=3000
```

### 4. Configura Frontend

```bash
cd ../frontend

# Installa dipendenze
npm install
```

### 5. Avvia il Progetto

#### Opzione A: Avvio Separato

**Terminale 1 - Backend:**
```bash
cd backend
npm run start:dev
```

Il backend sarà disponibile su `http://localhost:3000`

**Terminale 2 - Frontend:**
```bash
cd frontend
npm start
```

Il frontend sarà disponibile su `http://localhost:4200`

#### Opzione B: Avvio Simultaneo (dalla root)

```bash
# Dalla root del progetto
npm install
npm run dev
```

Questo avvierà sia backend che frontend contemporaneamente.

## 📊 Database

Il database viene popolato automaticamente al primo avvio con dati di esempio:

- **5 Operatori** (medici e fisioterapisti)
- **5 Pazienti** di esempio
- **Disponibilità default** (08:00-18:00 per i prossimi 30 giorni)

### Entità Database

```typescript
User {
  id, name, type, color, active
}

Patient {
  id, name, surname, phone, email, notes
}

Appointment {
  id, title, date, startTime, endTime,
  userId, patientId, notes, repeat, recurringGroupId
}

Availability {
  id, userId, date, startTime, endTime, available
}
```

## 🎨 Utilizzo

### Creare un Appuntamento

1. Seleziona uno o più operatori dalla sidebar
2. Clicca e trascina su uno slot libero per definire la durata
3. Compila i dettagli nel modal:
   - Cerca o aggiungi paziente
   - Specifica tipo visita
   - Aggiungi note (opzionale)
   - Configura ripetizione (opzionale)
4. Salva

### Spostare un Appuntamento (Feature 1)

1. Clicca e tieni premuto sulla **prima cella** dell'appuntamento (quella con orario e titolo)
2. Trascina verso l'alto o il basso
3. Rilascia il mouse
4. Conferma lo spostamento nel modal di conferma

### Ridimensionare un Appuntamento (Feature 2)

1. Clicca e tieni premuto sulla **barra verde** in basso (ultima cella)
2. Trascina verso l'alto per ridurre (min 5 min) o verso il basso per allungare
3. Rilascia il mouse per applicare
4. L'appuntamento viene aggiornato automaticamente

### Modificare Disponibilità Operatori

1. Clicca su "Modifica disponibilità" nella sidebar
2. Clicca e trascina su uno slot per creare/modificare una fascia oraria
3. Conferma se vuoi rendere disponibile o non disponibile
4. Esci dalla modalità cliccando di nuovo il pulsante

### Visual Feedback (Feature 3)

Durante il trascinamento:
- **Riduzione durata**: Celle rimosse con opacità ridotta
- **Allungamento durata**: Nuove celle evidenziate con bordo verde
- **Spostamento**: Nuovo range evidenziato in blu
- **Creazione**: Range selezionato in rosso

## 🔧 API Endpoints

### Users
- `GET /users` - Lista utenti
- `GET /users/:id` - Dettaglio utente
- `POST /users` - Crea utente
- `PUT /users/:id` - Aggiorna utente

### Patients
- `GET /patients?search=query` - Lista/cerca pazienti
- `POST /patients` - Crea paziente
- `PUT /patients/:id` - Aggiorna paziente

### Appointments
- `GET /appointments?startDate&endDate&userId` - Lista appuntamenti
- `GET /appointments/by-date?date&userId` - Appuntamenti per data
- `POST /appointments` - Crea appuntamento
- `PUT /appointments/:id` - Aggiorna appuntamento
- `DELETE /appointments/:id` - Elimina appuntamento
- `GET /appointments/check-availability` - Verifica disponibilità slot

### Availabilities
- `GET /availabilities?startDate&endDate&userId` - Lista disponibilità
- `POST /availabilities` - Crea disponibilità
- `POST /availabilities/bulk` - Crea disponibilità multiple
- `POST /availabilities/set-default` - Imposta disponibilità default

## 🎯 Tecnologie Utilizzate

### Backend
- **NestJS** - Framework Node.js
- **TypeORM** - ORM per database
- **PostgreSQL** - Database relazionale
- **Class Validator** - Validazione dati
- **RxJS** - Programmazione reattiva

### Frontend
- **Angular 17** - Framework frontend
- **Angular CDK** - Components Dev Kit
- **RxJS** - Gestione asincrona
- **Tailwind CSS** - Styling
- **TypeScript** - Linguaggio tipizzato

## 📝 Note di Sviluppo

### Sicurezza
- In produzione, configurare CORS appropriatamente
- Implementare autenticazione (JWT)
- Usare migrations invece di `synchronize: true`
- Validare input utente

### Performance
- Implementare paginazione per liste grandi
- Caching delle disponibilità
- Lazy loading componenti Angular
- Ottimizzazione query database

### Miglioramenti Futuri
- [ ] Autenticazione e autorizzazione
- [ ] Notifiche email/SMS
- [ ] Vista settimanale/mensile
- [ ] Export calendario (PDF, ICS)
- [ ] Gestione sale/risorse
- [ ] Dashboard statistiche
- [ ] App mobile (Ionic/React Native)
- [ ] Integrazione pagamenti

## 🐛 Troubleshooting

### Il backend non si avvia
```bash
# Verifica che PostgreSQL sia in esecuzione
sudo service postgresql status

# Verifica le credenziali in .env
cat backend/.env
```

### Errore di connessione database
```bash
# Verifica che il database esista
psql -U postgres -l | grep calendar_db

# Se non esiste, crealo
psql -U postgres -c "CREATE DATABASE calendar_db;"
```

### Il frontend non comunica con il backend
- Verifica che il backend sia in esecuzione su `http://localhost:3000`
- Controlla la console browser per errori CORS
- Verifica che `apiService.baseUrl` sia corretto

## 📄 Licenza

MIT

## 👥 Autori

Sviluppato per sistema di gestione poliambulatori

---

**Nota**: Questo è un progetto di esempio/prototipo. Per uso in produzione, implementare misure di sicurezza appropriate e testing completo.
