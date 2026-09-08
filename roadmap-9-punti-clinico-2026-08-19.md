# Roadmap — 9 richieste cliente sul clinico (avviata 19/08/2026)

Documento di lavoro **passabile ad altre chat**: ogni punto porta con sé stato
attuale (con file e righe), decisioni già prese, cosa resta da fare e come si
verifica. Aggiornare le caselle `[ ]` → `[x]` mano a mano.

Branch: `containerization-2026-06-11`.

## Stato al 19/08/2026

**Blocco A (punti 1-7) + risoluzione conflitti serie + 3 migliorie: codice
completo, build verde, NON ancora deployato.** Backend `npx tsc --noEmit` e
`nest build` puliti, schema GraphQL verificato, frontend `ng build` pulito,
test del gateway 9/9, generatore ricorrenze 20/20. Restano rebuild dei
container e prova sul campo.

## Ordine di lavorazione deciso con Marco

1. **Blocco A — punti 1-7** (interventi sull'esistente, quelli che il cliente
   sente subito). Deployabile per conto suo.
2. **Blocco B — punto 8** (sincronizzazione agenda operatori).
3. **Blocco C — punto 9** (notifiche multicanale WhatsApp / Email / SMS).

## Decisioni vincolanti già prese

| # | Decisione | Motivo |
|---|---|---|
| D1 | Punto 6: si **estende** il dialog "Gestisci Appuntamenti", non se ne crea uno nuovo | pannello di spostamento, drag/minimize e doppia vista sono già lì: duplicarli significa mantenerli due volte e mettere l'utente davanti a due pulsanti per la stessa operazione |
| D2 | Punto 8: **feed ICS subito**, Google OAuth in una fase B separata | Google Calendar non si integra con una API key (serve OAuth + verifica Google del consent screen) e Apple non ha API pubbliche. L'ICS copre iOS + Google + Outlook senza credenziali |
| D3 | Punto 9: si coprono **tre canali** — WhatsApp, Email, SMS | i driver esistono già tutti nel gateway; il gateway GSM in LAN di Marco è testabile davvero |
| D4 | Punto 9: nelle impostazioni si sceglie **modalità fallback** e/o **scelta canale per paziente**, più un canale di default | richiesta esplicita del 19/08 |
| D5 | Punto 4: fuori disponibilità su non retribuito → **conferma**, non blocco | la pausa pranzo è legittimamente fuori orario: va permessa, ma non in silenzio |

---

# BLOCCO A — punti 1-7

## Punto 1 — Ricorrenza mensile per giorno della settimana, con più regole

**Richiesta**: "il primo mercoledì del mese", e più fasce nella stessa serie
("il primo lunedì **e** l'ultimo mercoledì del mese").

### Stato attuale

- Generazione date: `backend/src/modules/availability/services/availability-appointment.service.ts`
  → `calculateRecurringDates()` (~riga 578). Il caso `MONTHLY` fa solo
  `current.setMonth(current.getMonth() + interval)`: stessa data del mese.
- DTO: `backend/src/modules/availability/dto/create-availability-appointment.input.ts`
  (`RepeatConfigInput`, enum `RecurringType`).
- Persistenza: colonna **jsonb** `repeatConfig` su
  `backend/src/modules/availability/entities/availability-appointment.entity.ts:325`
  → **nessuna migration necessaria per la colonna**, solo il tipo TS.
- UI: `frontend/src/app/shared/components/event-mat-dialog/event-mat-dialog.component.html:190-262`
  (select tipo, intervallo, giorni settimana, fine ricorrenza) e
  `event-mat-dialog.component.ts` (`repeatConfig`, `getIntervalLabel()`,
  `getOccurrencesPreview()` ~riga 875-910).
- Gemello palestra: `frontend/src/app/shared/components/gym-appointment-mat-dialog/gym-appointment-mat-dialog.component.ts:229`.
- I dialog sotto `components/calendar-cdk/` sono la versione legacy: il
  calendario in uso (`/calendar` = v3) usa i `*-mat-dialog` in `shared/`.

### Modello dati nuovo (retro-compatibile)

Si aggiunge a `repeatConfig`, con nomi allineati a RRULE così che il feed ICS
del punto 8 possa riusarli:

```ts
monthlyMode?: 'DAY_OF_MONTH' | 'DAY_OF_WEEK';   // assente = DAY_OF_MONTH (comportamento attuale)
monthlyRules?: { ordinal: 1|2|3|4|-1; weekday: 0|1|2|3|4|5|6 }[];  // -1 = ultimo
```

Config assente o `DAY_OF_MONTH` → si comporta esattamente come oggi: le serie
già in DB non cambiano.

### Da fare

- [x] Backend: `MonthlyMode` + `MonthlyRuleInput` nel DTO, campi sull'entity
      (jsonb: nessuna migration), campi sull'interfaccia del service.
- [x] Backend: **calcolo estratto** in
      `modules/availability/utils/recurring-dates.util.ts` — funzione pura,
      nessuna dipendenza da Nest o dai repository. Gestisce il nuovo ramo
      "per giorno della settimana" con più fasce per mese.
- [x] Backend: estratto `normalizeRepeatConfigForStorage()` — la
      normalizzazione degli enum era ripetuta in tre punti (creazione
      singola, creazione palestra, `makeRecurring`).
- [x] Frontend: radio "Stesso giorno del mese" / "Giorno della settimana" +
      elenco fasce `[posizione][giorno]` con aggiungi/rimuovi, nel dialog
      appuntamento. Entrando nella modalità propone la fascia che descrive la
      data cliccata (5 agosto 2026 → "primo mercoledì").
- [x] Frontend: anteprima che rilegge le fasce impostate, non solo il numero.
- [ ] **Non fatto — dialog palestra**: mantiene la mensile classica. Estenderlo
      significa duplicare UI e logica, oppure estrarre un componente
      `recurrence-config` condiviso fra i due dialog. Da decidere con Marco:
      per la palestra "il primo mercoledì del mese" è un caso raro.

### Due difetti latenti corretti strada facendo

Il generatore vecchio usava `new Date()` con i setter **locali** e
`toISOString()` (UTC) per formattare:

1. **Slittamento di un giorno sul cambio d'ora.** Una serie mensile partita il
   15 gennaio generava il **14** aprile: mezzanotte UTC è l'una del mattino in
   Italia, e passando all'ora legale l'istante tornava al giorno prima in UTC.
2. **Sconfinamento a fine mese.** Il 31 gennaio + 1 mese dava il **3 marzo**
   (overflow naturale di `Date`) invece del 28 febbraio.

Il nuovo generatore lavora su interi anno/mese/giorno e usa `Date.UTC` solo
per il giorno della settimana. Il clamp di fine mese è applicato sempre alla
data di partenza, non al risultato precedente: 31 gennaio → 28 febbraio →
**31** marzo, non 28 marzo.

