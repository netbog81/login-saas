import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GymRoom, GymSlotInfo, GymAppointment, CreateGymAppointmentInput, UpdateGymAppointmentInput } from '../../../services/gym-room.service';
import { Patient } from '../../../models/patient.model';
import { RepeatConfig } from '../../../models/appointment.model';
import { PatientService } from '../../../services/patient.service';

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
  action: 'save' | 'update' | 'cancel';
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
export class GymAppointmentDialogComponent implements OnInit {
  @Input() data!: GymAppointmentDialogData;
  @Output() result = new EventEmitter<GymAppointmentDialogResult>();

  constructor(private patientService: PatientService) {}

  // Form fields
  clientName: string = '';
  clientPhone: string = '';
  clientEmail: string = '';
  notes: string = '';
  selectedPatientId: number | null = null;

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

  ngOnInit(): void {
    this.filteredPatients = this.data.patients?.slice(0, 10) || [];

    // Se in modalità edit, popola i campi con i dati esistenti
    if (this.data.appointment) {
      const apt = this.data.appointment;
      this.clientName = apt.clientName || '';
      this.clientPhone = apt.clientPhone || '';
      this.clientEmail = apt.clientEmail || '';
      this.notes = apt.notes || '';
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
}
