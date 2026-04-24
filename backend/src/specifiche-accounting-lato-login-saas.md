# Specifiche Integrazione Accounting — lato login-saas

> **Destinatario:** team accounting + team login-saas
> **Versione:** 1.0 — 2026-04-22
> **Risposta a:** `specifiche-accounting.md` v1.0 (2026-04-21)
> **Scopo:** allineamento concreto sui punti di integrazione, risposta alle domande aperte del §13 e proposta di contratto operativo tra i due moduli.

---

## 1. Principi di confine (ribadizione)

Prima di entrare nel tecnico, fisso i principi condivisi emersi nella conversazione:

- **Dominio clinico (login-saas):** trattamento, operatore, cartella clinica, paziente (anagrafica operativa).
- **Dominio contabile (accounting):** party, documenti, convenzioni, sconti, IVA, piano dei conti, SDI, TS, scadenzario, incassi, riconciliazione.
- **login-saas NON duplica mai logica contabile.** Niente dropdown convenzioni, niente calcolo sconti, niente selezione party diversi dal paziente dentro login-saas.
- **login-saas comanda azioni semplici** (import evento, emetti fattura "standard", registra incasso "semplice") via REST.
- Per **operazioni complesse** (scelta party alternativo, convenzioni, proforma+conversione, fatture cumulative con regole custom, riconciliazione bonifici) il login-saas fa **deep-link** alla UI nativa di accounting pre-caricata sul contesto trattamento/paziente.
- **Contabilità notifica login-saas** via eventi (RabbitMQ o webhook) quando cambia lo stato di un documento legato a un trattamento (es. fattura emessa, pagamento ricevuto, SDI delivered).
- **login-saas mantiene una cache read-only** dello stato fatturazione sul `Treatment` (invalidata da eventi contabili). Il DB del login-saas non è mai fonte di verità fiscale.

Questi principi si riflettono nel resto del documento.

---

## 1bis. Mapping e sincronizzazione anagrafiche/party

Capitolo dedicato perché è il fondamento dell'integrazione e va scritto nero su bianco.

### 1bis.1 Ownership dei campi anagrafici

Non esiste "l'anagrafica sta qui o là". Ogni **campo** ha un owner ben definito:

| Campo | Owner | Dove vive | Commento |
|---|---|---|---|
| `firstName`, `lastName` | login-saas | DB clinico | Nome/cognome paziente, il clinico lo usa dappertutto |
| `birthDate` | login-saas | DB clinico | Dato clinico-anagrafico |
| `taxCode` (CF) | login-saas | DB clinico | Obbligatorio per prestazione sanitaria |
| `email` base | login-saas | DB clinico | Per contattare il paziente |
| `phone` base | login-saas | DB clinico | Per contattare il paziente |
| `allergie`, `terapie`, `cartella clinica` | login-saas | DB clinico | Dominio clinico puro |
| `email` fatturazione, `pecEmail`, `sdiCode` | accounting | DB accounting | Dati fiscali specifici |
| `vatNumber` (P.IVA) | accounting | DB accounting | Solo per party azienda/collaboratore |
| `legalName`, `partyType`, `billingAddresses[]` | accounting | DB accounting | Dati fiscali/commerciali |
| `bankAccounts[]`, `billingProfiles[]` | accounting | DB accounting | Dominio contabile puro |
| Party NON-pazienti (aziende, PA, assicurazioni) | accounting | DB accounting | login-saas non li vede mai |

**Regola:** il login-saas espone il paziente; accounting espone il party. Il paziente può coincidere col party ("Mario Rossi paziente = Mario Rossi party"), ma non sempre: può esistere un party "Assicurazione XYZ" che paga per tanti pazienti senza che XYZ sia un paziente.

### 1bis.2 Come sono collegati

Accounting tiene due campi per ogni party di origine clinica:

| Campo accounting | Valore | Significato |
|---|---|---|
| `parties.sourceSystem` | `'CLINICAL'` | Chi ha creato il party |
| `parties.sourcePartyId` | UUID del paziente in login-saas | Link al mondo clinico |

La coppia `(sourceSystem, sourcePartyId)` è **unique** su accounting. Un party clinico ↔ un paziente login-saas, 1:1.

Dal lato login-saas, per evitare di chiedere ogni volta ad accounting "chi è il party di questo paziente?", cachiamo l'id:

```sql
ALTER TABLE patients ADD COLUMN accounting_party_id UUID NULL;
```

Il risultato è una relazione bidirezionale esplicita:

```
┌────────────────────────┐                    ┌────────────────────────┐
│  login-saas            │                    │  accounting            │
│  patients              │                    │  parties               │
├────────────────────────┤                    ├────────────────────────┤
│  id (patientId)     ◀──┼────────────────────┼──▶ sourcePartyId       │
│                        │                    │  sourceSystem='CLINICAL'│
│  accounting_party_id ──┼───────────────────▶│  id (accountingPartyId)│
│  (cache)               │                    │                        │
└────────────────────────┘                    └────────────────────────┘
```

### 1bis.3 Sync iniziale: paziente nuovo

Quando la segreteria crea un nuovo paziente in login-saas:

```
login-saas                          RabbitMQ                     accounting
──────────                          ────────                     ──────────
1. INSERT INTO patients
2. publish patient.created     ──▶  clinical.events/patient.created
                                    routing-key: patient.created
                                    payload: { patientId, billingInfo:{...} }
                                                                  │
                                                                  ▼
                                           3. consume da queue accounting.patient.sync
                                           4. lookup per (sourceSystem='CLINICAL', sourcePartyId)
                                              - se esiste → aggiorna
                                              - se non esiste per sourcePartyId ma c'è un party
                                                con stesso taxCode → auto-link (riusa party esistente)
                                              - altrimenti → CREATE party
                                           5. party.status = ACTIVE
                                              masteringMode = EXTERNAL_MASTER
```

