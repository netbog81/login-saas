import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

/**
 * Servizio per gestire NgZone in modo centralizzato.
 *
 * ## Quando Usare
 * - Per eventi UI puri che NON coinvolgono GraphQL (per GraphQL usa ApolloZoneService)
 * - Per wrappare Observable/Subject che potrebbero emettere fuori NgZone
 * - Per operazioni async che devono triggerare change detection
 *
 * ## Esempi
 * ```typescript
 * // Wrappare un Observable
 * this.zoneService.wrapObservable(myObservable$).subscribe(data => {
 *   // Questo codice viene eseguito dentro NgZone
 * });
 *
 * // Eseguire codice in NgZone
 * this.zoneService.run(() => {
 *   this.myProperty = newValue;
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class NgZoneService {
  private zoneState$ = new BehaviorSubject<boolean>(true);

  constructor(private ngZone: NgZone) {}

  /**
   * Esegue una funzione dentro NgZone.
   * Usa questo per eventi UI che NON coinvolgono GraphQL.
   */
  run<T>(fn: () => T): T {
    return this.ngZone.run(fn);
  }

  /**
   * Esegue una funzione FUORI da NgZone.
   * Utile per operazioni pesanti che non devono triggerare change detection.
   */
  runOutsideAngular<T>(fn: () => T): T {
    return this.ngZone.runOutsideAngular(fn);
  }

  /**
   * Wrappa un Observable per garantire che le emissioni avvengano dentro NgZone.
   */
  wrapObservable<T>(source: Observable<T>): Observable<T> {
    return new Observable<T>(observer => {
      const subscription = source.subscribe({
        next: value => this.ngZone.run(() => observer.next(value)),
        error: err => this.ngZone.run(() => observer.error(err)),
        complete: () => this.ngZone.run(() => observer.complete())
      });
      return () => subscription.unsubscribe();
    });
  }

  /**
   * Wrappa un Subject per garantire che emit() avvenga dentro NgZone.
   */
  wrapSubject<T>(subject: Subject<T>): { emit: (value: T) => void } {
    return {
      emit: (value: T) => this.ngZone.run(() => subject.next(value))
    };
  }

  /**
   * Verifica se siamo attualmente dentro NgZone.
   */
  isInAngularZone(): boolean {
    return NgZone.isInAngularZone();
  }

  /**
   * Observable che indica se siamo in zone (per debugging).
   */
  get inZone$(): Observable<boolean> {
    return this.zoneState$.asObservable();
  }
}
