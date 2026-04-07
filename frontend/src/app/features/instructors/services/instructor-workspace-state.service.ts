/**
 * Instructor Workspace State Service
 * Layer 3: Stato Condiviso
 *
 * Responsabilità:
 * - Gestire stato condiviso tra le pagine (Appuntamenti, In Corso)
 * - Mantenere selezione istruttore e data persistente
 * - Esporre Observable per change detection OnPush
 * - Gestire accesso role-based: admin vede tutti gli istruttori, istruttore solo se stesso
 * - Filtra solo operatori con macroCategory GYM_INSTRUCTOR
 */

import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Operator, OperatorMacroCategory } from '../../../graphql/generated/types';
import { InstructorWorkspaceService } from './instructor-workspace.service';
import { OperatorService } from '../../../services/operator.service';
import { OidcAuthService } from '../../../core/auth/oidc-auth.service';
import { ViewMode } from '../models/instructor-workspace.model';

const ADMIN_ROLES = ['admin', 'amministratore', 'superadmin', 'it_manager'];

@Injectable({
  providedIn: 'root',
})
export class InstructorWorkspaceStateService {
  // BehaviorSubjects privati
  private operatorsSubject = new BehaviorSubject<Operator[]>([]);
  private selectedOperatorSubject = new BehaviorSubject<Operator | null>(null);
  private selectedDateSubject = new BehaviorSubject<Date>(new Date());
  private loadingOperatorsSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private initializedSubject = new BehaviorSubject<boolean>(false);
  private isAdminSubject = new BehaviorSubject<boolean>(false);
  private viewModeSubject = new BehaviorSubject<ViewMode>('day');

  // Observables pubblici
  readonly operators$ = this.operatorsSubject.asObservable();
  readonly selectedOperator$ = this.selectedOperatorSubject.asObservable();
  readonly selectedDate$ = this.selectedDateSubject.asObservable();
  readonly loadingOperators$ = this.loadingOperatorsSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();
  readonly initialized$ = this.initializedSubject.asObservable();
  readonly isAdmin$ = this.isAdminSubject.asObservable();
  readonly viewMode$ = this.viewModeSubject.asObservable();

  private destroy$ = new Subject<void>();

  constructor(
    private workspaceService: InstructorWorkspaceService,
    private operatorService: OperatorService,
    private authService: OidcAuthService,
    private ngZone: NgZone,
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

  get viewMode(): ViewMode {
    return this.viewModeSubject.value;
  }

  // ============ METODI PUBBLICI ============

  /**
   * Inizializza il servizio caricando gli istruttori.
   * Admin: carica tutti gli istruttori GYM_INSTRUCTOR (dropdown abilitato).
   * Operatore: carica solo il proprio operatore se è GYM_INSTRUCTOR (dropdown disabilitato).
   */
  initialize(): void {
    if (this.isInitialized || this.isLoading) {
      return;
    }

    const admin = this.authService.hasRole(ADMIN_ROLES);
    this.isAdminSubject.next(admin);

    if (admin) {
      this.loadInstructors();
    } else {
      this.loadMyOperator();
    }
  }

  /**
   * Carica tutti gli istruttori GYM_INSTRUCTOR dal backend (modalità admin)
   */
  loadInstructors(): void {
    this.loadingOperatorsSubject.next(true);
    this.errorSubject.next(null);

    this.workspaceService
      .loadInstructors()
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

            // Auto-select primo istruttore se non c'è selezione
            if (result.operators.length > 0 && !this.selectedOperator) {
              this.setSelectedOperator(result.operators[0]);
            }
          });
        },
        error: (err) => {
          console.error('[InstructorWorkspaceStateService] Error loading instructors:', err);
          this.ngZone.run(() => {
            this.loadingOperatorsSubject.next(false);
            this.errorSubject.next('Errore nel caricamento degli istruttori');
          });
        },
      });
  }

  /**
   * Carica solo l'operatore associato all'utente corrente (modalità operatore).
   * Verifica che sia un GYM_INSTRUCTOR.
   */
  private loadMyOperator(): void {
    this.loadingOperatorsSubject.next(true);
    this.errorSubject.next(null);

    this.operatorService
      .getMyOperator()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operator) => {
          this.ngZone.run(() => {
            this.loadingOperatorsSubject.next(false);
            this.initializedSubject.next(true);

            if (operator && operator.macroCategory === OperatorMacroCategory.GymInstructor) {
              this.operatorsSubject.next([operator]);
              this.setSelectedOperator(operator);
            } else if (operator) {
              this.operatorsSubject.next([]);
              this.errorSubject.next('Il tuo profilo operatore non è di tipo Istruttore Palestra');
            } else {
              this.operatorsSubject.next([]);
              this.errorSubject.next('Nessun operatore associato al tuo account');
            }
          });
        },
        error: (err) => {
          console.error('[InstructorWorkspaceStateService] Error loading my operator:', err);
          this.ngZone.run(() => {
            this.loadingOperatorsSubject.next(false);
            this.errorSubject.next('Errore nel caricamento del tuo profilo operatore');
          });
        },
      });
  }

  setSelectedOperator(operator: Operator): void {
    if (this.selectedOperator?.id !== operator.id) {
      this.selectedOperatorSubject.next(operator);
    }
  }

  setSelectedOperatorById(operatorId: string): void {
    const operator = this.operators.find((op) => op.id === operatorId);
    if (operator) {
      this.setSelectedOperator(operator);
    }
  }

  setSelectedDate(date: Date): void {
    this.selectedDateSubject.next(date);
  }

  setToday(): void {
    this.setSelectedDate(new Date());
  }

  setViewMode(mode: ViewMode): void {
    this.viewModeSubject.next(mode);
  }

  clearError(): void {
    this.errorSubject.next(null);
  }

  reset(): void {
    this.operatorsSubject.next([]);
    this.selectedOperatorSubject.next(null);
    this.selectedDateSubject.next(new Date());
    this.loadingOperatorsSubject.next(false);
    this.errorSubject.next(null);
    this.initializedSubject.next(false);
    this.isAdminSubject.next(false);
    this.viewModeSubject.next('day');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
