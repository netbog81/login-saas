import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
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
}

/**
 * Risultato restituito dal dialog alla chiusura.
 */
export interface GymAppointmentMatDialogResult {
  created: boolean;
  appointmentId?: string;
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
    RecurringScopePanelComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ isEditMode ? 'Modifica Appuntamento Palestra' : 'Nuovo Appuntamento Palestra' }}</h2>

    <mat-dialog-content>
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
        <!-- Paziente con Autocomplete -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
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

      <!-- Ricorrenza (solo in creazione: l'update modifica la singola occorrenza) -->
      <div class="recurring-section" *ngIf="!isEditMode">
        <mat-slide-toggle [(ngModel)]="repeatEnabled" (change)="onRepeatToggle()">
          <mat-icon>repeat</mat-icon>
          Appuntamento ricorrente
        </mat-slide-toggle>

        <div class="recurring-config" *ngIf="repeatEnabled">
          <div class="form-row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Ripeti</mat-label>
              <mat-select [(ngModel)]="repeatConfig.type">
                <mat-option value="daily">Ogni giorno</mat-option>
                <mat-option value="weekly">Ogni settimana</mat-option>
                <mat-option value="monthly">Ogni mese</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="interval-field">
              <mat-label>Intervallo</mat-label>
              <input matInput type="number" [(ngModel)]="repeatConfig.interval" min="1" max="12">
              <span matTextSuffix>{{ getIntervalLabel() }}</span>
            </mat-form-field>
          </div>

          <!-- Giorni della settimana (solo per weekly) -->
          <div class="weekday-selector" *ngIf="repeatConfig.type === 'weekly'">
            <label>Giorni della settimana</label>
            <div class="weekday-buttons">
              <button mat-mini-fab
                      *ngFor="let day of weekdays; let i = index"
                      [color]="isDaySelected(i) ? 'primary' : ''"
                      (click)="toggleDay(i)"
                      type="button">
                {{ day }}
              </button>
            </div>
          </div>

          <!-- Fine ricorrenza -->
          <div class="end-config">
            <label>Termina</label>
            <div class="end-options">
              <mat-radio-group [(ngModel)]="repeatConfig.endType">
                <div class="end-option">
                  <mat-radio-button value="after">Dopo</mat-radio-button>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="occurrences-field">
                    <input matInput type="number" [(ngModel)]="repeatConfig.occurrences"
                           [disabled]="repeatConfig.endType !== 'after'" min="1" max="52">
                  </mat-form-field>
                  <span>volte</span>
                </div>
                <div class="end-option">
                  <mat-radio-button value="until">Fino al</mat-radio-button>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="until-field">
                    <input matInput type="date" [(ngModel)]="repeatConfig.untilDate"
                           [disabled]="repeatConfig.endType !== 'until'">
                  </mat-form-field>
                </div>
              </mat-radio-group>
            </div>
          </div>

          <div class="recurring-preview" *ngIf="getOccurrencesPreview()">
            <mat-icon>info</mat-icon>
            <span>{{ getOccurrencesPreview() }}</span>
          </div>
        </div>
      </div>

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
export class GymAppointmentMatDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private serviceService = inject(ServiceService);
  private gymRoomService = inject(GymRoomService);
  private patientService = inject(PatientService);
  private recurringAppointmentService = inject(AvailabilityAppointmentService);

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

  // Serie ricorrente esistente (modalità modifica)
  loadingSeriesInfo = false;
  futureSeriesCount: number | null = null;

  // Recurring
  repeatEnabled = false;
  repeatConfig = {
    type: 'weekly' as 'daily' | 'weekly' | 'monthly',
    interval: 1,
    selectedDays: [] as number[],
    endType: 'after' as 'after' | 'until',
    occurrences: 4,
    untilDate: ''
  };
  weekdays = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

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

  /** Data (YYYY-MM-DD) dell'occorrenza in modifica, per scope/serie. */
  get currentAppointmentDate(): string {
    return String(this.data.appointment?.appointmentDate ?? this.data.date ?? '').slice(0, 10);
  }

  /** True se il dialog opera in modalita' modifica di un appuntamento esistente. */
  get isEditMode(): boolean {
    return !!this.data.appointment;
  }

  /**
   * Prefill del form a partire dall'appuntamento da modificare: paziente,
   * note e servizi. La ricorrenza non e' modificabile in edit (single
   * occurrence), quindi viene ignorata.
   */
  private prefillFromAppointment(apt: GymAppointment): void {
    // Paziente: valorizza il control e il display dell'autocomplete.
    if (apt.patientId) {
      this.form.patchValue({ patientId: apt.patientId });
      const existing = this.patients.find((p) => p.id == apt.patientId);
      if (existing) {
        this.patientSearchControl.setValue(this.displayPatient(existing));
      } else if (apt.clientName) {
        this.patientSearchControl.setValue(apt.clientName);
      }
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
   */
  displayPatient = (patient: Patient | null): string => {
    if (!patient) return '';
    return `${patient.cognome} ${patient.nome}`;
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
      this.form.patchValue({ patientId: patient.id });
      this.cdr.markForCheck();
    }
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
        this.form.patchValue({ patientId: result.patient.id });
        // Imposta il display dell'autocomplete con il nome del paziente
        this.patientSearchControl.setValue(this.displayPatient(result.patient));
        this.cdr.markForCheck();
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

  // ==================== RECURRING METHODS ====================

  onRepeatToggle(): void {
    if (!this.repeatEnabled) {
      this.repeatConfig = {
        type: 'weekly',
        interval: 1,
        selectedDays: [],
        endType: 'after',
        occurrences: 4,
        untilDate: ''
      };
    } else {
      const selectedDate = this.data.date ? new Date(this.data.date) : new Date();
      const dayOfWeek = selectedDate.getDay();
      this.repeatConfig.selectedDays = [dayOfWeek];
    }
    this.cdr.markForCheck();
  }

  isDaySelected(dayIndex: number): boolean {
    return this.repeatConfig.selectedDays?.includes(dayIndex) || false;
  }

  toggleDay(dayIndex: number): void {
    if (!this.repeatConfig.selectedDays) {
      this.repeatConfig.selectedDays = [];
    }
    const index = this.repeatConfig.selectedDays.indexOf(dayIndex);
    if (index === -1) {
      this.repeatConfig.selectedDays.push(dayIndex);
      this.repeatConfig.selectedDays.sort();
    } else {
      this.repeatConfig.selectedDays.splice(index, 1);
    }
    this.cdr.markForCheck();
  }

  getIntervalLabel(): string {
    switch (this.repeatConfig.type) {
      case 'daily': return this.repeatConfig.interval === 1 ? 'giorno' : 'giorni';
      case 'weekly': return this.repeatConfig.interval === 1 ? 'settimana' : 'settimane';
      case 'monthly': return this.repeatConfig.interval === 1 ? 'mese' : 'mesi';
      default: return '';
    }
  }

  getOccurrencesPreview(): string {
    if (!this.repeatEnabled) return '';
    let count = 0;
    if (this.repeatConfig.endType === 'after') {
      count = this.repeatConfig.occurrences || 1;
    } else if (this.repeatConfig.endType === 'until' && this.repeatConfig.untilDate && this.data.date) {
      const start = new Date(this.data.date);
      const end = new Date(this.repeatConfig.untilDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (this.repeatConfig.type === 'daily') count = Math.ceil(days / this.repeatConfig.interval);
      else if (this.repeatConfig.type === 'weekly') count = Math.ceil(days / 7 / this.repeatConfig.interval) * (this.repeatConfig.selectedDays?.length || 1);
      else if (this.repeatConfig.type === 'monthly') count = Math.ceil(days / 30 / this.repeatConfig.interval);
    }
    return count > 0 ? `(circa ${count} appuntamenti)` : '';
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
      const clientName = selectedPatient
        ? `${selectedPatient.cognome} ${selectedPatient.nome}`
        : '';

      // Costruisci config ricorrenza se abilitata
      const repeatConfigData = this.repeatEnabled ? {
        type: this.repeatConfig.type,
        interval: this.repeatConfig.interval,
        selectedDays: this.repeatConfig.type === 'weekly' ? this.repeatConfig.selectedDays : undefined,
        endType: this.repeatConfig.endType,
        occurrences: this.repeatConfig.endType === 'after' ? this.repeatConfig.occurrences : undefined,
        untilDate: this.repeatConfig.endType === 'until' ? this.repeatConfig.untilDate : undefined
      } : undefined;

      let result: GymAppointment;

      if (this.isEditMode) {
        // MODIFICA: aggiorna i campi editabili dell'appuntamento esistente.
        const updateInput: UpdateGymAppointmentInput = {
          patientId: this.form.value.patientId || undefined,
          clientName: clientName,
          clientPhone: selectedPatient?.cellulare || selectedPatient?.telefono || undefined,
          // Email omessa se vuota: il backend valida @IsEmail e rifiuta "".
          clientEmail: selectedPatient?.email || undefined,
          notes: this.form.value.notes || undefined,
          services: services.length > 0 ? services : undefined,
        };
        result = await firstValueFrom(
          this.gymRoomService.updateAppointment(this.data.appointment!.id, updateInput),
        );
      } else {
        // CREAZIONE (con report: le occorrenze ricorrenti in conflitto
        // vengono saltate dal backend ed elencate qui sotto).
        const input: CreateGymAppointmentInput = {
          gymRoomId: this.data.gymRoom.id,
          patientId: this.form.value.patientId || undefined,
          clientName: clientName,
          clientPhone: selectedPatient?.cellulare || selectedPatient?.telefono || '',
          // Email omessa se vuota: il backend valida @IsEmail e rifiuta "".
          clientEmail: selectedPatient?.email || undefined,
          appointmentDate: this.data.date,
          startTime: this.data.startTime,
          endTime: this.data.endTime,
          notes: this.form.value.notes || '',
          // MULTISERVIZIO: array invece di singolo serviceId
          services: services.length > 0 ? services : undefined,
          isRecurring: this.repeatEnabled || undefined,
          repeatConfig: repeatConfigData
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
        clientPhone: selectedPatient?.cellulare || selectedPatient?.telefono || undefined,
        clientEmail: selectedPatient?.email || undefined,
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
