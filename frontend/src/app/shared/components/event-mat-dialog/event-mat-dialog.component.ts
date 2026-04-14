import { Component, OnInit, Inject, ChangeDetectionStrategy, ChangeDetectorRef, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatRadioModule } from '@angular/material/radio';
import { Observable, startWith, map } from 'rxjs';

import { Patient } from '../../../models/patient.model';
import { User } from '../../../models/user.model';
import { Appointment, RepeatConfig, RecurringType, RecurringEndType, BookingStatus } from '../../../models/appointment.model';
import { ServiceService } from '../../../services/service.service';
import { Service, InstrumentCategory } from '../../../graphql/generated/types';
import { ServiceMultiSelectComponent, SelectableService, SelectedServiceItem } from '../service-multi-select';
import { NewPatientDialogComponent, NewPatientDialogResult } from '../new-patient-dialog';

/**
 * Dati passati al dialog per la creazione/modifica di un appuntamento.
 */
export interface EventMatDialogData {
  appointment?: Appointment;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultOperatorId?: string;
  users: User[];
  patients: Patient[];
  instrumentCategories?: InstrumentCategory[];
  searchFilters?: {
    duration?: number;
    withInstrument?: boolean;
    instrumentCount?: 1 | 2;
    instrumentCategoryId?: string | null;
    instrument2CategoryId?: string | null;
    instrumentPosition?: 'first' | 'second';
    instrumentOrderMatters?: boolean;
    suggestedInstruments?: { id: string; name: string; categoryId: string }[];
  };
}

/**
 * Dati degli strumenti per l'appuntamento.
 */
export interface AppointmentInstrumentData {
  instrumentCategoryId: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  orderPosition?: number;
}

/**
 * Risultato restituito dal dialog alla chiusura.
 */
export interface EventMatDialogResult {
  action: 'save' | 'delete' | 'cancel';
  appointment?: Appointment;
  services?: { serviceId: string; customPrice?: number; customDuration?: number }[];
  instruments?: AppointmentInstrumentData[];
  instrumentOrderMatters?: boolean;
  repeatConfig?: RepeatConfig;
  nonRetribuito?: boolean;
}

