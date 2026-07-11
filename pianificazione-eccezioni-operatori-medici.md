# Pianificazione — Eccezioni e assenze per operatori e medici

Data: 2026-07-06 · Stato: **IMPLEMENTATO (prima iterazione)** — vedi §10.

Decisioni di Marco (2026-07-06):
- **D1**: pagina dedicata "Gestione assenze" nel menu principale, accanto a Statistiche.
- **D2**: sì alle assenze multi-operatore in un colpo (checkbox "Tutti", es. studio chiuso per ferie).
- **D3**: stesso flusso per operatori e medici. Flussi palestra SEPARATI:
  la palestra usa il sostituto, per operatori/medici l'appuntamento si
  SPOSTA (eventualmente su altro operatore) via dialog spostamento.
- **D4**: ATTENDED fuori dai conflitti, MA attenzione agli auto-attended
  scattati da pochi minuti: se non c'è trattamento aperto vanno segnalati
  (la segreteria annulla poi manualmente l'appuntamento). → implementato
  come lista di avviso "ATTENDED senza trattamento" nell'anteprima.

Requisito (Marco): per fisioterapisti e medici serve poter segnare che
l'operatore non è disponibile, scegliendo il tipo di assenza, con tre
granularità: **singolo slot**, **fascia oraria**, **range di giorni (dal…al)**.
Niente sostituto automatico (a differenza della palestra): gli appuntamenti
impattati vanno in conflitto e la segreteria li risolve **spostandoli** con
l'interfaccia di spostamento già esistente (pannello "Spostamento" /
vista guidata del dialog appuntamenti). A valle, i conteggi di fine mese
devono riflettere l'operatore che ha realmente eseguito.

---

## 1. Cosa esiste già (riuso)

| Pezzo | Stato | Note |
|---|---|---|
| `AvailabilityException` (entity) | ✅ esiste | operatorId + exceptionDate + startTime/endTime opzionali + ExceptionType (SICK/VACATION/HOLIDAY/PERSONAL_LEAVE/UNAVAILABLE/MODIFIED) |
| `AvailabilityExceptionService.createVacation/createSickLeave` | ✅ esiste | loop per-giorno su range dal…al — base per il caso multi-day |
| `GroupException` | ✅ esiste | eccezione multi-operatore per singola data (es. chiusura studio) |
| `OperatorAbsenceType` (tipi assenza configurabili) | ✅ esiste | oggi usato SOLO dalla palestra — da riusare qui |
| `AppointmentConflictService.checkConflictsOnException` | ⚠️ **codice morto** | pronto ma mai chiamato: oggi creare un'eccezione operatore NON marca alcun conflitto |
| `resolveConflict` (keep/reschedule/cancel) + pagina `/conflicts` | ✅ esiste | manca l'azione "sposta con ricerca slot" |
| Dialog appuntamenti con pannello "Spostamento" + vista guidata | ✅ esiste | `features/calendar-v3/containers/appuntamenti-dialog.container.ts` — da riusare per la risoluzione |
| Riassegnazione sostituto palestra + ripristino | ✅ fatto 2026-07-06 | pattern di riferimento per apply/restore |

## 2. Modifiche al modello dati (migration 1802)

1. **`availability_exceptions`**:
   - `absenceTypeId uuid NULL` + `absenceTypeSnapshot jsonb NULL` — stesso
     pattern snapshot della palestra (il tipo cancellato non perde lo storico).
   - **Rimozione del vincolo logico "una eccezione per operatore per data"**
     (oggi `create()` rifiuta la seconda): con la granularità a slot/fascia
     servono più eccezioni nello stesso giorno. Sostituito da check di
     **overlap** (rifiuta solo fasce sovrapposte per lo stesso operatore).
   - `sourceGroupId uuid NULL` (o riuso `groupExceptionId`) per legare i
     giorni di un range dal…al creato in un colpo solo → cancellazione di
     tutto il range con un'azione.
