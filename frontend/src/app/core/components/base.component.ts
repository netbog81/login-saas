import { Directive, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { NgZoneService } from '../services/ng-zone.service';

/**
 * Classe base per componenti UI che necessitano gestione NgZone.
 *
 * ## Quando Usare
 * - Componenti con EventEmitter che potrebbero essere chiamati fuori NgZone
 * - Componenti che gestiscono eventi asincroni (setTimeout, WebSocket, etc.)
 * - Dialog/Modal che vengono aperti da contesti potenzialmente fuori NgZone
 *
 * ## Come Usare
 * ```typescript
 * @Component({...})
 * export class MyComponent extends BaseComponent {
 *   @Output() buttonClicked = new EventEmitter<void>();
 *
 *   onButtonClick(): void {
 *     // Usa emit() invece di this.buttonClicked.emit()
 *     this.emit(this.buttonClicked, undefined);
 *   }
 * }
 * ```
 *
 * ## Metodi Disponibili
 * - `emit(emitter, value)` - Emette un evento garantendo che sia in NgZone
 * - `runInZone(fn)` - Esegue codice in NgZone
 * - `detectChanges()` - Forza un ciclo di change detection
 * - `isInZone()` - Verifica se siamo in NgZone (per debugging)
 *
 * ## Note
 * - `destroy$` è già definito e gestito automaticamente
 * - `cdr` (ChangeDetectorRef) è già iniettato e disponibile
 * - `zoneService` (NgZoneService) è già iniettato e disponibile
 */
@Directive()
export abstract class BaseComponent implements OnDestroy {
  /** Subject per la gestione del ciclo di vita del componente */
  protected destroy$ = new Subject<void>();

  /** Servizio per la gestione di NgZone */
  protected zoneService = inject(NgZoneService);

  /** ChangeDetectorRef per forzare change detection quando necessario */
  protected cdr = inject(ChangeDetectorRef);

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Emette un evento garantendo che avvenga dentro NgZone.
   * Usa questo invece di `eventEmitter.emit()` direttamente.
   *
   * @example
   * ```typescript
   * @Output() close = new EventEmitter<void>();
   *
   * onCloseClick(): void {
   *   this.emit(this.close, undefined);
   * }
   * ```
   */
  protected emit<T>(emitter: { emit: (value: T) => void }, value: T): void {
    this.zoneService.run(() => {
      emitter.emit(value);
      this.cdr.detectChanges();
    });
  }

  /**
   * Esegue codice garantendo che sia dentro NgZone.
   *
   * @example
   * ```typescript
   * this.runInZone(() => {
   *   this.myProperty = newValue;
   * });
   * ```
   */
  protected runInZone<T>(fn: () => T): T {
    return this.zoneService.run(fn);
  }

  /**
   * Forza un ciclo di change detection.
   * Usa con parsimonia - preferire il normale flusso Angular.
   */
  protected detectChanges(): void {
    this.cdr.detectChanges();
  }

  /**
   * Verifica se siamo dentro NgZone (per debugging).
   */
  protected isInZone(): boolean {
    return this.zoneService.isInAngularZone();
  }
}
