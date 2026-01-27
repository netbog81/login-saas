# Bugfix Risolti

## Fix patientId stringa→numero (RISOLTO)
- Problema: GraphQL serializza ID come stringa, causando errore "Int cannot represent non-integer value"
- Soluzione: Aggiunto `Number()` in `gym-appointment-mat-dialog.component.ts` linea 513

## Fix orderPosition in ServiceInputItem DTO (RISOLTO)
- Problema: orderPosition non definito nel DTO backend
- Soluzione: Aggiunto campo `orderPosition` in `create-availability-appointment.input.ts`

## Fix Multi-Servizio Mapper (RISOLTO)
- Problema: Il mapper `appointment.mapper.ts` non mappava `appointmentServices`
- Soluzione: Aggiunta funzione `mapAppointmentServices()` nel mapper

## Fix AppointmentCardComponent.getServiceName() (RISOLTO)
- Problema: Cercava campo `serviceName` inesistente invece di `appointmentServices[]`
- Soluzione: Modificato metodo per usare `appointmentServices` array con fallback a `service`

## Fix Multi-Servizio EventDialogComponent (RISOLTO)
- Problema: Dialog operatori non supportava multi-servizio
- Soluzione: Integrato `ServiceMultiSelectComponent`, aggiunto `selectedServices[]`, modificato `onSave()`

## Pulsante "Annulla Appuntamento" (IN STANDBY)
- Il pulsante è stato nascosto dalla UI
- L'implementazione richiede un sistema di notifiche generico (feature futura)

## Sotto-menu Operatori New con 3 Pagine (COMPLETATO)
- **Obiettivo**: Aggiungere navigazione secondaria alla sezione "Operatori New"
- **Soluzione implementata**:
  - Creato `OperatorsNewLayoutComponent` con `mat-tab-nav-bar` per sotto-menu
  - Configurate child routes in `app.routes.ts`:
    - `/operatori-new/dashboard` → Dashboard con statistiche
    - `/operatori-new/pazienti` → Lista pazienti con ricerca
    - `/operatori-new/appuntamenti` → Workspace esistente
  - Componenti creati seguendo architettura a 5 strati:
    - **Layout**: `operators-new-layout.component.ts`
    - **Containers**: `operators-dashboard.container.ts`, `operators-patients.container.ts`
    - **Dumb Components**: `StatsCardComponent`, `QuickActionsComponent`, `PatientSearchComponent`, `PatientTableComponent`
    - **Models**: `dashboard-state.model.ts`, `patients-list-state.model.ts`
  - Design responsive con breakpoints per mobile/tablet/desktop

## Selezione Operatore Condivisa tra 3 Pagine (COMPLETATO)
- **Obiettivo**: Dropdown operatore condiviso tra Dashboard, Pazienti e Appuntamenti
- **Comportamento**:
  - Dropdown visibile nell'header del layout (tutte e 3 le pagine)
  - Cambiando operatore, i dati si aggiornano in tutte le pagine
  - Navigando tra le pagine, l'operatore selezionato rimane lo stesso
- **Soluzione implementata**:
  - Creato `OperatorWorkspaceStateService` con pattern BehaviorSubject:
    - `operators$`, `selectedOperator$`, `selectedDate$` come Observable pubblici
    - Metodi: `initialize()`, `setSelectedOperator()`, `setSelectedDate()`, `setToday()`
  - Modificato `OperatorsNewLayoutComponent` con header contenente:
    - `OperatorSelectorComponent` per selezione operatore
    - `DateNavigatorComponent` per selezione data
  - Aggiornati tutti i container per usare il servizio condiviso:
    - `OperatorsDashboardContainer`: statistiche filtrate per operatore
    - `OperatorsPatientsContainer`: mostra info operatore selezionato
    - `OperatorWorkspaceContainer`: rimosso WorkspaceHeader locale, usa state service
  - Pattern seguito: BehaviorSubject (come `AvailabilityStateService`)

