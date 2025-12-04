import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Appointment } from '../../../models/appointment.model';
import { User } from '../../../models/user.model';
import { Patient } from '../../../models/patient.model';

export interface EventDialogData {
  appointment?: Appointment;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultOperatorId?: string;
  users: User[];
  patients: Patient[];
  // Filtri pre-compilati dalla ricerca
  searchFilters?: {
    duration?: number;
    withInstrument?: boolean;
    instrumentCategoryId?: string | null;
    instrumentPosition?: 'first' | 'second';
  };
}

export interface EventDialogResult {
  action: 'save' | 'delete' | 'cancel';
  appointment?: Appointment;
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

  isEditMode: boolean = false;
  errors: { [key: string]: string } = {};

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
      this.patientId = apt.patientId || null;
      this.notes = apt.notes || '';
    } else {
      // Create mode
      this.date = this.data.defaultDate || '';
      this.startTime = this.data.defaultStartTime || '';
      this.endTime = this.data.defaultEndTime || '';
      this.operatorId = this.data.defaultOperatorId || (this.data.users[0]?.operatorId || '');
    }
  }

  get filteredPatients(): Patient[] {
    if (!this.patientSearch) {
      return this.data.patients;
    }
    const search = this.patientSearch.toLowerCase();
    return this.data.patients.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.surname.toLowerCase().includes(search) ||
      p.phone.includes(search)
    );
  }

  get selectedPatient(): Patient | undefined {
    return this.data.patients.find(p => p.id === this.patientId);
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

  onPatientSelect(patientId: number | null): void {
    this.patientId = patientId;
    if (patientId) {
      const patient = this.data.patients.find(p => p.id === patientId);
      if (patient) {
        this.title = `${patient.name} ${patient.surname}`;
      }
    }
  }

  onShowNewPatientForm(): void {
    this.showNewPatientForm = true;
    this.newPatient = {
      name: '',
      surname: '',
      phone: '',
      email: '',
      notes: ''
    };
  }

  onCancelNewPatient(): void {
    this.showNewPatientForm = false;
    this.newPatient = {};
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
      patientId: this.patientId || undefined,
      notes: this.notes || undefined
    };

    this.result.emit({
      action: 'save',
      appointment
    });
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

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
