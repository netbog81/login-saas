import { Component, OnInit, OnDestroy, Inject, ChangeDetectionStrategy, ChangeDetectorRef, inject, ViewChild } from '@angular/core';
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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { Observable, of, startWith, switchMap, debounceTime, distinctUntilChanged, catchError, firstValueFrom } from 'rxjs';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { PatientService } from '../../../services/patient.service';

import { Patient } from '../../../models/patient.model';
import { User } from '../../../models/user.model';
import { Appointment, RepeatConfig, RecurringType, RecurringEndType, BookingStatus } from '../../../models/appointment.model';
import { ServiceService } from '../../../services/service.service';
import { Service, InstrumentCategory } from '../../../graphql/generated/types';
import { ServiceMultiSelectComponent, SelectableService, SelectedServiceItem } from '../service-multi-select';
import { RecurringScopePanelComponent, RecurringScopeSelection } from '../recurring-scope-panel/recurring-scope-panel.component';
import { RecurringConflictsDialogComponent } from '../recurring-scope-panel/recurring-conflicts-dialog.component';
import { NewPatientDialogComponent, NewPatientDialogResult } from '../new-patient-dialog';
import { tokenizeQuery, matchesAllTokens } from '../../utils/token-match';
import { WhatsappChatStateService } from '../../../features/whatsapp-chat/services/whatsapp-chat-state.service';
import { MatSnackBar } from '@angular/material/snack-bar';

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
  /**
   * Apre il dialog in SOLA LETTURA (dettaglio appuntamento): form disabilitato
   * e nessun pulsante di azione (salva/elimina/stato), solo "Chiudi". Usato dal
   * calendar-v3 quando operatore/medico/istruttore consultano il proprio
   * calendario.
   */
  readOnly?: boolean;
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
  action: 'save' | 'delete' | 'cancel' | 'series-deleted'
    | 'mark-attended' | 'mark-no-show' | 'cancel-with-notice' | 'revert-attended'
    // 'copy' → l'utente vuole duplicare l'appuntamento: il dialog si chiude e
    // il container avvia il flusso copia/incolla. Gestito solo dal calendario
    // v3; gli altri container lo ignorano (retro-compatibile).
    | 'copy';
  appointmentId?: string;
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
    MatDatepickerModule,
    ServiceMultiSelectComponent,
    RecurringScopePanelComponent,
  ],
  templateUrl: './event-mat-dialog.component.html',
  styleUrls: ['./event-mat-dialog.component.scss']
})
export class EventMatDialogComponent implements OnInit, OnDestroy {
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
  /** Feedback temporaneo del pulsante "copia numero". */
  phoneCopied = false;
  private phoneCopiedTimer: ReturnType<typeof setTimeout> | null = null;

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
  /** Modello Date per il datepicker "Fino al"; tenuto in sync con repeatConfig.untilDate (string). */
  repeatUntilDate: Date | null = null;

  /** Aggiorna repeatConfig.untilDate (YYYY-MM-DD) dal datepicker. */
  onRepeatUntilChange(date: Date | null): void {
    this.repeatUntilDate = date;
    if (date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      this.repeatConfig.untilDate = `${y}-${m}-${d}`;
    } else {
      this.repeatConfig.untilDate = '';
    }
  }

  // Weekday labels
  weekdays = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  isEditMode = false;
  bookingStatus: BookingStatus = 'scheduled';

  /**
   * In modifica: un appuntamento singolo (non già in serie) e ancora attivo
   * può essere trasformato in ricorrente. Lui resta la prima occorrenza; le
   * successive vengono create dal backend (makeAppointmentRecurring).
   */
  get canMakeRecurring(): boolean {
    return (
      this.isEditMode &&
      !this.readOnly &&
      !this.data.appointment?.isRecurring &&
      (this.bookingStatus === 'scheduled' || this.bookingStatus === 'confirmed')
    );
  }

  // Recurring series management
  futureSeriesCount = 0;
  loadingSeriesInfo = false;
  private recurringAppointmentService = inject(AvailabilityAppointmentService);
  private patientService = inject(PatientService);
  private chatState = inject(WhatsappChatStateService);
  private snackBar = inject(MatSnackBar);

