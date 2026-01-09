import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, forkJoin } from 'rxjs';

// Components
import { OperatorSelectorComponent } from '../operator-selector/operator-selector.component';
import { DailyAppointmentsListComponent } from '../daily-appointments-list/daily-appointments-list.component';
import { CurrentTreatmentCardComponent, TreatmentCompletionData } from '../current-treatment-card/current-treatment-card.component';
import { PatientFolderComponent } from '../patient-folder/patient-folder.component';

// Services
import { OperatorService } from '../../../services/operator.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { PatientService } from '../../../services/patient.service';
import { TherapeuticPathService } from '../../../services/therapeutic-path.service';

// Models
import { Operator } from '../../../graphql/generated/types';
import { Appointment } from '../../../models/appointment.model';
import { mapAvailabilityAppointmentToAppointment } from '../../../utils/appointment.mapper';
import { Patient } from '../../../models/patient.model';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';

@Component({
  selector: 'app-operator-workspace',
  standalone: true,
  imports: [
    CommonModule,
    OperatorSelectorComponent,
    DailyAppointmentsListComponent,
    CurrentTreatmentCardComponent,
    PatientFolderComponent,
  ],
  templateUrl: './operator-workspace.component.html',
  styleUrls: ['./operator-workspace.component.scss'],
})
export class OperatorWorkspaceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  operators: Operator[] = [];
  selectedOperator: Operator | null = null;
  todayAppointments: Appointment[] = [];
  selectedAppointment: Appointment | null = null;
  selectedPatient: Patient | null = null;
  patientPaths: TherapeuticPath[] = [];

  // UI State
  loading = false;
  loadingOperators = false;
  loadingAppointments = false;
  loadingPatient = false;
  error: string | null = null;
  sidebarCollapsed = false;

  // Date
  selectedDate = new Date();

  constructor(
    private operatorService: OperatorService,
    private appointmentService: AvailabilityAppointmentService,
    private patientService: PatientService,
    private pathService: TherapeuticPathService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadOperators();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ DATA LOADING ============

  loadOperators(): void {
    this.loadingOperators = true;
    this.error = null;

    this.operatorService.getOperators(undefined, undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operators) => {
          this.operators = operators || [];
          this.loadingOperators = false;

          // Auto-select first operator if available
          if (this.operators.length > 0 && !this.selectedOperator) {
            this.onOperatorChange(this.operators[0]);
          }
        },
        error: (err) => {
          console.error('Error loading operators:', err);
          this.error = 'Errore nel caricamento degli operatori';
          this.loadingOperators = false;
        }
      });
  }

  loadTodayAppointments(): void {
    if (!this.selectedOperator) return;

    this.loadingAppointments = true;
    const dateStr = this.formatDate(this.selectedDate);

    this.appointmentService.getAppointmentsByOperator(
      this.selectedOperator.id,
      dateStr,
      dateStr
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (appointments) => {
        // Map to frontend model and sort by time
        this.todayAppointments = (appointments || [])
          .map(mapAvailabilityAppointmentToAppointment)
          .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
        this.loadingAppointments = false;
      },
      error: (err) => {
        console.error('Error loading appointments:', err);
        this.error = 'Errore nel caricamento degli appuntamenti';
        this.todayAppointments = [];
        this.loadingAppointments = false;
      }
    });
  }

  loadPatientData(patientId: number): void {
    this.loadingPatient = true;

    // Load patient and paths in parallel using forkJoin
    forkJoin({
      patient: this.patientService.getPatient(patientId),
      paths: this.pathService.getPathsByPatient(patientId)
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ patient, paths }) => {
        this.selectedPatient = patient;
        this.patientPaths = paths;
        this.loadingPatient = false;
      },
      error: (err) => {
        console.error('Error loading patient data:', err);
        this.selectedPatient = null;
        this.patientPaths = [];
        this.loadingPatient = false;
      }
    });
  }

  // ============ EVENT HANDLERS ============

  onOperatorChange(operator: Operator): void {
    this.selectedOperator = operator;
    this.selectedAppointment = null;
    this.selectedPatient = null;
    this.patientPaths = [];
    this.loadTodayAppointments();
  }

  onAppointmentSelect(appointment: Appointment): void {
    this.selectedAppointment = appointment;

    // Load patient data if patientId exists
    if (appointment.patientId) {
      this.loadPatientData(appointment.patientId);
    } else {
      this.selectedPatient = null;
      this.patientPaths = [];
    }
  }

  onStartTreatment(): void {
    if (!this.selectedAppointment) return;

    this.appointmentService.markAsAttended(this.selectedAppointment.id as string)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Update local state
          this.selectedAppointment = {
            ...this.selectedAppointment!,
            bookingStatus: 'attended',
          };

          // Update in list
          const index = this.todayAppointments.findIndex(
            (a) => a.id === this.selectedAppointment?.id
          );
          if (index >= 0) {
            this.todayAppointments[index] = this.selectedAppointment;
            this.todayAppointments = [...this.todayAppointments]; // Trigger change detection
          }
        },
        error: (err) => {
          console.error('Error starting treatment:', err);
          this.error = 'Errore nell\'avvio del trattamento';
        }
      });
  }

  onCompleteTreatment(data: TreatmentCompletionData): void {
    console.log('Treatment completed with data:', data);

    // Per MVP: mostra messaggio di conferma con riepilogo
    const summary = this.buildCompletionSummary(data);
    alert(`Trattamento completato!\n\n${summary}`);

    // TODO: In futuro, inviare al backend
  }

  private buildCompletionSummary(data: TreatmentCompletionData): string {
    const parts: string[] = [];

    // Valutazione dolore
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

  onViewPatientFolder(): void {
    // Scroll to patient folder section
    const folderElement = document.querySelector('.patient-folder-section');
    folderElement?.scrollIntoView({ behavior: 'smooth' });
  }

  onCancelAppointment(): void {
    if (!this.selectedAppointment) return;

    const reason = prompt('Motivo della cancellazione:');
    if (reason === null) return; // User cancelled

    this.appointmentService.cancelAppointment(
      this.selectedAppointment.id as string,
      reason || undefined
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        // Update local state
        this.selectedAppointment = {
          ...this.selectedAppointment!,
          bookingStatus: 'cancelled',
        };

        // Update in list
        const index = this.todayAppointments.findIndex(
          (a) => a.id === this.selectedAppointment?.id
        );
        if (index >= 0) {
          this.todayAppointments[index] = this.selectedAppointment;
          this.todayAppointments = [...this.todayAppointments];
        }
      },
      error: (err) => {
        console.error('Error cancelling appointment:', err);
        this.error = 'Errore nella cancellazione dell\'appuntamento';
      }
    });
  }

  onPathSelect(path: TherapeuticPath): void {
    // Could be used to sync selection between timeline and accordion
    console.log('Path selected:', path.name);
  }

  onPathCreated(newPath: TherapeuticPath): void {
    // Add the new path to the list
    this.patientPaths = [newPath, ...this.patientPaths];
    console.log('Path created:', newPath.name);
  }

  onPathUpdated(updatedPath: TherapeuticPath): void {
    // Update the path in the list
    const index = this.patientPaths.findIndex(p => p.id === updatedPath.id);
    if (index >= 0) {
      this.patientPaths[index] = updatedPath;
      this.patientPaths = [...this.patientPaths]; // Trigger change detection
    }
    console.log('Path updated:', updatedPath.name);
  }

  onPathDeleted(pathId: string): void {
    // Remove the path from the list
    this.patientPaths = this.patientPaths.filter(p => p.id !== pathId);
    console.log('Path deleted:', pathId);
  }

  onViewPatientDetails(patient: Patient): void {
    // For MVP, navigate to patient management or show details modal
    console.log('View patient details:', patient);
    alert(`Dettagli paziente: ${patient.nome} ${patient.cognome}\nQuesta funzionalita aprira la scheda completa del paziente`);
  }

  onToggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  // ============ HELPERS ============

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatFullDate(date: Date): string {
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // ============ DATE NAVIGATION ============

  navigatePrevious(): void {
    this.ngZone.run(() => {
      this.selectedDate = new Date(this.selectedDate);
      this.selectedDate.setDate(this.selectedDate.getDate() - 1);
      this.selectedAppointment = null;
      this.selectedPatient = null;
      this.patientPaths = [];
      this.loadTodayAppointments();
    });
  }

  navigateNext(): void {
    this.ngZone.run(() => {
      this.selectedDate = new Date(this.selectedDate);
      this.selectedDate.setDate(this.selectedDate.getDate() + 1);
      this.selectedAppointment = null;
      this.selectedPatient = null;
      this.patientPaths = [];
      this.loadTodayAppointments();
    });
  }

  navigateToToday(): void {
    this.ngZone.run(() => {
      this.selectedDate = new Date();
      this.selectedAppointment = null;
      this.selectedPatient = null;
      this.patientPaths = [];
      this.loadTodayAppointments();
    });
  }

  isToday(): boolean {
    const today = new Date();
    return this.selectedDate.toDateString() === today.toDateString();
  }
}