Questo è il flusso "normale" documentato dall'accounting al §3.

### 1bis.4 Il problema del gap sincrono/asincrono

Scenario: la segreteria crea un paziente e **subito dopo** (stesso minuto) chiude un trattamento e clicca "Fattura rapida".

1. `POST /patients` → login-saas salva, pubblica RabbitMQ `patient.created`.
2. L'utente chiude il trattamento → `POST /billable-events/import` con `payerAllocations[0].payerPartyId = ???`.

Problema: **login-saas non conosce ancora l'`accountingPartyId`** perché il messaggio RabbitMQ potrebbe essere ancora in coda (pochi ms o qualche secondo di latenza). Serve un modo di recuperare l'id in modo sincrono.

### 1bis.5 Soluzione: endpoint `GET /parties/by-source`

**Richiesta formale al team accounting:** endpoint sincrono per risolvere `sourceSystem + sourcePartyId → accountingPartyId`:

```
GET /api/v1/accounting/parties/by-source?sourceSystem=CLINICAL&sourcePartyId=<patientId>

Risposta 200:
{
  "id": "uuid-accounting-party",
  "sourceSystem": "CLINICAL",
  "sourcePartyId": "<uuid-paziente-clinico>",
  "partyType": "INDIVIDUAL",
  "firstName": "Mario",
  "lastName": "Rossi",
  "taxCode": "..."
}

Risposta 404:
Party non trovato. Il login-saas ritenta dopo breve delay,
oppure forza creazione sincrona inviando un POST /parties
con i dati anagrafici.
```

**Flusso di uso lato login-saas** (prima di ogni chiamata che richiede `accountingPartyId`):

```typescript
async function getAccountingPartyId(patient: Patient): Promise<string> {
  // 1. Cache hit
  if (patient.accounting_party_id) return patient.accounting_party_id;

  // 2. Cache miss: chiedi ad accounting
  try {
    const party = await accountingApi.get(
      `/parties/by-source?sourceSystem=CLINICAL&sourcePartyId=${patient.id}`,
    );
    // Aggiorna cache
    await db.update('patients', patient.id, {
      accounting_party_id: party.id,
    });
    return party.id;
  } catch (err) {
    if (err.status === 404) {
      // 3. Party non esiste ancora in accounting (race con RabbitMQ)
      // → forza creazione sincrona
      const created = await accountingApi.post('/parties', {
        sourceSystem: 'CLINICAL',
        sourcePartyId: patient.id,
        partyType: 'INDIVIDUAL',
        firstName: patient.firstName,
        lastName: patient.lastName,
        taxCode: patient.taxCode,
        // ...
      });
      await db.update('patients', patient.id, {
        accounting_party_id: created.id,
      });
      return created.id;
    }
    throw err;
  }
}
```

**Alternativa senza nuovo endpoint** (peggio): login-saas usa **solo** RabbitMQ e attende che il party sia creato prima di tentare import (polling di qualche secondo, timeout, retry). Fragile, sconsigliato.

**Alternativa `POST /parties` diretta** (funziona oggi secondo §5.1 accounting): login-saas salta RabbitMQ e crea il party direttamente via HTTP, salvandone subito l'id. Pro: flusso sincrono semplice. Contro: duplica la logica di sync (RabbitMQ diventa inutile?). **Non proponiamo** questo, perché RabbitMQ è già lo strumento per tenere allineate le anagrafiche e vogliamo mantenerlo.

### 1bis.6 Sync incrementale: modifica paziente

Quando login-saas aggiorna un paziente (es. cambio CF):

```
login-saas                          RabbitMQ                     accounting
──────────                          ────────                     ──────────
1. UPDATE patients SET ...
2. publish patient.updated     ──▶                              ──▶ consume
                                                                    find by (CLINICAL, patientId)
                                                                    update ONLY campi CLINICAL-owned
                                                                    (NON tocca email/pec/sdi/addresses)
```

Convenzione: l'evento `patient.updated` porta **tutti i campi anagrafici** (anche quelli contabili), ma accounting ignora i campi di sua ownership. Questa è la regola salva-vita perché evita che una modifica lato clinico distrugga i dati fiscali curati manualmente da contabilità.

### 1bis.7 Sync inverso: modifica party in accounting

Se l'operatore contabile modifica email, telefono, indirizzo del party in accounting, login-saas dovrebbe (eventualmente) aggiornarli lato clinico. **Oggi non esiste** questo sync (§4.5 di questo doc, domanda #5 accounting).

Proposta: accounting pubblica `party.updated` su un **exchange outbound** (lo stesso `accounting.events` di §4.2) quando cambiano i campi di sua ownership. login-saas li consuma e aggiorna **solo i campi presenti nel payload e di ownership condivisa** (es. `email`, `phone`, se sono in login-saas li aggiorna; se invece sono fiscali-only login-saas li ignora).

**Priorità: media.** Si parte senza; si aggiunge quando la segreteria segnala disallineamenti.

### 1bis.8 Party NON-pazienti

Esempi: azienda "Seven Star ASD" convenzionata, assicurazione "UnipolSai", ente pubblico "ASL Cuneo".

