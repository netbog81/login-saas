import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GymRoom, GymSlotInfo, GymAppointment, CreateGymAppointmentInput, UpdateGymAppointmentInput } from '../../../services/gym-room.service';
import { Patient } from '../../../models/patient.model';
import { RepeatConfig, ServiceInputItem } from '../../../models/appointment.model';
import { PatientService } from '../../../services/patient.service';
import { ServiceService } from '../../../services/service.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { Service } from '../../../graphql/generated/types';
import { ServiceMultiSelectComponent, SelectableService, SelectedServiceItem } from '../../../shared/components/service-multi-select';
import { BaseComponent } from '../../../core/components/base.component';

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
  imports: [CommonModule, FormsModule, ServiceMultiSelectComponent],
  templateUrl: './gym-appointment-dialog.component.html',
  styleUrls: ['./gym-appointment-dialog.component.scss']
})
export class GymAppointmentDialogComponent extends BaseComponent implements OnInit, OnChanges {
  @Input() data!: GymAppointmentDialogData;
  @Output() result = new EventEmitter<GymAppointmentDialogResult>();


  constructor(
    private patientService: PatientService,
    private serviceService: ServiceService,
    private appointmentService: AvailabilityAppointmentService
  ) {
    super();
  }

  // Form fields
  clientName: string = '';
  clientPhone: string = '';
  clientEmail: string = '';
  notes: string = '';
  selectedPatientId: number | null = null;

  // Service selection (legacy singolo)
  serviceId: string | null = null;
  // Multi-service selection (nuovo)
  selectedServices: SelectedServiceItem[] = [];
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
    this.selectedServices = [];
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

