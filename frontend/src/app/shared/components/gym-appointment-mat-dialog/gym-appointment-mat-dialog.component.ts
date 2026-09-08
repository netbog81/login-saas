import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { firstValueFrom, Observable, of, startWith, map, switchMap, debounceTime, distinctUntilChanged, catchError } from 'rxjs';
import { PatientService } from '../../../services/patient.service';
import { RepeatConfig } from '../../../models/appointment.model';

import { GymRoom, GymSlotInfo, GymRoomService, CreateGymAppointmentInput, UpdateGymAppointmentInput, GymAppointment } from '../../../services/gym-room.service';
import { Patient } from '../../../models/patient.model';
import { ServiceService } from '../../../services/service.service';
import { Service } from '../../../graphql/generated/types';
import { ServiceMultiSelectComponent, SelectableService, SelectedServiceItem } from '../service-multi-select';
import { NewPatientDialogComponent, NewPatientDialogResult } from '../new-patient-dialog';
import { RecurringScopePanelComponent, RecurringScopeSelection } from '../recurring-scope-panel/recurring-scope-panel.component';
import { RecurringConflictsDialogComponent } from '../recurring-scope-panel/recurring-conflicts-dialog.component';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { tokenizeQuery, matchesAllTokens } from '../../utils/token-match';
import { WhatsappChatStateService } from '../../../features/whatsapp-chat/services/whatsapp-chat-state.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  RecurrenceEditorComponent,
  DEFAULT_REPEAT_CONFIG,
  buildRepeatConfigPayload,
} from '../recurrence-editor';
import {
  ConflictBannerComponent,
  ConflictBannerAction,
} from '../../../features/conflicts/components/conflict-banner/conflict-banner.component';
import { ConflictService } from '../../../features/conflicts/services/conflict.service';
import {
  ConflictInfo,
  ConflictResolutionAction,
  ConflictResolutionResult,
} from '../../../features/conflicts/models/conflict.model';
import { GymRoomLookup } from '../../../features/gym-appointments/services/gym-rebooking.service';
import { RecurringOccurrencePreview } from '../../../features/calendar-v3/models/recurring-resolution.model';
import { GymResolvedOccurrence } from '../../../features/gym-appointments/models/gym-move.model';

/**
 * Dati passati al dialog per la creazione di un appuntamento palestra.
 */
export interface GymAppointmentMatDialogData {
  gymRoom: GymRoom;
  date: string;
  startTime: string;
  endTime: string;
  slotInfo: GymSlotInfo;
  patients: Patient[];
  /**
   * Se valorizzato, il dialog opera in modalita' MODIFICA dell'appuntamento
   * indicato (prefill + updateAppointment). Se assente, modalita' CREAZIONE.
   * Campo opzionale: i caller esistenti che non lo passano restano invariati.
   */
  appointment?: GymAppointment;
  /**
   * Sale attive: servono a proporre destinazioni alternative quando si
   * sposta o si risolve una serie. Se assente, la ricerca resta confinata
   * alla sala corrente — comportamento dei caller che non la passano.
   */
  rooms?: GymRoomLookup[];
}

/**
 * Risultato restituito dal dialog alla chiusura.
 */
export interface GymAppointmentMatDialogResult {
  created: boolean;
  appointmentId?: string;
  /**
   * Il conflitto si risolve spostando: il dialog si chiude e il container
   * apre il pannello di ricerca slot palestra. Non lo fa il dialog perché
   * quel pannello ha bisogno dell'elenco delle sale attive, che il container
   * ha già caricato per la griglia.
   */
  requestMove?: boolean;
}

/**
 * Dialog per la creazione di un nuovo appuntamento palestra.
 *
 * Utilizza MatDialog di Angular Material per garantire una corretta
 * gestione della change detection in qualsiasi contesto.
 *
 * Segue l'architettura a 5 layer:
 * - Layer 3: Dumb Component (presentazionale)
 * - Usa ChangeDetectionStrategy.OnPush
 * - Riceve dati via MAT_DIALOG_DATA
 * - Restituisce risultati via MatDialogRef.close()
 *
 * Integra:
 * - ServiceMultiSelectComponent per selezione multipla servizi
 * - NewPatientDialogComponent per aggiunta nuovo paziente
 */