- Nascono **solo** in accounting (via UI contabile).
- `sourceSystem = NULL` o `'ACCOUNTING'` (master interno).
- Login-saas non li conosce e non li mostrerà mai.
- Se una fattura di un trattamento è intestata a uno di questi, login-saas riceve via evento RabbitMQ `sales-document.issued` con il campo `billedPartySnapshot` (snapshot immutabile) e può mostrarlo in sola lettura nel dialog trattamento ("Fatturato a: Seven Star ASD").

```
┌────────────────────────┐                    ┌────────────────────────┐
│  login-saas            │                    │  accounting            │
│                        │                    │  parties               │
│   (niente)             │                    ├────────────────────────┤
│                        │                    │  sourceSystem=NULL     │
│                        │                    │  o 'ACCOUNTING'        │
│                        │                    │  partyType=COMPANY     │
│                        │                    │  (aziende, assicurazioni│
│                        │                    │   enti convenzionati)  │
└────────────────────────┘                    └────────────────────────┘
```

### 1bis.9 Schema riassuntivo

```
FLUSSO NORMALE (paziente nuovo):

  login-saas                    RabbitMQ                    accounting
  ──────────                    ────────                    ──────────
  crea Patient ──▶ publish patient.created  ──▶ consume ──▶ crea Party
                                                            auto-link per CF se già esiste

LOOKUP accountingPartyId (prima del billable-event):

  login-saas                                               accounting
  ──────────                                               ──────────
  se patients.accounting_party_id è NULL:
    GET /parties/by-source?sourceSystem=CLINICAL
                         &sourcePartyId=<patientId> ──────▶ ritorna { id } o 404
    se 404: POST /parties (creazione sincrona)    ──────▶ ritorna { id }
  salva id in patients.accounting_party_id

IMPORT BILLABLE EVENT:

  login-saas                                               accounting
  ──────────                                               ──────────
  POST /billable-events/import
    { sourcePatientId, payerAllocations: [
      { payerPartyId: <accountingPartyId cached> }
    ]} ──────────────────────────────────────▶          crea BillableEvent
                                                        collega al party
                                                ◀─────  response { id, accountingStatus }

AGGIORNAMENTO PAZIENTE (login-saas → accounting):

  login-saas                    RabbitMQ                    accounting
  ──────────                    ────────                    ──────────
  update Patient ──▶ publish patient.updated  ──▶ consume ──▶ update Party
                                                              (solo campi CLINICAL-owned)

AGGIORNAMENTO PARTY (accounting → login-saas, futuro):

  accounting                    RabbitMQ                    login-saas
  ──────────                    ────────                    ──────────
  update party
  (campi contabili) ──▶ publish party.updated ──▶ consume ──▶ update patients
                                                              (se campi condivisi
                                                               come email/phone)
```

### 1bis.10 Domande al team accounting su questo capitolo

Aggiunte alle domande §7 (elencate anche qui per chiarezza):

- Esiste o verrà creato `GET /parties/by-source?sourceSystem=X&sourcePartyId=Y`? È critico per evitare race condition sync/async.
- La risposta di `POST /billable-events/import` include `payerAllocations[].payerPartyId` valorizzato? (Se sì, possiamo usare questo come meccanismo di cache invece di `GET /parties/by-source`.)
- `POST /parties` accetta `sourceSystem=CLINICAL` + `sourcePartyId` dal login-saas? (come fallback sincrono quando RabbitMQ non ha ancora consumato.)
- L'accounting pubblicherà `party.updated` sull'exchange outbound `accounting.events` per i sync inversi?

---

## 2. Cosa faremo DENTRO login-saas

### 2.1 Pannello "Fatturazione" nel dialog trattamento

Dentro il dialog dettaglio trattamento, tab **"Fatturazione"** con:

- **Stato corrente** (letto dalla cache `Treatment.billing_status` aggiornata dagli eventi contabili):
  - `pending` → "Non inviato alla contabilità"
  - `imported` → "In attesa di fatturazione (evento inviato n. <billableEventId>)"
  - `proforma_issued` → "Proforma emessa n. X del gg/mm/aaaa"
  - `invoice_draft` → "Fattura in bozza (non ancora emessa)"
  - `invoice_issued` → "Fatturato n. Y del gg/mm/aaaa"
  - `partially_paid` / `paid` → "Pagato totale/parziale"
  - `cancelled` → "Annullato"
  - Importo totale, outstanding, data documento, convenzione applicata (solo display, letti da accounting)

