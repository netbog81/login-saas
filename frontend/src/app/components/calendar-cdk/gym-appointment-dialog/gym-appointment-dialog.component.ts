import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GymRoom, GymSlotInfo, GymAppointment, CreateGymAppointmentInput, UpdateGymAppointmentInput } from '../../../services/gym-room.service';
import { Patient } from '../../../models/patient.model';

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
      this.selectedPatientId = apt.patientId || null;
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
      this.showPatientDropdown = false;
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
    this.selectedPatientId = patient.id;
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
        patientId: this.selectedPatientId || undefined,
        notes: this.notes.trim() || undefined
      };

      this.result.emit({
        action: 'update',
        updateInput,
        appointmentId: this.data.appointment!.id
      });
    } else {
      // Modalità creazione - nuovo appuntamento
      const input: CreateGymAppointmentInput = {
        gymRoomId: this.data.gymRoom.id,
        appointmentDate: this.data.date,
        startTime: this.data.startTime,
        endTime: this.data.endTime,
        clientName: this.clientName.trim(),
        clientPhone: this.clientPhone.trim() || undefined,
        clientEmail: this.clientEmail.trim() || undefined,
        patientId: this.selectedPatientId || undefined,
        notes: this.notes.trim() || undefined
      };

      this.result.emit({ action: 'save', input });
    }
  }

  onCancel(): void {
    this.result.emit({ action: 'cancel' });
  }
}
