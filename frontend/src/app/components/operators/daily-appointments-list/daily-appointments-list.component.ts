import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Appointment } from '../../../models/appointment.model';

@Component({
  selector: 'app-daily-appointments-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-appointments-list.component.html',
  styleUrls: ['./daily-appointments-list.component.scss'],
})
export class DailyAppointmentsListComponent {
  @Input() appointments: Appointment[] = [];
  @Input() selectedAppointment: Appointment | null = null;
  @Input() loading = false;
  @Input() collapsed = false;

  @Output() appointmentSelect = new EventEmitter<Appointment>();
  @Output() toggleCollapse = new EventEmitter<void>();

  onAppointmentClick(appointment: Appointment): void {
    this.appointmentSelect.emit(appointment);
  }

  onToggleCollapse(): void {
    this.toggleCollapse.emit();
  }

  isSelected(appointment: Appointment): boolean {
    return this.selectedAppointment?.id === appointment.id;
  }

  getStatusClass(appointment: Appointment): string {
    const status = appointment.bookingStatus || 'scheduled';
    return `status-${status}`;
  }

  getStatusLabel(appointment: Appointment): string {
    const labels: Record<string, string> = {
      scheduled: 'Programmato',
      confirmed: 'Confermato',
      attended: 'Presente',
      cancelled: 'Annullato',
      cancelled_early: 'Annullato (anticipo)',
      cancelled_late: 'Annullato (ritardo)',
      no_show: 'Non presentato',
    };
    return labels[appointment.bookingStatus || 'scheduled'] || 'Programmato';
  }

  getClientName(appointment: Appointment): string {
    if (appointment.patient) {
      const p = appointment.patient;
      return `${p.nome} ${p.cognome}`;
    }
    return (appointment as any).clientName || 'Cliente';
  }

  getClientInitials(appointment: Appointment): string {
    if (appointment.patient) {
      const p = appointment.patient;
      return ((p.nome?.charAt(0) || '') + (p.cognome?.charAt(0) || '')).toUpperCase();
    }
    const name = (appointment as any).clientName || '';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase() || '?';
  }

  formatTime(time: string): string {
    return time?.substring(0, 5) || '';
  }

  get sortedAppointments(): Appointment[] {
    return [...this.appointments].sort((a, b) => {
      const timeA = a.startTime || '00:00';
      const timeB = b.startTime || '00:00';
      return timeA.localeCompare(timeB);
    });
  }

  get upcomingCount(): number {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return this.appointments.filter((a) => (a.startTime || '00:00') >= currentTime).length;
  }

  get completedCount(): number {
    return this.appointments.filter(
      (a) => a.bookingStatus === 'attended' || a.treatmentStatus === 'closed'
    ).length;
  }
}