@Component({
  selector: 'app-gym-appointment-mat-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatTooltipModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatRadioModule,
    FormsModule,
    ServiceMultiSelectComponent,
    RecurringScopePanelComponent,
    RecurrenceEditorComponent,
    ConflictBannerComponent,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEditMode ? 'Modifica Appuntamento Palestra' : 'Nuovo Appuntamento Palestra' }}</h2>

    <mat-dialog-content>
      <!-- Conflitto di disponibilità: in cima, prima di ogni campo. In
           palestra nasce quando un'assenza dell'istruttore lascia lo slot
           scoperto e nessun sostituto lo copre. -->
      <app-conflict-banner
        [conflict]="conflictInfo"
        [readOnly]="resolvingConflict"
        moveTooltip="Cerca uno slot libero (anche in un'altra sala) e spostala lì"
        (action)="onConflictAction($event)">
      </app-conflict-banner>

      <!-- Info Slot (read-only) -->
      <div class="slot-info">
        <div class="info-row">
          <mat-icon>fitness_center</mat-icon>
          <span>{{ data.gymRoom.name }}</span>
        </div>
        <div class="info-row">
          <mat-icon>event</mat-icon>
          <span>{{ formattedDate }}</span>
        </div>
        <div class="info-row">
          <mat-icon>schedule</mat-icon>
          <span>{{ data.startTime }} - {{ data.endTime }}</span>
        </div>
        <div class="info-row" *ngIf="operatorName">
          <mat-icon>person</mat-icon>
          <span>{{ operatorName }}</span>
        </div>
      </div>

      <mat-divider></mat-divider>

      <form [formGroup]="form" class="appointment-form">
        <!-- Paziente in MODIFICA: sola lettura. Riassegnare la prenotazione a
             un altro paziente e' un'azione rara e distruttiva, quindi richiede
             lo sblocco esplicito con "Cambia paziente". -->
        <div class="patient-locked" *ngIf="patientLocked">
          <mat-icon class="patient-locked-icon">person</mat-icon>
          <div class="patient-locked-text">
            <span class="patient-locked-label">Paziente</span>
            <span class="patient-locked-name">{{ lockedPatientName || '—' }}</span>
          </div>
          <button mat-stroked-button type="button" (click)="unlockPatient()"
                  matTooltip="Riassegna la prenotazione a un altro paziente">
            <mat-icon>swap_horiz</mat-icon>
            Cambia paziente
          </button>
        </div>

        <!-- Paziente con Autocomplete -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width"
                        *ngIf="!patientLocked">
          <mat-label>Paziente *</mat-label>
          <input matInput
                 [matAutocomplete]="patientAuto"
                 [formControl]="patientSearchControl"
                 placeholder="Cerca paziente per nome, cognome o telefono...">
          <mat-autocomplete #patientAuto="matAutocomplete"
                            [displayWith]="displayPatient"
                            (optionSelected)="onPatientSelected($event)">
            <mat-option *ngFor="let patient of filteredPatients$ | async" [value]="patient">
              <div class="patient-option">
                <span class="patient-name">{{ patient.cognome }} {{ patient.nome }}</span>
                <span class="patient-phone" *ngIf="patient.cellulare || patient.telefono">
                  - {{ patient.cellulare || patient.telefono }}
                </span>
              </div>
            </mat-option>
          </mat-autocomplete>
          <button mat-icon-button matSuffix type="button"
                  (click)="openNewPatientDialog($event)"
                  matTooltip="Aggiungi nuovo paziente">
            <mat-icon>person_add</mat-icon>
          </button>
          <mat-error *ngIf="form.get('patientId')?.hasError('required')">
            Seleziona un paziente
          </mat-error>
        </mat-form-field>

        <!-- Telefono del paziente: serve all'operatore che deve chiamarlo,
             quindi e' visibile senza aprire l'anagrafica. -->
        <div class="patient-contact" *ngIf="patientPhone">
          <mat-icon class="patient-contact-icon">phone</mat-icon>
          <a class="patient-contact-value" [href]="'tel:' + patientPhone">{{ patientPhone }}</a>
          <button mat-icon-button type="button" (click)="copyPatientPhone()"
                  [matTooltip]="phoneCopied ? 'Copiato' : 'Copia numero'">
            <mat-icon>{{ phoneCopied ? 'check' : 'content_copy' }}</mat-icon>
          </button>
          <button mat-icon-button type="button" class="chat-button"
                  (click)="openWhatsappChat()"
                  matTooltip="Apri chat WhatsApp">
            <mat-icon>forum</mat-icon>
          </button>
        </div>

        <!-- Servizi (multiselect) -->
        <div class="services-section" *ngIf="data.slotInfo.operator">
          <label class="section-label">Servizi</label>
          <div class="services-container">
            <app-service-multi-select
              *ngIf="!loadingServices"
              [availableServices]="selectableServices"
              [selectedServices]="selectedServices"
              [showPrices]="true"
              [editablePrices]="false"
              [placeholder]="'Aggiungi servizio'"
              (selectedServicesChange)="onServicesChange($event)">
            </app-service-multi-select>
            <div class="loading-services" *ngIf="loadingServices">
              <mat-spinner diameter="24"></mat-spinner>
              <span>Caricamento servizi...</span>
            </div>
          </div>
        </div>

        <!-- Note -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
          <mat-label>Note</mat-label>
          <textarea matInput formControlName="notes" rows="3"
                    placeholder="Note opzionali per l'appuntamento..."></textarea>
        </mat-form-field>
      </form>

      <!-- Ricorrenza: in creazione, oppure in modifica di una prenotazione
           singola ancora attiva (diventa la prima occorrenza della serie).
           L'editor è lo stesso del dialog operatori: la regola di
           ripetizione non ha nulla di specifico dell'una o dell'altra vista. -->
      <app-recurrence-editor
        *ngIf="!isEditMode || canMakeRecurring"
        [(enabled)]="repeatEnabled"
        [(config)]="repeatConfig"
        [baseDate]="currentAppointmentDate || data.date"
        [toggleLabel]="isEditMode ? 'Rendi ricorrente' : 'Appuntamento ricorrente'"
        [hint]="isEditMode
          ? 'Questa prenotazione diventa la prima occorrenza della serie: le successive verranno create al salvataggio, nella stessa fascia oraria.'
          : null">
      </app-recurrence-editor>

      <!-- Gestione serie ricorrenti in modifica: pannello "Applica a" con
           Applica modifiche / Elimina (parità con la modalità operatori).
           Il pulsante "Salva Modifiche" del dialog resta sulla singola
           occorrenza. -->
      <app-recurring-scope-panel
        *ngIf="isEditMode && data.appointment?.isRecurring && data.appointment?.recurringGroupId"
        [futureCount]="loadingSeriesInfo ? null : futureSeriesCount"
        [currentDate]="currentAppointmentDate"
        (applyEdit)="onApplySeriesEdit($event)"
        (applyDelete)="onApplySeriesDelete($event)">
      </app-recurring-scope-panel>

      <!-- Errore server -->
      <div class="server-error" *ngIf="serverError">
        <mat-icon color="warn">error</mat-icon>
        <span>{{ serverError }}</span>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <!-- "Sposta" solo in modifica: in creazione lo slot è già quello su cui
           si è cliccato, e cambiarlo qui equivarrebbe a ricominciare. -->
      <button mat-stroked-button type="button" *ngIf="isEditMode"
              [disabled]="saving"
              matTooltip="Cerca uno slot libero, anche in un'altra sala"
              (click)="onRequestMove()">
        <mat-icon>swap_horiz</mat-icon>
        Sposta
      </button>
      <span class="actions-spacer"></span>
      <button mat-stroked-button type="button" (click)="onCancel()" [disabled]="saving">
        Annulla
      </button>
      <button mat-flat-button color="primary" (click)="onSave()"
              [disabled]="saving || !form.get('patientId')?.value">
        <mat-spinner *ngIf="saving" diameter="20"></mat-spinner>
        <span *ngIf="!saving">{{ isEditMode ? 'Salva Modifiche' : 'Crea Appuntamento' }}</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 500px;
      max-width: 600px;
    }

    .slot-info {
      padding: 16px 0;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      color: #555;

      mat-icon {
        color: #667eea;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      span {
        font-size: 0.9375rem;
      }
    }

    mat-divider {
      margin: 8px 0 16px 0;
    }

    .appointment-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .patient-option {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .patient-name {
      font-weight: 500;
    }

    .patient-phone {
      color: #666;
      font-size: 0.875rem;
    }

    /* Paziente in sola lettura (modalita' modifica). */
    .patient-locked {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background: #fafafa;
    }

    .patient-locked-icon {
      color: #667eea;
      flex: 0 0 auto;
    }

    .patient-locked-text {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-width: 0;
    }

    .patient-locked-label {
      font-size: 0.75rem;
      color: #666;
      line-height: 1.2;
    }

    .patient-locked-name {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Recapito telefonico del paziente. */
    .patient-contact {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: -8px;
      color: #555;
    }

    .patient-contact-icon {
      color: #667eea;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .patient-contact-value {
      color: #1976d2;
      text-decoration: none;
      font-variant-numeric: tabular-nums;
    }

    .patient-contact-value:hover {
      text-decoration: underline;
    }

    .chat-button mat-icon {
      color: #25d366;
    }

    .services-section {
      margin-top: 8px;
    }

    .section-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.6);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .services-container {
      min-height: 60px;
    }

    .loading-services {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      color: #666;
    }

    .server-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      margin-top: 16px;
      border-radius: 4px;
      background-color: #f8d7da;
      color: #721c24;
    }

    .actions-spacer { flex: 1 1 auto; }

    mat-dialog-actions {
      padding: 16px 24px;
    }

    mat-dialog-actions button {
      min-width: 120px;
    }

    mat-spinner {
      display: inline-block;
    }

    .recurring-section {
      margin-top: 16px;
      padding: 12px;
      background-color: #fff8e1;
      border-radius: 8px;
      border: 1px solid #ffecb3;

      mat-slide-toggle mat-icon {
        margin-right: 8px;
      }
    }

    .recurring-config {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ffecb3;
    }

    .form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }

    .interval-field {
      max-width: 150px;
    }

    .weekday-selector {
      margin-bottom: 16px;

      label {
        display: block;
        font-weight: 500;
        margin-bottom: 8px;
      }
    }

    .weekday-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .weekday-buttons button {
      width: 40px;
      height: 40px;
      font-size: 0.7rem;
    }

    .end-config {
      margin-bottom: 16px;

      > label {
        display: block;
        font-weight: 500;
        margin-bottom: 12px;
      }
    }

    .end-option {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .occurrences-field {
      max-width: 80px;
    }

    .until-field {
      max-width: 180px;
    }

    .recurring-preview {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background-color: #fff3e0;
      border-radius: 4px;
      color: #e65100;
      font-size: 0.875rem;

      mat-icon {
        color: #f57c00;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
  `]
})
export class GymAppointmentMatDialogComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private serviceService = inject(ServiceService);
  private gymRoomService = inject(GymRoomService);
  private patientService = inject(PatientService);
  private recurringAppointmentService = inject(AvailabilityAppointmentService);
  private chatState = inject(WhatsappChatStateService);
  private snackBar = inject(MatSnackBar);

  // Form
  form!: FormGroup;
  patientSearchControl = new FormControl('');

  // State
  patients: Patient[] = [];
  filteredPatients$!: Observable<Patient[]>;
  operatorServices: Service[] = [];
  selectedServices: SelectedServiceItem[] = [];
  loadingServices = false;
  saving = false;
  serverError = '';

  /**
   * Modalita' modifica: il paziente parte in sola lettura e si sblocca solo
   * con "Cambia paziente". Senza questo, un click distratto sull'autocomplete
   * riassegnava la prenotazione a un altro paziente.
   */
  patientUnlocked = false;
  /** Nome mostrato nel blocco paziente in sola lettura. */
  lockedPatientName = '';
  /** Recapito telefonico del paziente selezionato (cellulare, poi fisso). */
  patientPhone = '';
  /** Feedback temporaneo del pulsante "copia numero". */
  phoneCopied = false;
  private phoneCopiedTimer: ReturnType<typeof setTimeout> | null = null;

  // Serie ricorrente esistente (modalità modifica)
  loadingSeriesInfo = false;
  futureSeriesCount: number | null = null;

  // Recurring — l'editor è condiviso col dialog operatori, e con esso la
  // configurazione di partenza e la conversione verso il payload GraphQL.
  repeatEnabled = false;
  repeatConfig: RepeatConfig = { ...DEFAULT_REPEAT_CONFIG };

  // Conflitto di disponibilità
  private conflictService = inject(ConflictService);
  /**
   * Conflitto già chiuso in questa sessione del dialog. "Accetta" risolve
   * senza chiudere, e il banner deve sparire subito: ricaricare la
   * prenotazione solo per far sparire un riquadro sarebbe un giro inutile.
   */
  conflictCleared = false;
  resolvingConflict = false;

  constructor(
    public dialogRef: MatDialogRef<GymAppointmentMatDialogComponent, GymAppointmentMatDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: GymAppointmentMatDialogData
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadOperatorServices();
    this.patients = this.data.patients || [];
    this.setupPatientFilter();

    // Modalita' MODIFICA: prefill dei campi dall'appuntamento esistente.
    if (this.isEditMode) {
      const apt = this.data.appointment!;
      this.prefillFromAppointment(apt);
      if (apt.isRecurring && apt.recurringGroupId) {
        this.loadSeriesInfo(apt.recurringGroupId);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.phoneCopiedTimer) clearTimeout(this.phoneCopiedTimer);
  }

  /** Data (YYYY-MM-DD) dell'occorrenza in modifica, per scope/serie. */
  get currentAppointmentDate(): string {
    return String(this.data.appointment?.appointmentDate ?? this.data.date ?? '').slice(0, 10);
  }

  /** True se il dialog opera in modalita' modifica di un appuntamento esistente. */
  get isEditMode(): boolean {
    return !!this.data.appointment;
  }

  /** True finche' il paziente della prenotazione non e' stato sbloccato. */
  get patientLocked(): boolean {
    return this.isEditMode && !this.patientUnlocked;
  }

  /**
   * Sblocca il campo paziente per riassegnare la prenotazione. Il valore
   * corrente resta nel campo, cosi' l'operatore vede da cosa sta partendo.
   */
  unlockPatient(): void {
    this.patientUnlocked = true;
    this.cdr.markForCheck();
  }

  /**
   * Prefill del form a partire dall'appuntamento da modificare: paziente,
   * note e servizi. La ricorrenza non e' modificabile in edit (single
   * occurrence), quindi viene ignorata.
   */
  private prefillFromAppointment(apt: GymAppointment): void {
    // Paziente: il control dell'autocomplete vuole l'OGGETTO Patient, non la
    // stringa gia' formattata — `[displayWith]="displayPatient"` riapplica il
    // formatter al valore del control, e su una stringa produceva
    // "undefined undefined" al posto del nome.
    this.lockedPatientName = apt.clientName || '';
    this.patientPhone = apt.clientPhone || '';

    if (apt.patientId) {
      this.form.patchValue({ patientId: apt.patientId });
      const existing = this.patients.find((p) => String(p.id) === String(apt.patientId));
      if (existing) {
        this.applySelectedPatient(existing);
      } else {
        // Paziente fuori dalla lista precaricata (che e' parziale): fallback
        // immediato sui dati dell'appuntamento, poi lookup mirato per avere
        // nome e recapito aggiornati dall'anagrafica.
        this.patientSearchControl.setValue(this.syntheticPatientFrom(apt) as any);
        this.loadPatientById(String(apt.patientId), apt);
      }
    } else if (apt.clientName) {
      // Prenotazione storica senza paziente collegato: mostra comunque il
      // nominativo scritto sull'appuntamento.
      this.patientSearchControl.setValue(this.syntheticPatientFrom(apt) as any);
    }

    this.form.patchValue({ notes: apt.notes || '' });

    // Servizi gia' associati all'appuntamento.
    if (apt.appointmentServices?.length) {
      this.selectedServices = apt.appointmentServices
        .slice()
        .sort((a, b) => a.orderPosition - b.orderPosition)
        .map((as, idx) => ({
          serviceId: as.serviceId,
          customDuration: as.customDuration,
          customPrice: as.customPrice,
          service: as.service
            ? {
                id: as.service.id,
                name: as.service.name,
                defaultPrice: as.service.defaultPrice,
                discountFE: as.service.discountFE ?? undefined,
                defaultDuration: as.service.defaultDuration,
              }
            : { id: as.serviceId, name: '' },
          orderPosition: idx,
        }));
    }
  }

  /**
   * Inizializza il form reattivo.
   */
  private initForm(): void {
    this.form = this.fb.group({
      patientId: [null, Validators.required],
      notes: ['']
    });
  }

  /**
   * Filtra l'autocomplete dei pazienti con strategia ibrida:
   * - 0 char     → primi 20 dalla lista pre-caricata
   * - 1-2 char   → filtro client-side
   * - 3+ char    → ricerca remota sul registry (POST /subjects/global-search,
   *                trigrammi+fonetico, full dataset 3700+) con debounce 250ms.
   */
  private setupPatientFilter(): void {
    this.filteredPatients$ = this.patientSearchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(250),
      distinctUntilChanged((a, b) => {
        const sa = typeof a === 'string' ? a : '';
        const sb = typeof b === 'string' ? b : '';
        return sa === sb;
      }),
      switchMap((value) => {
        // Oggetto Patient → autocomplete ha appena selezionato, mostra tutti
        if (typeof value === 'object' && value !== null) {
          return of(this.patients);
        }
        const filter = (value || '').toLowerCase().trim();
        if (filter.length >= 3) {
          // Ricerca remota
          return this.patientService.searchPatients(filter).pipe(
            catchError((err) => {
              console.warn('[GymMatDialog] Patient remote search failed:', err);
              return of(this.filterPatientsLocal(filter));
            }),
          );
        }
        return of(this.filterPatientsLocal(filter));
      }),
    );
  }

  private filterPatientsLocal(filter: string): Patient[] {
    if (!filter) {
      return this.patients.slice(0, 20);
    }
    // Match a token: copre entrambi gli ordini nome/cognome e i parziali su
    // ogni parola ("ros mar"), senza enumerare le combinazioni a mano.
    const tokens = tokenizeQuery(filter);
    return this.patients
      .filter((p) =>
        matchesAllTokens([p.nome, p.cognome, p.cellulare, p.telefono], tokens),
      )
      .slice(0, 20);
  }

  /**
   * Carica i servizi dell'operatore assegnato allo slot.
   */
  private loadOperatorServices(): void {
    const operatorId = this.data.slotInfo?.operator?.id;
    if (!operatorId) {
      this.operatorServices = [];
      return;
    }

    this.loadingServices = true;
    this.cdr.markForCheck();

    this.serviceService.getOperatorServices(operatorId).subscribe({
      next: (operatorServiceList) => {
        const services = operatorServiceList
          .map(os => os.service)
          .filter((s): s is Service => !!s && s.isActive !== false);
        this.operatorServices = services;
        this.loadingServices = false;

        // Auto-seleziona se c'è un solo servizio disponibile
        if (services.length === 1 && this.selectedServices.length === 0) {
          const s = services[0];
          this.selectedServices = [{
            serviceId: s.id,
            service: { id: s.id, name: s.name, defaultPrice: s.defaultPrice, discountFE: s.discountFE ?? undefined, defaultDuration: s.defaultDuration },
            orderPosition: 0
          }];
        }

        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('[GymAppointmentMatDialog] Error loading operator services:', error);
        this.operatorServices = [];
        this.loadingServices = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Getter: nome operatore formattato.
   */
  get operatorName(): string {
    if (!this.data.slotInfo?.operator) return '';
    const op = this.data.slotInfo.operator;
    return op.surname ? `${op.name} ${op.surname}` : op.name;
  }

  /**
   * Getter: data formattata in italiano.
   */
  get formattedDate(): string {
    if (!this.data.date) return '';
    const date = new Date(this.data.date);
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  /**
   * Getter: servizi in formato SelectableService per il componente multiselect.
   */
  get selectableServices(): SelectableService[] {
    return this.operatorServices.map(s => ({
      id: s.id,
      name: s.name,
      defaultPrice: s.defaultPrice ?? undefined,
      discountFE: s.discountFE ?? undefined,
      defaultDuration: s.defaultDuration ?? undefined
    }));
  }

  /**
   * Funzione display per l'autocomplete paziente.
   *
   * Tollera anche una stringa: MatAutocomplete applica `displayWith` a
   * QUALSIASI valore del control (anche a quello digitato a mano), e su una
   * stringa l'accesso a `.cognome`/`.nome` avrebbe reso "undefined undefined".
   */
  displayPatient = (patient: Patient | string | null): string => {
    if (!patient) return '';
    if (typeof patient === 'string') return patient;
    return `${patient.cognome ?? ''} ${patient.nome ?? ''}`.trim();
  };

  /**
   * Gestisce la selezione di un paziente dall'autocomplete.
   */
  onPatientSelected(event: MatAutocompleteSelectedEvent): void {
    const patient = event.option.value as Patient;
    if (patient && patient.id) {
      // Se viene da search remota e non è in this.patients, aggiungilo
      // così le lookup sul submit (selectedPatient = this.patients.find(...)) lo trovano.
      if (!this.patients.find((p) => p.id === patient.id)) {
        this.patients = [patient, ...this.patients];
      }
      this.applySelectedPatient(patient);
    }
  }

  /**
   * Punto unico in cui un paziente diventa "quello della prenotazione":
   * allinea id nel form, display dell'autocomplete, nome del blocco bloccato
   * e recapito telefonico.
   */
  private applySelectedPatient(patient: Patient): void {
    this.form.patchValue({ patientId: patient.id });
    this.patientSearchControl.setValue(patient as any);
    this.lockedPatientName = this.displayPatient(patient);
    this.patientPhone = patient.cellulare || patient.telefono || this.patientPhone || '';
    this.cdr.markForCheck();
  }

  /**
   * Paziente "finto" costruito dai dati denormalizzati sull'appuntamento.
   * Serve a mostrare subito nome e telefono quando l'anagrafica non e' (ancora)
   * disponibile, senza lasciare il campo vuoto.
   */
  private syntheticPatientFrom(apt: GymAppointment): Patient {
    return {
      id: apt.patientId ?? '',
      nome: '',
      cognome: apt.clientName ?? '',
      cellulare: apt.clientPhone,
      email: apt.clientEmail,
    } as unknown as Patient;
  }

  /**
   * Lookup mirato del paziente quando non e' nella lista precaricata (che e'
   * parziale: l'anagrafica ha migliaia di record). In caso di errore restano i
   * dati denormalizzati sull'appuntamento.
   */
  private loadPatientById(patientId: string, apt: GymAppointment): void {
    this.patientService.getPatient(patientId).subscribe({
      next: (patient) => {
        if (!patient) return;
        if (!this.patients.find((p) => String(p.id) === String(patient.id))) {
          this.patients = [patient, ...this.patients];
        }
        // Se nel frattempo l'operatore ha sbloccato e scelto un altro
        // paziente, il lookup in ritardo non deve sovrascrivere la scelta.
        if (String(this.form.get('patientId')?.value) !== patientId) return;
        this.applySelectedPatient(patient);
      },
      error: (err) => {
        console.warn('[GymMatDialog] Lookup paziente fallito:', err);
        this.lockedPatientName = apt.clientName || '';
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Apre il riquadro di chat WhatsApp col paziente della prenotazione.
   * Il dialog resta aperto: si scrive al paziente mentre si sistema la
   * prenotazione, non al suo posto.
   */
  openWhatsappChat(): void {
    if (!this.patientPhone) return;
    this.chatState.openForPhone({
      phone: this.patientPhone,
      patientId: this.form.get('patientId')?.value || undefined,
      patientName: this.lockedPatientName || undefined,
    });
    // Il riquadro di chat sta sotto ai dialog modali (altrimenti coprirebbe i
    // propri menu a tendina): senza avviso sembrerebbe non essere successo nulla.
    this.snackBar.open(
      'Chat WhatsApp aperta: la trovi chiudendo questa scheda.',
      'OK',
      { duration: 4000 },
    );
  }

  /** Copia il recapito negli appunti, con feedback sull'icona per 2s. */
  copyPatientPhone(): void {
    if (!this.patientPhone) return;
    navigator.clipboard?.writeText(this.patientPhone).then(
      () => {
        this.phoneCopied = true;
        this.cdr.markForCheck();
        if (this.phoneCopiedTimer) clearTimeout(this.phoneCopiedTimer);
        this.phoneCopiedTimer = setTimeout(() => {
          this.phoneCopied = false;
          this.cdr.markForCheck();
        }, 2000);
      },
      (err) => console.warn('[GymMatDialog] Copia numero fallita:', err),
    );
  }

  /**
   * Apre il dialog per creare un nuovo paziente.
   */
  openNewPatientDialog(event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    const dialogRef = this.dialog.open(NewPatientDialogComponent, {
      width: '500px',
      disableClose: true,
      data: {}
    });

    dialogRef.afterClosed().subscribe((result: NewPatientDialogResult | undefined) => {
      if (result && !result.cancelled && result.patient) {
        // Aggiungi il paziente alla lista e selezionalo
        this.patients = [...this.patients, result.patient];
        this.applySelectedPatient(result.patient);
      }
    });
  }

  /**
   * Gestisce il cambio dei servizi selezionati.
   */
  onServicesChange(services: SelectedServiceItem[]): void {
    this.selectedServices = services;
    this.cdr.markForCheck();
  }

  // ==================== RECURRING ====================
  //
  // L'editor della regola vive in shared/components/recurrence-editor ed è
  // lo stesso del dialog operatori. Qui resta solo il criterio di quando
  // offrire "Rendi ricorrente", che dipende dallo stato della prenotazione.

  /**
   * In modifica: una prenotazione singola (non già in serie) e ancora attiva
   * può diventare ricorrente. Resta lei la prima occorrenza; le successive
   * le crea il backend (makeAppointmentRecurring).
   */
  get canMakeRecurring(): boolean {
    const apt = this.data.appointment;
    if (!apt) return false;
    const status = (apt.bookingStatus || '').toLowerCase();
    return (
      !apt.isRecurring &&
      !apt.recurringGroupId &&
      (status === 'scheduled' || status === 'confirmed')
    );
  }

  // ==================== CONFLITTO DI DISPONIBILITÀ ====================

  get conflictInfo(): ConflictInfo {
    const apt = this.data.appointment;
    return {
      hasConflict: !!apt?.hasConflict && !this.conflictCleared,
      reason: apt?.conflictReason,
      detectedAt: apt?.conflictDetectedAt,
    };
  }

  onConflictAction(action: ConflictBannerAction): void {
    switch (action) {
      case 'accept':
        this.acceptConflict();
        break;
      case 'move':
        this.onRequestMove();
        break;
      case 'manage':
        this.openConflictDialog();
        break;
    }
  }

  /** "Accetta": la prenotazione resta dov'è e la segnalazione sparisce. */
  private acceptConflict(): void {
    const apt = this.data.appointment;
    if (!apt || this.resolvingConflict) return;

    this.resolvingConflict = true;
    this.cdr.markForCheck();

    this.conflictService
      .resolveConflict(String(apt.id), ConflictResolutionAction.Keep)
      .subscribe({
        next: () => {
          this.resolvingConflict = false;
          this.conflictCleared = true;
          this.snackBar.open('Conflitto accettato: prenotazione confermata.', 'OK', {
            duration: 3000,
          });
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.resolvingConflict = false;
          this.serverError =
            'Impossibile accettare il conflitto' + (err?.message ? `: ${err.message}` : '.');
          this.cdr.markForCheck();
        },
      });
  }

  /** Dialog completo di risoluzione, sopra questo. */
  private async openConflictDialog(): Promise<void> {
    const apt = this.data.appointment;
    if (!apt) return;

    const m = await import(
      '../../../features/conflicts/containers/conflict-resolve-dialog.container'
    );

    const ref = this.dialog.open(m.ConflictResolveDialogContainer, {
      autoFocus: false,
      data: {
        appointment: {
          id: String(apt.id),
          appointmentDate: apt.appointmentDate,
          startTime: apt.startTime,
          endTime: apt.endTime,
          clientName: apt.clientName,
          clientPhone: apt.clientPhone,
          patientId: apt.patientId,
          operatorId: apt.operatorId,
          operatorName: apt.operator
            ? `${apt.operator.name} ${apt.operator.surname || ''}`.trim()
            : null,
          operatorColor: apt.operator?.color,
          gymRoomId: apt.gymRoomId,
          gymRoomName: apt.gymRoom?.name ?? this.data.gymRoom?.name,
          conflictReason: apt.conflictReason,
          conflictDetectedAt: apt.conflictDetectedAt,
          isRecurring: apt.isRecurring,
          recurringGroupId: apt.recurringGroupId,
        },
        origin: 'gym',
        canMove: true,
        moveTooltip: "Cerca uno slot libero (anche in un'altra sala) e spostala lì",
      },
    });

    ref.afterClosed().subscribe((res: ConflictResolutionResult | undefined) => {
      if (!res) return;
      if (res.outcome === 'move') {
        this.onRequestMove();
        return;
      }
      if (res.outcome === 'resolved') {
        // "Accetta" tocca solo il flag: si può restare aperti. Riprogrammare
        // o cancellare invece cambia la prenotazione sotto ai campi mostrati.
        if (res.action === ConflictResolutionAction.Keep) {
          this.conflictCleared = true;
          this.cdr.markForCheck();
        } else {
          this.dialogRef.close({ created: true, appointmentId: String(apt.id) });
        }
      }
    });
  }

  /**
   * Chiude il dialog chiedendo al container di aprire il pannello di
   * spostamento: è lui ad avere l'elenco delle sale attive fra cui cercare.
   */
  onRequestMove(): void {
    if (!this.isEditMode) return;
    this.dialogRef.close({
      created: false,
      appointmentId: String(this.data.appointment!.id),
      requestMove: true,
    });
  }

  /**
   * Annulla e chiude il dialog.
   */
  onCancel(): void {
    this.dialogRef.close({ created: false });
  }

  /**
   * Salva l'appuntamento.
   */
  async onSave(): Promise<void> {
    // Validazione
    this.form.markAllAsTouched();

    if (!this.form.get('patientId')?.value || this.saving) {
      return;
    }

    this.saving = true;
    this.serverError = '';
    this.cdr.markForCheck();

    try {
      // Prepara array servizi per il backend
      const services = this.selectedServices.map((item, idx) => ({
        serviceId: item.serviceId,
        customPrice: item.customPrice,
        customDuration: item.customDuration
      }));

      // Recupera i dati del paziente selezionato per clientName
      // Usa == perché patient.id (da GraphQL) potrebbe essere string o number
      const selectedPatient = this.patients.find(p => p.id == this.form.value.patientId);
      // In modifica il paziente puo' non essere nella lista precaricata (che e'
      // parziale): senza fallback sui dati gia' sull'appuntamento, il salvataggio
      // azzererebbe nominativo e recapiti.
      const apt = this.data.appointment;
      const clientName = selectedPatient
        ? `${selectedPatient.cognome} ${selectedPatient.nome}`
        : (apt?.clientName || '');
      const clientPhone =
        selectedPatient?.cellulare || selectedPatient?.telefono || apt?.clientPhone || undefined;
      const clientEmail = selectedPatient?.email || apt?.clientEmail || undefined;

      // Config ricorrenza: stessa conversione del dialog operatori.
      const repeatConfigData = this.repeatEnabled
        ? buildRepeatConfigPayload(this.repeatConfig)
        : undefined;

      // Anteprima e risoluzione occorrenza per occorrenza. Si passa di qui
      // anche quando non ci sono conflitti: così le date scritte sono
      // esattamente quelle che l'utente ha visto, invece di essere
      // rigenerate dal backend un istante dopo.
      let resolvedOccurrences: GymResolvedOccurrence[] | undefined;
      if (repeatConfigData) {
        const resolved = await this.resolveGymSeries(repeatConfigData);
        if (resolved === null) {
          // Serie annullata dall'utente: niente da salvare.
          this.saving = false;
          this.cdr.markForCheck();
          return;
        }
        resolvedOccurrences = resolved;
      }

      let result: GymAppointment;

      if (this.isEditMode) {
        // MODIFICA: aggiorna i campi editabili dell'appuntamento esistente.
        const updateInput: UpdateGymAppointmentInput = {
          patientId: this.form.value.patientId || undefined,
          clientName: clientName,
          clientPhone: clientPhone,
          // Email omessa se vuota: il backend valida @IsEmail e rifiuta "".
          clientEmail: clientEmail,
          notes: this.form.value.notes || undefined,
          services: services.length > 0 ? services : undefined,
        };
        result = await firstValueFrom(
          this.gymRoomService.updateAppointment(this.data.appointment!.id, updateInput),
        );

        // "Rendi ricorrente": la prenotazione appena salvata diventa la
        // prima occorrenza e il backend crea le successive. Va DOPO
        // l'update, così le occorrenze nascono già coi dati aggiornati
        // (paziente, note, servizi) invece che con quelli di prima.
        if (repeatConfigData && this.canMakeRecurring) {
          await firstValueFrom(
            this.recurringAppointmentService.makeRecurring(
              String(this.data.appointment!.id),
              repeatConfigData,
              false,
              resolvedOccurrences,
            ),
          );
        }
      } else {
        // CREAZIONE (con report: le occorrenze ricorrenti in conflitto
        // vengono saltate dal backend ed elencate qui sotto).
        const input: CreateGymAppointmentInput = {
          gymRoomId: this.data.gymRoom.id,
          patientId: this.form.value.patientId || undefined,
          clientName: clientName,
          clientPhone: clientPhone || '',
          // Email omessa se vuota: il backend valida @IsEmail e rifiuta "".
          clientEmail: clientEmail,
          appointmentDate: this.data.date,
          startTime: this.data.startTime,
          endTime: this.data.endTime,
          notes: this.form.value.notes || '',
          // MULTISERVIZIO: array invece di singolo serviceId
          services: services.length > 0 ? services : undefined,
          isRecurring: this.repeatEnabled || undefined,
          repeatConfig: repeatConfigData,
          // Piano risolto: senza questo le decisioni prese occorrenza per
          // occorrenza verrebbero mostrate all'utente e poi ignorate, perché
          // il backend rigenererebbe comunque le date dalla regola.
          occurrences: resolvedOccurrences?.length
            ? resolvedOccurrences.map((o) => ({
                date: o.date,
                startTime: o.startTime,
                endTime: o.endTime,
                gymRoomId: o.gymRoomId,
              }))
            : undefined,
        };
        const report = await firstValueFrom(this.gymRoomService.createAppointmentWithReport(input));
        result = report.appointment;
        if (report.conflicts?.length) {
          // Serie creata parzialmente: avvisa con l'elenco delle saltate
          // (stesso dialog della modalità operatori, wording non bloccante).
          this.dialog.open(RecurringConflictsDialogComponent, {
            width: '520px', maxWidth: '95vw',
            data: {
              title: 'Serie creata con avvisi',
              intro: `Occorrenze create: ${report.createdCount}. Occorrenze saltate per conflitto: ${report.skippedCount}.`,
              conflicts: report.conflicts,
            },
          });
        }
      }

      this.dialogRef.close({
        created: true,
        appointmentId: result?.id
      });
    } catch (error: any) {
      console.error('[GymAppointmentMatDialog] Error saving appointment:', error);

      // Serie interamente in conflitto: il backend blocca con il marker
      // RECURRING_SERIES_CONFLICT e l'elenco (avvisa-e-blocca come operatori).
      const conflicts = this.tryParseRecurringConflicts(error?.message || '');
      if (conflicts) {
        this.dialog.open(RecurringConflictsDialogComponent, {
          width: '520px', maxWidth: '95vw',
          data: {
            title: 'Creazione serie bloccata',
            intro: 'Nessun appuntamento creato: tutte le occorrenze della serie sono in conflitto.',
            conflicts,
          },
        });
        this.saving = false;
        this.cdr.markForCheck();
        return;
      }

      this.serverError =
        error?.message ||
        (this.isEditMode
          ? 'Errore nel salvataggio delle modifiche. Riprova.'
          : 'Errore nella creazione dell\'appuntamento. Riprova.');
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Chiede al backend il piano della serie palestra e, se qualche occorrenza
   * è in conflitto, apre il riquadro di risoluzione.
   *
   * Ritorna:
   * - l'elenco delle occorrenze risolte (da passare a create/makeRecurring)
   * - `undefined` se l'anteprima non è disponibile: si prosegue col flusso
   *   storico, che in caso di conflitti avvisa a posteriori
   * - `null` se l'utente ha annullato l'intera serie
   *
   * PERCHÉ PASSARE DALL'ANTEPRIMA ANCHE SENZA CONFLITTI: l'alternativa
   * sarebbe far rigenerare le date al backend, e allora il piano visto e
   * quello scritto potrebbero non coincidere. Costa una query e toglie di
   * mezzo un'intera classe di "ma io avevo visto un'altra cosa".
   */
  private async resolveGymSeries(
    repeatConfig: RepeatConfig,
  ): Promise<GymResolvedOccurrence[] | undefined | null> {
    const gymRoomId = this.data.appointment?.gymRoomId ?? this.data.gymRoom.id;
    const startDate = this.currentAppointmentDate || this.data.date;
    const startTime = this.hhmm(this.data.appointment?.startTime ?? this.data.startTime);
    const endTime = this.hhmm(this.data.appointment?.endTime ?? this.data.endTime);

    let preview: RecurringOccurrencePreview[];
    try {
      preview = await firstValueFrom(
        this.recurringAppointmentService.previewRecurringSeries({
          gymRoomId,
          patientId: this.form.value.patientId || undefined,
          startDate,
          startTime,
          endTime,
          repeatConfig: repeatConfig as any,
          excludeAppointmentId: this.isEditMode
            ? String(this.data.appointment!.id)
            : undefined,
        }),
      );
    } catch (err: any) {
      // Anteprima non disponibile (rete, backend vecchio): si prosegue col
      // flusso storico. Meglio di un salvataggio impedito da un problema
      // sull'anteprima.
      console.warn('[GymAppointmentMatDialog] Anteprima serie non disponibile:', err?.message ?? err);
      return undefined;
    }

    if (preview.length === 0) return undefined;

    const asResolved = (o: RecurringOccurrencePreview): GymResolvedOccurrence => ({
      appointmentId: o.appointmentId,
      date: o.date,
      startTime: o.startTime,
      endTime: o.endTime,
    });

    if (!preview.some((o) => !!o.conflict)) {
      return preview.map(asResolved);
    }

    const m = await import(
      '../../../features/gym-appointments/containers/gym-recurring-resolution-dialog.container'
    );

    const ref = this.dialog.open(m.GymRecurringResolutionDialogContainer, {
      width: '820px',
      maxWidth: '96vw',
      maxHeight: '88vh',
      autoFocus: false,
      data: {
        occurrences: preview,
        gymRoomId,
        // Senza l'elenco sale il riquadro cerca solo nella sala corrente:
        // è la degradazione giusta per i caller che non lo passano.
        rooms: this.data.rooms ?? [
          { id: this.data.gymRoom.id, name: this.data.gymRoom.name, color: this.data.gymRoom.color },
        ],
        title: this.isEditMode
          ? 'Serie palestra: occorrenze da sistemare'
          : 'Nuova serie palestra: occorrenze da sistemare',
      },
    });

    const outcome = await firstValueFrom(ref.afterClosed());
    if (!outcome || outcome.action === 'cancel') return null;
    return outcome.occurrences;
  }

  /** Orari dal backend come 'HH:MM:SS': le mutation vogliono 'HH:MM'. */
  private hhmm(t: string | null | undefined): string {
    return (t ?? '').slice(0, 5);
  }

  /**
   * Estrae l'elenco conflitti dal messaggio d'errore backend
   * `RECURRING_SERIES_CONFLICT: [...]`. Ritorna null se non è quel tipo.
   */
  private tryParseRecurringConflicts(msg: string): any[] | null {
    const marker = 'RECURRING_SERIES_CONFLICT';
    const idx = msg.indexOf(marker);
    if (idx < 0) return null;
    const jsonStart = msg.indexOf('[', idx);
    if (jsonStart < 0) return null;
    try {
      const parsed = JSON.parse(msg.slice(jsonStart));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  // ==================== RECURRING SERIES MANAGEMENT ====================

  private loadSeriesInfo(recurringGroupId: string): void {
    this.loadingSeriesInfo = true;
    this.recurringAppointmentService.getRecurringSeries(recurringGroupId).subscribe({
      next: (series) => {
        // Conta solo occorrenze DOPO quella corrente (non inclusa).
        const currentDate = this.currentAppointmentDate;
        this.futureSeriesCount = series.filter(a =>
          String(a.appointmentDate).slice(0, 10) > currentDate &&
          !['cancelled', 'cancelled_early', 'cancelled_late'].includes((a.bookingStatus || '').toLowerCase())
        ).length;
        this.loadingSeriesInfo = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loadingSeriesInfo = false; this.cdr.markForCheck(); },
    });
  }

  /**
   * Elimina le occorrenze della serie nello scope scelto. La micro-conferma
   * è già stata data nel pannello.
   */
  async onApplySeriesDelete(sel: RecurringScopeSelection): Promise<void> {
    const apt = this.data.appointment!;
    try {
      const count = await firstValueFrom(this.recurringAppointmentService.deleteRecurringSeries(
        String(apt.id), this.currentAppointmentDate, sel.scope,
        { rangeFrom: sel.rangeFrom, rangeTo: sel.rangeTo, includeCurrent: sel.includeCurrent },
      ));
      alert(`${count} appuntamenti eliminati`);
      this.dialogRef.close({ created: true });
    } catch {
      alert('Errore nell\'eliminazione della serie');
    }
  }

  /**
   * Applica alla serie (nello scope scelto) le modifiche impostate nel form:
   * paziente, servizi e note. Data/orario/sala restano quelli di ciascuna
   * occorrenza (in palestra lo slot è fisso). Se il backend rileva conflitti,
   * mostra il riepilogo e NON chiude (niente è stato applicato).
   */
  async onApplySeriesEdit(sel: RecurringScopeSelection): Promise<void> {
    const apt = this.data.appointment!;
    if (!this.form.get('patientId')?.value) {
      alert('Seleziona un paziente prima di applicare le modifiche alla serie.');
      return;
    }

    const services = this.selectedServices.map(item => ({
      serviceId: item.serviceId,
      customPrice: item.customPrice,
      customDuration: item.customDuration,
    }));
    const selectedPatient = this.patients.find(p => p.id == this.form.value.patientId);
    const clientName = selectedPatient
      ? `${selectedPatient.cognome} ${selectedPatient.nome}`
      : (apt.clientName || '');

    try {
      const result = await firstValueFrom(this.recurringAppointmentService.updateRecurringSeries({
        appointmentId: String(apt.id),
        scope: sel.scope,
        // Orario invariato: il backend riconosce la posizione immutata e non
        // riesegue i check di chiusura/capienza.
        startTime: apt.startTime,
        endTime: apt.endTime,
        patientId: this.form.value.patientId || undefined,
        clientName: clientName || undefined,
        // Fallback sui dati dell'appuntamento: il paziente puo' non essere
        // nella lista precaricata e non vanno azzerati i recapiti.
        clientPhone: selectedPatient?.cellulare || selectedPatient?.telefono || apt.clientPhone || undefined,
        clientEmail: selectedPatient?.email || apt.clientEmail || undefined,
        notes: this.form.value.notes || undefined,
        services: services.length > 0 ? services : undefined,
        rangeFrom: sel.rangeFrom,
        rangeTo: sel.rangeTo,
        includeCurrent: sel.includeCurrent,
      }));

      if (!result.applied && result.conflicts.length > 0) {
        // Avvisa e blocca: mostra il riepilogo conflitti, niente modifiche.
        this.dialog.open(RecurringConflictsDialogComponent, {
          width: '520px', maxWidth: '95vw',
          data: { title: 'Modifica serie bloccata', conflicts: result.conflicts },
        });
        return;
      }

      const failedNote = result.conflicts.length > 0
        ? ` (${result.conflicts.length} non aggiornati per errore)` : '';
      alert(`${result.affectedCount} appuntamenti aggiornati${failedNote}`);
      this.dialogRef.close({ created: true });
    } catch {
      alert('Errore nella modifica della serie');
    }
  }
}