2. **`availability_appointments`**:
   - `conflictSourceExceptionId uuid NULL`: QUALE eccezione ha generato il
     conflitto. Oggi il clear è "tutti i conflitti assenza di operatore+data"
     (impreciso, dichiarato come fallback in `clearConflictsByGymExceptionId`).
     Con la colonna il ripristino diventa chirurgico. La userà anche la
     palestra (retrofit).

## 3. Granularità → rappresentazione

| Scelta UI | Persistenza |
|---|---|
| Giorno intero | 1 eccezione senza startTime/endTime |
| Fascia oraria (dalle–alle) | 1 eccezione con startTime/endTime |
| Slot singoli (dal template) | N eccezioni con startTime/endTime = slot selezionati |
| Range di giorni (dal–al) | N eccezioni giorno-intero legate da `sourceGroupId` |

Gli slot selezionabili si derivano dal template di disponibilità
dell'operatore per quel giorno (come fa il dialog palestra con
`operatorPatternsOnDate` — qui l'equivalente è la disponibilità V3).
**Tutti i confronti orari normalizzati a HH:MM** (lezione palestra).

## 4. Flusso eventi — creazione eccezione

```
Dialog "Nuova assenza" (operatore/medico)
  1. seleziona operatore (o più operatori? v. domanda D2)
  2. seleziona tipo di assenza (OperatorAbsenceType attivi)
  3. seleziona granularità: giorno intero | fascia | slot | dal…al
  4. ANTEPRIMA: query dry-run degli appuntamenti impattati
     (SCHEDULED/CONFIRMED che overlappano) mostrata PRIMA del salvataggio
  5. conferma →
     BE: create eccezione/i (transazione)
       → checkConflictsOnException (finalmente agganciato) per ogni eccezione
       → markExceptionConflicts + conflictSourceExceptionId + AppointmentLog
       → SSE `appointment_conflicts_changed` (refresh calendario + badge /conflicts)
```

Il guard `assertWithinAvailability` (blocco prenotazioni fuori
disponibilità) già esclude gli appuntamenti su operatore: le NUOVE
prenotazioni su un operatore assente vanno **bloccate** estendendo il
calcolo della disponibilità V3 per sottrarre le eccezioni (verificare dove:
`availability.service.ts` free-block reali).

## 5. Flusso eventi — risoluzione conflitto (spostamento)

```
Pagina /conflicts → riga appuntamento in conflitto → azione "Sposta"
  → apre il dialog appuntamenti esistente (pannello Spostamento,
    vista passo-passo o guidata) precaricato con paziente + appuntamento
  → l'utente sceglie nuovo slot/operatore → spostamento standard
    (updateAppointment: nuova data/ora/operatore)
  → il BE azzera hasConflict/conflictSourceExceptionId sull'appuntamento
  → log RESCHEDULED già esistente conserva l'audit trail
```

Nessuna logica speciale di fatturazione: l'appuntamento spostato ha il
nuovo operatore, il trattamento creato alla presenza lo copia (già così).

## 6. Flusso eventi — ripristino (eccezione cancellata/ridotta)

```
Delete eccezione (o riduzione fascia in update)
  → clear conflitti WHERE conflictSourceExceptionId = :id
    (solo quelli non ancora risolti: hasConflict = true)
  → gli appuntamenti GIÀ SPOSTATI restano dove sono
    (lo spostamento è un'azione utente esplicita, non si annulla da solo)
  → SSE per refresh UI
Update eccezione = restore + re-apply (pattern palestra: fotografia dei
valori precedenti prima della mutazione)
```

## 7. UI — collocazione

- **Nuova scheda "Assenze" nella pagina operatori** (workspace/config
  operatori): lista assenze future+passate dell'operatore, bottone
  "Nuova assenza" → dialog di cui sopra. Feature-pattern obbligatorio:
  `features/availability/operator-exceptions/` (components/containers/
  services/graphql).
