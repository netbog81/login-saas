import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Appointment } from '../../../models/appointment.model';
import { Patient } from '../../../models/patient.model';

// Interfaccia per i dati di completamento trattamento
export interface TreatmentCompletionData {
  painAssessment: {
    painBefore?: number;  // Scala VAS 0-10
    painAfter?: number;   // Scala VAS 0-10
  };
  rescheduling: {
    suggestInDays?: number;
    suggestDateRangeStart?: string;
    suggestDateRangeEnd?: string;
    secretaryNotes?: string;
  };
  pricing: {
    price?: number;
  };
  notes: {
    operatorNotes?: string;
    patientNotes?: string;
  };
}

export type ReschedulingType = 'days' | 'range' | 'none';

@Component({
  selector: 'app-current-treatment-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './current-treatment-card.component.html',
  styleUrls: ['./current-treatment-card.component.scss'],
})
export class CurrentTreatmentCardComponent {
  @Input() appointment: Appointment | null = null;
  @Input() patient: Patient | null = null;
  @Input() loading = false;

  @Output() startTreatment = new EventEmitter<void>();
  @Output() completeTreatment = new EventEmitter<TreatmentCompletionData>();
  @Output() viewPatientFolder = new EventEmitter<void>();
  @Output() cancelAppointment = new EventEmitter<void>();

  // Stato form completamento
  completionFormExpanded = false;
  reschedulingType: ReschedulingType = 'none';

  completionData: TreatmentCompletionData = {
    painAssessment: {},
    rescheduling: {},
    pricing: {},
    notes: {}
  };

  onStartTreatment(): void {
    this.startTreatment.emit();
  }

  onCompleteTreatment(): void {
    this.completeTreatment.emit(this.completionData);
  }

  toggleCompletionForm(): void {
    this.completionFormExpanded = !this.completionFormExpanded;
  }

  resetCompletionForm(): void {
    this.completionData = {
      painAssessment: {},
      rescheduling: {},
      pricing: {},
      notes: {}
    };
    this.reschedulingType = 'none';
    this.completionFormExpanded = false;
  }

  onViewPatientFolder(): void {
    this.viewPatientFolder.emit();
  }

  onCancelAppointment(): void {
    this.cancelAppointment.emit();
  }

  getClientName(): string {
    if (this.patient) {
      return `${this.patient.nome} ${this.patient.cognome}`;
    }
    if (this.appointment) {
      return (this.appointment as any).clientName || 'Cliente';
    }
    return 'Cliente';
  }

  getClientPhone(): string {
    if (this.patient) {
      return this.patient.cellulare || this.patient.telefono || '';
    }
    if (this.appointment) {
      return (this.appointment as any).clientPhone || '';
    }
    return '';
  }

  getClientEmail(): string {
    if (this.patient) {
      return this.patient.email || '';
    }
    if (this.appointment) {
      return (this.appointment as any).clientEmail || '';
    }
    return '';
  }

  formatTime(time: string | undefined): string {
    return time?.substring(0, 5) || '';
  }

  formatDuration(): string {
    if (!this.appointment?.startTime || !this.appointment?.endTime) return '';

    const [startH, startM] = this.appointment.startTime.split(':').map(Number);
    const [endH, endM] = this.appointment.endTime.split(':').map(Number);
    const duration = (endH * 60 + endM) - (startH * 60 + startM);

    if (duration >= 60) {
      const hours = Math.floor(duration / 60);
      const mins = duration % 60;
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${duration} min`;
  }

  getStatusClass(): string {
    const status = this.appointment?.bookingStatus || 'scheduled';
    return `status-${status}`;
  }

  getStatusLabel(): string {
    const labels: Record<string, string> = {
      scheduled: 'Programmato',
      confirmed: 'Confermato',
      attended: 'Paziente presente',
      cancelled: 'Annullato',
      cancelled_early: 'Annullato (anticipo)',
      cancelled_late: 'Annullato (ritardo)',
      no_show: 'Non presentato',
    };
    return labels[this.appointment?.bookingStatus || 'scheduled'] || 'Programmato';
  }

  canStartTreatment(): boolean {
    const status = this.appointment?.bookingStatus;
    return status === 'scheduled' || status === 'confirmed';
  }

  canCompleteTreatment(): boolean {
    return this.appointment?.bookingStatus === 'attended';
  }

  isInProgress(): boolean {
    return this.appointment?.bookingStatus === 'attended';
  }

  isCancelled(): boolean {
    const status = this.appointment?.bookingStatus;
    return status === 'cancelled' || status === 'cancelled_early' || status === 'cancelled_late';
  }

  hasInstruments(): boolean {
    return !!(this.appointment?.instruments && this.appointment.instruments.length > 0);
  }

  getInstrumentsList(): string {
    if (!this.appointment?.instruments) return '';
    return this.appointment.instruments
      .map((i) => i.instrumentName || i.categoryName || 'Strumento')
      .join(', ');
  }
}
