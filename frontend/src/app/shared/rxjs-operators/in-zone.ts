import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Servizio per wrappare Observable dentro NgZone.
 *
 * Risolve il problema per cui apollo-angular query() non integra con NgZone,
 * causando mancati aggiornamenti dell'UI dopo le risposte GraphQL.
 *
 * @example
 * // Nel servizio
 * constructor(private rxjsZone: RxjsZoneService) {}
 *
 * getData() {
 *   return this.apollo.query(...).pipe(
 *     map(...),
 *     this.rxjsZone.inZone()
 *   );
 * }
 */
@Injectable({ providedIn: 'root' })
export class RxjsZoneService {
  constructor(private ngZone: NgZone) {}

  /**
   * Operatore RxJS che forza l'esecuzione delle callback dentro NgZone.
   * Garantisce che Angular rilevi i cambiamenti e aggiorni l'UI.
   */
  inZone<T>() {
    return (source: Observable<T>): Observable<T> => {
      return new Observable<T>(observer => {
        const subscription = source.subscribe({
          next: (value) => this.ngZone.run(() => observer.next(value)),
          error: (err) => this.ngZone.run(() => observer.error(err)),
          complete: () => this.ngZone.run(() => observer.complete())
        });
        return () => subscription.unsubscribe();
      });
    };
  }
}
