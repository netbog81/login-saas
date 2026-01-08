import { Injectable, NgZone, isDevMode } from '@angular/core';

/**
 * Interfaccia per una violazione NgZone rilevata.
 */
export interface ZoneViolation {
  /** Nome del componente dove è avvenuta la violazione */
  component: string;
  /** Nome del metodo dove è avvenuta la violazione */
  method: string;
  /** Timestamp della violazione */
  timestamp: Date;
  /** Stack trace (se disponibile) */
  stackTrace?: string;
}

/**
 * Servizio per validare e debuggare problemi di NgZone.
 *
 * ## Quando Usare
 * - Durante lo sviluppo per identificare codice che gira fuori NgZone
 * - Per debuggare problemi di UI che non si aggiorna
 * - Per verificare che i fix NgZone funzionino correttamente
 *
 * ## Come Usare
 *
 * ### Abilitare in ambiente dev
 * ```typescript
 * // In AppComponent o in un servizio di bootstrap
 * constructor(private zoneValidator: NgZoneValidator) {
 *   if (isDevMode()) {
 *     this.zoneValidator.enable();
 *   }
 * }
 * ```
 *
 * ### Verificare in metodi critici
 * ```typescript
 * onButtonClick(): void {
 *   this.zoneValidator.assertInZone('MyComponent', 'onButtonClick');
 *   // ... resto del codice
 * }
 * ```
 *
 * ### Stampare report
 * ```typescript
 * // Nella console del browser
 * // Inietta il servizio e chiama:
 * this.zoneValidator.printReport();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class NgZoneValidator {
  private violations: ZoneViolation[] = [];
  private isEnabled = false;
  private maxViolations = 100; // Limita la memoria usata

  constructor(private ngZone: NgZone) {}

  /**
   * Abilita il validator.
   * In produzione è disabilitato di default per performance.
   */
  enable(): void {
    this.isEnabled = true;
    console.log('🔍 NgZoneValidator enabled - monitoring for zone violations');
  }

  /**
   * Disabilita il validator.
   */
  disable(): void {
    this.isEnabled = false;
    console.log('🔍 NgZoneValidator disabled');
  }

  /**
   * Verifica se il validator è abilitato.
   */
  get enabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Verifica che siamo dentro NgZone.
   * Chiamare all'inizio di metodi critici per il debugging.
   *
   * @param component - Nome del componente
   * @param method - Nome del metodo
   * @param captureStack - Se catturare lo stack trace (default: false per performance)
   *
   * @example
   * ```typescript
   * onSave(): void {
   *   this.zoneValidator.assertInZone('EventDialog', 'onSave');
   *   // ...
   * }
   * ```
   */
  assertInZone(component: string, method: string, captureStack = false): void {
    if (!this.isEnabled) return;

    if (!NgZone.isInAngularZone()) {
      const violation: ZoneViolation = {
        component,
        method,
        timestamp: new Date(),
        stackTrace: captureStack ? new Error().stack : undefined
      };

      // Limita il numero di violazioni memorizzate
      if (this.violations.length >= this.maxViolations) {
        this.violations.shift(); // Rimuove la più vecchia
      }
      this.violations.push(violation);

      console.warn(
        `⚠️ NgZone violation in ${component}.${method}() - ` +
        `Code is running outside Angular zone!`
      );

      if (captureStack && violation.stackTrace) {
        console.warn('Stack trace:', violation.stackTrace);
      }
    }
  }

  /**
   * Verifica se siamo attualmente dentro NgZone.
   * Utile per debugging condizionale.
   */
  isInZone(): boolean {
    return NgZone.isInAngularZone();
  }

  /**
   * Ottiene tutte le violazioni registrate.
   */
  getViolations(): ZoneViolation[] {
    return [...this.violations];
  }

  /**
   * Ottiene il numero di violazioni registrate.
   */
  getViolationCount(): number {
    return this.violations.length;
  }

  /**
   * Pulisce tutte le violazioni registrate.
   */
  clearViolations(): void {
    this.violations = [];
    console.log('🧹 NgZoneValidator violations cleared');
  }

  /**
   * Stampa un report delle violazioni nella console.
   */
  printReport(): void {
    if (this.violations.length === 0) {
      console.log('✅ No NgZone violations detected');
      return;
    }

    console.group(`🔴 NgZone Violations Report (${this.violations.length} total)`);

    // Raggruppa per componente
    const byComponent = this.violations.reduce((acc, v) => {
      const key = v.component;
      if (!acc[key]) acc[key] = [];
      acc[key].push(v);
      return acc;
    }, {} as Record<string, ZoneViolation[]>);

    Object.entries(byComponent).forEach(([component, violations]) => {
      console.group(`📦 ${component} (${violations.length} violations)`);
      violations.forEach((v, i) => {
        console.log(
          `  ${i + 1}. ${v.method}() at ${v.timestamp.toLocaleTimeString()}`
        );
      });
      console.groupEnd();
    });

    console.groupEnd();
  }

  /**
   * Esporta le violazioni come JSON per analisi.
   */
  exportViolationsAsJson(): string {
    return JSON.stringify(this.violations, null, 2);
  }

  /**
   * Ottiene un sommario delle violazioni per componente.
   */
  getSummary(): Record<string, number> {
    return this.violations.reduce((acc, v) => {
      const key = `${v.component}.${v.method}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
