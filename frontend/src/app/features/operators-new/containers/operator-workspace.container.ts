/**
 * Operator Workspace Container
 * Layer 2: Smart Component - Coordinatore Principale
 *
 * Responsabilità:
 * - Gestione stato globale del workspace
 * - Orchestrazione caricamento dati (appuntamenti, paziente)
 * - Coordinamento tra componenti figli
 * - Gestione eventi UI
 * - Usa OperatorWorkspaceStateService per operatore/data condivisi
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
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, filter, distinctUntilChanged, take } from 'rxjs/operators';

import { Operator, AvailabilityAppointment } from '../../../graphql/generated/types';
import { Patient } from '../../../models/patient.model';

import {
  WorkspaceUIState,
  createInitialWorkspaceUIState
} from '../models';

import { OperatorWorkspaceService } from '../services/operator-workspace.service';
import { OperatorWorkspaceStateService } from '../services/operator-workspace-state.service';
import { AppointmentsSidebarComponent } from '../components/appointments-sidebar/appointments-sidebar.component';
import { TreatmentCardComponent, TreatmentCompletionData } from '../components/treatment-card/treatment-card.component';
import { PatientFolderContainer } from './patient-folder.container';
import { StartTreatmentDialogContainer, StartTreatmentResult } from './start-treatment-dialog.container';
import { EditTreatmentDialogContainerComponent } from './edit-treatment-dialog.container';
import { Treatment, CompleteTreatmentInput } from '../../../models/treatment.model';
import { TreatmentService } from '../../../services/treatment.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { TherapeuticPathService } from '../../../services/therapeutic-path.service';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { PermissionsService } from '../../../core/services/permissions.service';
import { SseService, CalendarEvent } from '../../../services/sse.service';

@Component({
  selector: 'app-operator-workspace-container',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    AppointmentsSidebarComponent,
    TreatmentCardComponent,
    PatientFolderContainer,
    StartTreatmentDialogContainer,
    EditTreatmentDialogContainerComponent
  ],
  template: `
    <div class="operator-workspace-new">
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
        [patientId]="selectedPatient?.id || ''"
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
        [patientId]="selectedPatient?.id || ''"
        (treatmentUpdated)="onTreatmentUpdated($event)"
        (cancel)="onEditTreatmentDialogCancel()">
      </app-edit-treatment-dialog-container>

      <!-- Mini-dialog: scelta percorso (paziente con più percorsi attivi) -->
      @if (showPathChooser) {
        <div class="ws-overlay" (click)="onPathChooserCancel()">
          <div class="ws-mini-dialog" (click)="$event.stopPropagation()">
            <div class="ws-mini-header">
              <mat-icon>route</mat-icon>
              <h3>Scegli il percorso terapeutico</h3>
            </div>
            <p class="ws-mini-sub">
              Il paziente ha più percorsi attivi. Seleziona quello su cui avviare il trattamento.
            </p>
            <div class="ws-path-list">
              @for (p of pathChooserOptions; track p.id) {
                <button class="ws-path-item" type="button" (click)="onPathChosen(p)">
                  <mat-icon>arrow_forward</mat-icon>
                  <span class="ws-path-name">{{ p.name }}</span>
                </button>
              }
            </div>
            <div class="ws-mini-actions">
              <button mat-button (click)="onPathChooserCancel()">Annulla</button>
            </div>
          </div>
        </div>
      }

      <!-- Avviso: nessun percorso attivo -->
      @if (showNoPathNotice) {
        <div class="ws-overlay" (click)="onNoPathNoticeClose()">
          <div class="ws-mini-dialog" (click)="$event.stopPropagation()">
            <div class="ws-mini-header warn">
              <mat-icon>info</mat-icon>
              <h3>Nessun percorso terapeutico attivo</h3>
            </div>
            <p class="ws-mini-sub">
              Per avviare un trattamento serve un percorso terapeutico. Crea una
              <strong>Nuova Valutazione</strong> dalla scheda paziente: verranno create automaticamente
              valutazione, percorso e anamnesi. Poi riavvia il trattamento.
            </p>
            <div class="ws-mini-actions">
              <button mat-flat-button color="primary" (click)="onNoPathNoticeClose()">Ho capito</button>
            </div>
          </div>
        </div>
      }
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
      align-items: flex-start;  /* Ogni sezione ha altezza naturale, scroll basato sulla più alta */
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

    /* Responsive - Mobile */
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

    /* Mini-dialog scelta percorso / avviso */
    .ws-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 24px;
    }

    .ws-mini-dialog {
      background: #fff;
      border-radius: 12px;
      width: 100%;
      max-width: 440px;
      padding: 20px 24px;
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14);
    }

    .ws-mini-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;

      h3 { margin: 0; font-size: 1.1rem; color: #1e293b; }
      mat-icon { color: #667eea; }
      &.warn mat-icon { color: #f59e0b; }
    }

    .ws-mini-sub {
      margin: 0 0 16px;
      color: #64748b;
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .ws-path-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
      max-height: 320px;
      overflow-y: auto;
    }

    .ws-path-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      cursor: pointer;
      text-align: left;
      font: inherit;
      transition: all 0.15s;

      &:hover { background: #eef2ff; border-color: #667eea; }

      mat-icon { color: #94a3b8; flex-shrink: 0; }
      .ws-path-name { font-weight: 500; color: #1e293b; }
    }

    .ws-mini-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
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

  // Dati - operatore e data vengono dal servizio condiviso
  selectedOperator: Operator | null = null;
  selectedDate: Date = new Date();
  appointments: AvailabilityAppointment[] = [];
  selectedAppointment: AvailabilityAppointment | null = null;
  selectedPatient: Patient | null = null;
  currentTreatment: Treatment | null = null;  // Trattamento in corso

  // Mini-dialog "scegli percorso" (quando il paziente ha più percorsi attivi).
  showPathChooser = false;
  pathChooserOptions: TherapeuticPath[] = [];
  // Avviso "nessun percorso attivo".
  showNoPathNotice = false;

  constructor(
    private stateService: OperatorWorkspaceStateService,
    private workspaceService: OperatorWorkspaceService,
    private treatmentService: TreatmentService,
    private appointmentService: AvailabilityAppointmentService,
    private pathService: TherapeuticPathService,
    private permissions: PermissionsService,
    private sse: SseService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('[OperatorWorkspaceContainer] Inizializzato');

    // Garantisce che il profilo permessi sia caricato anche se si arriva qui
    // con un reload diretto (senza ripassare dal callback di login). Senza
    // questo, per l'admin i pulsanti azione sul trattamento restano disabilitati
    // perché permissions() è vuoto → il bypass admin non scatta.
    this.permissions.ensureLoaded()
      .then(() => this.cdr.markForCheck())
      .catch(() => null);

    // Sottoscrivi ai cambiamenti di operatore e data dal servizio condiviso
    combineLatest([
      this.stateService.selectedOperator$.pipe(
        filter((op): op is Operator => op !== null),
        distinctUntilChanged((a, b) => a.id === b.id)
      ),
      this.stateService.selectedDate$.pipe(
        distinctUntilChanged((a, b) => a.getTime() === b.getTime())
      )
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([operator, date]) => {
        this.ngZone.run(() => {
          this.selectedOperator = operator;
          this.selectedDate = date;
          this.uiState = {
            ...this.uiState,
            selectedDate: date,
            selectedOperatorId: operator.id
          };
          this.loadAppointments();
          this.cdr.markForCheck();
        });
      });

    // Realtime: il backend (cron/cascata o segreteria) può cambiare lo stato
    // dell'appuntamento o creare/annullare il trattamento mentre l'operatore è
    // sulla pagina. Senza ascoltare la SSE la pagina resterebbe su dati vecchi
    // → conflitti (es. "esiste già un trattamento"). Aggiorniamo in automatico,
    // in modo silenzioso.
    this.sse.getAppointmentEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: CalendarEvent) => this.handleSseEvent(event));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ DATA LOADING ============

  private loadAppointments(): void {
    if (!this.selectedOperator) return;

    this.uiState = { ...this.uiState, loadingAppointments: true };
    this.cdr.markForCheck();

    this.workspaceService.loadAppointments(this.selectedOperator.id, this.selectedDate)
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

  private loadPatient(patientId: string): void {
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

  // ============ REALTIME (SSE) ============

  /**
   * Gestisce gli eventi SSE per tenere allineata la pagina operatori con lo
   * stato lato server (cambi stato appuntamento + creazione/annullo trattamento
   * fatti da cron/cascata o dalla segreteria su un altro client).
   * Reagisce solo a ciò che riguarda l'appuntamento attualmente aperto.
   */
  private handleSseEvent(event: CalendarEvent): void {
    if (!event || event.type === 'heartbeat') return;

    const currentApptId = this.selectedAppointment?.id != null
      ? String(this.selectedAppointment.id)
      : null;

    if (event.type === 'appointment_status_changed') {
      // Aggiorna la sidebar (stato programmato → presentato, ecc.) ricaricando
      // gli appuntamenti del giorno. Se l'evento riguarda l'appuntamento aperto,
      // ricarica anche il suo trattamento.
      const ids = (event.appointmentIds ?? []).map(String);
      const touchesDay = ids.length > 0; // gli id sono del tenant; ricarico il giorno comunque
      if (touchesDay) {
        this.refreshAppointmentsKeepingSelection();
      }
      if (currentApptId && ids.includes(currentApptId)) {
        this.reloadCurrentTreatment(currentApptId);
      }
      return;
    }

    if (
      event.type === 'treatment_created' ||
      event.type === 'treatment_status_changed' ||
      event.type === 'treatment_deleted'
    ) {
      // Gli eventi trattamento non portano l'appointmentId: se ho un appuntamento
      // aperto, ricarico il suo trattamento (query leggera) per riflettere
      // eventuale auto-start/annullo. La scheda paziente si aggiorna da sé.
      if (currentApptId) {
        this.reloadCurrentTreatment(currentApptId);
        // Se nel frattempo era aperto il mini-dialog "scegli percorso" o
        // l'avviso "nessun percorso", li chiudo: il trattamento potrebbe essere
        // appena nato lato server e la scelta non ha più senso.
        if (event.type === 'treatment_created' && (this.showPathChooser || this.showNoPathNotice)) {
          this.showPathChooser = false;
          this.showNoPathNotice = false;
          this.pathChooserOptions = [];
        }
      }
      if (this.patientFolderContainer) {
        this.patientFolderContainer.reloadTreatments();
      }
      return;
    }
  }

  /** Ricarica il trattamento dell'appuntamento aperto senza resettare la UI. */
  private reloadCurrentTreatment(appointmentId: string): void {
    this.treatmentService.getTreatmentByAppointment(appointmentId)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (treatment) => {
          this.ngZone.run(() => {
            this.currentTreatment = treatment;
            this.cdr.markForCheck();
          });
        },
        error: () => { /* assenza trattamento = nessun cambiamento */ },
      });
  }

  /**
   * Ricarica gli appuntamenti del giorno mantenendo l'appuntamento selezionato
   * (a differenza di loadAppointments() che deseleziona). Aggiorna gli stati in
   * sidebar senza perdere il contesto dell'operatore.
   */
  private refreshAppointmentsKeepingSelection(): void {
    if (!this.selectedOperator) return;
    const keepId = this.selectedAppointment?.id != null ? String(this.selectedAppointment.id) : null;

    this.workspaceService.loadAppointments(this.selectedOperator.id, this.selectedDate)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(result => {
        this.ngZone.run(() => {
          this.appointments = result.appointments;
          // Riallinea il riferimento all'appuntamento selezionato all'oggetto
          // aggiornato (nuovo bookingStatus), senza deselezionarlo.
          if (keepId) {
            const updated = this.appointments.find(a => String(a.id) === keepId);
            if (updated) this.selectedAppointment = updated;
          }
          this.cdr.markForCheck();
        });
      });
  }

  // ============ EVENT HANDLERS ============

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
  /**
   * "Inizia trattamento": NON apre più il modulo (che l'operatore compila a
   * fine trattamento, in chiusura). Apre direttamente il trattamento:
   *  - 1 solo percorso attivo  → crea subito il trattamento su quel percorso;
   *  - 0 o >1 percorsi attivi  → apre il dialog per scegliere/creare il percorso
   *    (caso ambiguo, serve l'input dell'operatore).
   */
  onStartTreatment(): void {
    if (!this.selectedAppointment || !this.selectedPatient) {
      console.warn('[OperatorWorkspaceContainer] Cannot start treatment: no appointment or patient selected');
      return;
    }

    const status = this.selectedAppointment.bookingStatus?.toString().toUpperCase();
    if (status !== 'ATTENDED') {
      // Stesso vincolo del dialog: serve paziente presentato.
      this.startTreatmentDialog.open();
      return;
    }

    this.pathService.getActivePathsByPatient(this.selectedPatient.id)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (activePaths) => {
          this.ngZone.run(() => {
            if (activePaths.length === 1) {
              // Percorso unico → trattamento diretto, niente modulo.
              this.createTreatmentDirect(activePaths[0].id);
            } else if (activePaths.length === 0) {
              // Nessun percorso → avviso: serve creare prima una valutazione
              // (che crea percorso + anamnesi + valutazione).
              this.showNoPathNotice = true;
              this.cdr.markForCheck();
            } else {
              // Più percorsi → mini-dialog di sola scelta del percorso.
              this.pathChooserOptions = activePaths;
              this.showPathChooser = true;
              this.cdr.markForCheck();
            }
          });
        },
        error: (err) => {
          console.error('[OperatorWorkspaceContainer] Error loading active paths:', err);
          this.ngZone.run(() => {
            alert('Errore nel caricamento dei percorsi del paziente. Riprova.');
            this.cdr.markForCheck();
          });
        }
      });
  }

  /** Mini-dialog: percorso scelto → crea il trattamento e chiudi. */
  onPathChosen(path: TherapeuticPath): void {
    this.showPathChooser = false;
    this.pathChooserOptions = [];
    this.createTreatmentDirect(path.id);
    this.cdr.markForCheck();
  }

  onPathChooserCancel(): void {
    this.showPathChooser = false;
    this.pathChooserOptions = [];
    this.cdr.markForCheck();
  }

  onNoPathNoticeClose(): void {
    this.showNoPathNotice = false;
    this.cdr.markForCheck();
  }

  /**
   * Crea il trattamento direttamente (senza modulo) sul percorso dato e lo
   * mette in corso. I dati clinici/economici si compilano dopo, in chiusura.
   */
  private createTreatmentDirect(pathId: string): void {
    if (!this.selectedAppointment?.id) return;

    this.treatmentService.createTreatment(
      this.selectedAppointment.id.toString(),
      pathId,
      false,
    )
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (treatment) => {
          this.ngZone.run(() => {
            this.currentTreatment = treatment;
            if (this.patientFolderContainer) {
              this.patientFolderContainer.reloadTreatments();
            }
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          // Race condition: nel frattempo il backend (cascata/cron) può aver già
          // creato il trattamento per questo appuntamento → 409 "esiste già".
          // Non è un vero errore: ricarichiamo il trattamento esistente.
          if (this.isAlreadyExistsError(err)) {
            console.warn('[OperatorWorkspaceContainer] Trattamento già esistente (race), ricarico.');
            this.ngZone.run(() => {
              if (this.selectedAppointment?.id) {
                this.reloadCurrentTreatment(String(this.selectedAppointment.id));
              }
              if (this.patientFolderContainer) {
                this.patientFolderContainer.reloadTreatments();
              }
              this.cdr.markForCheck();
            });
            return;
          }
          console.error('[OperatorWorkspaceContainer] Error creating treatment directly:', err);
          this.ngZone.run(() => {
            alert('Errore durante l\'avvio del trattamento. Riprova.');
            this.cdr.markForCheck();
          });
        }
      });
  }

  /**
   * True se l'errore è il conflitto "esiste già un trattamento per
   * l'appuntamento" (status 409). Robusto a diverse forme dell'errore Apollo.
   */
  private isAlreadyExistsError(err: any): boolean {
    const status =
      err?.graphQLErrors?.[0]?.extensions?.status ??
      err?.graphQLErrors?.[0]?.extensions?.originalError?.statusCode;
    if (status === 409) return true;
    const msg: string =
      err?.graphQLErrors?.[0]?.message ?? err?.message ?? '';
    return /esiste gi[àa]/i.test(msg) || /already exists|conflict/i.test(msg);
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
    console.log('[OperatorWorkspaceContainer] Finish treatment - opening edit dialog:', treatment.id);
    if (this.editTreatmentDialog) {
      this.editTreatmentDialog.open(treatment);
    }
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

}
