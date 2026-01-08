import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { ApolloZoneService } from './apollo-zone.service';
import type { DocumentNode } from 'graphql';
import type { FetchPolicy, WatchQueryFetchPolicy, OperationVariables } from '@apollo/client/core';

/**
 * Classe base astratta per tutti i servizi GraphQL.
 *
 * ## Vantaggi
 * - DRY: Metodi comuni query/mutate/watch centralizzati
 * - NgZone: Integrazione automatica tramite ApolloZoneService
 * - Type-safe: Generics per tipizzazione forte
 * - API semplificata: Meno boilerplate nei servizi
 *
 * ## Come Usare
 * 1. Estendere questa classe nel servizio
 * 2. Usare Injector nel costruttore (evita dipendenze circolari)
 * 3. Usare this.query(), this.mutate(), this.watch()
 *
 * @example
 * @Injectable({ providedIn: 'root' })
 * export class PatientService extends BaseGraphQLService {
 *   constructor(injector: Injector) {
 *     super(injector);
 *   }
 *
 *   getPatients(): Observable<Patient[]> {
 *     return this.query<{ patients: Patient[] }>(GET_PATIENTS)
 *       .pipe(map(result => result.patients));
 *   }
 *
 *   createPatient(input: CreatePatientInput): Observable<Patient> {
 *     return this.mutate<{ createPatient: Patient }>(
 *       CREATE_PATIENT,
 *       { input },
 *       [{ query: GET_PATIENTS }]
 *     ).pipe(map(result => result.createPatient));
 *   }
 * }
 */
@Injectable()
export abstract class BaseGraphQLService {
  protected apolloZone: ApolloZoneService;

  constructor(injector: Injector) {
    // Injection manuale per evitare dipendenze circolari
    this.apolloZone = injector.get(ApolloZoneService);
  }

  /**
   * Esegue una query GraphQL one-time.
   * Restituisce direttamente i dati tipizzati.
   *
   * @param query - DocumentNode della query GraphQL
   * @param variables - Variabili della query (opzionale)
   * @param fetchPolicy - Policy di fetch (default: 'network-only')
   * @returns Observable<TResult> - I dati della query
   */
  protected query<TResult, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode,
    variables?: TVariables,
    fetchPolicy: FetchPolicy = 'network-only'
  ): Observable<TResult> {
    return this.apolloZone.query<TResult, TVariables>({
      query,
      variables: variables as TVariables,
      fetchPolicy
    });
  }

  /**
   * Esegue una mutation GraphQL.
   * Restituisce direttamente i dati tipizzati.
   *
   * @param mutation - DocumentNode della mutation GraphQL
   * @param variables - Variabili della mutation (opzionale)
   * @param refetchQueries - Query da ri-eseguire dopo la mutation (opzionale)
   * @returns Observable<TResult> - I dati della mutation
   */
  protected mutate<TResult, TVariables extends OperationVariables = OperationVariables>(
    mutation: DocumentNode,
    variables?: TVariables,
    refetchQueries?: Array<{ query: DocumentNode; variables?: Record<string, unknown> }>
  ): Observable<TResult> {
    return this.apolloZone.mutate<TResult, TVariables>({
      mutation,
      variables: variables as TVariables,
      refetchQueries: refetchQueries,
      awaitRefetchQueries: refetchQueries ? true : undefined
    });
  }

  /**
   * Esegue una watch query GraphQL per dati reattivi.
   * Utile per dati che cambiano nel tempo o con cache.
   *
   * @param query - DocumentNode della query GraphQL
   * @param variables - Variabili della query (opzionale)
   * @param fetchPolicy - Policy di fetch (default: 'cache-and-network')
   * @returns Observable<TResult> - Stream di dati che si aggiorna
   */
  protected watch<TResult, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode,
    variables?: TVariables,
    fetchPolicy: WatchQueryFetchPolicy = 'cache-and-network'
  ): Observable<TResult> {
    return this.apolloZone.watchQuery<TResult, TVariables>({
      query,
      variables: variables as TVariables,
      fetchPolicy
    });
  }

  /**
   * Utility per eseguire codice dentro NgZone.
   * Utile per casi speciali (setTimeout, WebSocket, etc.)
   *
   * @param fn - Funzione da eseguire dentro NgZone
   * @returns Il risultato della funzione
   */
  protected runInZone<T>(fn: () => T): T {
    return this.apolloZone.runInZone(fn);
  }
}