## Visualizzazione Cartella Paziente dalla Lista Pazienti (COMPLETATO)
- **Obiettivo**: Aprire la cartella paziente completa quando si clicca su "Visualizza dettagli" nella lista pazienti
- **Comportamento**:
  - Click su icona "eye" nella tabella pazienti → apre dialog modale
  - Dialog contiene la `PatientFolderContainer` completa con tutte le tabs
  - Tabs funzionanti: Trattamenti, Anamnesi, Obiettivi, Documenti
  - Responsive (95vw su mobile, max 1400px su desktop)
- **Soluzione implementata**:
  - Creato `PatientFolderDialogComponent` come wrapper Material Dialog:
    - Header con nome paziente e pulsante chiusura
    - Content con `PatientFolderContainer` esistente
  - Modificato `OperatorsPatientsContainer`:
    - Iniettato `MatDialog`
    - `onPatientView()` apre il dialog con dati paziente e operatorId
  - Architettura seguita: 5 strati (dialog è Layer 1, riusa container Layer 2)

## Fix Scrollbar Lista Pazienti (COMPLETATO)
- **Problema**: La tabella pazienti non mostrava la scrollbar, i dati uscivano dalla viewport
- **Causa**: Catena di `overflow: hidden` senza propagazione corretta dell'altezza tra container
- **Soluzione implementata**:
  - `OperatorsPatientsContainer`: aggiunto `display: flex; flex-direction: column` a `.table-section`
  - `PatientTableComponent`:
    - Aggiunto `.table-wrapper` con `flex: 1; min-height: 0; overflow: auto`
    - Header sticky con `sticky: true` su `matHeaderRowDef`
    - Paginator rimane fisso in basso fuori dal wrapper scrollabile

## Fix 3 Bug Test Valutazione (COMPLETATO)
- **Problema 1**: "Valutazione attuale" non si aggiornava correttamente dopo modifica
- **Problema 2**: Modal storico test non si aggiornava dopo modifica valore nella lista
- **Problema 3**: Pulsante "Annulla" aveva delay multi-secondo prima di rispondere
- **Causa Root**:
  - `loadAnamnesis()` resettava `testsWithEvaluations = []` causando destroy/recreate dei componenti
  - L'aggiornamento ottimistico veniva sovrascritto dal ricaricamento async
  - `ngOnChanges()` in test-history-dialog non rilevava modifiche al contenuto dell'oggetto test
