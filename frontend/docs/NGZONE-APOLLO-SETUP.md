# NgZone & Apollo GraphQL Setup

## Architettura

### Problema Originale

Il metodo `query()` di apollo-angular NON ha integrazione NgZone nativa. Usa internamente `fromLazyPromise()` che non ha alcun scheduling NgZone.

Quando i dati arrivano dal server GraphQL:
1. Le callback vengono eseguite **fuori dalla zona Angular**
2. `markForCheck()` non funziona (richiede essere già in un ciclo di change detection)
3. L'UI non si aggiorna anche se i dati sono stati caricati correttamente
4. Solo `detectChanges()` manuale forza l'aggiornamento

### Soluzione Implementata

`ApolloZoneService` wrappa tutte le chiamate Apollo e forza l'esecuzione delle callback dentro NgZone. Tutti i servizi GraphQL estendono `BaseGraphQLService` che usa `ApolloZoneService` internamente.

```
┌─────────────────────────────────────────────────────────────┐
│                      COMPONENTI                              │
│  (NON usano mai ngZone.run() o detectChanges() per GraphQL) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVIZI GraphQL                           │
│         (extends BaseGraphQLService)                         │
│                                                              │
│   - PatientService                                           │
│   - OperatorService                                          │
│   - AvailabilityAppointmentService                           │
│   - TherapeuticPathService                                   │
│   - TreatmentService                                         │
│   - GymRoomService                                           │
│   - SettingsService                                          │
│   - ...altri servizi                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  BaseGraphQLService                          │
│   - protected query<T>(query, variables)                     │
│   - protected mutate<T>(mutation, variables, refetch)        │
│   - protected watch<T>(query, variables)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   ApolloZoneService                          │
│   - Wrappa Apollo con NgZone                                 │
│   - Garantisce callback eseguite dentro Angular Zone         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Apollo Client                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Regole d'Oro

### ✅ NEI SERVICES

**Estendere sempre `BaseGraphQLService`:**

```typescript
import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import { GET_PATIENTS, CREATE_PATIENT } from '../graphql/operations/patient.queries';

@Injectable({ providedIn: 'root' })
export class PatientService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getPatients(): Observable<Patient[]> {
    return this.query<{ patients: Patient[] }>(GET_PATIENTS)
      .pipe(map(result => result.patients || []));
  }

  createPatient(input: CreatePatientInput): Observable<Patient> {
    return this.mutate<{ createPatient: Patient }>(
      CREATE_PATIENT,
      { input },
      [{ query: GET_PATIENTS }]  // refetch queries
    ).pipe(map(result => result.createPatient));
  }
}
```

**MAI usare `this.apollo` direttamente** - sempre `this.query()`, `this.mutate()`, `this.watch()`.

### ❌ NEI COMPONENTI

**MAI usare `ngZone.run()` per dati GraphQL:**

```typescript
// ❌ SBAGLIATO
this.patientService.getPatients().subscribe(patients => {
  this.ngZone.run(() => {
    this.patients = patients;
    this.cdr.detectChanges();
  });
});

// ✅ CORRETTO
this.patientService.getPatients().subscribe(patients => {
  this.patients = patients;
  // L'UI si aggiorna automaticamente!
});
```

**MAI usare `detectChanges()` per dati GraphQL:**

```typescript
// ❌ SBAGLIATO
loadData() {
  this.service.getData().subscribe(data => {
    this.data = data;
    this.cdr.detectChanges();  // Non necessario!
  });
}

// ✅ CORRETTO
loadData() {
  this.service.getData().subscribe(data => {
    this.data = data;
  });
}
```

---

## Eccezioni: Quando ngZone.run() È Permesso

In alcuni casi specifici, `ngZone.run()` è ancora necessario:

### 1. setTimeout / setInterval

```typescript
setTimeout(() => {
  this.ngZone.run(() => {
    this.showMessage = false;
  });
}, 3000);
```

### 2. WebSocket / EventSource

```typescript
this.socket.onmessage = (event) => {
  this.ngZone.run(() => {
    this.messages.push(event.data);
  });
};
```

### 3. API Browser (Geolocation, etc.)

```typescript
navigator.geolocation.getCurrentPosition((position) => {
  this.ngZone.run(() => {
    this.location = position.coords;
  });
});
```

### 4. Librerie Esterne (charts, maps, etc.)

```typescript
this.chart.on('click', (event) => {
  this.ngZone.run(() => {
    this.selectedPoint = event.data;
  });
});
```

### 5. EventEmitter in Contesti Speciali (es. ConfirmDialog)

```typescript
// In alcuni casi rari con EventEmitter e overlay CDK
onConfirm(): void {
  this.ngZone.run(() => {
    this.confirmed.emit(true);
  });
}
```

---

## API Reference

### BaseGraphQLService

```typescript
abstract class BaseGraphQLService {
  constructor(injector: Injector);

