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
  NgZone,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { StartTreatmentDialogContainer, StartTreatmentResult } from './start-treatment-dialog.container';
import { EditTreatmentDialogContainerComponent } from './edit-treatment-dialog.container';
import { Treatment, CompleteTreatmentInput } from '../../../models/treatment.model';
import { TreatmentService } from '../../../services/treatment.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';

@Component({
  selector: 'app-operator-workspace-container',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    WorkspaceHeaderComponent,
    AppointmentsSidebarComponent,
    TreatmentCardComponent,
    PatientFolderContainer,
    StartTreatmentDialogContainer,
    EditTreatmentDialogContainerComponent
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
          <!-- PARTE SUPERIORE: Dettagli appuntamento (collapsible) -->
          <section class="treatment-section" [class.collapsed]="treatmentSectionCollapsed">
            <!-- Header sezione con titolo e toggle -->
            <div class="section-header">
              <div class="section-title">
                <mat-icon>event_note</mat-icon>
                <h3>Dettagli Appuntamento</h3>
              </div>
              <button mat-icon-button
                      (click)="toggleTreatmentSection()"
                      [matTooltip]="treatmentSectionCollapsed ? 'Espandi sezione' : 'Comprimi sezione'">
                <mat-icon>{{ treatmentSectionCollapsed ? 'expand_more' : 'expand_less' }}</mat-icon>
              </button>
            </div>

            <!-- Contenuto (nascosto se collapsed) -->
            @if (!treatmentSectionCollapsed) {
              <div class="section-content">
                <app-treatment-card
                  [appointment]="selectedAppointment"
                  [patient]="selectedPatient"
                  [currentTreatment]="currentTreatment"
                  [loading]="uiState.loadingPatient"
                  (startTreatment)="onStartTreatment()"
                  (completeTreatment)="onCompleteTreatment($event)"
                  (editTreatment)="onEditTreatment($event)"
                  (finishTreatment)="onFinishTreatment($event)"
                  (cancelTreatment)="onCancelTreatment($event)"
                  (viewPatientFolder)="onViewPatientFolder()"
                  (deleteNonRetribuito)="onDeleteNonRetribuito($event)">
                </app-treatment-card>
              </div>
            }
          </section>

          <!-- PARTE INFERIORE: Scheda paziente -->
          <section class="patient-folder-section">
            <!-- Header sezione con titolo -->
            <div class="section-header patient-folder-header">
              <div class="section-title">
                <mat-icon>folder_shared</mat-icon>
                <h3>Cartella Paziente</h3>
              </div>
            </div>

            <div class="section-content">
              <app-patient-folder-container
                [patient]="selectedPatient"
                [currentOperatorId]="selectedOperator?.id"
                (viewPatientDetails)="onViewPatientDetails($event)"
                (editTreatment)="onEditTreatmentFromFolder($event)">
              </app-patient-folder-container>
            </div>
          </section>
        </main>
      </div>

      <!-- Start Treatment Dialog Container -->
      <app-start-treatment-dialog-container
        #startTreatmentDialog
        [appointmentId]="selectedAppointment?.id?.toString() || ''"
        [patientId]="selectedPatient?.id || 0"
        [patientName]="getPatientFullName()"
        [operatorId]="selectedOperator?.id || ''"
        [serviceId]="getServiceId()"
        [serviceName]="getServiceName()"
        [servicePrice]="getServicePrice()"
        [appointmentStatus]="selectedAppointment?.bookingStatus"
        [defaultPathId]="getSelectedPathId()"
        (treatmentStarted)="onTreatmentStarted($event)"
        (cancel)="onStartTreatmentDialogCancel()"
        (createPath)="onCreatePathFromTreatmentDialog()">
      </app-start-treatment-dialog-container>

      <!-- Edit Treatment Dialog Container -->
      <app-edit-treatment-dialog-container
        #editTreatmentDialog
        [patientId]="selectedPatient?.id || 0"
        (treatmentUpdated)="onTreatmentUpdated($event)"
        (cancel)="onEditTreatmentDialogCancel()">
      </app-edit-treatment-dialog-container>
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
      min-height: 0;  // Critico per propagare il constraint di scroll ai figli
    }

    /* Section headers */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px 12px 0 0;
      min-height: 48px;

      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        h3 {
          margin: 0;
          font-size: 0.9375rem;
          font-weight: 600;
        }
      }

      button {
        color: white;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      }
    }

    .section-content {
      padding: 0;
    }

    /* Treatment section */
    .treatment-section {
      flex-shrink: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;

      &.collapsed {
        .section-header {
          border-radius: 12px;
        }
      }
    }

    /* Patient folder section */
    .patient-folder-section {
      flex: 1;
      min-height: 0;  // Permette contrazione, scrollbar interna sui trattamenti
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;

      .section-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .patient-folder-header {
        flex-shrink: 0;
      }
    }

    /* Responsive */
    @media (max-width: 599px) {
      .workspace-content {
        flex-direction: column;
        padding: 0.5rem;
      }

      .section-header {
        padding: 10px 12px;
        min-height: 44px;

        .section-title h3 {
          font-size: 0.875rem;
        }
      }

      .patient-folder-section {
        overflow: visible;  // Permette al contenuto di crescere in mobile
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperatorWorkspaceContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild('startTreatmentDialog') startTreatmentDialog!: StartTreatmentDialogContainer;
  @ViewChild('editTreatmentDialog') editTreatmentDialog!: EditTreatmentDialogContainerComponent;
  @ViewChild(PatientFolderContainer) patientFolderContainer!: PatientFolderContainer;

  // Stato UI
  uiState: WorkspaceUIState = createInitialWorkspaceUIState();
  treatmentSectionCollapsed = false;

  // Dati
  operators: Operator[] = [];
  selectedOperator: Operator | null = null;
  appointments: AvailabilityAppointment[] = [];
  selectedAppointment: AvailabilityAppointment | null = null;
  selectedPatient: Patient | null = null;
  currentTreatment: Treatment | null = null;  // Trattamento in corso

  constructor(
    private workspaceService: OperatorWorkspaceService,
    private treatmentService: TreatmentService,
    private appointmentService: AvailabilityAppointmentService,
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

  private loadTreatmentForAppointment(appointmentId: string): void {
    this.treatmentService.getTreatmentByAppointment(appointmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (treatment) => {
          this.ngZone.run(() => {
            this.currentTreatment = treatment;
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[OperatorWorkspaceContainer] Error loading treatment:', err);
          this.ngZone.run(() => {
            this.currentTreatment = null;
            this.cdr.markForCheck();
          });
        }
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

    // Auto-expand della sezione dettagli appuntamento quando si seleziona un nuovo appuntamento
    if (this.treatmentSectionCollapsed) {
      this.treatmentSectionCollapsed = false;
    }

    // Reset trattamento corrente quando cambia appuntamento
    this.currentTreatment = null;

    // Carica paziente se presente - patientId potrebbe essere in participant o nell'appointment
    const patientId = (appointment as any).patientId || (appointment as any).participant?.id;
    if (patientId) {
      this.loadPatient(patientId);
    } else {
      this.selectedPatient = null;
    }

    // Carica trattamento esistente per questo appuntamento
    this.loadTreatmentForAppointment(String(appointment.id));

    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.uiState = {
      ...this.uiState,
      sidebarCollapsed: !this.uiState.sidebarCollapsed
    };
    this.cdr.markForCheck();
  }

  toggleTreatmentSection(): void {
    this.treatmentSectionCollapsed = !this.treatmentSectionCollapsed;
    this.cdr.markForCheck();
  }

  clearError(): void {
    this.uiState = { ...this.uiState, error: null };
    this.cdr.markForCheck();
  }

  // Treatment handlers
  onStartTreatment(): void {
    if (!this.selectedAppointment || !this.selectedPatient) {
      console.warn('[OperatorWorkspaceContainer] Cannot start treatment: no appointment or patient selected');
      return;
    }

    console.log('[OperatorWorkspaceContainer] Opening start treatment dialog');
    this.startTreatmentDialog.open();
  }

  onTreatmentStarted(result: StartTreatmentResult): void {
    console.log('[OperatorWorkspaceContainer] Treatment started:', result);
    this.currentTreatment = result.treatment;

    // Il trattamento è stato creato con successo
    // La TreatmentCard mostrerà automaticamente lo stato "in corso"
    this.cdr.markForCheck();

    // Ricarica la lista trattamenti nella cartella paziente
    if (this.patientFolderContainer) {
      this.patientFolderContainer.reloadTreatments();
    }
  }

  onStartTreatmentDialogCancel(): void {
    console.log('[OperatorWorkspaceContainer] Start treatment dialog cancelled');
  }

  onCreatePathFromTreatmentDialog(): void {
    console.log('[OperatorWorkspaceContainer] Create path requested from treatment dialog');
    // Apri il dialog per la creazione del percorso
    // Puoi accedere al PatientFolderContainer tramite ViewChild se necessario
    // oppure gestire l'evento qui direttamente
    alert('Funzionalità "Crea Percorso" - Il dialog di creazione percorso verrà aperto dalla scheda paziente');
    // Dopo la creazione del percorso, si può chiamare:
    // this.startTreatmentDialog.retryAfterPathCreated();
  }

  // Helper methods for dialog data
  getPatientFullName(): string {
    if (!this.selectedPatient) return '';
    return `${this.selectedPatient.nome} ${this.selectedPatient.cognome}`;
  }

  getServiceName(): string | undefined {
    if (!this.selectedAppointment) return undefined;
    // Cerca il nome del servizio nell'appuntamento
    const apt = this.selectedAppointment as any;
    return apt.serviceName || apt.service?.name || apt.title || undefined;
  }

  getServicePrice(): number | undefined {
    if (!this.selectedAppointment) return undefined;
    // Cerca il prezzo del servizio nell'appuntamento
    const apt = this.selectedAppointment as any;
    return apt.servicePrice || apt.service?.price || undefined;
  }

  getServiceId(): string | undefined {
    if (!this.selectedAppointment) return undefined;
    // Cerca l'ID del servizio nell'appuntamento
    const apt = this.selectedAppointment as any;
    return apt.serviceId || apt.service?.id || undefined;
  }

  getSelectedPathId(): string | undefined {
    // Recupera l'ID del percorso selezionato dalla cartella paziente
    return this.patientFolderContainer?.getSelectedPathId() || undefined;
  }

  onCompleteTreatment(data: TreatmentCompletionData): void {
    if (!this.selectedAppointment) return;
    console.log('[OperatorWorkspaceContainer] Complete treatment:', data);
    // TODO: Implementare chiamata al service per completare trattamento
    alert('Trattamento completato!\n\n' + this.buildCompletionSummary(data));
  }

  onEditTreatment(treatment: Treatment): void {
    console.log('[OperatorWorkspaceContainer] Edit treatment:', treatment.id);
    if (this.editTreatmentDialog) {
      this.editTreatmentDialog.open(treatment);
    }
  }

  onEditTreatmentFromFolder(treatment: Treatment): void {
    console.log('[OperatorWorkspaceContainer] Edit treatment from folder:', treatment.id);
    if (this.editTreatmentDialog) {
      this.editTreatmentDialog.open(treatment);
    }
  }

  onTreatmentUpdated(treatment: Treatment): void {
    console.log('[OperatorWorkspaceContainer] Treatment updated:', {
      id: treatment.id,
      therapeuticPathId: treatment.therapeuticPathId,
      serviceId: treatment.serviceId,
      price: treatment.price
    });
    this.ngZone.run(() => {
      this.currentTreatment = treatment;
      this.cdr.markForCheck();

      // Ricarica trattamenti nella cartella paziente
      if (this.patientFolderContainer) {
        this.patientFolderContainer.reloadTreatments();
      }
    });
  }

  onEditTreatmentDialogCancel(): void {
    console.log('[OperatorWorkspaceContainer] Edit treatment dialog cancelled');
  }

  onFinishTreatment(treatment: Treatment): void {
    console.log('[OperatorWorkspaceContainer] Finish treatment:', treatment.id);

    if (!confirm('Confermi di voler completare il trattamento?')) {
      return;
    }

    const input: CompleteTreatmentInput = {
      price: treatment.price || 0,
      clinicalNotes: treatment.clinicalNotes,
      secretaryNotes: treatment.secretaryNotes,
      operatorNotes: treatment.operatorNotes
    };

    this.treatmentService.completeTreatment(treatment.id, input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTreatment) => {
          this.ngZone.run(() => {
            console.log('[OperatorWorkspaceContainer] Treatment completed successfully:', updatedTreatment.id);
            this.currentTreatment = updatedTreatment;
            this.cdr.markForCheck();
            // Ricarica trattamenti nella cartella paziente
            if (this.patientFolderContainer) {
              this.patientFolderContainer.reloadTreatments();
            }
          });
        },
        error: (err) => {
          console.error('[OperatorWorkspaceContainer] Error completing treatment:', err);
          this.ngZone.run(() => {
            alert('Errore durante il completamento del trattamento');
            this.cdr.markForCheck();
          });
        }
      });
  }

  onCancelTreatment(treatment: Treatment): void {
    if (!confirm('Sei sicuro di voler annullare questo trattamento in corso?')) {
      return;
    }

    this.treatmentService.deleteTreatment(treatment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          this.ngZone.run(() => {
            if (success) {
              console.log('[OperatorWorkspaceContainer] Treatment cancelled:', treatment.id);
              this.currentTreatment = null;
              // Ricarica trattamenti nella cartella paziente
              if (this.patientFolderContainer) {
                this.patientFolderContainer.reloadTreatments();
              }
            }
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[OperatorWorkspaceContainer] Error cancelling treatment:', err);
          this.ngZone.run(() => {
            alert('Errore durante l\'annullamento del trattamento');
            this.cdr.markForCheck();
          });
        }
      });
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

  // NOTA: onCancelAppointment() rimosso - richiede sistema notifiche per segreteria
  // Vedere Section 11 del piano: /home/marco/.claude/plans/cosmic-wishing-fairy.md

  /**
   * Gestisce l'eliminazione di un appuntamento non retribuito
   * Layer 3: Business logic orchestration
   */
  onDeleteNonRetribuito(appointment: AvailabilityAppointment): void {
    const confirmed = window.confirm(`Eliminare "${appointment.clientName}"?`);
    if (!confirmed) return;

    this.appointmentService.deleteAppointment(String(appointment.id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          this.ngZone.run(() => {
            if (success) {
              console.log('[OperatorWorkspaceContainer] Non-retribuito appointment deleted:', appointment.id);
              // Ricarica appuntamenti
              this.loadAppointments();
              // Deseleziona appuntamento
              this.selectedAppointment = null;
              this.selectedPatient = null;
              this.currentTreatment = null;
              this.uiState = {
                ...this.uiState,
                selectedAppointmentId: null
              };
            }
            this.cdr.markForCheck();
          });
        },
        error: (error) => {
          console.error('[OperatorWorkspaceContainer] Error deleting non-retribuito appointment:', error);
          this.ngZone.run(() => {
            alert('Errore durante l\'eliminazione dell\'appuntamento');
            this.cdr.markForCheck();
          });
        }
      });
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
