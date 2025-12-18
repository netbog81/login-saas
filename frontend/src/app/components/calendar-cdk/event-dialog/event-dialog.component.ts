import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Appointment, AppointmentInstrument, RepeatConfig, RecurringType, RecurringEndType, BookingStatus } from '../../../models/appointment.model';
import { User } from '../../../models/user.model';
import { Patient } from '../../../models/patient.model';
import { InstrumentCategory } from '../../../graphql/generated/types';
import { PatientService } from '../../../services/patient.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';

export interface EventDialogData {
  appointment?: Appointment;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultOperatorId?: string;
  users: User[];
  patients: Patient[];
  // Categorie strumenti disponibili per l'operatore
  instrumentCategories?: InstrumentCategory[];
  // Filtri pre-compilati dalla ricerca
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

export interface AppointmentInstrumentData {
  instrumentCategoryId: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  orderPosition?: number;
}

export interface EventDialogResult {
  action: 'save' | 'delete' | 'cancel';
  appointment?: Appointment;
  instruments?: AppointmentInstrumentData[];
  instrumentOrderMatters?: boolean;
  repeatConfig?: RepeatConfig;
}

@Component({
  selector: 'app-event-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-dialog.component.html',
  styleUrls: ['./event-dialog.component.scss']
})
export class EventDialogComponent implements OnInit {
  @Input() data!: EventDialogData;
  @Output() result = new EventEmitter<EventDialogResult>();

  // Form fields
  title: string = '';
  date: string = '';
  startTime: string = '';
  endTime: string = '';
  operatorId: string = '';
  patientId: number | null = null;
  notes: string = '';

  // Patient search
  patientSearch: string = '';
  showNewPatientForm: boolean = false;
  newPatient: Partial<Patient> = {};
  newPatientError: string = '';
  savingNewPatient: boolean = false;

  constructor(
    private patientService: PatientService,
    private appointmentService: AvailabilityAppointmentService
  ) {}

  // Instrument management
  instrumentsEnabled: boolean = false;
  instrumentOrderMatters: boolean = false;
  configuredInstruments: AppointmentInstrumentData[] = [];
  // For single instrument config
  selectedInstrumentCategoryId: string = '';
  instrumentPosition: 'first' | 'second' = 'first';
  // For dual instrument config
  selectedInstrument2CategoryId: string = '';

  // Recurring appointment config
  repeatEnabled: boolean = false;
  repeatConfig: RepeatConfig = {
    type: 'weekly',
    interval: 1,
    selectedDays: [],
    endType: 'after',
    occurrences: 4,
    untilDate: ''
  };

  // Weekday labels for UI
  weekdays = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  isEditMode: boolean = false;
  errors: { [key: string]: string } = {};

  // Booking status for edit mode
  bookingStatus: BookingStatus = 'scheduled';