  // Query one-time con network-only (default)
  protected query<TResult, TVariables = OperationVariables>(
    query: DocumentNode,
    variables?: TVariables,
    fetchPolicy?: FetchPolicy
  ): Observable<TResult>;

  // Mutation con refetch queries opzionale
  protected mutate<TResult, TVariables = OperationVariables>(
    mutation: DocumentNode,
    variables?: TVariables,
    refetchQueries?: Array<{ query: DocumentNode; variables?: Record<string, unknown> }>
  ): Observable<TResult>;

  // Watch query per dati reattivi (cache-and-network)
  protected watch<TResult, TVariables = OperationVariables>(
    query: DocumentNode,
    variables?: TVariables,
    fetchPolicy?: WatchQueryFetchPolicy
  ): Observable<TResult>;

  // Utility per casi speciali
  protected runInZone<T>(fn: () => T): T;
}
```

### ApolloZoneService

```typescript
@Injectable({ providedIn: 'root' })
class ApolloZoneService {
  // Query con NgZone wrapping
  query<TData, TVariables>(options: Apollo.QueryOptions): Observable<TData>;

  // Mutation con NgZone wrapping
  mutate<TData, TVariables>(options: Apollo.MutateOptions): Observable<TData>;

  // Watch query (già ha integrazione NgZone nativa)
  watchQuery<TData, TVariables>(options: Apollo.WatchQueryOptions): Observable<TData>;

  // Utility pubblica
  runInZone<T>(fn: () => T): T;
}
```

---

## Migrazione di un Servizio Esistente

### Prima (usando Apollo direttamente):

```typescript
import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MyService {
  constructor(private apollo: Apollo) {}

  getData(): Observable<Data[]> {
    return this.apollo.query<{ data: Data[] }>({
      query: GET_DATA,
      fetchPolicy: 'network-only'
    }).pipe(map(result => result.data?.data || []));
  }

  createData(input: CreateInput): Observable<Data> {
    return this.apollo.mutate<{ createData: Data }>({
      mutation: CREATE_DATA,
      variables: { input }
    }).pipe(map(result => result.data!.createData));
  }
}
```

### Dopo (usando BaseGraphQLService):

```typescript
import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

@Injectable({ providedIn: 'root' })
export class MyService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getData(): Observable<Data[]> {
    return this.query<{ data: Data[] }>(GET_DATA)
      .pipe(map(result => result.data || []));
  }

  createData(input: CreateInput): Observable<Data> {
    return this.mutate<{ createData: Data }>(
      CREATE_DATA,
      { input },
      [{ query: GET_DATA }]
    ).pipe(map(result => result.createData));
  }
}
```

---

## File Critici

### Core Services
- `frontend/src/app/core/services/apollo-zone.service.ts` - Wrapper NgZone per Apollo
- `frontend/src/app/core/services/base-graphql.service.ts` - Classe base per tutti i servizi GraphQL

### Servizi Migrati
Tutti i servizi in `frontend/src/app/services/*.service.ts` estendono `BaseGraphQLService`.

---

## Troubleshooting

### L'UI non si aggiorna dopo una chiamata GraphQL

1. Verifica che il servizio estenda `BaseGraphQLService`
2. Verifica che usi `this.query()` / `this.mutate()` invece di `this.apollo.query()`
3. NON aggiungere `detectChanges()` - è un workaround, non una soluzione

### Errore "Cannot read property 'query' of undefined"

Il servizio non è stato inizializzato correttamente. Verifica:
```typescript
constructor(injector: Injector) {
  super(injector);  // DEVE chiamare super!
}
```

### watchQuery emette valori multipli

È il comportamento corretto di `watchQuery` con `cache-and-network`:
1. Prima emissione: dati dalla cache (può essere vuota)
2. Seconda emissione: dati dal network

Se usi `firstValueFrom()`, riceverai solo la cache (potenzialmente vuota). Usa `take(1)` solo se hai bisogno di un singolo valore dal network, oppure usa `query()` invece di `watchQuery()`.
