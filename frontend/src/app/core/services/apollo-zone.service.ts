import { Injectable, NgZone } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { OperationVariables } from '@apollo/client/core';

/**
 * Wrapper centralizzato per Apollo che garantisce l'esecuzione dentro NgZone.
 *
 * ## Problema Risolto
 * Il metodo `query()` di apollo-angular usa `fromLazyPromise()` che NON ha
 * integrazione NgZone. Le callback vengono eseguite fuori dalla zona Angular,
 * causando mancati aggiornamenti dell'UI.
 *
 * ## Soluzione
 * Questo servizio wrappa tutte le chiamate Apollo e forza l'esecuzione
 * delle callback dentro NgZone, garantendo che Angular rilevi i cambiamenti.
 *
 * ## API Semplificata
 * - `query()` → Restituisce direttamente `Observable<TData>` (non QueryResult)
 * - `mutate()` → Restituisce direttamente `Observable<TData>` (non MutationResult)
 * - `watchQuery()` → Per query reattive che si aggiornano nel tempo
 *
 * @example
 * // Nel servizio (preferibilmente estendendo BaseGraphQLService)
 * getPatients(): Observable<Patient[]> {
 *   return this.apolloZone.query<{ patients: Patient[] }>({
 *     query: GET_PATIENTS,
 *     fetchPolicy: 'network-only'
 *   }).pipe(map(result => result.patients));
 * }
 *
 * createPatient(input: CreatePatientInput): Observable<Patient> {
 *   return this.apolloZone.mutate<{ createPatient: Patient }>({
 *     mutation: CREATE_PATIENT,
 *     variables: { input }
 *   }).pipe(map(result => result.createPatient));
 * }
 */
@Injectable({ providedIn: 'root' })
export class ApolloZoneService {
  constructor(
    private apollo: Apollo,
    private ngZone: NgZone
  ) {}

  /**
   * Esegue una query GraphQL one-time con integrazione NgZone.
   * Restituisce direttamente i dati (non il wrapper QueryResult).
   *
   * IMPORTANTE: Filtriamo emissioni con data undefined/null per evitare
   * errori nei consumatori quando la query fallisce o restituisce dati vuoti.
   *
   * @param options - Opzioni della query Apollo
   * @returns Observable<TData> - I dati della query
   */
  query<TData, TVariables extends OperationVariables = OperationVariables>(
    options: Apollo.QueryOptions<TData, TVariables>
  ): Observable<TData> {
    return this.wrapInZone(
      this.apollo.query<TData, TVariables>(options)
    ).pipe(
      // Filtra emissioni con data undefined/null per evitare errori nei consumatori
      filter(result => result.data !== undefined && result.data !== null),
      map(result => result.data as TData)
    );
  }

  /**
   * Esegue una mutation GraphQL con integrazione NgZone.
   * Restituisce direttamente i dati (non il wrapper MutationResult).
   *
   * IMPORTANTE: Filtriamo emissioni con data undefined/null per evitare
   * errori nei consumatori quando la mutation fallisce o restituisce dati vuoti.
   *
   * @param options - Opzioni della mutation Apollo
   * @returns Observable<TData> - I dati della mutation
   */
  mutate<TData, TVariables extends OperationVariables = OperationVariables>(
    options: Apollo.MutateOptions<TData, TVariables>
  ): Observable<TData> {
    return this.wrapInZone(
      this.apollo.mutate<TData, TVariables>(options)
    ).pipe(
      // Filtra emissioni con data undefined/null per evitare errori nei consumatori
      filter(result => result.data !== undefined && result.data !== null),
      map(result => result.data as TData)
    );
  }

  /**
   * Esegue una watch query GraphQL per dati reattivi.
   * apollo-angular watchQuery() ha già integrazione NgZone nativa.
   * Restituisce direttamente i dati (non il wrapper QueryResult).
   *
   * Nota: watchQuery è utile per dati che cambiano nel tempo o
   * quando si vuole sfruttare la cache con aggiornamenti automatici.
   * Per query one-time, preferire query().
   *
   * IMPORTANTE: Con fetchPolicy 'cache-and-network', la prima emissione
   * dalla cache vuota può avere result.data = undefined. Filtriamo queste
   * emissioni per evitare errori nei consumatori.
   *
   * @param options - Opzioni della watch query Apollo
   * @returns Observable<TData> - Stream di dati che si aggiorna
   */
  watchQuery<TData, TVariables extends OperationVariables = OperationVariables>(
    options: Apollo.WatchQueryOptions<TData, TVariables>
  ): Observable<TData> {
    // watchQuery() di apollo-angular ha già integrazione NgZone
    // tramite wrapWithZone() in QueryRef
    return this.apollo.watchQuery<TData, TVariables>(options).valueChanges.pipe(
      // Filtra emissioni con data undefined/null (cache vuota con cache-and-network)
      filter(result => result.data !== undefined && result.data !== null),
      map(result => result.data as TData)
    );
  }

  /**
   * Utility per eseguire codice dentro NgZone.
   * Utile per casi speciali dove serve forzare l'esecuzione in zona Angular.
   *
   * @param fn - Funzione da eseguire dentro NgZone
   * @returns Il risultato della funzione
   */
  runInZone<T>(fn: () => T): T {
    return this.ngZone.run(fn);
  }

  /**
   * Wrappa un Observable per eseguire le callback dentro NgZone.
   * Metodo privato usato internamente.
   */
  private wrapInZone<T>(observable: Observable<T>): Observable<T> {
    return new Observable<T>(observer => {
      const subscription = observable.subscribe({
        next: (value) => {
          this.ngZone.run(() => observer.next(value));
        },
        error: (err) => {
          this.ngZone.run(() => observer.error(err));
        },
        complete: () => {
          this.ngZone.run(() => observer.complete());
        }
      });
      return () => subscription.unsubscribe();
    });
  }
}