- **Soluzione implementata**:
  - `patient-folder.container.ts`:
    - Rimosso reset array in `loadAnamnesis()` (gli array vengono aggiornati da `populateObjectivesAndTests()`)
    - Rimossa chiamata a `loadAnamnesis()` dopo edit in `onTestEvaluationEdited()` (l'update ottimistico è sufficiente)
  - `test-history-dialog.container.ts`:
    - Convertito `@Input() test` in setter per intercettare modifiche
    - Aggiunto metodo `refreshDialogData()` che crea nuovo riferimento array con spread operator
    - Forza sempre re-render del dialog quando test cambia

## Fix Persistenza Valutazione Test - Backend (COMPLETATO)
- **Problema**: Modifica "Valutazione attuale" non veniva persistita dopo refresh pagina
- **Causa Root**:
  - Backend `editTestEvaluation()` aggiornava solo `test.risultato` ma NON lo storico (`evaluationHistory`)
  - Frontend calcola `currentLevel` da `evaluationHistory[0]`, non da `test.risultato`
  - Risultato: Backend salva 4/5 in test, frontend legge 3/5 da history → mismatch
- **Soluzione implementata**:
  - `backend/patient-anamnesis.service.ts`:
    - Modificato `editTestEvaluation()` per aggiornare anche l'ultima entry dello storico
    - Ora trova `latestEntry` con `order: { createdAt: 'DESC' }` e aggiorna `evaluationLevel`
    - Mantiene consistenza tra `test.risultato` e `evaluationHistory[0]`

## Fix Ordinamento Storico Valutazioni Test (COMPLETATO)
- **Problema**: Dopo modifica valutazione, card mostrava valore vecchio al refresh
- **Causa Root**:
  - Backend restituisce `evaluationHistory` senza ordinamento (ordine DB, tipicamente ASC)
  - Frontend assume `history[0]` = entry più recente, ma era la più vecchia
  - Backend aggiornava entry più recente (con `order: DESC`), frontend leggeva la più vecchia
- **Soluzione implementata**:
  - `patient-folder.container.ts`:
    - Aggiunto `.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())` dopo il mapping
    - Ora `history[0]` è sempre l'entry più recente
    - Applicato sia per `objectiveExam.testSpecifici` che per `monitoring.testSpecifici`

## Fix Aggiornamento Ottimistico Storico Test (COMPLETATO)
- **Problema**: Dopo modifica valutazione, lo storico mostrava ancora il vecchio valore fino al refresh
- **Causa Root**:
  - L'aggiornamento ottimistico aggiornava solo `currentLevel` ma non `evaluationHistory[0]`
  - Quando si apriva lo storico prima del refresh, mostrava i dati vecchi
- **Soluzione implementata**:
  - `patient-folder.container.ts` in `onTestEvaluationEdited()`:
    - L'aggiornamento ottimistico ora aggiorna anche `evaluationHistory[0].evaluationLevel`
    - Crea un nuovo array con la prima entry aggiornata: `[{...history[0], evaluationLevel}, ...history.slice(1)]`

## Fix Aggiornamento Ottimistico Modal Storico Test (COMPLETATO)
- **Problema**: Modifica valutazione dal modal storico non aggiornava la lista fino a chiusura/riapertura
- **Causa Root**:
  - `onEditEntry()` emetteva `entryUpdated` ma non aggiornava `dialogData` localmente
  - Il parent riceveva l'evento e aggiornava i suoi dati, ma il dialog manteneva la copia vecchia
- **Soluzione implementata**:
  - `test-history-dialog.container.ts` in `onEditEntry()`:
    - Aggiunto aggiornamento ottimistico di `dialogData.history` dopo la mutation
    - Mappa le entries e aggiorna quella modificata con i nuovi valori
    - Chiama `cdr.markForCheck()` per triggerare il re-render

## Fix Pulsante "Annulla" Modal Storico Test (COMPLETATO)
- **Problema**: Pulsante "Annulla" nel form di modifica valutazione non rispondeva immediatamente, solo dopo aver mosso il mouse su un'icona
- **Causa Root**:
  - Componente `TestHistoryDialogComponent` ha `ChangeDetectionStrategy.OnPush`
  - NON aveva `ChangeDetectorRef` iniettato
  - I metodi `startEditEntry()`, `cancelEditEntry()` e `toggleSortOrder()` modificavano lo stato locale ma non notificavano Angular
- **Soluzione implementata**:
  - `test-history-dialog.component.ts`:
    - Aggiunto import e injection di `ChangeDetectorRef`
    - Aggiunto `cdr.markForCheck()` in `startEditEntry()`, `cancelEditEntry()` e `toggleSortOrder()`

## Fix Linea Verticale Campo Note (COMPLETATO)
- **Problema**: Campo textarea per le note mostrava una linea verticale visibile (brutta da vedere) nella card del test e nel modal storico
- **Causa Root**:
  - Angular Material MDC crea struttura "notched outline" per `mat-form-field` con `appearance="outline"`
  - `.mdc-notched-outline__notch` ha `border-left` e `border-right` che creano linee verticali ai lati della label
- **Soluzione implementata**:
  - `test-history-dialog.component.ts` - aggiunto fix CSS a `.edit-note-field`
  - `test-evaluation-item.component.ts` - aggiunto fix CSS a `.note-field`
  - Fix: `::ng-deep .mdc-notched-outline__notch { border-left: none !important; border-right: none !important; }`