**Assunzione dichiarata**: l'appuntamento che si sta creando resta **la prima
occorrenza** della serie anche se la sua data non corrisponde a nessuna regola
(è lo slot che l'utente ha cliccato); le occorrenze successive seguono le
regole. È già il comportamento di `makeRecurring()`.

### Verifica

Il generatore è stato provato con 20 casi (script in scratchpad, non
committato): posizioni nel mese, quarta vs ultima occorrenza nei mesi con
cinque, fasce multiple, deduplica, "fino al", intervallo di 2 mesi, clamp di
fine mese, cambio d'ora, retro-compatibilità di giornaliera/settimanale/
mensile classica, orizzonte di 2 anni. **Tutti verdi.**

Da provare a mano dopo il deploy: serie "primo lunedì + ultimo mercoledì,
6 volte" partendo da un martedì → 6 appuntamenti sul calendario.

---

## Punto 2 — Dialog nuovo appuntamento: trascinabile, ridimensionabile, più compatto

### Stato attuale

- Il dialog è `frontend/src/app/shared/components/event-mat-dialog/`
  (`.ts` 1211 righe, `.html` 368, `.scss` 474).
- Aperto da `features/calendar-v3/containers/calendar-v3.container.ts:1008` e
  `:2285` (e da `components/calendar-cdk/calendar-container/calendar-container.component.ts:1710`,
  legacy) con `width: '600px'`, **senza `panelClass`** → nessun drag, nessun resize.
- Il pattern già in uso nel progetto (`frontend/src/styles.scss:144-330`):
  `resize: both` + `overflow: auto` sulla classe del pane, `cdkDrag` sulla
  title bar con `cdkDragRootElement=".<pane>"` e
  `cdkDragBoundary=".cdk-overlay-container"`. Esempio completo e commentato:
  `features/calendar-v3/containers/appuntamenti-dialog.container.ts:84-120` e
  `:435-520` (correzione posizione fuori viewport).

### Da fare

- [x] `panelClass: 'event-mat-dialog-pane'` nei tre punti di apertura
      (calendar v3 ×2, calendar-cdk legacy ×1).
- [x] `.event-mat-dialog-pane` in `styles.scss` con `resize: both` e il
      layout flex che propaga il ridimensionamento al contenuto.
- [x] Barra del titolo trascinabile (`cdkDrag` +
      `cdkDragRootElement=".event-mat-dialog-pane"`), icona `drag_indicator`.
- [x] Larghezza `600px` → **520px**; `mat-dialog-content` non impone più
      `min-width: 420px / max-width: 600px`, così segue la finestra
      ridimensionata invece di combatterci.
- [x] Campi più bassi: `mat.form-field-density(-2)` scoped al solo pane
      (48px invece di 56px), più spaziature ridotte su titolo, azioni,
      sezione stato e blocchi ricorrenza/strumenti.
- [x] `.form-row` passa da due colonne fisse a `auto-fit minmax(190px, 1fr)`:
      restringendo la finestra i campi si impilano invece di sovrapporsi.

### Verifica

Browser a 100%, dialog aperto: si trascina dalla barra del titolo, si
ridimensiona dall'angolo, nessun campo sovrapposto in creazione **e** in
modifica (le due modalità mostrano sezioni diverse).

---

## Punto 3 — Pulsante reset filtri nella ricerca disponibilità

### Stato attuale

`frontend/src/app/features/calendar-v2/components/calendar-sidebar/calendar-v2-sidebar.component.ts`
(riusata dal v3): sezione "Ricerca Disponibilità" al template ~riga 104-200,
stato `filters` inizializzato a riga 709, `slotSearchEnabled = true` a riga 707.

### Da fare

- [x] `DEFAULT_SEARCH_FILTERS` e `DEFAULT_SLOT_SEARCH_ENABLED` estratti in
      `features/calendar-v2/models/calendar-v2.model.ts`.
- [x] Pulsante icona "Ripristina i filtri iniziali" sulla riga del toggle
      "Mostra slot disponibili"; rimette anche il toggle e rilancia
      `emitFilters()`.
- [x] Disabilitato quando i filtri sono già ai default.

---

## Punto 4 — Appuntamento non retribuito fuori disponibilità: nessuna conferma

### Stato attuale — è una scelta esplicita, in due punti

- Backend: `availability-appointment.service.ts` → `assertWithinAvailability()`
  ~riga 228: `if (params.nonRetribuito) return;` (commento: "pausa pranzo & co.
  sono legittimamente fuori orario").
- Frontend: `calendar-v3.container.ts:2355` → `if (!result.nonRetribuito) { ...controllo... }`.

### Da fare (decisione D5: conferma, non blocco)

- [x] Backend: tolto lo short-circuit `if (params.nonRetribuito) return;` da
      `assertWithinAvailability`. Il parametro `nonRetribuito`, diventato
      inutile, è stato rimosso anche dai due chiamanti.
- [x] Frontend: il guard gira anche per i non retribuiti, con testo dedicato
      ("Per un appuntamento non retribuito può essere corretto — pausa,
      rappresentante, ecc.") e conferma in blu invece che rossa: è una
      conferma, non un errore.
- [x] Flusso **incolla** coperto: prima creava in silenzio i non retribuiti
      fuori orario e restituiva un errore secco sugli altri. Ora passa dallo
      stesso guard, quindi chiede conferma e propaga la forzatura.
- [x] L'impostazione globale "blocca fuori disponibilità" resta l'interruttore:
      se è **off** non viene chiesto niente a nessuno.

Non toccata la validazione delle **serie ricorrenti**
(`createRecurringAppointments`), che continua a saltare i non retribuiti: quel
controllo riguarda le sovrapposizioni fra occorrenze, e una pausa pranzo
ripetuta ogni giorno deve poter esistere.

✅ **Il tech debt del flag `force` sulle serie è stato risolto alla radice**
sostituendo il flag con la risoluzione per occorrenza — vedi il capitolo
dedicato più sotto.

### Verifica

Con flag on: appuntamento non retribuito fuori orario → compare la conferma,
confermando viene creato. Con flag off: nessuna conferma per nessuno.

---

## Punto 5 — Rinominare "Appuntamenti" → "Gestisci Appuntamenti"

- [x] Etichetta e tooltip del pulsante in toolbar.
- [x] Titolo della finestra allineato a "Gestisci Appuntamenti".

---

## Punto 6 — Ricerca per operatore in "Gestisci Appuntamenti"

**Decisione D1: si estende il riquadro esistente.**

### Stato attuale

- `features/calendar-v3/containers/appuntamenti-dialog.container.ts` (886 righe,
  smart container, `OnPush`): due layout, `panels` e `wizard`
  (`LayoutMode`/`WizardStep` riga ~68), step `search → appointments → rebooking`.
- Dumb components: `components/patient-search/`,
  `components/patient-appointments-list/`, `components/rebooking-panel/`.
- Query backend già disponibili, **nessuna modifica backend prevista**:
  - `availabilityAppointmentsByPatient(patientId, startDate)`
  - `availabilityAppointmentsByOperator(operatorId, startDate, endDate)` →
    `findByOperatorAndDateRange()` (service riga 1037), già con relations
    `operator, service, gymRoom, instruments...` e ordine data/ora ASC.
- Preset date già implementati altrove da riusare:
  `features/trattamenti/components/trattamenti-filters/trattamenti-filters.component.ts:424-450`
  e `features/operators-new/components/patient-appointments-list/...:59`.

### Da fare (architettura a 5 strati)

- [x] **Layer 1** — nuovo dumb `components/operator-search/`: operatori
      raggruppati per categoria con filtro testuale.
- [x] **Layer 1** — nuovo dumb `components/appointments-filter-bar/`: date
      inizio/fine con datepicker + periodi rapidi (Oggi, Questa settimana,
      Questo mese, Prossimo mese, Prossimi 30 giorni) e, solo in modalità
      operatore, toggle Tutti/Retribuiti/Non retribuiti + filtro paziente.
- [x] **Layer 1** — `patient-appointments-list` rinominato in
      `appointments-list` (`app-v3-appointments-list`) con `@Input() mode`:
      per paziente mostra l'operatore, per operatore mostra il paziente e il
      badge "Non retribuito". Testi di stato vuoto coerenti con la modalità.
- [x] **Layer 2** — `searchMode` nel container, con toggle Paziente/Operatore.
      **I due layout condividono lo stesso markup** via `ng-template`
      (`modeToggleTpl`, `subjectSearchTpl`, `filterBarTpl`,
      `appointmentsListTpl`): è l'unico modo per essere certi che pannelli e
      vista guidata si comportino allo stesso modo.
- [x] **Layer 3** — riusata `getAppointmentsByOperator(operatorId, from, to)`,
      già presente nel service. **Nessuna modifica al backend.**
- [x] Filtri tipo-fascia e paziente applicati sul risultato caricato: il
      periodo limita già il volume e cambiare filtro è immediato.
- [x] Periodo di default per modalità: paziente = da oggi senza limite (come
      prima), operatore = settimana in corso (un'agenda operatore senza limite
      superiore sarebbe illeggibile).
- [x] Estratto `shared/utils/date-range-presets.ts`, riusabile.

Nota: `features/trattamenti/components/trattamenti-filters` ha una copia
propria della stessa logica di periodi. Non l'ho toccata (fuori scope), ma
adottare l'util condivisa toglierebbe la duplicazione.

### Verifica

Ricerca per operatore → si vedono gli appuntamenti **non retribuiti** (che non
hanno paziente e oggi sono invisibili in questo riquadro), si filtra per
periodo, si sposta un appuntamento. Ripetere in vista guidata.

---

## Punto 7 — Recap multiplo ordinato dal più prossimo al più lontano

### Stato attuale — tre percorsi, due già corretti

| Percorso | Dove | Stato |
|---|---|---|
| Recap da elenco appuntamenti | `backend/.../availability-appointment.service.ts:2616` `sendAppointmentsRecap()` | ✅ già `order: { appointmentDate: ASC, startTime: ASC }` |
| Recap dalla chat WhatsApp | `backend/.../whatsapp/chat/services/whatsapp-chat.service.ts:585` | ✅ già `ORDER BY "appointmentDate" ASC, "startTime" ASC` |
| **Recap automatico raggruppato** | `/home/marco/whatsapp-gateway/src/whatsapp/whatsapp.processor.ts:132` e `buildRecapText()` riga 201 | ❌ **ordine di inserimento nel buffer**, cioè ordine di creazione |

Il buffer accorpa gli appuntamenti creati entro `recapBufferSeconds`; ogni
elemento porta con sé `date` (ISO) e la propria `recapLine` già renderizzata.

### Da fare

- [x] `sortChronologically()` nel processor, applicata prima di comporre il
      testo: l'ordine vale sia per le righe del messaggio sia per gli
      `appointmentIds` che finiscono nell'audit.
- [x] Tre test nuovi in `whatsapp.processor.spec.ts` (ordine invertito,
      parità di giorno + elemento senza data, non-mutazione dell'input).
      Suite: **9/9 verdi**.
- [ ] **Rebuild del gateway** (non basta il restart) — da fare al deploy.

---

## Risoluzione conflitti sulle serie ricorrenti (aggiunta 19/08, su proposta di Marco)

### Il problema che risolve

Il flag `forceOutsideAvailability` è una risposta sì/no a una domanda che
riguarda **N date diverse**, ognuna con la propria storia: una fuori orario
perché il template è cambiato a settembre, una occupata da un altro paziente,
le altre a posto. Da lì venivano due comportamenti opposti e sbagliati in modi
diversi:

- **creazione serie**: la forzatura non arrivava mai (campo estratto
  dall'input prima di passarlo), quindi confermare "procedi comunque"
  finiva lo stesso in "Creazione serie bloccata" — troppo severo;
- **rendi ricorrente**: la forzatura arrivava e saltava *tutto*, comprese le
  sovrapposizioni — troppo permissivo.

### Come funziona ora

Flusso a due tempi, per creazione serie, "rendi ricorrente" e modifica serie:

1. **Anteprima** — query `recurringSeriesPreview`: il backend genera le date e
   restituisce il piano con i conflitti. Non scrive niente.
2. **Risoluzione** — se c'è almeno un conflitto si apre il riquadro: per ogni
   occorrenza *conferma* (fuori disponibilità ma la si vuole), *sposta* o
   *salta*; oppure si annulla tutta la serie.
3. **Scrittura** — il frontend rimanda l'elenco **esplicito** delle occorrenze
   risolte. Il backend crea quelle, non rigenera le date: il piano scritto è
   esattamente quello che l'utente ha visto.

**Le sovrapposizioni non sono confermabili**, solo spostabili o saltabili: due
pazienti nello stesso slot sono un errore di dato, non una scelta. È anche
coerente con l'appuntamento singolo, dove la sovrapposizione è già un blocco
secco senza forzatura.

### Lo spostamento della singola occorrenza

La riga si apre e propone gli **slot liberi veri** (riusa
`availableSlotsForRebooking`, la stessa query del pannello di riprenotazione),
con:
- finestra di ricerca allargabile: solo quel giorno, ± 1, ± 3, ± 7 giorni —
  serve quando il giorno originale è pieno;
- casella "anche altri operatori", che porta in elenco gli slot degli altri
  con il nome accanto (l'operatore originale resta comunque in cima);
- campi data e ora per decidere a mano, con l'orario di fine che segue quello
  di inizio mantenendo la durata.

### I due scenari che non si vedevano a disegno

- **Volume.** Una serie arriva a 52 occorrenze e, dopo un cambio di template,
  possono essere in conflitto quasi tutte. Perciò: azioni cumulative
  ("conferma tutte", "salta tutte"), occorrenze pulite raccolte in una riga
  sola di riepilogo, e **validazione in due query invece che due per
  occorrenza** (erano ~100 round-trip per una serie lunga).
- **Scarto fra anteprima e creazione.** Fra i due passaggi passano secondi, ma
  bastano perché qualcuno prenoti uno di quegli slot. Alla scrittura si
  ricontrollano **solo le sovrapposizioni**: sono l'unica cosa che può
  cambiare sotto i piedi dell'utente, e l'unica che non gli è mai stato
  permesso di forzare. I fuori-disponibilità li ha visti e confermati, non
  vanno rimessi in discussione. Se spunta una sovrapposizione nuova, si
  riapre il riepilogo aggiornato invece di scrivere a metà.

### Non retribuiti: trattati come gli altri (richiesta di Marco)

Il salto della validazione per `nonRetribuito` è stato tolto ovunque
(`assertWithinAvailability`, creazione serie, `makeRecurring`). Una pausa
pranzo fuori orario è legittima e si conferma in un clic, ma una riunione o un
appuntamento con un rappresentante fuori disponibilità è un problema vero, e
prima passava in silenzio.

### Template diversi nel periodo (richiesta di Marco)

Gli assignment dei template sono una **timeline** (`isCurrent` = "non
revocata", periodi non sovrapposti) e `computeDayRawBands` sceglie
l'assegnazione valida **giorno per giorno**. La validazione chiede la
disponibilità per l'intero intervallo in una sola query, ma la risoluzione
resta per data: una serie agosto→ottobre che attraversa un cambio di template
a metà settembre viene valutata con l'orario giusto in ogni sua parte.

### File toccati

Backend:
- `modules/availability/dto/recurring-occurrence.input.ts` (nuovo)
- `modules/availability/dto/recurring-series-conflict.output.ts` (`RecurringOccurrencePreview`)
- `modules/availability/services/availability-appointment.service.ts`
  (`previewRecurringSeries`, `recheckResolvedOccurrences`,
  `validateRecurringOccurrences` batch, piano in `createRecurringAppointments`,
  `makeRecurring`, `updateRecurringSeries`)
- `modules/availability/services/availability.service.ts`
  (`getOperatorsAvailabilityV3` accetta più esclusioni)

Frontend:
- `features/calendar-v3/models/recurring-resolution.model.ts` (nuovo)
- `features/calendar-v3/components/recurring-resolution-list/` (nuovo, dumb)
- `features/calendar-v3/containers/recurring-resolution-dialog.container.ts` (nuovo, smart)
- `calendar-v3.container.ts` → `resolveRecurringSeries()`
- `event-mat-dialog.component.ts` → `resolveSeriesConflicts()` per la modifica serie

### Cosa resta fuori

`updateRecurringSeriesTime` (modifica del solo orario) **non ha chiamanti nel
frontend**: la UI usa `updateRecurringSeries`. Non è stata estesa, per non
aggiungere codice mai eseguito.

---

## Migliorie implementate (le tre proposte approvate)

1. **Memoria della finestra** — nuova direttiva
   `shared/directives/remembered-window.directive.ts`: salva posizione e
   dimensione in `localStorage`, **per utente e per finestra** (su un PC di
   segreteria condiviso ognuno ritrova il proprio ingombro). Al ripristino
   riporta la finestra dentro la viewport, così una posizione salvata su uno
   schermo più grande non la rende irraggiungibile. Applicata a: dialog
   appuntamento, Gestisci Appuntamenti, Trattamenti.
   *Le altre finestre trascinabili usano `.cdk-overlay-pane` generico come
   root del drag: con più dialog aperti il selettore prenderebbe quello
   sbagliato. Vanno prima dotate di una panelClass propria.*

2. **Stampa ed export dell'elenco filtrato** — `AppointmentsExportService`
   con stampa (finestra dedicata, intestazione con soggetto, periodo e filtri
   attivi) ed export CSV (separatore `;` e BOM, per Excel italiano). Pulsanti
   nella barra filtri, spenti quando non c'è niente da esportare.

3. **Duplicazione dei periodi rapidi rimossa** — `trattamenti-filters` usa
   l'util condivisa `shared/utils/date-range-presets`. Resta locale solo
   "ultimi N mesi", che è specifico dei trattamenti (guardano indietro, gli
   appuntamenti guardano avanti).

---

# BLOCCO B — punto 8: sincronizzazione agenda operatori

**Decisione D2: fase A ICS ora, fase B Google OAuth dopo.**

### Perché non "API key"

- **Google Calendar**: nessuna API key scrive su un calendario personale.
  Serve OAuth 2.0 con consenso del singolo operatore, progetto Google Cloud
  intestato a Curandis e — per lo scope `calendar.events`, che Google
  classifica come sensibile — la verifica della schermata di consenso, che
  richiede settimane. Il service account con delega a livello di dominio vale
  solo per account Google Workspace del dominio del cliente.
- **Apple / iOS**: nessuna API pubblica di calendario. Restano CalDAV su
  iCloud con password specifica per app (non ufficiale, fragile, obbliga a
  custodire una credenziale iCloud per operatore — scartato) oppure la
  sottoscrizione a un feed.

### Fase A — feed ICS per operatore ✅ FATTA E DEPLOYATA (19/08/2026)

Un URL segreto per operatore, che iOS Calendar, Google Calendar e Outlook
sottoscrivono nativamente. Sola lettura, aggiornamento a cura del client
(iOS ~15-60 min, Google anche 8-24 h: **detto all'utente nella UI**).

**Provata end-to-end sul tenant bdq**, con feed poi revocato e tenant
ripulito (0 feed attivi residui):

| prova | esito |
|---|---|
| `GET /calendar-feed/<token>.ics` senza JWT, host `clinico.bdq.curandis.cloud` | **200**, `text/calendar`, 65 KB, 211 eventi |
| conversione fuso | DB `2026-07-27 13:45` → `DTSTART:20260727T114500Z` (luglio = UTC+2) ✅ |
| nome paziente spento (default) | `SUMMARY:FISIO` — solo servizio ✅ |
| nome paziente acceso | `SUMMARY:<nome paziente>…` ✅ |
| token inesistente | **404** |
| host senza tenant | **404** |
| feed revocato | **404** |

Generatore ICS provato a parte con 23 casi (`ics.util.ts`): cambio ora legale
in entrambe le direzioni, escape RFC 5545, folding a 75 ottetti con accenti,
STATUS CANCELLED, calendario vuoto.

- [x] Migration **1818** `AddOperatorCalendarFeed`: colonne `calendarFeedToken`
      (unique parziale), `calendarFeedEnabled`, `calendarFeedShowPatientName`,
      `calendarFeedCreatedAt`, `calendarFeedRevokedAt`, `calendarFeedLastAccessAt`.
      Applicata su `clinico_4701c4aaba73713294696ae7ae46d21b` (bdq).
      ⚠️ **Da applicare sugli altri tenant** quando ce ne saranno:
      `MIGRATION_DB=clinico_<hash> npm run migration:run`
      (il CLAUDE.md cita `DB_DATABASE`, ma la variabile giusta è `MIGRATION_DB`
      — `typeorm.config.ts` si ferma con un errore parlante se manca).
- [x] Endpoint REST `GET /calendar-feed/:token.ics`, **escluso da
      `CurandisTenantContextMiddleware`** (che pretende un JWT) in `app.module.ts`.
      Il tenant si risolve dal sottodominio via `TenantResolverService`
      (`extractTenantAliasFromRequest`, stateless, nessun JWT richiesto) e il
      contesto si costruisce a mano con `tenantContext.run(...)`, come fa il
      controller dei webhook.
- [x] `ics.util.ts` (funzione pura): UID stabile = id appuntamento,
      DTSTART/DTEND convertiti in UTC con le regole DST italiane, `SEQUENCE`
      derivato da `updatedAt`, `STATUS:CANCELLED` per le disdette,
      `LAST-MODIFIED`, `REFRESH-INTERVAL` + `X-PUBLISHED-TTL`. Finestra da
      -30 a +180 giorni.
- [x] **Privacy**: nome paziente **spento di default**; attivandolo compare un
      avviso che spiega che il feed viaggia su un indirizzo non autenticato,
      che i nomi finiscono nel calendario personale e nei backup del telefono,
      che sono dati sanitari, e che la scelta è **a rischio e responsabilità
      dell'operatore** — con conferma esplicita ("Attiva, me ne assumo la
      responsabilità"). Disattivarlo non chiede niente: si torna sempre al più
      prudente. Token da 32 byte, revoca che **azzera** il token (non lo lascia
      in tabella), rigenerazione che invalida il precedente con avviso delle
      conseguenze, `calendarFeedLastAccessAt` per sapere se il feed è ancora
      scaricato dopo una revoca.
- [x] UI: feature `features/operator-calendar-feed/` a 5 strati (model,
      graphql, service su BaseGraphQLService, dumb panel, smart container),
      innestata nella scheda operatore **solo in modifica** (in creazione
      l'operatore non ha ancora un id). Genera/copia/rigenera/revoca,
      istruzioni passo-passo per iOS, Google e Outlook, avviso esplicito sul
      ritardo di aggiornamento, data di creazione e ultimo scaricamento.
- [x] **Invio del link all'operatore** (20/08), che rende superfluo il QR code:
      dal pannello si sceglie WhatsApp o email, si indica il recapito
      (precompilato se c'è in anagrafica — serve, perché **solo 4 operatori su
      18 hanno un numero**) e parte il messaggio. L'operatore tocca il link e
      poi un pulsante: `webcal://` apre il Calendario di iOS con la richiesta
      di sottoscrizione già pronta, oppure `calendar.google.com/r?cid=` apre
      l'aggiunta su Google. Niente impostazioni da cercare.
- [x] **Il link nel messaggio è usa-e-getta** (migration **1821**,
      `calendar_feed_setup_links`): vale 30 minuti e una volta sola, e apre una
      pagina che contiene l'URL vero. Nella conversazione resta un link morto
      invece di una credenziale permanente sull'agenda, che altrimenti
      resterebbe lì anche nei backup del telefono e in ogni inoltro della chat.
      Emetterne uno nuovo invalida i precedenti.
      **Correzione dopo la prova sul campo di Marco**: alla prima versione il
      link risultava sempre "scaduto". Non lo era: **WhatsApp scarica l'URL da
      sé** per generare l'anteprima del messaggio, e quella visita consumava il
      link. I dati lo dicevano senza ambiguità — consumo registrato **1 secondo
      dopo l'invio**, quando il destinatario non poteva ancora aver toccato
      niente. Vale anche per i filtri di posta e gli antivirus aziendali.

      Ora **aprire non consuma**: il GET mostra solo un pulsante "Attiva la
      sincronizzazione" e non contiene alcun indirizzo; il consumo avviene sul
      **POST**, che i crawler non fanno. Beneficio in più: nemmeno l'anteprima
      memorizzata dal messaggio contiene il segreto.

      Provato simulando il crawler: GET con user-agent WhatsApp → 200 e
      **zero** occorrenze dell'indirizzo nel corpo, link ancora valido; GET
      dell'operatore → 200; POST → 200 con il pulsante `webcal://`; secondo
      POST → 410.
- [x] **Endpoint email generico nel gateway** (`POST /notify/email`,
      `NotifyModule`): finora la posta del gateway era raggiungibile solo col
      payload degli OTP. È anche il primo mattone del blocco C.
- [x] **Corretto il telefono nel feed**: usciva solo il cellulare, ora escono
      **tutti** i recapiti presenti, etichettati (`Cell: … · Tel: …`) e
      deduplicati sulle cifre. Chi non risponde al mobile è esattamente il caso
      per cui il numero sta nel feed.

### Correzioni dopo la prova sul campo di Marco (19/08, pomeriggio)

**1. L'URL del feed era irraggiungibile (difetto grave).** Generavo
`https://clinico.{tenant}.curandis.cloud/...`, host che **non esiste nemmeno
nel DNS**. In produzione tutti i tenant parlano con lo stesso backend,
`api.curandis.cloud` (vedi `frontend/src/environments/environment.prod.ts`),
che però non contiene il tenant nel sottodominio — normalmente lo si ricava
dal JWT, che nel feed non c'è.

→ Il tenant è passato **nel path**: `https://api.curandis.cloud/calendar-feed/{tenant}/{token}.ics`.
Verificato con una chiamata dall'esterno: **200, 213 eventi**; tenant
inesistente → 404. Alias validato con una whitelist prima di aprire una
connessione col pool.

La prova precedente non l'aveva preso perché forzavo l'header `Host`: provava
che la logica funzionava, non che l'indirizzo fosse raggiungibile. Conferma
indipendente della diagnosi: sui due feed generati da Marco
`calendarFeedLastAccessAt` era **NULL** — Google non era mai riuscito a
scaricarli.

⚠️ **I link generati prima di questa correzione sono da rigenerare/ricopiare**:
l'URL è cambiato.

**2. Il toggle "mostra nome paziente" restava acceso annullando l'avviso.**
`mat-slide-toggle` cambia il proprio stato interno al clic, prima che il padre
decida. Annullando, il valore in `status` non cambiava (era `false`, restava
`false`): Angular non vedeva differenze sul binding `[checked]` e non
ridisegnava, lasciando l'interruttore acceso su un dato falso. Risolto con
`@ViewChild(MatSlideToggle)` che riallinea l'istanza a ogni cambio di
`status`, e il container che rimanda un oggetto nuovo con `showPatientName:
false`. Lato servizio non era mai stato scritto nulla, quindi il backend era
già coerente.

**3. Telefono del paziente nel feed** (migration **1819**), interruttore
separato da quello del nome con avviso proprio: il nome dice CHI, il numero
permette di RAGGIUNGERLO, e insieme fanno del feed una rubrica di persone
legate a uno studio sanitario. Il recapito non sta nel clinico ma nel registry:
una sola chiamata `bulkSubjectsAsService` per i pazienti distinti (max 200),
best-effort — se il registry non risponde il feed esce senza numeri.
**Solo appuntamenti futuri**: su uno di due mesi fa un numero non serve.
(Primo tentativo sbagliato: filtravo i lookup ma non l'assegnazione, così un
paziente con un appuntamento futuro si vedeva il numero anche sulle visite
passate. Verificato dopo il fix: 0 telefoni sui passati, 186 sui futuri.)

**4. Ricerca tollerante nel filtro di Gestisci Appuntamenti** (punto 5 del
cliente). La casella cercava solo nel nome paziente; ora cerca in **titolo,
paziente, note e servizi** — il titolo è l'unico modo di ritrovare le fasce
non retribuite, che un paziente non ce l'hanno. Nuova util
`shared/utils/text-match.ts`: normalizza accenti e punteggiatura, spezza la
ricerca in parole che devono esserci tutte ma in qualsiasi ordine, accetta
pezzi di parola e tollera un refuso con soglia proporzionata alla lunghezza
(sotto le 5 lettere nessuna tolleranza, o "ana" pescherebbe mezzo dizionario).
22 casi di prova verdi: `riun`→Riunione, `pausa pra`→Pausa pranzo,
`pranzo pausa`→Pausa pranzo, `perone`→Peroni, `ama`✗Ana.

### Una trappola trovata strada facendo

Il primo tentativo usava `@InjectRepository`, come si fa normalmente in Nest.
Il container **non è partito**: `Nest can't resolve dependencies`. È stato un
bene, perché quel pattern qui è proprio sbagliato — con un database per
tenant un repository iniettato resta legato a una connessione statica e
leggerebbe il database di un altro tenant (o quello legacy). Il pattern
corretto, già usato dagli altri service del modulo, è prendere il DataSource
dall'AsyncLocalStorage a ogni chiamata (`tenantContext.getDataSource()`).
**Il build TypeScript passava lo stesso**: l'unico modo di accorgersene era
avviare davvero il container.

### Google diceva di aggiungerlo e non lo aggiungeva (20/08)

Sintomo: dal pulsante "Aggiungi a Google Calendar" la conferma appariva, ma il
calendario non compariva. Google non dà nessun errore, quindi si procede per
esclusione.

**Escluso il contenuto**: il feed pubblico risponde 200, `text/calendar`,
176 eventi, CRLF corretti, nessuna riga oltre i 75 ottetti, nessun UID
duplicato, tutte le proprietà obbligatorie presenti, DTSTART ben formati,
SEQUENCE nel range. Il calendario è impeccabile.

Restavano tre cose, **tutte mie**, corrette insieme perché Google non dice
quale lo blocca:

1. **`Cache-Control: no-store`** — l'avevo messo per prudenza sui dati
   sanitari. Ma sottoscrivere un calendario *significa* che il servizio ne
   conserva una copia e la rilegge nel tempo: è la funzione, non un effetto
   collaterale. Vietarglielo non proteggeva nulla — i dati arrivano comunque a
   destinazione — e poteva impedire a Google di completare la sottoscrizione.
   Resta `private`, che tiene fuori le cache condivise ed è il livello giusto.
2. **`Content-Disposition: attachment`** — chi consuma un feed è un'app di
   calendario, non un browser che scarica un file. Ora `inline`.
3. **`cid=https://...`** nel link Google — era davvero sbagliato: serve
   **`webcal://`**. Con `https` Google risponde *"impossibile aggiungere al
   calendario, controlla l'URL"*, perché legge il parametro come
   identificativo di calendario e non come indirizzo a cui iscriversi.
   **Verificato da Marco il 20/08**: col pulsante `webcal://` la
   sottoscrizione da computer va a buon fine — chiede conferma, mostra la
   schermata di scelta, e il calendario compare.

   Nota sul percorso, perché serve a chi verrà dopo: questa correzione era
   giusta al primo colpo, ma è stata **ritirata per un mio fraintendimento** —
   ho letto "lascia il link diretto" come "rimetti `https` nel pulsante"
   mentre Marco parlava dell'indirizzo da copiare. Da lì tre cambi di
   direzione. La causa di fondo è che **Google non è osservabile dal nostro
   lato**: nessun errore diagnosticabile, nessun modo di autenticarsi come
   l'utente, ogni verifica costa un giro di deploy. In quelle condizioni le
   ipotesi del lato server valgono poco e le osservazioni dell'utente valgono
   tutto: la via d'uscita è stata offrire entrambe le forme e chiedere quale
   funzionasse, invece di continuare a scegliere al posto suo.

⚠️ Chi aveva già provato ad aggiungerlo deve **rimuovere il calendario da
Google e rifare la sottoscrizione**: un tentativo fallito resta memorizzato
come tale.

### Il limite vero di Google: da telefono non si può (20/08)

Dopo le correzioni sulle intestazioni Google continuava a non aggiungere il
calendario. Marco ha dato l'indizio decisivo: dopo il pulsante arrivava un
**redirect alla scelta Android/iOS**, cioè la pagina promozionale di Google.

**Non era il link usa-e-getta**: una volta sulla pagina dei pulsanti il token
temporaneo ha già esaurito il suo compito, e il pulsante Google porta
l'indirizzo *permanente* del feed, che non dipende da quello.

La causa è un limite di Google: **l'aggiunta di un calendario da URL non
esiste sull'app mobile**, e `calendar.google.com/calendar/r?cid=` aperto da
telefono viene dirottato sulla pagina "scarica l'app" perdendo il parametro.

**Non serve però un computer** (precisazione del 20/08, da Marco): basta
attivare la **modalità desktop** nel browser del telefono. E non serve nemmeno
copiare l'indirizzo: **lo stesso pulsante `r?cid=` funziona anche da Android**
una volta in modalità desktop, quindi su Android il percorso principale è il
pulsante e il copia-incolla resta solo come ripiego, richiuso in un
`<details>`.

Due avvertenze che non avevamo e su cui l'operatore si sarebbe incastrato:
- **non toccare il link `.ics`** (vale nel percorso di ripiego) — il telefono
  scaricherebbe il file o lo aprirebbe con un'altra app di calendario invece di
  sincronizzarlo: va copiato con "copia indirizzo";
- **modalità desktop obbligatoria** su mobile, altrimenti il riquadro di
  conferma di Google non compare proprio;
- ultimo passaggio **dentro l'app** Google Calendar → Impostazioni → nome del
  calendario → **Sincronizza**, altrimenti resta associato all'account ma non
  compare sul telefono.

Il difetto mio era offrire quel pulsante a tutti: l'operatore riceve il link
**sul telefono**, ed è lì che lo tocca. Ora la pagina si adatta al dispositivo:

| dispositivo | cosa vede |
|---|---|
| iPhone/iPad | pulsante `webcal://` che apre il Calendario — funziona subito |
| Android | stesso pulsante del computer + istruzione ad attivare la **modalità desktop** se Google propone l'app; in fondo, ripiego copia-incolla richiudibile |
| computer | pulsante Google (`cid` con https diretto) + `webcal://` per Apple/Outlook |

In più, l'**indirizzo copiabile resta visibile su tutti i dispositivi**,
iPhone compreso: è la via che funziona sempre, anche quando un pulsante non
conclude, e toglierla lascerebbe l'utente senza alternative proprio nel caso
in cui gli servono.

Stesso avviso aggiunto anche nelle istruzioni del pannello operatore.

### Fase B — push Google Calendar via OAuth (in corso)

**Decisioni prese con Marco il 19/08:**

| Cosa | Scelta | Perché |
|---|---|---|
| Dove scrive | **Calendario dedicato** creato dall'app, nome configurabile (es. "BDQ") | Scope `calendar.app.created`: l'app tocca solo i calendari che ha creato, non l'agenda personale. E un calendario separato **compare comunque nella stessa vista** del principale, quindi l'operatore non perde nulla visivamente. La variante "scegli tu" costerebbe `calendar.events`, cioè lettura/scrittura su ogni evento privato dell'operatore |
| Tipo di app | **External** + verifica Google | Gli operatori usano Gmail personali. In Testing i refresh token scadono ogni **7 giorni**: buono per sviluppare, inutilizzabile per il cliente |
| Proprietario del collegamento | **`app_users`**, non `operators` | Un operatore È un app_user con `user_type='operator'` (18/18 hanno `app_user_id` nel tenant bdq). `operators` porta ruolo e policy, non identità; un account Google appartiene alla persona. `PATIENT` già previsto nell'enum per l'area riservata futura |
| Custodia token | **Postgres cifrato con Transit OpenBao** | Chi leggesse il DB (backup, copia di sviluppo) non troverebbe nulla di utilizzabile senza il permesso di decifrare su OpenBao |
| Chiave Transit | **Nuova chiave** `clinico-oauth-<alias>` nella stessa engine `transit` | Non serve una engine nuova: serve una chiave. Separata da `clinico-docs-<alias>` per **rotazione indipendente** — ruotare i token dopo un sospetto non deve costringere a ri-wrappare ogni documento clinico. Stesso schema per tenant, quindi il crypto-shredding all'offboarding resta intatto |

**Fatto (non dipende da Google):**
- [x] Migration **1820**: `app_users.google_account_email` (indirizzo
      *dichiarato*) + tabella `google_calendar_connections` con proprietario
      polimorfico, token cifrato, stato, tracce di errore e ultimo sync.
      Applicata su bdq.
- [x] `GoogleCalendarConnectionService`: salvataggio con cifratura Transit,
      lettura del token solo quando serve parlare con Google, revoca che
      **cancella** il ciphertext, `rewrapAll()` per la rotazione chiave.
- [x] Distinzione fra indirizzo **dichiarato** (su app_user) e **autorizzato**
      (quello che torna da Google). Confrontarli è una protezione concreta: chi
      autorizza con il Gmail sbagliato manderebbe i propri appuntamenti nel
      calendario di un'altra persona senza che nessuno se ne accorga.

**Azioni per Marco, bloccanti:**
- [ ] Progetto Google Cloud + consent screen External + scope
      `calendar.app.created` + utenti di test; redirect URI esatto:
      `https://api.curandis.cloud/integrations/google-calendar/callback`
- [ ] Client ID e secret in OpenBao su `kv/clinico/google-calendar`
      (convenzione di `kv/clinico/s3`: segreti di modulo, non per-tenant)
- [ ] **Chiave Transit** da creare a mano — il Transit non la crea da solo:
      `bao write -f transit/keys/clinico-oauth-<alias> type=aes256-gcm96`
- [ ] **Policy AppRole**: autorizzare il prefisso `clinico-oauth-*`, oggi
      la policy copre `clinico-docs-*`
- [ ] Verifica Google: informativa privacy pubblica, proprietà dominio in
      Search Console, **video dimostrativo** del flusso (è il punto che fa
      perdere più tempo a chi non se lo aspetta)

**Fatto il 20/08 (credenziali e policy pronte da Marco):**
- [x] Verifica dell'impianto prima di scrivere il flusso: KV leggibile con i
      nomi giusti, chiave Transit esistente, round-trip cifra/decifra corretto,
      rewrap possibile, e **isolamento confermato** — il percorso OAuth non può
      cifrare con la chiave dei documenti (403, come deve essere).
- [x] `state` firmato in **HMAC** con scadenza a 15 minuti: il callback di
      Google non ha JWT, e senza firma cambiare l'id nell'URL basterebbe a
      farsi collegare il calendario a nome di un altro. Confronto della firma
      a tempo costante.
- [x] Endpoint di avvio (GraphQL, autenticato) e callback (REST, pubblico,
      escluso dal middleware tenant come il feed ICS). Il callback rende una
      pagina leggibile e si chiude da sé se aperto come finestra secondaria.
- [x] Creazione del calendario dedicato al primo collegamento, nome
      configurabile (default: alias del tenant).
- [x] **Verifica dell'account autorizzante**: se l'operatore autorizza con un
      Gmail diverso da quello dichiarato, il collegamento viene annullato e il
      token appena ottenuto revocato subito lato Google. Senza questo controllo
      i suoi appuntamenti finirebbero nel calendario di un'altra persona.
- [x] Gestione revoca e token scaduto: `invalid_grant` diventa stato EXPIRED e
      la UI dice "riconnetti" invece di smettere di funzionare in silenzio.
- [x] Pannello nella scheda operatore accanto a quello ICS, con indirizzo
      Google dichiarato, collegamento in finestra separata (per non far
      perdere il form aperto) e scollegamento con revoca lato Google.
- [x] Provato contro Google davvero: l'URL di autorizzazione con client_id,
      redirect_uri e scope reali risponde **302 verso la pagina di accesso** —
      nessun `redirect_uri_mismatch`, `invalid_client` o `invalid_scope`.

⚠️ **Da aggiungere nella schermata di consenso**: agli scope dichiarati vanno
affiancati `openid` e `email`. Servono a sapere CHI ha autorizzato, senza cui
il controllo dell'account sopra non esisterebbe. Sono scope **non sensibili**:
non allungano la verifica.

### Due difetti trovati provando in UI (20/08)

**1. `permission denied for table google_calendar_connections`.** Le migration
girano come `migrator`, il backend si connette come `clinico_<alias>_svc`: una
tabella nuova nasce senza grant per lui. Il modello c'era già nelle migration
precedenti (1793, 1800, 1803, 1806) e la 1820 non lo seguiva. Aggiunto il
blocco `GRANT ... TO %I` su tutti i ruoli `%_svc`. **Da ricordare per ogni
nuova tabella.**

**2. L'errore era travestito da diagnosi sbagliata.** Il pannello mostrava
"questo operatore non ha un utente del gestionale collegato" — falso, tutti e
18 ce l'hanno — perché in caso di errore il container azzerava lo stato e la
UI cadeva nel ramo "nessun utente". Un guasto raccontato come diagnosi manda a
cercare il problema dalla parte sbagliata: ora c'è uno stato di errore
distinto, col messaggio vero. Stessa correzione applicata al pannello ICS, che
aveva lo stesso difetto in forma più benigna (un errore sembrava "feed non
ancora attivo").

**Push degli eventi — fatto il 21/08.** Il collegamento creava il calendario
ma restava vuoto: mancava proprio questa parte.

- [x] **Regole condivise** in `external-event-content.util.ts`: titolo,
      descrizione e luogo li decide un solo posto, usato sia dal feed ICS sia
      dal push Google. Sono due canali diversi ma la domanda è la stessa —
      quanto di un paziente esce dal gestionale — e due copie della risposta
      divergerebbero proprio sulle scelte di riservatezza.
- [x] **Nessuna tabella di corrispondenza** fra appuntamenti ed eventi: l'id
      dell'evento su Google è l'UUID dell'appuntamento senza trattini (le 32
      cifre esadecimali stanno tutte nell'alfabeto base32hex che Google
      richiede). Una mappatura in più sarebbe una cosa in più da tenere
      allineata, e risincronizzare due volte non crea doppioni.
- [x] **Push immediato** su creazione, modifica, disdetta ed eliminazione,
      con 3 tentativi. Agganciato a `createSingleAppointment` (l'imbuto di
      tutte le creazioni: singole, serie, palestra), `update` e i due percorsi
      di cancellazione. Sempre **fire-and-forget**: un rallentamento di Google
      non deve tradursi in una segreteria che aspetta.
- [x] **Riconciliazione ogni 10 minuti** (`GoogleCalendarReconcileJob`), che
      rende la correttezza **indipendente dall'aver agganciato ogni singola
      scrittura**: operazioni massive, spostamenti di serie e cambi di stato
      automatici rientrano comunque. Al massimo l'operatore vede una modifica
      con qualche minuto di ritardo, mai un calendario sbagliato per sempre.
- [x] **Riversata iniziale** subito dopo il collegamento: chi autorizza si
      aspetta di trovare la propria agenda, non un calendario che si popola
      col tempo.
- [x] **Pulsante "Sincronizza adesso"** nel pannello, utile dopo un cambio
      delle impostazioni di riservatezza o per verificare senza attendere.
- [x] Orari come data-ora locale + `timeZone: Europe/Rome`: la conversione la
      fa Google. Nessuna aritmetica sui fusi da mantenere, a differenza
      dell'ICS dove il formato impone UTC.

**Verificato in produzione il 21/08**: il ciclo automatico ha riversato
**31 appuntamenti su 31** nel calendario "BDQ" di `marco.gosso@gmail.com`,
nessun errore, `lastSyncAt` valorizzato.

**Ancora da fare:**
- [ ] Conferma visiva da Marco che gli eventi compaiano davvero in Google
- [ ] Verifica Google in corso: finché l'app è in "Testing" i token scadono
      ogni 7 giorni e serve ricollegare

---

# BLOCCO C — punto 9: notifiche multicanale (WhatsApp / Email / SMS)

**Buona notizia: i driver esistono già tutti**, nel repo
`/home/marco/whatsapp-gateway`. Manca il collegamento al flusso appuntamenti.

| Canale | Driver esistente | Config per tenant |
|---|---|---|
| Email | `src/email/smtp.driver.ts` (nodemailer) | OpenBao `mail/<tenant>/smtp`, fallback relay condiviso `mail/saas-relay` con mittente del tenant |
| SMS — gateway GSM in LAN | `src/sms/personal-gsm.driver.ts` | OpenBao `sms/<tenant>/gsm_gateway` (`base_url`, `api_key`, `http_method`, `path`, `auth_style`) |
| SMS — provider commerciale | `src/sms/skebby.driver.ts` | OpenBao `sms/<tenant>/skebby` |
| WhatsApp | Evolution, già in produzione | OpenBao `kv/whatsapp/{tenant}/` |

E il **motore di fallback fra canali è già scritto**:
`src/otp/otp-delivery.service.ts` — priorità canali, salto dei canali senza
recapito, controllo "questo numero è su WhatsApp?", audit. Oggi lo usa solo il
flusso OTP delle firme.

### Da fare

- [ ] **Gateway**: generalizzare `OtpDeliveryService` in un
      `NotificationDeliveryService` (o estrarne la parte di piano-canali) ed
      esporre `POST /notify/send` con `{ channels[], phone?, email?, subject?,
      message, correlationId }`. Non duplicare la logica: l'OTP deve
      continuare a passare dallo stesso motore.
- [ ] **Gateway**: endpoint di scrittura config sul modello di
      `POST /whatsapp/config/evolution-key` (`src/controllers/whatsapp.controller.ts:93`)
      per SMTP e gateway SMS. ⚠️ **Mai toccare a mano policy o credenziali
      OpenBao senza Marco.**
- [ ] **Clinico — impostazioni generali** (`frontend/src/app/components/settings/`,
      backend `modules/settings/`): sezione "Comunicazioni" con
      - modalità: *solo fallback* / *scelta per paziente* / *entrambe* (D4)
      - canale predefinito e ordine di fallback
      - configurazione SMTP del tenant **oppure** relay Curandis, con "invia
        email di prova"
      - configurazione gateway SMS, con "invia SMS di prova" (testabile sul
        gateway GSM in LAN di Marco)
- [ ] **Preferenza canale per paziente** — *decisione aperta*: sta nel registry
      (che è il master dei contatti e ha già l'email del soggetto fra i
      `contacts` di tipo EMAIL) o resta locale al clinico? Propendo per il
      registry, accanto ai contatti, perché è "come lo studio contatta questa
      persona". Da chiudere con Marco prima di scrivere codice.
- [ ] **Template**: oggi esistono `RECAP_SINGLE`, `RECAP_MULTI`, `REMINDER_24H`
      (`backend/src/modules/whatsapp/enums/whatsapp-enums.ts`). Servono le
      varianti email (con oggetto) e SMS (corte, attenzione ai 160 caratteri e
      ai costi). Riusare l'editor template già presente.
- [ ] **Recupero email paziente**: `fetchPatientContactAsService()`
      (`availability-appointment.service.ts:2545`) oggi estrae solo MOBILE e
      PHONE — aggiungere EMAIL via `primaryContactValue(subject, ['EMAIL'])`.
- [ ] **Log e monitor**: le comunicazioni email/SMS devono finire nello stesso
      registro delle WhatsApp, altrimenti nessuno sa se il paziente è stato
      avvisato.

---

## Migliorie proposte (da decidere, non ancora approvate)

1. **Punto 4 esteso allo spostamento**: oggi la conferma "fuori disponibilità"
   riguarda creazione e modifica dal dialog; ha senso anche sul drag&drop e
   sull'incolla, che sono i modi più veloci per sbagliare orario.
2. **Punto 2, memoria della finestra**: salvare posizione e dimensione del
   dialog in `localStorage` per utente, come si fa in un gestionale desktop.
   Vale per tutte le finestre trascinabili, non solo questa.
3. **Punto 6, stampa/esport dell'elenco filtrato**: una volta che si può
   filtrare per operatore e periodo, il passo naturale è stampare l'agenda di
   un operatore o esportarla. Costo basso, valore alto per la segreteria.
4. **Punto 1 e punto 8 si incontrano**: modellare le ricorrenze con nomi
   RRULE (`BYDAY`, ordinali, `-1` = ultimo) permette al feed ICS di emettere
   `RRULE` invece di un evento per occorrenza. Già tenuto in conto nel modello
   dati proposto al punto 1.
5. **Punto 9, promemoria e non solo recap**: una volta acceso il multicanale,
   anche il promemoria del giorno prima dovrebbe seguire la stessa logica di
   canale, altrimenti il paziente senza WhatsApp riceve la conferma via email
   ma non il promemoria.

---

## Note operative da non perdere

- **Migration clinico**: registrare secondo la checklist e passare **sempre**
  il tenant (`npm run migration:run -- --tenant X`): il DB di default è il
  legacy `calendar_db`.
- **Architettura frontend a 5 strati obbligatoria**
  (`frontend/src/app/architettura-componenti.md`): niente GraphQL nei
  componenti, business logic nei service, `OnPush`, niente `any`.
- **Librerie condivise**: i pacchetti `@curandis` arrivano dal package registry
  GitLab, non più da tarball locali.
- **Gateway WhatsApp**: dopo una modifica serve **rebuild** del container, non
  un semplice restart.
