import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GymRoom, GymSlotInfo, GymAppointment, CreateGymAppointmentInput, UpdateGymAppointmentInput } from '../../../services/gym-room.service';
import { Patient } from '../../../models/patient.model';
import { RepeatConfig } from '../../../models/appointment.model';
import { PatientService } from '../../../services/patient.service';
import { ServiceService } from '../../../services/service.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { Service } from '../../../graphql/generated/types';

export interface GymAppointmentDialogData {
  gymRoom: GymRoom;
  date: string;
  startTime: string;
  endTime: string;
  slotInfo: GymSlotInfo;
  patients: Patient[];
  appointment?: GymAppointment; // Per modalità edit
}

export interface GymAppointmentDialogResult {
  action: 'save' | 'update' | 'cancel' | 'status-changed';
  input?: CreateGymAppointmentInput;
  updateInput?: UpdateGymAppointmentInput;
  appointmentId?: string;
}

@Component({
  selector: 'app-gym-appointment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gym-appointment-dialog.component.html',
  styleUrls: ['./gym-appointment-dialog.component.scss']
})
export class GymAppointmentDialogComponent implements OnInit, OnChanges {
  @Input() data!: GymAppointmentDialogData;
  @Output() result = new EventEmitter<GymAppointmentDialogResult>();

  constructor(
    private patientService: PatientService,
    private serviceService: ServiceService,
    private appointmentService: AvailabilityAppointmentService
  ) {}

  // Form fields
  clientName: string = '';
  clientPhone: string = '';
  clientEmail: string = '';
  notes: string = '';
  selectedPatientId: number | null = null;

  // Service selection
  serviceId: string | null = null;
  operatorServices: Service[] = [];
  loadingServices: boolean = false;

  // Status management
  bookingStatus: string = 'scheduled';
  processingStatus: boolean = false;

  // Patient search
  patientSearch: string = '';
  filteredPatients: Patient[] = [];
  showPatientDropdown: boolean = false;

  // New patient form
  showNewPatientForm: boolean = false;
  newPatient: Partial<Patient> = {};
  newPatientError: string = '';
  savingNewPatient: boolean = false;

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

  errors: { [key: string]: string } = {};

  // Edit mode
  get isEditMode(): boolean {
    return !!this.data.appointment;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reagisce ai cambiamenti del data binding
    if (changes['data'] && this.data) {
      this.initializeForm();
    }
  }

  ngOnInit(): void {
    // Chiamata iniziale quando il componente viene creato
    if (this.data) {
      this.initializeForm();
    }
  }

  /**
   * Inizializza il form con i dati ricevuti.
   * Resetta tutti i campi e popola in base alla modalità (create/edit).
   */
  private initializeForm(): void {
    // Reset a valori default
    this.clientName = '';
    this.clientPhone = '';
    this.clientEmail = '';
    this.notes = '';
    this.serviceId = null;
    this.bookingStatus = 'scheduled';
    this.selectedPatientId = null;
    this.patientSearch = '';
    this.showPatientDropdown = false;
    this.showNewPatientForm = false;
    this.repeatEnabled = false;
    this.errors = {};
    this.processingStatus = false;

    // Inizializza pazienti filtrati
    this.filteredPatients = this.data.patients?.slice(0, 10) || [];

    // Carica i servizi dell'operatore assegnato allo slot
    if (this.data.slotInfo?.operator?.id) {
      this.loadOperatorServices(this.data.slotInfo.operator.id);
    }

    // Se in modalità edit, popola i campi con i dati esistenti
    if (this.data.appointment) {
      const apt = this.data.appointment;
      this.clientName = apt.clientName || '';
      this.clientPhone = apt.clientPhone || '';
      this.clientEmail = apt.clientEmail || '';
      this.notes = apt.notes || '';
      this.serviceId = apt.serviceId || null;
      this.bookingStatus = apt.bookingStatus || 'scheduled';
      // Forza conversione a number (GraphQL ID può essere stringa)
      this.selectedPatientId = apt.patientId ? Number(apt.patientId) : null;

      // Se c'è un paziente associato, cerca i suoi dati nella lista
      if (this.selectedPatientId) {
        const patient = this.data.patients?.find(p => p.id == this.selectedPatientId);
        if (patient) {
          // Aggiorna i campi con i dati aggiornati del paziente
          this.clientName = `${patient.nome} ${patient.cognome}`;
          this.clientPhone = patient.cellulare || patient.telefono || apt.clientPhone || '';
          this.clientEmail = patient.email || apt.clientEmail || '';
        }
      }
    }
  }