      // Carica i servizi multipli (se presenti)
      if ((apt as any).appointmentServices?.length > 0) {
        this.selectedServices = (apt as any).appointmentServices.map((as: any, idx: number) => ({
          serviceId: as.serviceId,
          service: as.service,
          customPrice: as.customPrice,
          customDuration: as.customDuration,
          orderPosition: as.orderPosition ?? idx
        }));
      }
      // Fallback: se c'è solo serviceId legacy, crea un singolo servizio selezionato
      else if (apt.serviceId) {
        // Troveremo il servizio nella lista quando sarà caricata
        this.selectedServices = [{
          serviceId: apt.serviceId,
          orderPosition: 0
        }];
      }

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
        this.runInZone(() => {
          const services = operatorServiceList
            .map(os => os.service)
            .filter((s): s is Service => !!s && s.isActive !== false);
          this.operatorServices = services;
          this.loadingServices = false;
          this.detectChanges();
        });
      },
      error: (error) => {
        this.runInZone(() => {
          console.error('Error loading operator services:', error);
          this.operatorServices = [];
          this.loadingServices = false;
          this.detectChanges();
        });
      }
    });
  }

  get remainingCapacity(): number {
    return this.data.slotInfo.maxCapacity - this.data.slotInfo.currentCount;
  }

  /**
   * Converte i servizi dell'operatore nel formato atteso dal componente multi-select
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
   * Gestisce il cambio dei servizi selezionati
   */
  onServicesChange(services: SelectedServiceItem[]): void {
    this.selectedServices = services;
    // Aggiorna anche il serviceId legacy con il primo servizio (per retrocompatibilità)
    this.serviceId = services.length > 0 ? services[0].serviceId : null;
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
    this.runInZone(() => {
      if (!this.patientSearch || this.patientSearch.length < 2) {
        this.filteredPatients = this.data.patients?.slice(0, 10) || [];
        this.showPatientDropdown = this.filteredPatients.length > 0;
        this.detectChanges();
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
      this.detectChanges();
    });
  }

  selectPatient(patient: Patient): void {
    this.runInZone(() => {
      // Forza conversione a number (GraphQL ID può essere stringa)
      this.selectedPatientId = Number(patient.id);
      this.clientName = `${patient.nome} ${patient.cognome}`;
      this.clientPhone = patient.cellulare || patient.telefono || '';
      this.clientEmail = patient.email || '';
      this.patientSearch = '';
      this.showPatientDropdown = false;
      this.detectChanges();
    });
  }

  clearPatient(): void {
    this.runInZone(() => {
      this.selectedPatientId = null;
      this.clientName = '';
      this.clientPhone = '';
      this.clientEmail = '';
      this.detectChanges();
    });
  }

  // ==================== RECURRING APPOINTMENT METHODS ====================

  /**
   * Gestisce il toggle della ricorrenza
   */
  onRepeatToggle(): void {
    this.runInZone(() => {
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
      this.detectChanges();
    });
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
    this.runInZone(() => {
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
      this.detectChanges();
    });
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
    this.runInZone(() => {
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
      this.detectChanges();
    });
  }

  onCancelNewPatient(): void {
    this.runInZone(() => {
      this.showNewPatientForm = false;
      this.newPatient = {};
      this.newPatientError = '';
      this.detectChanges();
    });
  }

  /**
   * Salva un nuovo paziente.
   * IMPORTANTE: Questo metodo usa console.log per debug perché l'errore di validazione
   * non appariva immediatamente. Il problema era dovuto al contesto Angular zone.
   */
  onSaveNewPatient(): void {
    console.log('[GymAppointmentDialog] onSaveNewPatient called');

    if (this.savingNewPatient) {
      console.log('[GymAppointmentDialog] Already saving, returning');
      return;
    }

    const nome = this.newPatient.nome?.trim();
    const cognome = this.newPatient.cognome?.trim();

    // Validazione: nome e cognome obbligatori
    if (!nome || !cognome) {
      console.log('[GymAppointmentDialog] Validation failed: nome/cognome missing');
      this.newPatientError = 'Nome e cognome sono obbligatori';
      // Forza aggiornamento UI usando cdr dal BaseComponent
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      console.log('[GymAppointmentDialog] Error set to:', this.newPatientError);
      return;
    }

    const telefono = this.newPatient.telefono?.trim();
    const cellulare = this.newPatient.cellulare?.trim();
    const email = this.newPatient.email?.trim();

    // Validazione: almeno un contatto obbligatorio
    if (!telefono && !cellulare && !email) {
      console.log('[GymAppointmentDialog] Validation failed: no contact info');
      this.newPatientError = 'Almeno un contatto (telefono, cellulare o email) è obbligatorio';
      // Forza aggiornamento UI usando cdr dal BaseComponent
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      console.log('[GymAppointmentDialog] Error set to:', this.newPatientError);
      return;
    }

    // Validazione passata, procedi con il salvataggio
    console.log('[GymAppointmentDialog] Validation passed, saving patient');
    this.savingNewPatient = true;
    this.newPatientError = '';
    this.detectChanges();

    // Esegue il salvataggio asincrono
    this.savePatientAsync(nome, cognome, telefono, cellulare, email);
  }

  /**
   * Metodo privato per il salvataggio asincrono del paziente
   */
  private async savePatientAsync(
    nome: string,
    cognome: string,
    telefono?: string,
    cellulare?: string,
    email?: string
  ): Promise<void> {
    try {
      const created = await firstValueFrom(this.patientService.createPatient(this.newPatient));
      this.runInZone(() => {
        this.data.patients = [...this.data.patients, created];
        this.selectPatient(created);
        this.showNewPatientForm = false;
        this.newPatient = {};
        this.savingNewPatient = false;
        this.detectChanges();
      });
    } catch (error) {
      this.runInZone(() => {
        console.error('Error creating patient:', error);
        this.newPatientError = 'Errore nella creazione del paziente';
        this.savingNewPatient = false;
        this.detectChanges();
      });
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

    // Prepara l'array di servizi per l'input GraphQL
    const servicesInput: ServiceInputItem[] | undefined = this.selectedServices.length > 0
      ? this.selectedServices.map(s => ({
          serviceId: s.serviceId,
          customPrice: s.customPrice,
          customDuration: s.customDuration,
          orderPosition: s.orderPosition
        }))
      : undefined;

    if (this.isEditMode) {
      // Modalità edit - aggiorna appuntamento esistente
      const updateInput: UpdateGymAppointmentInput = {
        clientName: this.clientName.trim(),
        clientPhone: this.clientPhone.trim() || undefined,
        clientEmail: this.clientEmail.trim() || undefined,
        // Forza conversione a Int per GraphQL
        patientId: this.selectedPatientId ? Number(this.selectedPatientId) : undefined,
        // Usa servizi multipli se presenti, altrimenti fallback a serviceId singolo
        serviceId: !servicesInput && this.serviceId ? this.serviceId : undefined,
        services: servicesInput,
        notes: this.notes.trim() || undefined
      };

      this.emit(this.result, {
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
        // Usa servizi multipli se presenti, altrimenti fallback a serviceId singolo
        serviceId: !servicesInput && this.serviceId ? this.serviceId : undefined,
        services: servicesInput,
        notes: this.notes.trim() || undefined,
        isRecurring: this.repeatEnabled || undefined,
        repeatConfig: repeatConfigData
      };

      this.emit(this.result, { action: 'save', input });
    }
  }

  onCancel(): void {
    this.emit(this.result, { action: 'cancel' });
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
    this.detectChanges();
    try {
      await firstValueFrom(this.appointmentService.markAsAttended(this.data.appointment.id));
      this.runInZone(() => {
        this.bookingStatus = 'attended';
        this.processingStatus = false;
        this.emit(this.result, { action: 'status-changed' }); // Chiudi modal e forza refresh della griglia
      });
    } catch (error) {
      this.runInZone(() => {
        console.error('Error marking as attended:', error);
        alert('Errore nel segnare il paziente come arrivato');
        this.processingStatus = false;
        this.detectChanges();
      });
    }
  }

  async onMarkNoShow(): Promise<void> {
    if (!this.data.appointment?.id || this.processingStatus) return;

    // Chiedi conferma come in EventDialogComponent
    if (!confirm('Confermi che il paziente non si è presentato?')) return;

    this.processingStatus = true;
    this.detectChanges();
    try {
      await firstValueFrom(this.appointmentService.markAsNoShow(this.data.appointment.id));
      this.runInZone(() => {
        this.bookingStatus = 'no_show';
        this.processingStatus = false;
        this.emit(this.result, { action: 'status-changed' });
      });
    } catch (error) {
      this.runInZone(() => {
        console.error('Error marking as no-show:', error);
        alert('Errore nel segnare come non presentato');
        this.processingStatus = false;
        this.detectChanges();
      });
    }
  }

  async onCancelWithNotice(): Promise<void> {
    if (!this.data.appointment?.id || this.processingStatus) return;

    // Chiedi il motivo come in EventDialogComponent
    const reason = prompt('Motivo della cancellazione:');
    if (!reason) return;

    this.processingStatus = true;
    this.detectChanges();
    try {
      await firstValueFrom(
        this.appointmentService.cancelWithNotice(
          this.data.appointment.id,
          reason,
          'system' // TODO: sostituire con ID utente corrente
        )
      );
      this.runInZone(() => {
        // Lo stato verrà aggiornato in base alla logica del backend (early/late)
        this.processingStatus = false;
        this.emit(this.result, { action: 'status-changed' });
      });
    } catch (error) {
      this.runInZone(() => {
        console.error('Error cancelling appointment:', error);
        alert('Errore nella cancellazione dell\'appuntamento');
        this.processingStatus = false;
        this.detectChanges();
      });
    }
  }

  async onRevertAttended(): Promise<void> {
    if (!this.data.appointment?.id || this.processingStatus) return;

    // Chiedi conferma come in EventDialogComponent
    if (!confirm('Vuoi annullare lo stato "Presentato" e riportare l\'appuntamento a "Confermato"?')) return;

    this.processingStatus = true;
    this.detectChanges();
    try {
      await firstValueFrom(this.appointmentService.revertAttended(this.data.appointment.id));
      this.runInZone(() => {
        this.bookingStatus = 'confirmed';
        this.processingStatus = false;
        this.emit(this.result, { action: 'status-changed' });
      });
    } catch (error) {
      this.runInZone(() => {
        console.error('Error reverting attended status:', error);
        alert('Errore nell\'annullare lo stato presentato');
        this.processingStatus = false;
        this.detectChanges();
      });
    }
  }
}