- **Accesso rapido dal calendario**: voce contestuale sull'header colonna
  operatore ("Segna assenza…") che apre lo stesso dialog precompilato
  con operatore+data.
- Badge count conflitti già presente in /conflicts: aggiungere filtro
  per eccezione sorgente ("mostrami i conflitti di QUESTA assenza").

## 8. Ordine di implementazione proposto

1. Migration 1802 + estensione entity (absenceType su AvailabilityException,
   conflictSourceExceptionId su appointment) — piccola.
2. BE: aggancio `checkConflictsOnException` in create/update/delete
   eccezione + overlap-check al posto del vincolo una-per-data + dry-run
   query "appuntamenti impattati" (nuova query GraphQL) + SSE.
3. BE: blocco nuove prenotazioni su operatore assente (disponibilità V3).
4. FE: dialog "Nuova assenza" + scheda Assenze operatore (feature nuova).
5. FE: azione "Sposta" in /conflicts che riusa il dialog spostamento.
6. Retrofit palestra su `conflictSourceExceptionId` (sostituisce il clear
   per operatore+data).

## 9. Domande aperte

Tutte risolte — vedi "Decisioni di Marco" in testa al documento.

## 10. Stato implementazione (2026-07-06)

Fatto (migration 1802 applicata su bdq, type-check BE+FE ok, codegen ok —
**container DA BUILDARE**):

- **Migration 1802**: drop UNIQUE(operatorId, exceptionDate);
  `absenceTypeId`/`absenceTypeSnapshot`/`sourceGroupId` su
  availability_exceptions; `conflictSourceExceptionId` su
  availability_appointments (+ indici parziali).
- **BE** `AvailabilityExceptionService`: `createOperatorAbsences` (batch
  operatori × giorni, finestra oraria opzionale, anti-overlap, snapshot
  tipo assenza, marcatura conflitti con sourceExceptionId),
  `previewAbsenceImpact` (dry-run: conflitti + ATTENDED senza trattamento),
  `deleteAbsenceGroup`, delete/update con clear chirurgico dei conflitti.
- **BE** `AppointmentConflictService`: finestra oraria su qualunque tipo di
  eccezione (non solo MODIFIED), `conflictSourceExceptionId` nel marking,
  `clearConflictsBySourceException`.
- **BE** disponibilità: bulk + V3 free-blocks supportano più eccezioni per
  giorno e assenze a fascia (le fasce template si spezzano attorno
  all'assenza) → le nuove prenotazioni non vedono gli slot in assenza e
  `assertWithinAvailability` blocca gli spostamenti dentro l'assenza.
- **BE** `updateAppointment`: su spostamento/cambio operatore azzera i flag
  conflitto e ri-verifica contro le assenze del nuovo operatore.
- **FE**: pagina **Gestione assenze** (menu accanto a Statistiche, route
  `/gestione-assenze`, feature `features/availability/absence-management/`)
  con lista/filtri/delete singola e di gruppo + dialog "Nuova assenza"
  (multi-operatore con "Tutti", tipo assenza, giorno/range, giornata
  intera/fascia, ANTEPRIMA impatti).
- **FE** `/conflicts`: bottone **Sposta** che apre il dialog Appuntamenti
  del calendario (pannello Spostamento / vista guidata) precaricato su
  paziente+appuntamento; alla chiusura ricarica i conflitti.

Non fatto (backlog):
- Granularità "slot da template" nel dialog (oggi coperta dalla fascia
  oraria libera); quick-pick degli slot del giorno dell'operatore.
- SSE `appointment_conflicts_changed` per badge live sul menu Conflitti.
- Retrofit del clear palestra su `conflictSourceExceptionId` (oggi la
  palestra continua a usare il clear per operatore+data — funziona, meno
  chirurgico).
- Estensione `GroupException` legacy (non usata dal nuovo flusso: i gruppi
  usano `sourceGroupId`).
