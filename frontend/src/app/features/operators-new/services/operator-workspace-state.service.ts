/**
 * Operator Workspace State Service
 * Layer 3: Stato Condiviso
 *
 * Responsabilità:
 * - Gestire stato condiviso tra le pagine (Dashboard, Pazienti, Appuntamenti)
 * - Mantenere selezione operatore e data persistente tra navigazioni
 * - Esporre Observable per change detection OnPush
 * - Gestire accesso role-based: admin vede tutti gli operatori, operatore/medico solo se stesso
 */

import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Operator } from '../../../graphql/generated/types';
import { OperatorWorkspaceService } from './operator-workspace.service';
import { OperatorService } from '../../../services/operator.service';
import { OidcAuthService } from '../../../core/auth/oidc-auth.service';

const ADMIN_ROLES = ['admin', 'amministratore', 'superadmin', 'it_manager'];

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
  private isAdminSubject = new BehaviorSubject<boolean>(false);

  // Observables pubblici
  readonly operators$ = this.operatorsSubject.asObservable();
  readonly selectedOperator$ = this.selectedOperatorSubject.asObservable();
  readonly selectedDate$ = this.selectedDateSubject.asObservable();
  readonly loadingOperators$ = this.loadingOperatorsSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();
  readonly initialized$ = this.initializedSubject.asObservable();
  readonly isAdmin$ = this.isAdminSubject.asObservable();

  private destroy$ = new Subject<void>();

  constructor(
    private workspaceService: OperatorWorkspaceService,
    private operatorService: OperatorService,
    private authService: OidcAuthService,
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

  get isAdmin(): boolean {
    return this.isAdminSubject.value;
  }

  // ============ METODI PUBBLICI ============

  /**
   * Inizializza il servizio caricando gli operatori.
   * Admin: carica tutti gli operatori (dropdown abilitato).
   * Operatore/Medico: carica solo il proprio operatore (dropdown disabilitato).
   */
  initialize(): void {
    if (this.isInitialized || this.isLoading) {
      return;
    }

    const admin = this.authService.hasRole(ADMIN_ROLES);
    this.isAdminSubject.next(admin);

    if (admin) {
      this.loadOperators();
    } else {
      this.loadMyOperator();
    }
  }

  /**
   * Carica la lista di tutti gli operatori dal backend (modalità admin)
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
   * Carica solo l'operatore associato all'utente corrente (modalità operatore/medico)
   */
  private loadMyOperator(): void {
    this.loadingOperatorsSubject.next(true);
    this.errorSubject.next(null);

    this.operatorService.getMyOperator()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operator) => {
          this.ngZone.run(() => {
            this.loadingOperatorsSubject.next(false);
            this.initializedSubject.next(true);

            if (operator) {
              this.operatorsSubject.next([operator]);
              this.setSelectedOperator(operator);
            } else {
              this.operatorsSubject.next([]);
              this.errorSubject.next('Nessun operatore associato al tuo account');
            }
          });
        },
        error: (err) => {
          console.error('[OperatorWorkspaceStateService] Error loading my operator:', err);
          this.ngZone.run(() => {
            this.loadingOperatorsSubject.next(false);
            this.errorSubject.next('Errore nel caricamento del tuo profilo operatore');
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
    this.isAdminSubject.next(false);
  }

  /**
   * Cleanup per evitare memory leak
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
