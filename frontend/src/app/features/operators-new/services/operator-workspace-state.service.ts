/**
 * Operator Workspace State Service
 * Layer 3: Stato Condiviso
 *
 * Responsabilità:
 * - Gestire stato condiviso tra le pagine (Dashboard, Pazienti, Appuntamenti)
 * - Mantenere selezione operatore e data persistente tra navigazioni
 * - Esporre Observable per change detection OnPush
 */

import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Operator } from '../../../graphql/generated/types';
import { OperatorWorkspaceService } from './operator-workspace.service';

@Injectable({
  providedIn: 'root'
})
export class OperatorWorkspaceStateService {
  // BehaviorSubjects privati
  private operatorsSubject = new BehaviorSubject<Operator[]>([]);
  private selectedOperatorSubject = new BehaviorSubject<Operator | null>(null);
  private selectedDateSubject = new BehaviorSubject<Date>(new Date());
  private loadingOperatorsSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private initializedSubject = new BehaviorSubject<boolean>(false);

  // Observables pubblici
  readonly operators$ = this.operatorsSubject.asObservable();
  readonly selectedOperator$ = this.selectedOperatorSubject.asObservable();
  readonly selectedDate$ = this.selectedDateSubject.asObservable();
  readonly loadingOperators$ = this.loadingOperatorsSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();
  readonly initialized$ = this.initializedSubject.asObservable();

  private destroy$ = new Subject<void>();

  constructor(
    private workspaceService: OperatorWorkspaceService,
    private ngZone: NgZone
  ) {}

  // ============ GETTERS SINCRONI ============

  get operators(): Operator[] {
    return this.operatorsSubject.value;
  }

  get selectedOperator(): Operator | null {
    return this.selectedOperatorSubject.value;
  }

  get selectedOperatorId(): string | null {
    return this.selectedOperatorSubject.value?.id || null;
  }

  get selectedDate(): Date {
    return this.selectedDateSubject.value;
  }

  get isLoading(): boolean {
    return this.loadingOperatorsSubject.value;
  }

  get isInitialized(): boolean {
    return this.initializedSubject.value;
  }

  // ============ METODI PUBBLICI ============

  /**
   * Inizializza il servizio caricando gli operatori
   * Chiamare dal layout component all'init
   */
  initialize(): void {
    if (this.isInitialized || this.isLoading) {
      return;
    }
    this.loadOperators();
  }

  /**
   * Carica la lista operatori dal backend
   */
  loadOperators(): void {
    this.loadingOperatorsSubject.next(true);
    this.errorSubject.next(null);

    this.workspaceService.loadOperators()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.ngZone.run(() => {
            this.operatorsSubject.next(result.operators);
            this.loadingOperatorsSubject.next(false);
            this.initializedSubject.next(true);

            if (result.error) {
              this.errorSubject.next(result.error);
            }

            // Auto-select primo operatore se non c'è selezione
            if (result.operators.length > 0 && !this.selectedOperator) {
              this.setSelectedOperator(result.operators[0]);
            }
          });
        },
        error: (err) => {
          console.error('[OperatorWorkspaceStateService] Error loading operators:', err);
          this.ngZone.run(() => {
            this.loadingOperatorsSubject.next(false);
            this.errorSubject.next('Errore nel caricamento degli operatori');
          });
        }
      });
  }

  /**
   * Imposta l'operatore selezionato
   */
  setSelectedOperator(operator: Operator): void {
    if (this.selectedOperator?.id !== operator.id) {
      this.selectedOperatorSubject.next(operator);
      console.log('[OperatorWorkspaceStateService] Selected operator:', operator.name, operator.surname);
    }
  }

  /**
   * Imposta l'operatore selezionato tramite ID
   */
  setSelectedOperatorById(operatorId: string): void {
    const operator = this.operators.find(op => op.id === operatorId);
    if (operator) {
      this.setSelectedOperator(operator);
    }
  }

  /**
   * Imposta la data selezionata
   */
  setSelectedDate(date: Date): void {
    this.selectedDateSubject.next(date);
    console.log('[OperatorWorkspaceStateService] Selected date:', date.toISOString().split('T')[0]);
  }

  /**
   * Imposta la data a oggi
   */
  setToday(): void {
    this.setSelectedDate(new Date());
  }

  /**
   * Cancella eventuali errori
   */
  clearError(): void {
    this.errorSubject.next(null);
  }

  /**
   * Reset dello stato (utile per logout)
   */
  reset(): void {
    this.operatorsSubject.next([]);
    this.selectedOperatorSubject.next(null);
    this.selectedDateSubject.next(new Date());
    this.loadingOperatorsSubject.next(false);
    this.errorSubject.next(null);
    this.initializedSubject.next(false);
  }

  /**
   * Cleanup per evitare memory leak
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
