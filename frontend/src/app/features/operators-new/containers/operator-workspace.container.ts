/**
 * Operator Workspace Container
 * Layer 2: Smart Component - Coordinatore Principale
 *
 * Responsabilità:
 * - Gestione stato globale del workspace
 * - Orchestrazione caricamento dati (operatori, appuntamenti, paziente)
 * - Coordinamento tra componenti figli
 * - Gestione eventi UI
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
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Operator, AvailabilityAppointment } from '../../../graphql/generated/types';
import { Patient } from '../../../models/patient.model';

import {
  WorkspaceUIState,
  createInitialWorkspaceUIState
} from '../models';

import { OperatorWorkspaceService } from '../services/operator-workspace.service';
import { WorkspaceHeaderComponent } from '../components/workspace-header/workspace-header.component';
import { AppointmentsSidebarComponent } from '../components/appointments-sidebar/appointments-sidebar.component';
import { TreatmentCardComponent, TreatmentCompletionData } from '../components/treatment-card/treatment-card.component';
import { PatientFolderContainer } from './patient-folder.container';

@Component({
  selector: 'app-operator-workspace-container',
  standalone: true,
  imports: [
    CommonModule,
    WorkspaceHeaderComponent,
    AppointmentsSidebarComponent,
    TreatmentCardComponent,
    PatientFolderContainer
  ],
  template: `
    <div class="operator-workspace-new">
      <!-- Header con selezione operatore e data -->
      <app-workspace-header
        [operators]="operators"
        [selectedOperator]="selectedOperator"
        [selectedDate]="uiState.selectedDate"
        [loadingOperators]="uiState.loadingOperators"
        [title]="'Workspace Operatore'"
        [subtitle]="'Architettura a 5 strati'"
        (operatorChange)="onOperatorChange($event)"
        (dateChange)="onDateChange($event)"
        (todayClick)="onTodayClick()">
      </app-workspace-header>

      <!-- Error banner -->
      @if (uiState.error) {
        <div class="error-banner">
          <span>{{ uiState.error }}</span>
          <button (click)="clearError()">×</button>
        </div>
      }

      <!-- Main content -->
      <div class="workspace-content">
        <!-- Sidebar appuntamenti -->
        <app-appointments-sidebar
          [appointments]="appointments"
          [selectedAppointmentId]="uiState.selectedAppointmentId"
          [loading]="uiState.loadingAppointments"
          [collapsed]="uiState.sidebarCollapsed"
          (appointmentSelect)="onAppointmentSelect($event)"
          (toggleCollapse)="toggleSidebar()">
        </app-appointments-sidebar>

        <!-- Main area -->
        <main class="main-area">
          <!-- Treatment card -->
          <section class="treatment-section">
            <app-treatment-card
              [appointment]="selectedAppointment"
              [patient]="selectedPatient"
              [loading]="uiState.loadingPatient"
              (startTreatment)="onStartTreatment()"
              (completeTreatment)="onCompleteTreatment($event)"
              (viewPatientFolder)="onViewPatientFolder()"
              (cancelAppointment)="onCancelAppointment()">
            </app-treatment-card>
          </section>

          <!-- Patient folder -->
          <section class="patient-folder-section">
            <app-patient-folder-container
              [patient]="selectedPatient"
              [currentOperatorId]="selectedOperator?.id"
              (viewPatientDetails)="onViewPatientDetails($event)">
            </app-patient-folder-container>
          </section>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .operator-workspace-new {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f8fafc;
    }

    .error-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.5rem;
      background: #fee2e2;
      color: #dc2626;
      font-size: 0.875rem;

      button {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        color: #dc2626;
        padding: 0 0.5rem;
      }
    }

    .workspace-content {
      display: flex;
      flex: 1;
      min-height: 0;
      gap: 1rem;
      padding: 1rem;
    }

    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 0;
    }

    .treatment-section {
      flex-shrink: 0;
    }

    .patient-folder-section {
      flex: 1;
      min-height: 400px;
      display: flex;
      flex-direction: column;
    }

    /* Responsive */
    @media (max-width: 599px) {
      .workspace-content {
        flex-direction: column;
        padding: 0.5rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperatorWorkspaceContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Stato UI
  uiState: WorkspaceUIState = createInitialWorkspaceUIState();

  // Dati
  operators: Operator[] = [];
  selectedOperator: Operator | null = null;
  appointments: AvailabilityAppointment[] = [];
  selectedAppointment: AvailabilityAppointment | null = null;
  selectedPatient: Patient | null = null;

  constructor(
    private workspaceService: OperatorWorkspaceService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('[OperatorWorkspaceContainer] Inizializzato');
    this.loadOperators();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ DATA LOADING ============

  private loadOperators(): void {
    this.uiState = { ...this.uiState, loadingOperators: true, error: null };
    this.cdr.markForCheck();

    this.workspaceService.loadOperators()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.ngZone.run(() => {
          this.operators = result.operators;
          this.uiState = {
            ...this.uiState,
            loadingOperators: false,
            error: result.error || null
          };

          // Auto-select primo operatore
          if (this.operators.length > 0 && !this.selectedOperator) {
            this.selectOperator(this.operators[0]);
          }

          this.cdr.markForCheck();
        });
      });
  }

  private loadAppointments(): void {
    if (!this.selectedOperator) return;

    this.uiState = { ...this.uiState, loadingAppointments: true };
    this.cdr.markForCheck();

    this.workspaceService.loadAppointments(this.selectedOperator.id, this.uiState.selectedDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.ngZone.run(() => {
          this.appointments = result.appointments;
          this.uiState = {
            ...this.uiState,
            loadingAppointments: false,
            error: result.error || this.uiState.error
          };

          // Deseleziona appuntamento corrente
          this.selectedAppointment = null;
          this.selectedPatient = null;
          this.uiState.selectedAppointmentId = null;

          this.cdr.markForCheck();
        });
      });
  }

  private loadPatient(patientId: number): void {
    this.uiState = { ...this.uiState, loadingPatient: true };
    this.cdr.markForCheck();

    this.workspaceService.loadPatient(patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.ngZone.run(() => {
          this.selectedPatient = result.patient;
          this.uiState = {
            ...this.uiState,
            loadingPatient: false,
            error: result.error || this.uiState.error
          };
          this.cdr.markForCheck();
        });
      });
  }

  // ============ EVENT HANDLERS ============

  onOperatorChange(operator: Operator): void {
    this.selectOperator(operator);
  }

  onDateChange(date: Date): void {
    this.uiState = { ...this.uiState, selectedDate: date };
    this.loadAppointments();
  }

  onTodayClick(): void {
    this.uiState = { ...this.uiState, selectedDate: new Date() };
    this.loadAppointments();
  }

  onAppointmentSelect(appointment: AvailabilityAppointment): void {
    this.selectedAppointment = appointment;
    this.uiState = {
      ...this.uiState,
      selectedAppointmentId: String(appointment.id)
    };

    // Carica paziente se presente - patientId potrebbe essere in participant o nell'appointment
    const patientId = (appointment as any).patientId || (appointment as any).participant?.id;
    if (patientId) {
      this.loadPatient(patientId);
    } else {
      this.selectedPatient = null;
    }

    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.uiState = {
      ...this.uiState,
      sidebarCollapsed: !this.uiState.sidebarCollapsed
    };
    this.cdr.markForCheck();
  }

  clearError(): void {
    this.uiState = { ...this.uiState, error: null };
    this.cdr.markForCheck();
  }

  // Treatment handlers
  onStartTreatment(): void {
    if (!this.selectedAppointment) return;
    // TODO: Implementare chiamata al service per avviare trattamento
    console.log('[OperatorWorkspaceContainer] Start treatment:', this.selectedAppointment.id);
    // Per ora simula il cambio di stato
  }

  onCompleteTreatment(data: TreatmentCompletionData): void {
    if (!this.selectedAppointment) return;
    console.log('[OperatorWorkspaceContainer] Complete treatment:', data);
    // TODO: Implementare chiamata al service per completare trattamento
    alert('Trattamento completato!\n\n' + this.buildCompletionSummary(data));
  }

  onViewPatientFolder(): void {
    // Scroll to patient folder section
    const folderElement = document.querySelector('.patient-folder-section');
    folderElement?.scrollIntoView({ behavior: 'smooth' });
  }

  onViewPatientDetails(patient: Patient): void {
    // TODO: Navigare alla scheda paziente dettagliata o aprire modal
    console.log('[OperatorWorkspaceContainer] View patient details:', patient);
    alert(`Dettagli paziente: ${patient.nome} ${patient.cognome}\nQuesta funzionalità aprirà la scheda completa del paziente`);
  }

  onCancelAppointment(): void {
    if (!this.selectedAppointment) return;
    const reason = prompt('Motivo della cancellazione:');
    if (reason === null) return;
    // TODO: Implementare chiamata al service per cancellare appuntamento
    console.log('[OperatorWorkspaceContainer] Cancel appointment:', this.selectedAppointment.id, reason);
  }

  private buildCompletionSummary(data: TreatmentCompletionData): string {
    const parts: string[] = [];

    if (data.painAssessment.painBefore !== undefined || data.painAssessment.painAfter !== undefined) {
      const painBefore = data.painAssessment.painBefore ?? '-';
      const painAfter = data.painAssessment.painAfter ?? '-';
      parts.push(`Dolore (VAS): Prima ${painBefore}/10 → Dopo ${painAfter}/10`);
    }

    if (data.rescheduling.suggestInDays) {
      parts.push(`Riprogrammare fra ${data.rescheduling.suggestInDays} giorni`);
    }
    if (data.rescheduling.suggestDateRangeStart) {
      parts.push(`Riprogrammare dal ${data.rescheduling.suggestDateRangeStart} al ${data.rescheduling.suggestDateRangeEnd}`);
    }
    if (data.rescheduling.secretaryNotes) {
      parts.push(`Note segreteria: ${data.rescheduling.secretaryNotes}`);
    }
    if (data.pricing.price) {
      parts.push(`Tariffa: EUR ${data.pricing.price.toFixed(2)}`);
    }
    if (data.notes.operatorNotes) {
      parts.push(`Note operatore: ${data.notes.operatorNotes}`);
    }
    if (data.notes.patientNotes) {
      parts.push(`Info paziente: ${data.notes.patientNotes}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'Nessuna nota aggiuntiva';
  }

  // ============ PRIVATE HELPERS ============

  private selectOperator(operator: Operator): void {
    this.selectedOperator = operator;
    this.uiState = {
      ...this.uiState,
      selectedOperatorId: operator.id
    };
    this.loadAppointments();
  }
}