- **Azioni disponibili** (mutuamente esclusive in base a `billing_status`):

  **Quando `billing_status` è null o `pending`:**
  - `[Invia al sistema di fatturazione]` → `POST /billable-events/import` (crea solo l'evento fatturabile lato accounting in stato `pending`, nessun documento emesso). La segreteria potrà poi decidere se/come fatturarlo, anche dall'interfaccia accounting. Utile quando si vuole accumulare trattamenti per **fatturazione cumulativa fine mese** o quando la decisione (proforma/fattura/intestatario) va presa dopo.
  - `[Fattura rapida]` → chain atomica: `POST /billable-events/import` + `POST /sales-documents/invoices` + `POST /:id/issue`. In un click: evento creato + fattura emessa con numero. Payload minimale: paziente come intestatario, nessuna convenzione specifica, tax code dal servizio, prezzo da listino.
  - `[Emetti proforma]` → stessa chain ma `/sales-documents/proformas` al posto di invoices. L'evento resta `pending` (§4.4 accounting), verrà "chiuso" solo alla conversione in fattura.

  **Quando `billing_status = imported`** (trattamento già inviato come billable-event ma nessun documento ancora):
  - `[Fattura rapida]` → `POST /sales-documents/invoices` + `issue` (riusa l'evento già importato).
  - `[Emetti proforma]` → stessa cosa per proforma.
  - `[Apri in Contabilità ↗]` → per scenari complessi.

  **Quando `billing_status = invoice_issued / partially_paid`** e presente un documento:
  - `[Scarica PDF fattura]` → `GET /sales-documents/:id/pdf` (per stampa immediata al cliente).
  - `[Registra incasso rapido]` → `POST /payments/receipts` con form minimo (metodo, importo, data, riferimento).
  - `[Apri in Contabilità ↗]` → per modifiche, annullamenti, note credito, allocazioni complesse.

  **Quando `billing_status = paid`:**
  - `[Scarica PDF fattura]`.
  - `[Apri in Contabilità ↗]`.

- **Deep link esteso**: sempre presente `[Apri in Contabilità ↗]` → nuova tab `https://accounting.{tenant}.curandis.cloud/documents?treatmentId={id}` (oppure `?billableEventId=X` / `?salesDocumentId=Y` a seconda del contesto disponibile) per qualunque operazione che richieda UI completa.

### 2.1.1 Concettualmente: cosa fa il pulsante "Invia" vs "Fattura rapida"

È il punto che conviene chiarire per evitare ambiguità future:

- **"Invia al sistema di fatturazione"** = 1 chiamata (`import billable-event`). Accounting prende in carico il trattamento ma **non emette nessun documento**. La segreteria decide dopo cosa farne (dal login-saas o direttamente in accounting). Utile per accumulare, per fatture cumulative fine mese, per casi dove la decisione richiede informazioni non disponibili subito (es. "il cliente vuole bonifico o pagamento immediato?").

- **"Fattura rapida"** = 3 chiamate in sequenza (`import` + `invoices` + `issue`). Accounting prende in carico **e emette la fattura nello stesso istante**. Utile per il caso più frequente: "il paziente ha pagato, gli do la fattura subito, fine della storia".

- **"Emetti proforma"** = analoga a "Fattura rapida" ma genera proforma invece di fattura. Utile per il caso: "il cliente pagherà con bonifico, gli do la proforma, quando arriva il bonifico converto in fattura".

Il backend accounting non ha (e non deve avere) un endpoint separato "fattura rapida": è il login-saas che chaina 3 chiamate. Questo mantiene l'API accounting pulita e permette di variare la chain (es. in futuro "fattura con applicazione convenzione X" = una variante client-side). Se la chain di 3 chiamate va in errore a metà, il login-saas può:
- segnalare errore all'utente con info specifica (es. "evento creato ma fattura non emessa")
- permettere retry della sola parte fallita

Idempotency-Key sulle chiamate garantisce che un retry non crei duplicati.

### 2.2 Vista batch "Fatturazione mensile"

Nella pagina `/trattamenti` esistente, con selezione multipla dalla lista:

- **Selezione multi-trattamento** con checkbox (già implementata oggi).
- **Pulsante `[Invia al sistema di fatturazione]`** sulla toolbar batch → per ogni trattamento selezionato fa `POST /billable-events/import`. I trattamenti passano da `billing_status=null` a `imported`. Utile per pre-caricare N trattamenti in accounting senza decidere subito il documento.
- **Pulsante `[Fattura cumulativa]`** sulla toolbar batch → visibile solo quando tutti i trattamenti selezionati appartengono allo **stesso paziente** (altrimenti non ha senso generare una fattura unica). Chain:
  1. Per ogni trattamento non ancora `imported`: `POST /billable-events/import` (idempotente).
  2. `POST /sales-documents/invoices` con `billableEventIds: [...]` di tutti i trattamenti → una fattura sola con N righe.
  3. `POST /:id/issue`.
- **Attivo solo se**: tutti `readyForBilling=true`, nessuno già fatturato, nessuno con `scontoFE=true`.
- **Scenario multi-paziente** (es. "a fine mese fattura tutti i pronti"): il login-saas raggruppa client-side per paziente e **itera** `POST /sales-documents/invoices` una volta per paziente. Ciascuna iterazione produce una fattura. Se verrà aggiunto un endpoint batch lato accounting (domanda #4), lo useremo; per ora va bene parallelismo con max-concurrency = 10.

### 2.3 Cache locale di mapping

Il login-saas mantiene nel proprio DB:

| Tabella | Colonne nuove | Scopo |
|---|---|---|
| `treatments` | `billable_event_id UUID NULL` | Id evento accounting dopo import |
| `treatments` | `accounting_document_id UUID NULL` | Id documento vendita (quando fatturato) |
| `treatments` | `billing_status VARCHAR NULL` | Cache: `pending`, `imported`, `proforma_issued`, `invoice_draft`, `invoice_issued`, `paid`, `partially_paid`, `cancelled` |
| `treatments` | `billing_last_synced_at TIMESTAMP NULL` | Quando la cache è stata aggiornata l'ultima volta |
| `patients` | `accounting_party_id UUID NULL` | Id party dopo primo sync (cache) |

Il campo `billingStatus` del login-saas **non è autoritativo**, è solo un hint per UI rapida. L'accounting rimane fonte di verità; la cache viene aggiornata via eventi RabbitMQ reverse (vedi §4 risposta domanda #2).

---

## 3. Cosa NON faremo DENTRO login-saas (rinvio all'UI accounting)

Elenco esplicito per evitare ambiguità future. Queste operazioni **aprono sempre l'app accounting** via deep link:

- Scelta di un party diverso dal paziente come intestatario (azienda, assicurazione, genitore).
- Selezione/modifica convenzioni, applicazione sconti custom.
- Modifica righe fattura (descrizione, quantità, prezzo unitario) dopo la creazione del documento draft.
- Conversione proforma → fattura (richiede review delle righe).
- Annullamento documento / emissione nota credito.
- Riconciliazione bancaria, allocazioni manuali su scadenze multiple.
- Gestione sinistri assicurativi.
- Invio SDI manuale (quando ci saranno casi di retry).
- Configurazione tenant (organizzazione, sedi, piano conti, metodi pagamento, convenzioni, progressivo SDI).
- Reportistica (fatturato, IVA, scadenzario, CE riclassificato).

Nel dialog trattamento del login-saas compare un unico bottone **"Apri in Contabilità ↗"** che porta l'utente nella pagina accounting giusta.

---

## 4. Risposte alle domande aperte del §13

### 4.1 Risposta domanda #1 — Endpoint `GET /billable-events/:id/document`

**Risposta: sì, altamente utile.** Senza questo endpoint il login-saas deve:
- fare `GET /sales-documents?status=ISSUED` con range data ± alcuni giorni
- pivot client-side su `lines[].billableEventId`
- N+1 se ha molti trattamenti da visualizzare

Con l'endpoint `GET /billable-events/:id/document` una chiamata sola risolve il lookup. **Richiesta formale**: aggiungere.

Payload minimo desiderato nella risposta:
```json
{
  "salesDocumentId": "uuid",
  "documentNumber": "42",
  "documentType": "INVOICE",
  "status": "ISSUED",
  "issueDate": "2026-04-21",
  "totalAmount": "55.00",
  "outstandingAmount": "0.00",
  "paidStatus": "PAID"
}
```

### 4.2 Risposta domanda #2 — Webhook outbound / eventi reverse

**Risposta: sì, sin da subito. Preferenza: RabbitMQ.** Visto che accounting **già espone RabbitMQ in ingresso** (per sync anagrafica), simmetricamente vogliamo che esponga un **exchange di uscita** che il login-saas consuma per aggiornare la cache `Treatment.billingStatus`.

**Proposta contratto:**

| | |
|---|---|
| **Exchange** | `accounting.events` (topic, durable) |
| **Queue lato login-saas** | `clinical.accounting.sync` (durable) |
| **Prefetch** | 20 |
| **DLX/DLQ** | `accounting.events.dlx` / `clinical.dlq.accounting.sync` |

**Routing keys da pubblicare:**

- `billable-event.imported` — conferma che l'import è andato a buon fine (può aiutare in scenari di retry)
- `billable-event.cancelled` — evento annullato (es. dopo nota credito)
- `sales-document.draft-created` — documento creato (DRAFT)
- `sales-document.issued` — documento emesso (numero assegnato)
- `sales-document.cancelled` — documento annullato
- `sales-document.converted` — proforma convertita in fattura
- `payment.received` — incasso registrato, eventuale cambio status documento
- `sdi.delivered` / `sdi.rejected` — esito SDI

**Schema messaggio minimo:**

```json
{
  "schemaVersion": "1.0",
  "occurredAt": "2026-04-21T14:30:00.000Z",
  "eventId": "uuid-v4",
  "eventType": "sales-document.issued",
  "tenantAlias": "bdq",
  "correlationId": "uuid-v4",
  "payload": {
    "salesDocumentId": "uuid",
    "documentNumber": "42",
    "documentType": "INVOICE",
    "status": "ISSUED",
    "totalAmount": "55.00",
    "outstandingAmount": "55.00",
    "issueDate": "2026-04-21",
    "billableEventIds": ["uuid-ev-1", "uuid-ev-2"],
    "sourcePatientId": "uuid-paziente-clinico"
  }
}
```

Il login-saas ha un listener che per ogni messaggio:
1. Trova i `Treatment` con `billable_event_id IN (payload.billableEventIds)`.
2. Aggiorna `treatments.billing_status`, `accounting_document_id`, `billing_last_synced_at`.
3. Emette SSE/websocket per aggiornare le UI aperte (opzionale, nice-to-have).

**Protocollo alternativo (fallback):** se RabbitMQ outbound non è prioritario, un endpoint webhook `POST /api/accounting-events` sul login-saas con HMAC sharing secret va bene come temporaneo. Il contenuto è lo stesso. Ma preferiamo RabbitMQ per coerenza con l'inbound.

### 4.3 Risposta domanda #3 — PDF fattura

**Risposta: sì, priorità ALTA.** Use case login-saas:

- Segreteria emette fattura mentre il paziente è ancora allo sportello → serve stampa/consegna **immediata** del PDF.
- Questo è un workflow quotidiano: la fattura la si stampa e si dà in mano al cliente subito, non si può rimandare.
- Senza endpoint PDF in login-saas la segreteria deve: uscire dal dialog trattamento → aprire accounting → cercare il documento → stampare. Troppi passaggi per un'operazione che accade molte volte al giorno.

**Richiesta:** `GET /api/v1/accounting/sales-documents/:id/pdf` → ritorna binary PDF con `Content-Disposition: attachment; filename="fattura-<numero>.pdf"`.

Layout: standard di accounting va bene per partire, cosmetica si sistema in secondo tempo. **Priorità: alta**, necessario al momento in cui attiviamo il pannello "Fatturazione" nel dialog trattamento (fase 2 della roadmap).

Implementazione login-saas: pulsante "Scarica PDF" nel dialog fatturazione, visibile quando `billing_status` è `invoice_issued`, `partially_paid` o `paid`. Click → chiama l'endpoint, restituisce il file al browser che apre il dialog di download/stampa.

### 4.4 Risposta domanda #4 — Bulk import eventi

**Risposta: utile ma non bloccante.** Il login-saas oggi importa 1 evento alla chiusura del trattamento, con frequenza moderata. Ma per la **fatturazione cumulativa fine mese** c'è un caso in cui importiamo N eventi in uno sprint.

Non è strettamente necessario un endpoint batch di import perché:
- L'import singolo è idempotente (Idempotency-Key + lookup su sourceOperationalSnapshotId).
- Possiamo parallelizzare con Promise.all, max 10 concorrenti per rispettare il server.

**Proposta (da valutare dopo le prime rilevazioni in produzione):** se vediamo che il throughput è un problema, endpoint `POST /billable-events/import-batch` che accetta un array di evento in un'unica richiesta con risposta granulare per ciascuno (successo/idempotent-hit/errore).

**Priorità: bassa.** Partiamo con import singolo.

### 4.5 Risposta domanda #5 — Reverse sync party → clinico

**Risposta: sì, ma con scope limitato.** Il caso d'uso è: l'operatore contabile aggiorna email/telefono/indirizzo del party in accounting. Il login-saas deve vedere la modifica per non mostrare dati obsoleti nel profilo paziente.

**Problema:** il login-saas ha la fonte di verità sui dati **clinici/operativi** del paziente (nome, cognome, data nascita, CF). Se accounting modifica uno di questi, c'è un conflitto di ownership.

**Proposta divisione dei campi:**

| Campo | Ownership | Direzione sync |
|---|---|---|
| `firstName`, `lastName`, `birthDate`, `taxCode` | login-saas (clinico) | login-saas → accounting |
| `email`, `phone`, `addresses[]`, `sdiCode`, `pecEmail` | accounting | accounting → login-saas (quando cambia in accounting) |
| `billingInfo.legalName`, `vatNumber`, `partyType` | accounting | accounting-only (il clinico non li mostra) |

**Contratto:** accounting pubblica eventi `party.updated` su RabbitMQ quando cambiano i campi di sua ownership. Il login-saas li consuma e aggiorna la sua anagrafica paziente per i soli campi "contabili".

**Evento proposto:**

```json
{
  "eventType": "party.updated",
  "payload": {
    "accountingPartyId": "uuid",
    "sourcePatientId": "uuid-paziente-clinico",
    "updatedFields": ["email", "phone", "addresses"],
    "billingInfo": {
      "email": "nuovo@example.com",
      "phone": "+39 333 9999999",
      "addresses": [...]
    }
  }
}
```

**Priorità: media.** Partiamo senza; aggiungiamo quando la segreteria segnala "dati disallineati".

### 4.6 Risposta domanda #6 — Cache/invalidation (ETag/Last-Modified)

**Risposta: sì, utile su lookup poco variabili.** login-saas vuole cachare localmente:
- `GET /payments/methods` (molto stabile)
- `GET /tax/codes` (stabile)
- `GET /conventions` (cambia di rado)
- `GET /services-catalog` (stabile)

**Proposta:** accounting aggiunge `ETag` + `Cache-Control: private, max-age=3600` a questi endpoint. Il login-saas manda `If-None-Match` e riceve 304 se invariato. Con cache 1h su client è sufficiente per UX rapida.

**Priorità: bassa.** Partiamo con polling semplice; aggiungiamo ETag se vediamo pressione sui tempi di risposta.

---

## 5. Flussi UX definiti (dalla parte login-saas)

### 5.1 Flusso "fattura immediata al pagamento in cassa"

Trigger: segreteria chiude trattamento e paziente paga subito.

```
1. Segreteria clicca "Chiudi trattamento" (login-saas)
   → status trattamento: CLOSED, readyForBilling: true
   → (login-saas) POST /billable-events/import automatico in background
     Idempotency-Key = treatmentId
     → salva treatments.billable_event_id
     → billing_status = 'imported'
2. Nel dialog compare "Emetti fattura" (enabled perché billable_event_id presente)
3. Segreteria clicca "Emetti fattura"
   → POST /sales-documents/invoices { accountingPartyId, billableEventIds:[ev.id] }
   → POST /sales-documents/:id/issue
   → evento RabbitMQ sales-document.issued torna al login-saas
   → billing_status = 'invoice_issued', accounting_document_id = <doc>
4. Nel dialog compare "Registra incasso"
5. Segreteria inserisce metodo + importo, conferma
   → POST /payments/receipts
   → evento payment.received torna al login-saas
   → billing_status = 'paid'
```

UX: 3 click, nessun cambio di schermata.

### 5.2 Flusso "proforma → bonifico → fattura"

```
1. Chiudi trattamento (come sopra) → import evento
2. Clic "Emetti proforma" → POST /sales-documents/proformas + /:id/issue
   → billing_status = 'proforma_issued'
3. La segreteria invia la proforma al paziente (via download PDF o email manuale)
4. Settimane dopo, arriva il bonifico
5. (opzione A) segreteria clicca "Registra incasso" dal dialog login-saas
   → POST /payments/receipts con paymentMethodId = bonifico
   → billing_status = 'partially_paid' o 'paid' (evento payment.received)
   → la proforma NON viene convertita automaticamente in fattura
6. (opzione B, più probabile) segreteria clicca "Apri in Contabilità"
   → in accounting fa: registra incasso + converti proforma in fattura + emetti fattura
   → tornano 3 eventi RabbitMQ al login-saas che aggiornano la cache
```

### 5.3 Flusso "fatturazione cumulativa fine mese"

```
1. Fine mese, segreteria apre pagina /trattamenti in modalità "by-patient"
2. Filtra: readyForBilling=true, dateRange=<mese>, isInvoicedToPatient=false
3. Espande il paziente "Rossi Mario" → 5 trattamenti pronti
4. Seleziona tutti i 5 via checkbox → clic "Fattura cumulativa"
5. (login-saas) per ciascun trattamento non ancora importato, chiama /billable-events/import
6. (login-saas) chiama POST /sales-documents/invoices con billableEventIds = [5 ids]
7. (login-saas) chiama POST /:id/issue
8. Accounting risponde con fattura unica (5 righe), login-saas mostra conferma
9. Per il paziente "Bianchi Luigi" ripete (iterazione per paziente)
```

Per ora l'iterazione per paziente è client-side; se il volume cresce, endpoint batch.

### 5.4 Flusso "pagamento parziale / allocazione multipla"

**Non gestito dal login-saas.** Se la segreteria deve registrare un incasso di 100€ da allocare su 3 scadenze diverse, clicca "Apri in Contabilità" → accounting ha la UI dedicata.

---

## 6. Considerazioni tecniche

### 6.1 Party del paziente: come lo conosciamo?

Due opzioni:
- **A)** Il login-saas ottiene `accountingPartyId` dal risponsi del primo `POST /billable-events/import` (che implicitamente crea/collega il party) e lo **cacha** in `patients.accounting_party_id`.
- **B)** Endpoint dedicato `GET /parties/by-source?sourceSystem=CLINICAL&sourcePartyId=<patientId>` che ritorna l'accountingPartyId.

**Preferiamo A** (più semplice, nessuna nuova API). La risposta di `POST /billable-events/import` dovrebbe includere il `partyId` del pagatore principale:

```json
{
  "id": "uuid-billable-event",
  "accountingStatus": "pending",
  "payerAllocations": [
    {
      "payerPartyId": "uuid-accounting-party",  // ← questo lo cachiamo
      "payerRole": "PATIENT",
      "isPrimary": true
    }
  ],
  ...
}
```

**Domanda al team accounting:** confermare che la risposta di `/billable-events/import` include `payerAllocations[].payerPartyId` popolato.

### 6.2 billingInfo in /billable-events/import: sempre obbligatorio?

Se il paziente è già stato sincronizzato via RabbitMQ, il party in accounting esiste già con tutti i dati fiscali. Il `billingInfo` nel body dell'import sembra ridondante.

**Domanda al team accounting:**
- Il `billingInfo` è obbligatorio o posso ometterlo quando `sourcePatientId` punta a un party già sincronizzato?
- Se obbligatorio: è uno snapshot storico (immutabile per tracciabilità del trattamento)? Va bene, allora lo popoliamo al momento dell'import con i dati correnti del paziente.

Se è snapshot storico, stabiliamo che il login-saas **deve** popolare `billingInfo` al momento dell'import con i dati del paziente al tempo T. Se poi in accounting cambiano via UI contabile, resta lo snapshot originale sul `billable_event`.

### 6.3 Multi-sede (siteId)

Il body di `/billable-events/import` richiede `siteId`. Nel login-saas c'è il concetto di sede? Dal dominio attuale sembra di no. Un poliambulatorio può avere più sedi?

**Se sì** (probabile per franchise/poliambulatori grandi): il login-saas deve avere l'informazione di "sede del trattamento" sul `Treatment` o sull'`Operator`. Aggiungere campo opzionale `operator.default_site_id` o `treatment.site_id` quando mappato.

**Se no** (studio singolo): il siteId è sempre lo stesso per quel tenant. Il login-saas lo configura una volta (in una tabella tenant-level tipo `tenant_accounting_config.default_site_id`) e lo include in ogni import.

**Domanda al team accounting:** c'è un endpoint `GET /organizations/:id/sites` che il login-saas può usare al boot per scoprire la sede di default?

### 6.4 TaxCodeId per import

Stesso problema: `/billable-events/import` richiede `taxCodeId`. Il login-saas non conosce gli UUID dei tax code.

**Proposta:**
- Al boot del login-saas, fetch `GET /tax/codes` una volta, cache.
- Sul `Service` del login-saas aggiungere un campo `accounting_tax_code_mapping` (es. codice stringa `"ES10"` o `"IVA22"`).
- Al momento dell'import, il login-saas risolve `Service.accounting_tax_code_mapping → tax_code.id` dal cache.

**Richiesta alla UI accounting:** la pagina di gestione servizi contabili o la pagina tax/codes deve poter essere linkata dalla configurazione di un servizio nel login-saas, perché l'admin clinico deve sapere quale codice IVA associare ad ogni servizio clinico.

### 6.5 Gestione errori FeExcluded

Nel login-saas abbiamo il flag `Treatment.scontoFE`. Dal documento (§4.1) capisco che quando `feExcluded=true` il server ritorna 422.

Il login-saas deve **prima di importare** controllare `treatment.scontoFE` e, se true, **non chiamare** `/billable-events/import`. Già lo facciamo (è parte della regola `readyForBilling` che vieta scontoFE). Nessun problema.

---

## 7. Domande aperte del login-saas verso accounting

Le cose che chiedo formalmente al team accounting, ordinate per criticità:

### Critiche (bloccanti per partire)

1. **Endpoint `GET /parties/by-source?sourceSystem=X&sourcePartyId=Y`**: fondamentale per risolvere `patientId → accountingPartyId` senza race condition con RabbitMQ. (§1bis.5)
2. **Endpoint `GET /billable-events/:id/document`**: evita N+1 quando serve sapere se un trattamento è fatturato. (§4.1)
3. **Exchange RabbitMQ outbound `accounting.events`** per notificare al login-saas i cambi di stato documento/pagamento. (§4.2)
4. **Endpoint `GET /sales-documents/:id/pdf`** (priorità alta, non bassa): serve per stampa immediata al cliente. (§4.3)
5. **Risposta di `POST /billable-events/import` include `payerAllocations[].payerPartyId` valorizzato**? Se sì, può sostituire/completare il lookup di (1). (§6.1)
6. **`POST /parties` accetta `sourceSystem=CLINICAL` + `sourcePartyId`** dal login-saas come fallback sincrono quando RabbitMQ non ha ancora consumato? (§1bis.5)
7. **`billingInfo` nel body di `/billable-events/import` è obbligatorio** anche se paziente già sincronizzato, o posso ometterlo? Se obbligatorio: è snapshot storico immutabile? (§6.2)

### Importanti (da chiarire prima dell'implementazione)

8. **Tax codes**: codici stringa stabili (`ES10`, `IVA22`) oppure solo UUID? login-saas userà i codici stringa per il mapping con i servizi clinici. (§6.4)
9. **Endpoint `GET /organizations/:id/sites`**: esiste? Serve per popolare `siteId` nelle import. (§6.3)
10. **Eventi RabbitMQ outbound `party.updated`**: previsti per sync inverso modifiche email/indirizzo da accounting a login-saas? (§1bis.7)

### Operative (non bloccanti, da decidere presto)

11. **Rate limit pratico**: quante chiamate/secondo dal login-saas durante fatturazione cumulativa? (stima: 50 trattamenti in batch all'ora di picco)
12. **Timeout connessione**: timeout ragionevole per REST? (SDI può andare oltre 10s)
13. **Test/staging**: ambiente di staging disponibile? URL? Credenziali? Reset dei dati di test programmabile?
14. **Bulk import eventi**: endpoint `POST /billable-events/import-batch` previsto? (§4.4, non urgente)
15. **ETag/Last-Modified su lookup stabili** (`/payments/methods`, `/tax/codes`, `/conventions`)? (§4.6, non urgente)

---

## 8. Nuovi requirement per il login-saas derivanti da questo documento

Per chi dovrà implementare lato login-saas:

### 8.1 Migration DB

```sql
ALTER TABLE treatments
  ADD COLUMN billable_event_id UUID NULL,
  ADD COLUMN accounting_document_id UUID NULL,
  ADD COLUMN billing_status VARCHAR(40) NULL,
  ADD COLUMN billing_last_synced_at TIMESTAMP NULL;

ALTER TABLE patients
  ADD COLUMN accounting_party_id UUID NULL;

-- Tabella tenant-level config
CREATE TABLE accounting_integration_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_site_id UUID NOT NULL,
  accounting_base_url TEXT NOT NULL,
  rabbitmq_exchange_in VARCHAR(100) DEFAULT 'clinical.events',
  rabbitmq_exchange_out VARCHAR(100) DEFAULT 'accounting.events',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Mapping servizi → tax code
ALTER TABLE services
  ADD COLUMN accounting_tax_code VARCHAR(20) NULL;
```

### 8.2 Nuovi moduli

- `AccountingBridgeModule` — service HTTP client verso accounting con retry, idempotency key, auth JWT propagation
- `AccountingEventsConsumerModule` — consumer RabbitMQ per `accounting.events`, aggiorna `treatments.billing_status`
- `AccountingEventsProducerModule` — producer per `clinical.events`, pubblica `patient.*` già previsti

### 8.3 Dipendenze

- `amqplib` per RabbitMQ (se non già presente per patient sync)
- nessun'altra dipendenza nuova (REST client = `fetch` nativo o `@nestjs/axios` se già presente)

---

## 9. Roadmap proposta

| Fase | Cosa | Tempi |
|---|---|---|
| **1** | Contratto API: firma documento + creazione endpoint `GET /billable-events/:id/document` (§4.1) + risposta domande §7 | 1 settimana |
| **2** | login-saas: migrations + `AccountingBridgeModule` + UI pannello fatturazione nel dialog trattamento (azioni: import + emetti fattura semplice + registra incasso) | 2 settimane |
| **3** | accounting: exchange RabbitMQ outbound `accounting.events` con gli eventi base (`sales-document.issued`, `payment.received`) | 1 settimana (parallelo a Fase 2) |
| **4** | login-saas: `AccountingEventsConsumer` + aggiornamento cache `billing_status` | 1 settimana |
| **5** | login-saas: vista batch "Fatturazione mensile" con selezione multi-trattamento per paziente | 1 settimana |
| **6** | login-saas: deep-link verso accounting pre-caricato sul contesto trattamento | 2 giorni |
| **7** | accounting: endpoint PDF fattura (§4.3), ETag su lookup (§4.6) | dopo fase 4, 2 settimane |
| **8** | accounting: reverse sync party (§4.5) | dopo fase 5 |
| **9** | Test end-to-end staging, hardening | 1 settimana |

Totale realistico: **6-8 settimane** con i due team che procedono in parallelo.

---

## 10. Changelog

| Data | Versione | Modifiche |
|---|---|---|
| 2026-04-22 | 1.0 | Prima stesura: risposta alle domande aperte del §13 accounting, definizione confini UX, proposta RabbitMQ outbound, roadmap |
| 2026-04-23 | 1.1 | Nuovo capitolo §1bis su mapping/sync anagrafiche e party (ownership per campo, flussi, diagrammi). Richiesta formale endpoint `GET /parties/by-source` per risolvere race sync/async. Chiarimento §2.1 sulle azioni disponibili nel dialog trattamento e differenza concettuale tra "Invia al sistema di fatturazione" e "Fattura rapida". PDF fattura passato a priorità ALTA (stampa al cliente è workflow quotidiano). Riorganizzate domande §7 per criticità. |