  /**
   * Carica i servizi assegnati all'operatore dello slot
   */
  loadOperatorServices(operatorId: string): void {
    if (!operatorId) {
      this.operatorServices = [];
      return;
    }

    this.loadingServices = true;
    this.serviceService.getOperatorServices(operatorId).subscribe({
      next: (operatorServiceList) => {
        const services = operatorServiceList
          .map(os => os.service)
          .filter((s): s is Service => !!s && s.isActive !== false);
        this.operatorServices = services;
        this.loadingServices = false;
      },
      error: (error) => {
        console.error('Error loading operator services:', error);
        this.operatorServices = [];
        this.loadingServices = false;
      }
    });
  }

  get remainingCapacity(): number {
    return this.data.slotInfo.maxCapacity - this.data.slotInfo.currentCount;
  }

  get operatorName(): string {
    if (!this.data.slotInfo.operator) return 'Non assegnato';
    const op = this.data.slotInfo.operator;
    return op.surname ? `${op.name} ${op.surname}` : op.name;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  onPatientSearchChange(): void {
    if (!this.patientSearch || this.patientSearch.length < 2) {
      this.filteredPatients = this.data.patients?.slice(0, 10) || [];
      this.showPatientDropdown = this.filteredPatients.length > 0;
      return;
    }

    const search = this.patientSearch.toLowerCase();
    this.filteredPatients = (this.data.patients || [])
      .filter(p => {
        const fullName = `${p.nome} ${p.cognome}`.toLowerCase();
        const phone = (p.telefono || p.cellulare || '').toLowerCase();
        return fullName.includes(search) || phone.includes(search);
      })
      .slice(0, 10);

    this.showPatientDropdown = this.filteredPatients.length > 0;
  }

  selectPatient(patient: Patient): void {
    // Forza conversione a number (GraphQL ID può essere stringa)
    this.selectedPatientId = Number(patient.id);
    this.clientName = `${patient.nome} ${patient.cognome}`;
    this.clientPhone = patient.cellulare || patient.telefono || '';
    this.clientEmail = patient.email || '';
    this.patientSearch = '';
    this.showPatientDropdown = false;
  }

  clearPatient(): void {
    this.selectedPatientId = null;
    this.clientName = '';
    this.clientPhone = '';
    this.clientEmail = '';
  }

  // ==================== RECURRING APPOINTMENT METHODS ====================

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
      const selectedDate = this.data.date ? new Date(this.data.date) : new Date();
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
        if (this.repeatConfig.untilDate && this.data.date) {
          const start = new Date(this.data.date);
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

  // ==================== NEW PATIENT METHODS ====================

  onShowNewPatientForm(): void {
    this.showNewPatientForm = true;
    this.showPatientDropdown = false;
    this.newPatient = {
      nome: '',
      cognome: '',
      telefono: '',
      cellulare: '',
      email: '',
      notes: '',
      genere: 'NON_SPECIFICATO',
      tipoPaziente: 'ADULTO_AUTONOMO'
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
      this.data.patients = [...this.data.patients, created];
      this.selectPatient(created);
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

    if (!this.clientName.trim()) {
      this.errors['clientName'] = 'Il nome del cliente è obbligatorio';
    }

    return Object.keys(this.errors).length === 0;
  }

  onSave(): void {
    if (!this.validate()) return;

    if (this.isEditMode) {
      // Modalità edit - aggiorna appuntamento esistente
      const updateInput: UpdateGymAppointmentInput = {
        clientName: this.clientName.trim(),
        clientPhone: this.clientPhone.trim() || undefined,
        clientEmail: this.clientEmail.trim() || undefined,
        // Forza conversione a Int per GraphQL
        patientId: this.selectedPatientId ? Number(this.selectedPatientId) : undefined,
        serviceId: this.serviceId || undefined,
        notes: this.notes.trim() || undefined
      };

      this.result.emit({
        action: 'update',
        updateInput,
        appointmentId: this.data.appointment!.id
      });
    } else {
      // Modalità creazione - nuovo appuntamento
      // Costruisci la config di ricorrenza se abilitata
      // Nota: type e endType devono essere lowercase per corrispondere ai valori degli enum backend
      const repeatConfigData = this.repeatEnabled ? {
        type: this.repeatConfig.type as 'daily' | 'weekly' | 'monthly',
        interval: this.repeatConfig.interval,
        selectedDays: this.repeatConfig.type === 'weekly' ? this.repeatConfig.selectedDays : undefined,
        endType: this.repeatConfig.endType as 'after' | 'until',
        occurrences: this.repeatConfig.endType === 'after' ? this.repeatConfig.occurrences : undefined,
        untilDate: this.repeatConfig.endType === 'until' ? this.repeatConfig.untilDate : undefined
      } : undefined;

      const input: CreateGymAppointmentInput = {
        gymRoomId: this.data.gymRoom.id,
        appointmentDate: this.data.date,
        startTime: this.data.startTime,
        endTime: this.data.endTime,
        clientName: this.clientName.trim(),
        clientPhone: this.clientPhone.trim() || undefined,
        clientEmail: this.clientEmail.trim() || undefined,
        // Forza conversione a Int per GraphQL
        patientId: this.selectedPatientId ? Number(this.selectedPatientId) : undefined,
        serviceId: this.serviceId || undefined,
        notes: this.notes.trim() || undefined,
        isRecurring: this.repeatEnabled || undefined,
        repeatConfig: repeatConfigData
      };

      this.result.emit({ action: 'save', input });
    }
  }

  onCancel(): void {
    this.result.emit({ action: 'cancel' });
  }

  // ==================== STATUS MANAGEMENT METHODS ====================

  /**
   * Normalizza lo stato dell'appuntamento per gestire differenze di case
   * tra frontend (lowercase) e backend/GraphQL (potenzialmente UPPERCASE).
   * Converte anche underscore in formato consistente.
   */
  private normalizeStatus(status: string | null | undefined): string {
    if (!status) return 'scheduled';
    // Converti a lowercase e sostituisci eventuali spazi con underscore
    return status.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Verifica se la cancellazione è tardiva (< 24h dall'appuntamento)
   */
  get isLateCancellation(): boolean {
    if (!this.data.date || !this.data.startTime) return false;
    const appointmentStart = new Date(`${this.data.date}T${this.data.startTime}`);
    const hoursUntil = (appointmentStart.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil < 24;
  }

  /**
   * Verifica se è possibile mostrare le azioni di stato (stato non terminale)
   */
  get canShowStatusActions(): boolean {
    const status = this.normalizeStatus(this.bookingStatus);
    return status === 'scheduled' || status === 'confirmed';
  }

  /**
   * Verifica se è possibile marcare come presente (appuntamento oggi)
   */
  get canMarkAttended(): boolean {
    if (!this.isEditMode || this.processingStatus) return false;
    const today = new Date().toISOString().split('T')[0];
    return this.canShowStatusActions && this.data.date === today;
  }

  /**
   * Verifica se è possibile marcare come non presentato (ora di inizio passata)
   */
  get canMarkNoShow(): boolean {
    if (!this.isEditMode || this.processingStatus) return false;
    const now = new Date();
    const appointmentStart = new Date(`${this.data.date}T${this.data.startTime}`);
    return this.canShowStatusActions && appointmentStart < now;
  }

  /**
   * Verifica se è possibile disdire (stato non terminale)
   */
  get canCancel(): boolean {
    if (!this.isEditMode || this.processingStatus) return false;
    return this.canShowStatusActions;
  }

  /**
   * Verifica se è possibile ripristinare lo stato (solo da 'attended')
   */
  get canRevertAttended(): boolean {
    if (!this.isEditMode || this.processingStatus) return false;
    const status = this.normalizeStatus(this.bookingStatus);
    return status === 'attended';
  }

  get statusLabel(): string {
    const status = this.normalizeStatus(this.bookingStatus);
    const labels: Record<string, string> = {
      'scheduled': 'Programmato',
      'confirmed': 'Confermato',
      'cancelled': 'Annullato',
      'cancelled_early': 'Disdetto (>24h)',
      'cancelled_late': 'Disdetto (<24h)',
      'no_show': 'Non presentato',
      'attended': 'Presente'
    };
    return labels[status] || this.bookingStatus || 'Sconosciuto';
  }

  get statusClass(): string {
    const status = this.normalizeStatus(this.bookingStatus);
    const classes: Record<string, string> = {
      'scheduled': 'status-scheduled',
      'confirmed': 'status-confirmed',
      'cancelled': 'status-cancelled',
      'cancelled_early': 'status-cancelled',
      'cancelled_late': 'status-cancelled-late',
      'no_show': 'status-noshow',
      'attended': 'status-attended'
    };
    return classes[status] || '';
  }

  async onMarkAttended(): Promise<void> {
    if (!this.data.appointment?.id || this.processingStatus) return;

    this.processingStatus = true;
    try {
      await firstValueFrom(this.appointmentService.markAsAttended(this.data.appointment.id));
      this.bookingStatus = 'attended';
      this.result.emit({ action: 'status-changed' }); // Chiudi modal e forza refresh della griglia
    } catch (error) {
      console.error('Error marking as attended:', error);
      alert('Errore nel segnare il paziente come arrivato');
    } finally {
      this.processingStatus = false;
    }
  }

  async onMarkNoShow(): Promise<void> {
    if (!this.data.appointment?.id || this.processingStatus) return;

    // Chiedi conferma come in EventDialogComponent
    if (!confirm('Confermi che il paziente non si è presentato?')) return;

    this.processingStatus = true;
    try {
      await firstValueFrom(this.appointmentService.markAsNoShow(this.data.appointment.id));
      this.bookingStatus = 'no_show';
      this.result.emit({ action: 'status-changed' });
    } catch (error) {
      console.error('Error marking as no-show:', error);
      alert('Errore nel segnare come non presentato');
    } finally {
      this.processingStatus = false;
    }
  }

  async onCancelWithNotice(): Promise<void> {
    if (!this.data.appointment?.id || this.processingStatus) return;

    // Chiedi il motivo come in EventDialogComponent
    const reason = prompt('Motivo della cancellazione:');
    if (!reason) return;

    this.processingStatus = true;
    try {
      await firstValueFrom(
        this.appointmentService.cancelWithNotice(
          this.data.appointment.id,
          reason,
          'system' // TODO: sostituire con ID utente corrente
        )
      );
      // Lo stato verrà aggiornato in base alla logica del backend (early/late)
      this.result.emit({ action: 'status-changed' });
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Errore nella cancellazione dell\'appuntamento');
    } finally {
      this.processingStatus = false;
    }
  }

  async onRevertAttended(): Promise<void> {
    if (!this.data.appointment?.id || this.processingStatus) return;

    // Chiedi conferma come in EventDialogComponent
    if (!confirm('Vuoi annullare lo stato "Presentato" e riportare l\'appuntamento a "Confermato"?')) return;

    this.processingStatus = true;
    try {
      await firstValueFrom(this.appointmentService.revertAttended(this.data.appointment.id));
      this.bookingStatus = 'confirmed';
      this.result.emit({ action: 'status-changed' });
    } catch (error) {
      console.error('Error reverting attended status:', error);
      alert('Errore nell\'annullare lo stato presentato');
    } finally {
      this.processingStatus = false;
    }
  }
}