  constructor(
    public dialogRef: MatDialogRef<EventMatDialogComponent, EventMatDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: EventMatDialogData
  ) {}

  /** Sola lettura: dettaglio appuntamento senza azioni di modifica. */
  get readOnly(): boolean {
    return this.data.readOnly === true;
  }

  ngOnDestroy(): void {
    if (this.phoneCopiedTimer) clearTimeout(this.phoneCopiedTimer);
  }

  ngOnInit(): void {
    this.patients = this.data.patients || [];
    this.isEditMode = !!this.data.appointment;

    this.initForm();
    this.setupPatientFilter();

    // In sola lettura disabilito l'intero form: i campi restano visibili e
    // valorizzati ma non modificabili. I pulsanti di azione sono nascosti dal
    // template (vedi *ngIf="!readOnly").
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    }

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

      // Carica info serie ricorrente
      if (this.data.appointment.isRecurring && this.data.appointment.recurringGroupId) {
        this.loadSeriesInfo(this.data.appointment.recurringGroupId);
      }
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
        this._selectedPatient = patient;
        this.patientSearchControl.setValue(this.displayPatient(patient));
      } else {
        // La lista precaricata e' parziale: senza lookup mirato il campo
        // resterebbe vuoto (e il telefono con lui). Nel frattempo mostra il
        // nominativo scritto sull'appuntamento.
        this.patientSearchControl.setValue(apt.title || '');
        this.loadPatientById(String(apt.patientId));
      }
    }
  }

  /**
   * Lookup mirato del paziente della prenotazione quando non e' nella lista
   * precaricata. In caso di errore restano i dati denormalizzati.
   */
  private loadPatientById(patientId: string): void {
    this.patientService.getPatient(patientId).subscribe({
      next: (patient) => {
        if (!patient) return;
        // Se nel frattempo l'operatore ha scelto un altro paziente, il lookup
        // in ritardo non deve sovrascrivere la scelta.
        if (String(this.form.get('patientId')?.value) !== patientId) return;
        if (!this.patients.find((p) => String(p.id) === String(patient.id))) {
          this.patients = [patient, ...this.patients];
        }
        this._selectedPatient = patient;
        this.patientSearchControl.setValue(this.displayPatient(patient));
        this.cdr.markForCheck();
      },
      error: (err) => console.warn('[EventMatDialog] Lookup paziente fallito:', err),
    });
  }

  /**
   * Filtra l'autocomplete con strategia ibrida:
   * - 0 char     → mostra i primi 50 dalla lista pre-caricata (data.patients)
   * - 1-2 char   → filtro client-side sulla lista pre-caricata
   * - 3+ char    → ricerca remota sul registry (debounced 250ms) — full dataset 3700+
   */
  private setupPatientFilter(): void {
    this.filteredPatients$ = this.patientSearchControl.valueChanges.pipe(
      startWith(''),
      // value può essere string o Patient (quando autocomplete fa il display)
      // — convertiamo a string per la query.
      debounceTime(250),
      distinctUntilChanged((a, b) => {
        const sa = typeof a === 'string' ? a : '';
        const sb = typeof b === 'string' ? b : '';
        return sa === sb;
      }),
      switchMap((value) => {
        const searchStr = (typeof value === 'string' ? value : '').trim();
        if (searchStr.length >= 3) {
          // Ricerca remota: registry global-search trigrammi+fonetico
          return this.patientService.searchPatients(searchStr).pipe(
            catchError((err) => {
              console.warn('[EventMatDialog] Patient remote search failed:', err);
              // Fallback: filtro locale sui pazienti pre-caricati
              return of(this.filterPatientsLocal(searchStr));
            }),
          );
        }
        return of(this.filterPatientsLocal(searchStr));
      }),
    );
  }

  private filterPatientsLocal(search: string): Patient[] {
    if (!search) {
      return this.patients.slice(0, 50);
    }
    // Match a token: "rossi mario" e "mario rossi" trovano entrambi.
    const tokens = tokenizeQuery(search);
    return this.patients
      .filter((p) =>
        matchesAllTokens([p.nome, p.cognome, p.telefono, p.cellulare], tokens),
      )
      .slice(0, 50);
  }

  displayPatient(patient: Patient | string | null): string {
    if (!patient) return '';
    if (typeof patient === 'string') return patient;
    return `${patient.cognome} ${patient.nome}`;
  }

  /**
   * Paziente attualmente selezionato. Memorizzato a parte perché può venire
   * dalla search remota (quindi non presente in this.patients).
   */
  private _selectedPatient: Patient | undefined;

  onPatientSelected(event: MatAutocompleteSelectedEvent): void {
    const patient = event.option.value as Patient;
    this._selectedPatient = patient;
    // Aggiungi alla lista locale se non c'è — utile per "selectedPatient" lookup.
    if (!this.patients.find((p) => p.id === patient.id)) {
      this.patients = [patient, ...this.patients];
    }
    this.form.patchValue({
      patientId: patient.id,
      title: `${patient.cognome ?? ''} ${patient.nome ?? ''}`.trim(),
    });
    this.cdr.markForCheck();
  }

  clearPatient(): void {
    this._selectedPatient = undefined;
    this.form.patchValue({ patientId: null });
    this.patientSearchControl.setValue('');
    this.cdr.markForCheck();
  }

  get selectedPatient(): Patient | undefined {
    const patientId = this.form.get('patientId')?.value;
    if (!patientId) return undefined;
    if (this._selectedPatient && this._selectedPatient.id === patientId) {
      return this._selectedPatient;
    }
    return this.patients.find((p) => p.id == patientId);
  }

  /**
   * Recapito del paziente: prima l'anagrafica (piu' aggiornata), poi il numero
   * denormalizzato sull'appuntamento. Serve all'operatore che deve chiamare il
   * paziente senza uscire dalla scheda.
   */
  get patientPhone(): string {
    const p = this.selectedPatient;
    return p?.cellulare || p?.telefono || this.data.appointment?.clientPhone || '';
  }

  /**
   * Apre il riquadro di chat WhatsApp col paziente dell'appuntamento. Il dialog
   * resta aperto: si scrive al paziente mentre si sistema l'appuntamento.
   */
  openWhatsappChat(): void {
    const phone = this.patientPhone;
    if (!phone) return;
    const patient = this.selectedPatient;
    this.chatState.openForPhone({
      phone,
      patientId: this.form.get('patientId')?.value || undefined,
      patientName: patient
        ? `${patient.cognome ?? ''} ${patient.nome ?? ''}`.trim()
        : this.data.appointment?.title,
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
    const phone = this.patientPhone;
    if (!phone) return;
    navigator.clipboard?.writeText(phone).then(
      () => {
        this.phoneCopied = true;
        this.cdr.markForCheck();
        if (this.phoneCopiedTimer) clearTimeout(this.phoneCopiedTimer);
        this.phoneCopiedTimer = setTimeout(() => {
          this.phoneCopied = false;
          this.cdr.markForCheck();
        }, 2000);
      },
      (err) => console.warn('[EventMatDialog] Copia numero fallita:', err),
    );
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
    const isToday = this.form.get('date')?.value === today;
    // Da scheduled/confirmed (flusso normale) oppure da no_show di oggi
    // (caso ritardatario: il paziente arriva tardi e viene fatto passare).
    const fromStandard = this.canShowStatusActions;
    const fromNoShow = this.bookingStatus === 'no_show';
    return (fromStandard || fromNoShow) && isToday;
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

  // Le azioni di stato chiudono il dialog ritornando l'azione richiesta.
  // Il container che lo apre invoca la mutation corrispondente sul backend
  // (markAppointmentAttended/NoShow/cancelAppointmentWithNotice/revertAttended).
  // Non aggiorniamo lo stato locale prima del round-trip: in caso di errore
  // backend la UI rimane coerente al server.
  onMarkAttended(): void {
    const appointmentId = String(this.data.appointment?.id ?? '');
    if (!appointmentId) return;
    this.dialogRef.close({ action: 'mark-attended', appointmentId });
  }

  onMarkNoShow(): void {
    const appointmentId = String(this.data.appointment?.id ?? '');
    if (!appointmentId) return;
    this.dialogRef.close({ action: 'mark-no-show', appointmentId });
  }

  onCancelWithNotice(): void {
    const appointmentId = String(this.data.appointment?.id ?? '');
    if (!appointmentId) return;
    this.dialogRef.close({ action: 'cancel-with-notice', appointmentId });
  }

  onRevertAttended(): void {
    const appointmentId = String(this.data.appointment?.id ?? '');
    if (!appointmentId) return;
    this.dialogRef.close({ action: 'revert-attended', appointmentId });
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
      // In creazione: config della nuova serie. In modifica: presente solo se
      // l'utente ha attivato "Rendi ricorrente" su un singolo attivo — il
      // container chiama makeAppointmentRecurring dopo l'update.
      repeatConfig:
        this.repeatEnabled && (!this.isEditMode || this.canMakeRecurring)
          ? this.buildRepeatConfig()
          : undefined,
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

  /**
   * "Copia appuntamento": chiude il dialog restituendo l'appuntamento
   * originale, cosi' il container puo' avviare il flusso copia/incolla.
   * Disponibile solo in modifica (serve un appuntamento esistente da copiare).
   */
  onCopy(): void {
    if (!this.isEditMode || !this.data.appointment) return;
    this.dialogRef.close({ action: 'copy', appointment: this.data.appointment });
  }

  // ==================== UTILITIES ====================

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // ==================== RECURRING SERIES MANAGEMENT ====================

  private loadSeriesInfo(recurringGroupId: string): void {
    this.loadingSeriesInfo = true;
    this.recurringAppointmentService.getRecurringSeries(recurringGroupId).subscribe({
      next: (series) => {
        // Conta solo appuntamenti DOPO quello corrente (non incluso)
        const currentDate = this.data.appointment!.date;
        this.futureSeriesCount = series.filter(a =>
          a.appointmentDate > currentDate &&
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
        String(apt.id), apt.date, sel.scope,
        { rangeFrom: sel.rangeFrom, rangeTo: sel.rangeTo, includeCurrent: sel.includeCurrent },
      ));
      alert(`${count} appuntamenti eliminati`);
      this.dialogRef.close({ action: 'series-deleted' });
    } catch {
      alert('Errore nell\'eliminazione della serie');
    }
  }

  /**
   * Applica alla serie (nello scope scelto) TUTTE le modifiche attualmente
   * impostate nel form: orario, operatore, paziente, servizi, strumenti, note,
   * non-retribuito ed un eventuale spostamento di data (l'intera serie viene
   * traslata dello stesso numero di giorni). Se il backend rileva conflitti di
   * sovrapposizione, mostra il riepilogo e NON chiude (niente è stato applicato).
   */
  async onApplySeriesEdit(sel: RecurringScopeSelection): Promise<void> {
    const apt = this.data.appointment!;
    const f = this.form.value;
    const startTime = f.startTime;
    const endTime = f.endTime;
    if (!startTime || !endTime) {
      alert('Imposta un orario di inizio e fine validi prima di applicare alla serie.');
      return;
    }

    const services = this.selectedServices.map(item => ({
      serviceId: item.serviceId,
      customPrice: item.customPrice,
      customDuration: item.customDuration,
    }));

    try {
      const result = await firstValueFrom(this.recurringAppointmentService.updateRecurringSeries({
        appointmentId: String(apt.id),
        scope: sel.scope,
        startTime,
        endTime,
        newDate: f.date || undefined,
        operatorId: f.operatorId || undefined,
        patientId: f.patientId || undefined,
        clientName: f.title || undefined,
        notes: f.notes || undefined,
        nonRetribuito: f.nonRetribuito,
        instrumentOrderMatters: this.instrumentOrderMatters,
        services: services.length > 0 ? services : undefined,
        instruments: this.buildInstrumentData(),
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

      // Applicata (eventuali occorrenze fallite sono segnalate a parte).
      const failedNote = result.conflicts.length > 0
        ? ` (${result.conflicts.length} non aggiornati per errore)` : '';
      alert(`${result.affectedCount} appuntamenti aggiornati${failedNote}`);
      this.dialogRef.close({ action: 'series-deleted' }); // forza refresh calendario
    } catch {
      alert('Errore nella modifica della serie');
    }
  }
}
