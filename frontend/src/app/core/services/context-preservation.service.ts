import { Injectable, NgZone, ApplicationRef } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Interfaccia per il contesto di zona preservato.
 */
export interface ZoneContext {
  /** Indica se il contesto è stato creato dentro NgZone */
  isInZone: boolean;
  /** Timestamp di creazione del contesto */
  timestamp: number;
  /** Identificativo della sorgente che ha creato il contesto */
  source: string;
}

/**
 * Servizio per preservare il contesto NgZone durante operazioni asincrone.
 *
 * ## Quando Usare
 * - Quando si aprono dialog/modal da contesti potenzialmente fuori NgZone
 * - Quando si creano componenti dinamicamente dopo operazioni async
 * - Per garantire che i componenti creati dinamicamente siano rilevati da Angular
 *
 * ## Pattern di Utilizzo
 * ```typescript
 * // Nel componente root (AppComponent)
 * ngOnInit(): void {
 *   this.cleanupContext = this.contextService.preserveContext('AppComponent');
 * }
 *
 * ngOnDestroy(): void {
 *   this.cleanupContext?.();
 * }
 *
 * // In un componente che apre dialog
 * openDialog(): void {
 *   this.contextService.runInPreservedContext(() => {
 *     // Il dialog sarà creato dentro NgZone
 *     this.showDialog = true;
 *   });
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ContextPreservationService {
  private contextStack: ZoneContext[] = [];
  private currentContext$ = new BehaviorSubject<ZoneContext | null>(null);

  constructor(
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {}

  /**
   * Crea un contesto preservato per operazioni che creano componenti dinamici.
   * Utile per dialog, modal, overlay che vengono aperti da contesti async.
   *
   * @param source - Identificativo della sorgente (es: nome componente)
   * @returns Funzione di cleanup da chiamare quando il contesto non è più necessario
   *
   * @example
   * ```typescript
   * private cleanupContext: (() => void) | null = null;
   *
   * ngOnInit(): void {
   *   this.cleanupContext = this.contextService.preserveContext('MyComponent');
   * }
   *
   * ngOnDestroy(): void {
   *   this.cleanupContext?.();
   * }
   * ```
   */
  preserveContext(source: string): () => void {
    const context: ZoneContext = {
      isInZone: NgZone.isInAngularZone(),
      timestamp: Date.now(),
      source
    };

    this.contextStack.push(context);
    this.currentContext$.next(context);

    // Ritorna una funzione per pulire il contesto
    return () => {
      const index = this.contextStack.indexOf(context);
      if (index > -1) {
        this.contextStack.splice(index, 1);
        this.currentContext$.next(
          this.contextStack.length > 0
            ? this.contextStack[this.contextStack.length - 1]
            : null
        );
      }
    };
  }

  /**
   * Esegue una funzione nel contesto Angular preservato.
   * Garantisce che i componenti creati dinamicamente siano dentro NgZone.
   *
   * @param fn - Funzione da eseguire nel contesto preservato
   * @returns Il risultato della funzione
   *
   * @example
   * ```typescript
   * openDialog(): void {
   *   this.contextService.runInPreservedContext(() => {
   *     this.dialogVisible = true;
   *   });
   * }
   * ```
   */
  runInPreservedContext<T>(fn: () => T): T {
    return this.ngZone.run(() => {
      const result = fn();
      // Forza un tick dell'applicazione per assicurare che i componenti
      // dinamici vengano rilevati
      this.appRef.tick();
      return result;
    });
  }

  /**
   * Observable del contesto corrente (per debugging).
   */
  get context$(): Observable<ZoneContext | null> {
    return this.currentContext$.asObservable();
  }

  /**
   * Verifica se c'è un contesto preservato attivo.
   */
  hasActiveContext(): boolean {
    return this.contextStack.length > 0;
  }

  /**
   * Ottiene il contesto corrente (per debugging).
   */
  getCurrentContext(): ZoneContext | null {
    return this.contextStack.length > 0
      ? this.contextStack[this.contextStack.length - 1]
      : null;
  }

  /**
   * Ottiene la profondità dello stack di contesti (per debugging).
   */
  getContextDepth(): number {
    return this.contextStack.length;
  }
}