  ngOnInit(): void {
    if (this.data.appointment) {
      // Edit mode
      this.isEditMode = true;
      const apt = this.data.appointment;
      this.title = apt.title;
      this.date = apt.date;
      this.startTime = apt.startTime;
      this.endTime = apt.endTime;
      this.operatorId = apt.operatorId;
      this.patientId = apt.patientId ? Number(apt.patientId) : null;  // Forza conversione a number
      this.notes = apt.notes || '';
      this.bookingStatus = (apt.bookingStatus as BookingStatus) || 'scheduled';

      // Load existing instruments
      if (apt.instruments && apt.instruments.length > 0) {
        this.instrumentsEnabled = true;
        this.instrumentOrderMatters = apt.instrumentOrderMatters || false;
        this.configuredInstruments = apt.instruments.map(inst => ({
          instrumentCategoryId: inst.instrumentCategoryId || '',
          startOffsetMinutes: inst.startOffsetMinutes,
          endOffsetMinutes: inst.endOffsetMinutes,
          orderPosition: inst.orderPosition
        }));

        // Set UI state from loaded instruments
        if (this.configuredInstruments.length === 1) {
          this.selectedInstrumentCategoryId = this.configuredInstruments[0].instrumentCategoryId;
          this.instrumentPosition = this.configuredInstruments[0].startOffsetMinutes === 0 ? 'first' : 'second';
        } else if (this.configuredInstruments.length >= 2) {
          this.selectedInstrumentCategoryId = this.configuredInstruments[0].instrumentCategoryId;
          this.selectedInstrument2CategoryId = this.configuredInstruments[1].instrumentCategoryId;
        }
      }
    } else {
      // Create mode
      this.date = this.data.defaultDate || '';
      this.startTime = this.data.defaultStartTime || '';
      this.endTime = this.data.defaultEndTime || '';
      this.operatorId = this.data.defaultOperatorId || (this.data.users[0]?.operatorId || '');

      // Pre-fill from search filters if present
      if (this.data.searchFilters?.withInstrument) {
        this.instrumentsEnabled = true;
        this.instrumentOrderMatters = this.data.searchFilters.instrumentOrderMatters || false;

        // Usa suggestedInstruments se disponibili (contengono la combinazione che ha funzionato durante la ricerca)
        const suggested = this.data.searchFilters.suggestedInstruments;

        if (suggested && suggested.length >= 2) {
          // Usa l'ordine che ha effettivamente funzionato durante la ricerca
          this.selectedInstrumentCategoryId = suggested[0].categoryId;
          this.selectedInstrument2CategoryId = suggested[1].categoryId;
        } else if (suggested && suggested.length === 1) {
          this.selectedInstrumentCategoryId = suggested[0].categoryId;
        } else {
          // Fallback ai filtri originali se non ci sono suggestedInstruments
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
    }
  }

  get filteredPatients(): Patient[] {
    if (!this.patientSearch) {
      return this.data.patients;
    }
    const search = this.patientSearch.toLowerCase();
    return this.data.patients.filter(p =>
      p.nome.toLowerCase().includes(search) ||
      p.cognome.toLowerCase().includes(search) ||
      (p.telefono || p.cellulare || '').includes(search)
    );
  }

  get selectedPatient(): Patient | undefined {
    if (!this.patientId) return undefined;
    // Usa == per gestire confronto stringa/numero (GraphQL ID può essere stringa)
    return this.data.patients.find(p => p.id == this.patientId);
  }

  get canSave(): boolean {
    return !!(
      this.date &&
      this.startTime &&
      this.endTime &&
      this.operatorId &&
      (this.title || this.patientId)
    );
  }

  /**
   * Categorie strumenti disponibili
   */
  get instrumentCategories(): InstrumentCategory[] {
    return this.data.instrumentCategories || [];
  }

  /**
   * Verifica se gli strumenti sono disponibili per la configurazione
   */
  get canConfigureInstruments(): boolean {
    return this.instrumentCategories.length > 0;
  }

  /**
   * Calcola la durata dell'appuntamento in minuti
   */
  get appointmentDuration(): number {
    if (!this.startTime || !this.endTime) return 45;
    const start = this.timeToMinutes(this.startTime);
    const end = this.timeToMinutes(this.endTime);
    return end - start;
  }

  /**
   * Verifica se è necessario mostrare la selezione della posizione strumento
   */
  get showPositionSelector(): boolean {
    return this.instrumentsEnabled &&
           !!this.selectedInstrumentCategoryId &&
           !this.selectedInstrument2CategoryId &&
           this.appointmentDuration > 30;
  }

  /**
   * Verifica se è possibile aggiungere un secondo strumento
   */
  get canAddSecondInstrument(): boolean {
    return this.instrumentsEnabled &&
           !!this.selectedInstrumentCategoryId &&
           this.appointmentDuration >= 60;
  }

  /**
   * Ottiene il nome della categoria strumento selezionata
   */
  getInstrumentCategoryName(categoryId: string): string {
    const cat = this.instrumentCategories.find(c => c.id === categoryId);
    return cat?.name || 'Strumento';
  }

  /**
   * Restituisce gli strumenti suggeriti dai filtri
   */
  get suggestedInstruments(): { id: string; name: string; categoryId: string }[] {
    return this.data.searchFilters?.suggestedInstruments || [];
  }

  /**
   * Formatta la descrizione degli strumenti per la visualizzazione
   */
  getInstrumentDescription(): string {
    if (!this.instrumentsEnabled) return '';

    const duration = this.appointmentDuration;
    const parts: string[] = [];

    if (this.selectedInstrumentCategoryId && !this.selectedInstrument2CategoryId) {
      // Single instrument
      const name = this.getInstrumentCategoryName(this.selectedInstrumentCategoryId);
      if (duration === 30) {
        parts.push(`${name} (0-30 min)`);
      } else if (this.instrumentPosition === 'first') {
        parts.push(`${name} (0-30 min)`);
      } else {
        parts.push(`${name} (${duration - 30}-${duration} min)`);
      }
    } else if (this.selectedInstrumentCategoryId && this.selectedInstrument2CategoryId) {
      // Two instruments
      const name1 = this.getInstrumentCategoryName(this.selectedInstrumentCategoryId);
      const name2 = this.getInstrumentCategoryName(this.selectedInstrument2CategoryId);

      if (duration === 45) {
        // Overlap: 0-30 e 15-45 (15 min di sovrapposizione)
        parts.push(`${name1} (0-30 min)`);
        parts.push(`${name2} (15-45 min)`);
      } else {
        // Sequenziale: split a metà (es: 60 min → 0-30 e 30-60)
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

  /**
   * Gestisce il toggle degli strumenti
   */
  onInstrumentsToggle(): void {
    if (!this.instrumentsEnabled) {
      // Reset instrument config when disabled
      this.selectedInstrumentCategoryId = '';
      this.selectedInstrument2CategoryId = '';
      this.instrumentPosition = 'first';
      this.instrumentOrderMatters = false;
    }
  }

  /**
   * Rimuove il secondo strumento
   */
  removeSecondInstrument(): void {
    this.selectedInstrument2CategoryId = '';
    this.instrumentOrderMatters = false;
  }

  // ==================== RECURRING METHODS ====================

  /**
   * Gestisce il toggle della ricorrenza
   */
  onRepeatToggle(): void {
    if (!this.repeatEnabled) {
      // Reset config when disabled
      this.repeatConfig = {
        type: 'weekly',
        interval: 1,
        selectedDays: [],
        endType: 'after',
        occurrences: 4,
        untilDate: ''
      };
    } else {
      // Pre-select current day of week
      const selectedDate = this.date ? new Date(this.date) : new Date();
      const dayOfWeek = selectedDate.getDay();
      this.repeatConfig.selectedDays = [dayOfWeek];
    }
  }

  /**
   * Verifica se un giorno della settimana è selezionato
   */
  isDaySelected(dayIndex: number): boolean {
    return this.repeatConfig.selectedDays?.includes(dayIndex) || false;
  }

  /**
   * Toggle di un giorno della settimana
   */
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
  }

  /**
   * Restituisce il label per l'intervallo in base al tipo di ricorrenza
   */
  getIntervalLabel(): string {
    switch (this.repeatConfig.type) {
      case 'daily': return this.repeatConfig.interval === 1 ? 'giorno' : 'giorni';
      case 'weekly': return this.repeatConfig.interval === 1 ? 'settimana' : 'settimane';
      case 'monthly': return this.repeatConfig.interval === 1 ? 'mese' : 'mesi';
      default: return '';
    }
  }

  /**
   * Calcola il numero di occorrenze in base alla configurazione
   */
  getOccurrencesPreview(): string {
    if (!this.repeatEnabled) return '';

    let count = 0;
    switch (this.repeatConfig.endType) {
      case 'after':
        count = this.repeatConfig.occurrences || 1;
        break;
      case 'until':
        // Stima approssimativa
        if (this.repeatConfig.untilDate && this.date) {
          const start = new Date(this.date);
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
        count = 52; // Max default
        break;
    }

    return count > 0 ? `(circa ${count} appuntamenti)` : '';
  }

  onPatientSelect(patientId: number | null): void {
    this.patientId = patientId;
    this.patientSearch = '';  // Chiude il dropdown di ricerca
    if (patientId) {
      // Usa == per confronto loose (GraphQL può restituire ID come stringa)
      const patient = this.data.patients.find(p => p.id == patientId);
      if (patient) {
        this.title = `${patient.nome} ${patient.cognome}`;
      }
    }
  }

  onShowNewPatientForm(): void {
    this.showNewPatientForm = true;
    this.newPatient = {
      nome: '',
      cognome: '',
      telefono: '',
      cellulare: '',
      email: '',
      notes: '',
      genere: 'NON_SPECIFICATO',  // GraphQL enum key name (required)
      tipoPaziente: 'ADULTO_AUTONOMO'  // GraphQL enum key name (required)
    };
  }

  onCancelNewPatient(): void {
    this.showNewPatientForm = false;
    this.newPatient = {};
    this.newPatientError = '';
  }

  async onSaveNewPatient(): Promise<void> {
    if (this.savingNewPatient) return;

    const nome = this.newPatient.nome?.trim();
    const cognome = this.newPatient.cognome?.trim();

    if (!nome || !cognome) {
      this.newPatientError = 'Nome e cognome sono obbligatori';
      return;
    }

    // Validazione contatti: backend richiede almeno un contatto
    const telefono = this.newPatient.telefono?.trim();
    const cellulare = this.newPatient.cellulare?.trim();
    const email = this.newPatient.email?.trim();

    if (!telefono && !cellulare && !email) {
      this.newPatientError = 'Almeno un contatto (telefono, cellulare o email) è obbligatorio';
      return;
    }

    this.savingNewPatient = true;
    this.newPatientError = '';

    try {
      const created = await firstValueFrom(this.patientService.createPatient(this.newPatient));
      // Add to patients list (create new array to avoid immutability issues with Apollo cache)
      this.data.patients = [...this.data.patients, created];
      // Select the new patient - forza conversione a number (GraphQL ID può essere string)
      this.onPatientSelect(Number(created.id));
      // Close form
      this.showNewPatientForm = false;
      this.newPatient = {};
    } catch (error) {
      console.error('Error creating patient:', error);
      this.newPatientError = 'Errore nella creazione del paziente';
    } finally {
      this.savingNewPatient = false;
    }
  }

  validate(): boolean {
    this.errors = {};

    if (!this.date) {
      this.errors['date'] = 'La data è obbligatoria';
    }

    if (!this.startTime) {
      this.errors['startTime'] = 'L\'orario di inizio è obbligatorio';
    }

    if (!this.endTime) {
      this.errors['endTime'] = 'L\'orario di fine è obbligatorio';
    }

    if (this.startTime && this.endTime) {
      const start = this.timeToMinutes(this.startTime);
      const end = this.timeToMinutes(this.endTime);
      if (end <= start) {
        this.errors['endTime'] = 'L\'orario di fine deve essere successivo all\'inizio';
      }
    }

    if (!this.operatorId) {
      this.errors['operatorId'] = 'Seleziona un operatore';
    }

    if (!this.title && !this.patientId) {
      this.errors['title'] = 'Inserisci un titolo o seleziona un paziente';
    }

    return Object.keys(this.errors).length === 0;
  }

  onSave(): void {
    if (!this.validate()) {
      return;
    }

    const appointment: Appointment = {
      id: this.data.appointment?.id || 0,
      title: this.title,
      date: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
      operatorId: this.operatorId,
      patientId: this.patientId ? Number(this.patientId) : undefined,  // Forza conversione a Int per GraphQL
      notes: this.notes || undefined
    };

    // Costruisci i dati degli strumenti dalla configurazione corrente
    const instruments = this.buildInstrumentData();

    // Costruisci la config di ricorrenza se abilitata
    // Nota: type e endType devono essere UPPERCASE per GraphQL (DAILY, WEEKLY, MONTHLY, NEVER, AFTER, UNTIL)
    const repeatConfig = this.repeatEnabled && !this.isEditMode ? {
      type: this.repeatConfig.type.toUpperCase() as RecurringType,
      interval: this.repeatConfig.interval,
      selectedDays: this.repeatConfig.type === 'weekly' ? this.repeatConfig.selectedDays : undefined,
      endType: this.repeatConfig.endType.toUpperCase() as RecurringEndType,
      occurrences: this.repeatConfig.endType === 'after' ? this.repeatConfig.occurrences : undefined,
      untilDate: this.repeatConfig.endType === 'until' ? this.repeatConfig.untilDate : undefined
    } : undefined;

    this.result.emit({
      action: 'save',
      appointment,
      instruments: instruments.length > 0 ? instruments : undefined,
      instrumentOrderMatters: this.instrumentOrderMatters,
      repeatConfig
    });
  }

  /**
   * Costruisce i dati degli strumenti in base alla configurazione corrente
   */
  private buildInstrumentData(): AppointmentInstrumentData[] {
    if (!this.instrumentsEnabled || !this.selectedInstrumentCategoryId) {
      return [];
    }

    const instruments: AppointmentInstrumentData[] = [];
    const duration = this.appointmentDuration;

    if (this.selectedInstrumentCategoryId && !this.selectedInstrument2CategoryId) {
      // Single instrument
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
      // Two instruments
      if (duration === 45) {
        // Overlap: 0-30 e 15-45 (15 min di sovrapposizione)
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
        // Sequenziale: split a metà (es: 60 min → 0-30 e 30-60)
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

  onDelete(): void {
    if (confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
      this.result.emit({
        action: 'delete',
        appointment: this.data.appointment
      });
    }
  }

  onCancel(): void {
    this.result.emit({
      action: 'cancel'
    });
  }

  // ==================== BOOKING STATUS METHODS ====================

  /**
   * Mostra le azioni di stato solo per appuntamenti non già cancellati/chiusi
   */
  get canShowStatusActions(): boolean {
    return this.bookingStatus === 'scheduled' || this.bookingStatus === 'confirmed';
  }

  /**
   * Può segnare come "paziente arrivato" solo se l'appuntamento è oggi
   */
  get canMarkAttended(): boolean {
    const today = new Date().toISOString().split('T')[0];
    return this.canShowStatusActions && this.date === today;
  }

  /**
   * Può segnare come no-show solo se l'appuntamento è passato
   */
  get canMarkNoShow(): boolean {
    const now = new Date();
    const appointmentEnd = new Date(`${this.date}T${this.endTime}`);
    return this.canShowStatusActions && appointmentEnd < now;
  }

  /**
   * Può cancellare se lo stato lo consente
   */
  get canCancel(): boolean {
    return this.canShowStatusActions;
  }

  /**
   * Verifica se è una cancellazione tardiva (<24h)
   */
  get isLateCancellation(): boolean {
    if (!this.date || !this.startTime) return false;
    const appointmentStart = new Date(`${this.date}T${this.startTime}`);
    const hoursUntil = (appointmentStart.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil < 24;
  }

  /**
   * Restituisce la classe CSS per il badge dello stato
   */
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

  /**
   * Restituisce il label dello stato
   */
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

  /**
   * Segna il paziente come arrivato
   */
  async onMarkAttended(): Promise<void> {
    if (!this.data.appointment?.id) return;
    try {
      await firstValueFrom(
        this.appointmentService.markAsAttended(String(this.data.appointment.id))
      );
      this.result.emit({
        action: 'save',
        appointment: { ...this.data.appointment, bookingStatus: 'attended' } as Appointment
      });
    } catch (error) {
      console.error('Error marking as attended:', error);
      alert('Errore nel segnare il paziente come arrivato');
    }
  }

  /**
   * Segna come no-show
   */
  async onMarkNoShow(): Promise<void> {
    if (!this.data.appointment?.id) return;
    if (!confirm('Confermi che il paziente non si e presentato?')) return;
    try {
      await firstValueFrom(
        this.appointmentService.markAsNoShow(String(this.data.appointment.id))
      );
      this.result.emit({
        action: 'save',
        appointment: { ...this.data.appointment, bookingStatus: 'no_show' } as Appointment
      });
    } catch (error) {
      console.error('Error marking as no-show:', error);
      alert('Errore nel segnare come non presentato');
    }
  }

  /**
   * Disdici appuntamento con calcolo automatico del preavviso
   */
  async onCancelWithNotice(): Promise<void> {
    if (!this.data.appointment?.id) return;

    const reason = prompt('Motivo della cancellazione:');
    if (!reason) return;

    try {
      await firstValueFrom(
        this.appointmentService.cancelWithNotice(
          String(this.data.appointment.id),
          reason,
          'system' // TODO: sostituire con ID utente corrente
        )
      );
      this.result.emit({ action: 'delete' });
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Errore nella cancellazione dell\'appuntamento');
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
