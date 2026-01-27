/**
 * Operators Dashboard Container
 * Layer 2: Smart Component - Coordinatore Dashboard
 *
 * Responsabilità:
 * - Caricare statistiche dai servizi (filtrate per operatore selezionato)
 * - Gestire stato UI della dashboard
 * - Orchestrare azioni rapide
 * - Reagire ai cambi di operatore/data dal state service condiviso
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, forkJoin, combineLatest } from 'rxjs';
import { takeUntil, filter, switchMap } from 'rxjs/operators';

import { PatientService } from '../../../services/patient.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { TreatmentService } from '../../../services/treatment.service';
import { Operator } from '../../../graphql/generated/types';

import { StatsCardComponent } from '../components/dashboard/stats-card/stats-card.component';
import { QuickActionsComponent } from '../components/dashboard/quick-actions/quick-actions.component';
import { OperatorWorkspaceStateService } from '../services/operator-workspace-state.service';

import {
  DashboardStats,
  DashboardUIState,
  QuickAction,
  createInitialDashboardState,
  createEmptyStats,
  DEFAULT_QUICK_ACTIONS
} from '../models';

@Component({
  selector: 'app-operators-dashboard-container',
  standalone: true,
  imports: [
    CommonModule,
    StatsCardComponent,
    QuickActionsComponent
  ],
  template: `
    <div class="dashboard-container">
      <!-- Header -->
      <header class="dashboard-header">
        <h1>Dashboard</h1>
        <p class="subtitle">
          @if (selectedOperator) {
            Statistiche per {{ selectedOperator.name }} {{ selectedOperator.surname }}
          } @else {
            Seleziona un operatore
          }
        </p>
      </header>

      <!-- Error banner -->
      @if (uiState.error) {
        <div class="error-banner">
          <span>{{ uiState.error }}</span>
          <button (click)="clearError()">×</button>
        </div>
      }

      <!-- Stats Grid -->
      <section class="stats-section">
        <div class="stats-grid">
          <app-stats-card
            icon="today"
            [value]="stats.appointmentsToday"
            label="Appuntamenti Oggi"
            [loading]="uiState.loadingStats"
            iconBackground="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            [clickable]="true"
            (cardClick)="onStatsClick('appointments-today')">
          </app-stats-card>

          <app-stats-card
            icon="date_range"
            [value]="stats.appointmentsWeek"
            label="Appuntamenti Settimana"
            [loading]="uiState.loadingStats"
            iconBackground="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
            [clickable]="true"
            (cardClick)="onStatsClick('appointments-week')">
          </app-stats-card>

          <app-stats-card
            icon="people"
            [value]="stats.patientsTotal"
            label="Pazienti Totali"
            [loading]="uiState.loadingStats"
            iconBackground="linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)"
            [clickable]="true"
            (cardClick)="onStatsClick('patients')">
          </app-stats-card>

          <app-stats-card
            icon="pending_actions"
            [value]="stats.treatmentsPending"
            label="Trattamenti in Attesa"
            [loading]="uiState.loadingStats"
            iconBackground="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            [clickable]="true"
            (cardClick)="onStatsClick('treatments-pending')">
          </app-stats-card>
        </div>
      </section>

      <!-- Quick Actions -->
      <section class="actions-section">
        <app-quick-actions
          [actions]="quickActions"
          (actionClick)="onQuickAction($event)">
        </app-quick-actions>
      </section>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .dashboard-header {
      margin-bottom: 24px;

      h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        color: #1e293b;
      }

      .subtitle {
        margin: 4px 0 0;
        font-size: 0.9375rem;
        color: #64748b;
      }
    }

    .error-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      margin-bottom: 24px;
      background: #fee2e2;
      color: #dc2626;
      border-radius: 8px;
      font-size: 0.875rem;

      button {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        color: #dc2626;
        padding: 0 4px;
      }
    }

    .stats-section {
      margin-bottom: 24px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }

    .actions-section {
      margin-bottom: 24px;
    }

    /* Responsive */
    @media (max-width: 599px) {
      .dashboard-container {
        padding: 16px;
      }

      .dashboard-header {
        margin-bottom: 16px;

        h1 {
          font-size: 1.5rem;
        }
      }

      .stats-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperatorsDashboardContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  uiState: DashboardUIState = createInitialDashboardState();
  stats: DashboardStats = createEmptyStats();
  quickActions: QuickAction[] = DEFAULT_QUICK_ACTIONS;
  selectedOperator: Operator | null = null;

  constructor(
    private stateService: OperatorWorkspaceStateService,
    private patientService: PatientService,
    private appointmentService: AvailabilityAppointmentService,
    private treatmentService: TreatmentService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Sottoscrivi ai cambi di operatore e data
    combineLatest([
      this.stateService.selectedOperator$,
      this.stateService.selectedDate$
    ]).pipe(
      takeUntil(this.destroy$),
      filter(([operator]) => operator !== null)
    ).subscribe(([operator, date]) => {
      this.selectedOperator = operator;
      this.loadStats(operator!, date);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadStats(operator: Operator, date: Date): void {
    this.uiState = { ...this.uiState, loadingStats: true, error: null };
    this.cdr.markForCheck();

    const todayStr = this.formatDate(date);

    // Calcola inizio e fine settimana basata sulla data selezionata
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1); // Lunedì
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Domenica

    const weekStartStr = this.formatDate(weekStart);
    const weekEndStr = this.formatDate(weekEnd);

    forkJoin({
      patients: this.patientService.getPatients(1000, 0),
      // Filtra appuntamenti per operatore selezionato
      appointmentsToday: this.appointmentService.getAppointmentsByOperator(operator.id, todayStr, todayStr),
      appointmentsWeek: this.appointmentService.getAppointmentsByOperator(operator.id, weekStartStr, weekEndStr),
      // Filtra trattamenti per operatore
      treatmentsPending: this.treatmentService.getTreatmentsByOperator(operator.id)
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.ngZone.run(() => {
            // Filtra i trattamenti pending (non completati)
            const pendingTreatments = results.treatmentsPending.filter(
              t => t.status === 'in_progress' || t.status === 'operator_completed'
            );

            this.stats = {
              patientsTotal: results.patients.length,
              appointmentsToday: results.appointmentsToday.length,
              appointmentsWeek: results.appointmentsWeek.length,
              treatmentsPending: pendingTreatments.length
            };
            this.uiState = { ...this.uiState, loadingStats: false };
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[OperatorsDashboardContainer] Error loading stats:', err);
          this.ngZone.run(() => {
            this.uiState = {
              ...this.uiState,
              loadingStats: false,
              error: 'Errore nel caricamento delle statistiche'
            };
            this.cdr.markForCheck();
          });
        }
      });
  }

  onStatsClick(statType: string): void {
    switch (statType) {
      case 'appointments-today':
      case 'appointments-week':
        this.router.navigate(['/operatori-new/appuntamenti']);
        break;
      case 'patients':
        this.router.navigate(['/operatori-new/pazienti']);
        break;
      case 'treatments-pending':
        this.router.navigate(['/operatori-new/appuntamenti']);
        break;
    }
  }

  onQuickAction(action: QuickAction): void {
    if (action.route) {
      this.router.navigate([action.route]);
    }
  }

  clearError(): void {
    this.uiState = { ...this.uiState, error: null };
    this.cdr.markForCheck();
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