@Component({
  selector: 'app-event-mat-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatTooltipModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatButtonToggleModule,
    MatRadioModule,
    ServiceMultiSelectComponent
  ],
  templateUrl: './event-mat-dialog.component.html',
  styleUrls: ['./event-mat-dialog.component.scss']
})
export class EventMatDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private serviceService = inject(ServiceService);

  // ViewChild per chiudere autocomplete quando si apre nuovo paziente
  @ViewChild('patientAutoTrigger') patientAutoTrigger!: MatAutocompleteTrigger;

  // Form principale
  form!: FormGroup;
  patientSearchControl = new FormControl('');

  // State
  patients: Patient[] = [];
  filteredPatients$!: Observable<Patient[]>;
  operatorServices: Service[] = [];
  selectedServices: SelectedServiceItem[] = [];
  loadingServices = false;

  // Instruments
  instrumentsEnabled = false;
  instrumentOrderMatters = false;
  selectedInstrumentCategoryId = '';
  selectedInstrument2CategoryId = '';
  instrumentPosition: 'first' | 'second' = 'first';

  // Recurring
  repeatEnabled = false;
  repeatConfig: RepeatConfig = {
    type: 'weekly',
    interval: 1,
    selectedDays: [],
    endType: 'after',
    occurrences: 4,
    untilDate: ''
  };

  // Weekday labels
  weekdays = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  isEditMode = false;
  bookingStatus: BookingStatus = 'scheduled';

  constructor(
    public dialogRef: MatDialogRef<EventMatDialogComponent, EventMatDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: EventMatDialogData
  ) {}

  ngOnInit(): void {
    this.patients = this.data.patients || [];
    this.isEditMode = !!this.data.appointment;

    this.initForm();
    this.setupPatientFilter();

    // Load operator services if operator is selected
    const operatorId = this.form.get('operatorId')?.value;
    if (operatorId) {
      this.loadOperatorServices(operatorId);
    }

    // Pre-fill from search filters if present
    if (this.data.searchFilters?.withInstrument && !this.isEditMode) {
      this.instrumentsEnabled = true;
      this.instrumentOrderMatters = this.data.searchFilters.instrumentOrderMatters || false;

      const suggested = this.data.searchFilters.suggestedInstruments;
      if (suggested && suggested.length >= 2) {
        this.selectedInstrumentCategoryId = suggested[0].categoryId;
        this.selectedInstrument2CategoryId = suggested[1].categoryId;
      } else if (suggested && suggested.length === 1) {
        this.selectedInstrumentCategoryId = suggested[0].categoryId;
      } else {
        if (this.data.searchFilters.instrumentCategoryId) {
          this.selectedInstrumentCategoryId = this.data.searchFilters.instrumentCategoryId;
        }
        if (this.data.searchFilters.instrument2CategoryId) {
          this.selectedInstrument2CategoryId = this.data.searchFilters.instrument2CategoryId;
        }
      }

      if (this.data.searchFilters.instrumentPosition) {
        this.instrumentPosition = this.data.searchFilters.instrumentPosition;
      }
    }

    // Load existing instruments in edit mode
    if (this.isEditMode && this.data.appointment?.instruments?.length) {
      this.instrumentsEnabled = true;
      this.instrumentOrderMatters = this.data.appointment.instrumentOrderMatters || false;
      const instruments = this.data.appointment.instruments;
      if (instruments.length >= 1) {
        this.selectedInstrumentCategoryId = instruments[0].instrumentCategoryId || '';
        this.instrumentPosition = instruments[0].startOffsetMinutes === 0 ? 'first' : 'second';
      }
      if (instruments.length >= 2) {
        this.selectedInstrument2CategoryId = instruments[1].instrumentCategoryId || '';
      }
    }

    // Set booking status in edit mode
    if (this.isEditMode && this.data.appointment) {
      this.bookingStatus = (this.data.appointment.bookingStatus as BookingStatus) || 'scheduled';
    }
  }

  private initForm(): void {
    const apt = this.data.appointment;

    this.form = this.fb.group({
      date: [apt?.date || this.data.defaultDate || '', Validators.required],
      operatorId: [apt?.operatorId || this.data.defaultOperatorId || '', Validators.required],
      startTime: [apt?.startTime || this.data.defaultStartTime || '', Validators.required],
      endTime: [apt?.endTime || this.data.defaultEndTime || '', Validators.required],
      patientId: [apt?.patientId || null],
      title: [apt?.title || ''],
      notes: [apt?.notes || ''],
      nonRetribuito: [apt?.nonRetribuito || false]
    });

    // If edit mode and patient exists, set patient search display
    if (this.isEditMode && apt?.patientId) {
      const patient = this.patients.find(p => p.id == apt.patientId);
      if (patient) {
        this.patientSearchControl.setValue(this.displayPatient(patient));
      }
    }
  }

  private setupPatientFilter(): void {
    this.filteredPatients$ = this.patientSearchControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const searchStr = typeof value === 'string' ? value : '';
        return this.filterPatients(searchStr);
      })
    );
  }

  private filterPatients(search: string): Patient[] {
    if (!search) {
      return this.patients.slice(0, 50); // Limit results
    }
    const lowerSearch = search.toLowerCase();
    return this.patients.filter(p =>
      p.nome.toLowerCase().includes(lowerSearch) ||
      p.cognome.toLowerCase().includes(lowerSearch) ||
      (p.telefono || '').includes(search) ||
      (p.cellulare || '').includes(search)
    ).slice(0, 50);
  }

  displayPatient(patient: Patient | string | null): string {
    if (!patient) return '';
    if (typeof patient === 'string') return patient;
    return `${patient.cognome} ${patient.nome}`;
  }

  onPatientSelected(event: MatAutocompleteSelectedEvent): void {
    const patient = event.option.value as Patient;
    this.form.patchValue({
      patientId: patient.id,
      title: `${patient.cognome} ${patient.nome}`
    });
    this.cdr.markForCheck();
  }

  clearPatient(): void {
    this.form.patchValue({ patientId: null });
    this.patientSearchControl.setValue('');
    this.cdr.markForCheck();
  }

  get selectedPatient(): Patient | undefined {
    const patientId = this.form.get('patientId')?.value;
    if (!patientId) return undefined;
    return this.patients.find(p => p.id == patientId);
  }

  // ==================== OPERATOR & SERVICES ====================

  get selectedOperator(): User | undefined {
    const operatorId = this.form.get('operatorId')?.value;
    if (!operatorId) return undefined;
    return this.data.users.find(u => u.operatorId === operatorId);
  }

  onOperatorChange(): void {
    const operatorId = this.form.get('operatorId')?.value;
    this.selectedServices = [];

    // Reset strumenti quando cambia operatore (potrebbero non essere più validi per la nuova macroCategory)
    this.selectedInstrumentCategoryId = '';
    this.selectedInstrument2CategoryId = '';
    this.instrumentPosition = 'first';
    this.instrumentOrderMatters = false;

    if (operatorId) {
      this.loadOperatorServices(operatorId);
    } else {
      this.operatorServices = [];
    }
    this.cdr.markForCheck();
  }

  private loadOperatorServices(operatorId: string): void {
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

        // In edit mode, restore selected services
        if (this.isEditMode && this.data.appointment) {
          const apt = this.data.appointment;

          // Priorità: appointmentServices (nuovo) > serviceId (vecchio)
          if (apt.appointmentServices && apt.appointmentServices.length > 0) {
            this.selectedServices = apt.appointmentServices.map((as, idx) => {
              const foundService = services.find(s => s.id === as.serviceId);

              // Costruisce SelectableService con tipo corretto
              const selectableService: SelectableService | undefined = as.service
                ? {
                    id: as.service.id,
                    name: as.service.name,
                    defaultPrice: as.service.defaultPrice,
                    discountFE: as.service.discountFE,
                    defaultDuration: as.service.duration
                  }
                : foundService
                  ? {
                      id: foundService.id,
                      name: foundService.name,
                      defaultPrice: foundService.defaultPrice,
                      defaultDuration: foundService.defaultDuration
                    }
                  : undefined;

              return {
                serviceId: as.serviceId,
                service: selectableService,
                customPrice: as.customPrice ?? undefined,
                customDuration: as.customDuration ?? undefined,
                orderPosition: as.orderPosition ?? idx
              };
            });
          } else if (apt.serviceId) {
            // Fallback per vecchi appuntamenti con solo serviceId
            const existingService = services.find(s => s.id === apt.serviceId);
            if (existingService) {
              this.selectedServices = [{
                serviceId: existingService.id,
                service: {
                  id: existingService.id,
                  name: existingService.name,
                  defaultPrice: existingService.defaultPrice,
                  defaultDuration: existingService.defaultDuration
                },
                orderPosition: 0
              }];
            }
          }
        }

        // Auto-seleziona se c'è un solo servizio disponibile e non siamo in edit mode
        if (!this.isEditMode && services.length === 1 && this.selectedServices.length === 0) {
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
        console.error('[EventMatDialog] Error loading operator services:', error);
        this.operatorServices = [];
        this.loadingServices = false;
        this.cdr.markForCheck();
      }
    });
  }

  get selectableServices(): SelectableService[] {
    return this.operatorServices.map(s => ({
      id: s.id,
      name: s.name,
      defaultPrice: s.defaultPrice,
      defaultDuration: s.defaultDuration
    }));
  }

  onServicesChange(services: SelectedServiceItem[]): void {
    this.selectedServices = services;
    this.cdr.markForCheck();
  }

  // ==================== NEW PATIENT ====================

  openNewPatientDialog(event?: MouseEvent): void {
    // Previeni propagazione per evitare che il click attivi il focus sull'input
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    // Chiudi il pannello autocomplete se aperto (evita che copra il modal nuovo paziente)
    if (this.patientAutoTrigger) {
      this.patientAutoTrigger.closePanel();
    }

    const dialogRef = this.dialog.open(NewPatientDialogComponent, {
      width: '500px',
      disableClose: true,
      data: {}
    });

    dialogRef.afterClosed().subscribe((result: NewPatientDialogResult | undefined) => {
      if (result && !result.cancelled && result.patient) {
        // Add patient to list
        this.patients = [...this.patients, result.patient];
        // Select automatically
        this.form.patchValue({
          patientId: result.patient.id,
          title: `${result.patient.cognome} ${result.patient.nome}`
        });
        this.patientSearchControl.setValue(this.displayPatient(result.patient));
        this.cdr.markForCheck();
      }
    });
  }

  // ==================== NON RETRIBUITO ====================

  onNonRetribuitoChange(): void {
    if (this.form.get('nonRetribuito')?.value) {
      // Reset fields not needed for non-paid appointment
      this.selectedServices = [];
      this.form.patchValue({ patientId: null });
      this.patientSearchControl.setValue('');
      this.instrumentsEnabled = false;
      this.selectedInstrumentCategoryId = '';
      this.selectedInstrument2CategoryId = '';
      this.instrumentOrderMatters = false;
    }
    this.cdr.markForCheck();
  }

  // ==================== INSTRUMENTS ====================

  get instrumentCategories(): InstrumentCategory[] {
    const allCategories = this.data.instrumentCategories || [];
    const operator = this.selectedOperator;

    // Se operatore ha macroCategory, filtra le categorie strumenti per quella macroCategory
    if (operator?.macroCategory) {
      return allCategories.filter(cat => cat.macroCategory === operator.macroCategory);
    }

    // Altrimenti mostra tutte le categorie
    return allCategories;
  }

  get canConfigureInstruments(): boolean {
    return this.instrumentCategories.length > 0;
  }

  get appointmentDuration(): number {
    const startTime = this.form.get('startTime')?.value;
    const endTime = this.form.get('endTime')?.value;
    if (!startTime || !endTime) return 45;
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    return end - start;
  }

  get showPositionSelector(): boolean {
    return this.instrumentsEnabled &&
           !!this.selectedInstrumentCategoryId &&
           !this.selectedInstrument2CategoryId &&
           this.appointmentDuration > 30;
  }

  get canAddSecondInstrument(): boolean {
    return this.instrumentsEnabled &&
           !!this.selectedInstrumentCategoryId &&
           this.appointmentDuration >= 45; // Ridotto da 60 a 45 minuti per maggiore flessibilità
  }

  getInstrumentCategoryName(categoryId: string): string {
    const cat = this.instrumentCategories.find(c => c.id === categoryId);
    return cat?.name || 'Strumento';
  }

  getInstrumentDescription(): string {
    if (!this.instrumentsEnabled) return '';

    const duration = this.appointmentDuration;
    const parts: string[] = [];

    if (this.selectedInstrumentCategoryId && !this.selectedInstrument2CategoryId) {
      const name = this.getInstrumentCategoryName(this.selectedInstrumentCategoryId);
      if (duration === 30) {
        parts.push(`${name} (0-30 min)`);
      } else if (this.instrumentPosition === 'first') {
        parts.push(`${name} (0-30 min)`);
      } else {
        parts.push(`${name} (${duration - 30}-${duration} min)`);
      }
    } else if (this.selectedInstrumentCategoryId && this.selectedInstrument2CategoryId) {
      const name1 = this.getInstrumentCategoryName(this.selectedInstrumentCategoryId);
      const name2 = this.getInstrumentCategoryName(this.selectedInstrument2CategoryId);

      if (duration === 45) {
        parts.push(`${name1} (0-30 min)`);
        parts.push(`${name2} (15-45 min)`);
      } else {
        const halfDuration = Math.floor(duration / 2);
        parts.push(`${name1} (0-${halfDuration} min)`);
        parts.push(`${name2} (${halfDuration}-${duration} min)`);
      }

      if (this.instrumentOrderMatters) {
        parts.push('(ordine specifico)');
      }
    }

    return parts.join(', ');
  }

  onInstrumentsToggle(): void {
    if (!this.instrumentsEnabled) {
      this.selectedInstrumentCategoryId = '';
      this.selectedInstrument2CategoryId = '';
      this.instrumentPosition = 'first';
      this.instrumentOrderMatters = false;
    }
    this.cdr.markForCheck();
  }

  removeSecondInstrument(): void {
    this.selectedInstrument2CategoryId = '';
    this.instrumentOrderMatters = false;
    this.cdr.markForCheck();
  }

  private buildInstrumentData(): AppointmentInstrumentData[] {
    if (!this.instrumentsEnabled || !this.selectedInstrumentCategoryId) {
      return [];
    }

    const instruments: AppointmentInstrumentData[] = [];
    const duration = this.appointmentDuration;

    if (this.selectedInstrumentCategoryId && !this.selectedInstrument2CategoryId) {
      if (duration === 30) {
        instruments.push({
          instrumentCategoryId: this.selectedInstrumentCategoryId,
          startOffsetMinutes: 0,
          endOffsetMinutes: 30,
          orderPosition: 1
        });
      } else if (this.instrumentPosition === 'first') {
        instruments.push({
          instrumentCategoryId: this.selectedInstrumentCategoryId,
          startOffsetMinutes: 0,
          endOffsetMinutes: 30,
          orderPosition: 1
        });
      } else {
        instruments.push({
          instrumentCategoryId: this.selectedInstrumentCategoryId,
          startOffsetMinutes: duration - 30,
          endOffsetMinutes: duration,
          orderPosition: 1
        });
      }
    } else if (this.selectedInstrumentCategoryId && this.selectedInstrument2CategoryId) {
      if (duration === 45) {
        instruments.push({
          instrumentCategoryId: this.selectedInstrumentCategoryId,
          startOffsetMinutes: 0,
          endOffsetMinutes: 30,
          orderPosition: 1
        });
        instruments.push({
          instrumentCategoryId: this.selectedInstrument2CategoryId,
          startOffsetMinutes: 15,
          endOffsetMinutes: 45,
          orderPosition: 2
        });
      } else {
        const halfDuration = Math.floor(duration / 2);
        instruments.push({
          instrumentCategoryId: this.selectedInstrumentCategoryId,
          startOffsetMinutes: 0,
          endOffsetMinutes: halfDuration,
          orderPosition: 1
        });
        instruments.push({
          instrumentCategoryId: this.selectedInstrument2CategoryId,
          startOffsetMinutes: halfDuration,
          endOffsetMinutes: duration,
          orderPosition: 2
        });
      }
    }

    return instruments;
  }

  // ==================== RECURRING ====================

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
      const date = this.form.get('date')?.value;
      const selectedDate = date ? new Date(date) : new Date();
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
    const date = this.form.get('date')?.value;

    switch (this.repeatConfig.endType) {
      case 'after':
        count = this.repeatConfig.occurrences || 1;
        break;
      case 'until':
        if (this.repeatConfig.untilDate && date) {
          const start = new Date(date);
          const end = new Date(this.repeatConfig.untilDate);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          switch (this.repeatConfig.type) {
            case 'daily':
              count = Math.ceil(days / this.repeatConfig.interval);
              break;
            case 'weekly':
              const weeks = Math.ceil(days / 7);
              count = Math.ceil(weeks / this.repeatConfig.interval) * (this.repeatConfig.selectedDays?.length || 1);
              break;
            case 'monthly':
              count = Math.ceil(days / 30 / this.repeatConfig.interval);
              break;
          }
        }
        break;
      case 'never':
        count = 52;
        break;
    }

    return count > 0 ? `(circa ${count} appuntamenti)` : '';
  }

  private buildRepeatConfig(): RepeatConfig | undefined {
    if (!this.repeatEnabled) return undefined;

    return {
      type: this.repeatConfig.type.toUpperCase() as RecurringType,
      interval: this.repeatConfig.interval,
      selectedDays: this.repeatConfig.type === 'weekly' ? this.repeatConfig.selectedDays : undefined,
      endType: this.repeatConfig.endType.toUpperCase() as RecurringEndType,
      occurrences: this.repeatConfig.endType === 'after' ? this.repeatConfig.occurrences : undefined,
      untilDate: this.repeatConfig.endType === 'until' ? this.repeatConfig.untilDate : undefined
    };
  }

  // ==================== BOOKING STATUS ====================

  get canShowStatusActions(): boolean {
    return this.bookingStatus === 'scheduled' || this.bookingStatus === 'confirmed';
  }

  get canMarkAttended(): boolean {
    const today = new Date().toISOString().split('T')[0];
    return this.canShowStatusActions && this.form.get('date')?.value === today;
  }

  get canMarkNoShow(): boolean {
    const now = new Date();
    const date = this.form.get('date')?.value;
    const startTime = this.form.get('startTime')?.value;
    if (!date || !startTime) return false;
    const appointmentStart = new Date(`${date}T${startTime}`);
    return this.canShowStatusActions && appointmentStart < now;
  }

  get canCancel(): boolean {
    return this.canShowStatusActions;
  }

  get canRevertAttended(): boolean {
    return this.bookingStatus === 'attended';
  }

  get isLateCancellation(): boolean {
    const date = this.form.get('date')?.value;
    const startTime = this.form.get('startTime')?.value;
    if (!date || !startTime) return false;
    const appointmentStart = new Date(`${date}T${startTime}`);
    const hoursUntil = (appointmentStart.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil < 24;
  }

  getStatusClass(): string {
    const statusClasses: Record<string, string> = {
      'scheduled': 'status-scheduled',
      'confirmed': 'status-confirmed',
      'attended': 'status-attended',
      'no_show': 'status-no-show',
      'cancelled_early': 'status-cancelled',
      'cancelled_late': 'status-cancelled-late',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[this.bookingStatus] || 'status-scheduled';
  }

  getStatusLabel(): string {
    const labels: Record<string, string> = {
      'scheduled': 'Prenotato',
      'confirmed': 'Confermato',
      'attended': 'Presentato',
      'no_show': 'Non Presentato',
      'cancelled_early': 'Disdetto',
      'cancelled_late': 'Disdetto (tardivo)',
      'cancelled': 'Cancellato'
    };
    return labels[this.bookingStatus] || 'Prenotato';
  }

  onRevertAttended(): void {
    this.bookingStatus = 'scheduled';
    this.cdr.markForCheck();
  }

  // ==================== VALIDATION ====================

  get canSave(): boolean {
    const f = this.form.value;
    return !!(
      f.date &&
      f.startTime &&
      f.endTime &&
      f.operatorId &&
      (f.title || f.patientId)
    );
  }

  // ==================== ACTIONS ====================

  onSave(): void {
    if (!this.canSave) return;

    const f = this.form.value;

    // Build services array
    const services = this.selectedServices.map(item => ({
      serviceId: item.serviceId,
      customPrice: item.customPrice,
      customDuration: item.customDuration
    }));

    const appointment: Appointment = {
      id: this.data.appointment?.id || 0,
      title: f.title || '',
      date: f.date,
      startTime: f.startTime,
      endTime: f.endTime,
      operatorId: f.operatorId,
      serviceId: services[0]?.serviceId,
      patientId: f.patientId || undefined,
      notes: f.notes || undefined
    };

    this.dialogRef.close({
      action: 'save',
      appointment,
      services: services.length > 0 ? services : undefined,
      instruments: this.buildInstrumentData(),
      instrumentOrderMatters: this.instrumentOrderMatters,
      repeatConfig: this.repeatEnabled && !this.isEditMode ? this.buildRepeatConfig() : undefined,
      nonRetribuito: f.nonRetribuito
    });
  }

  onDelete(): void {
    if (confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
      this.dialogRef.close({
        action: 'delete',
        appointment: this.data.appointment
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' });
  }

  // ==================== UTILITIES ====================

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
