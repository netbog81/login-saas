import { Component, Input, Output, EventEmitter, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Appointment } from '../../../models/appointment.model';
import { User } from '../../../models/user.model';

export interface SummaryAction {
  type: 'edit' | 'delete' | 'share' | 'close';
  appointment: Appointment;
  shareMethod?: 'email' | 'whatsapp';
}

@Component({
  selector: 'app-appointment-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './appointment-summary.component.html',
  styleUrls: ['./appointment-summary.component.scss']
})
export class AppointmentSummaryComponent {
  @Input() appointment!: Appointment;
  @Input() user?: User;
  @Output() action = new EventEmitter<SummaryAction>();
  @Output() clickOutside = new EventEmitter<void>();

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.clickOutside.emit();
    }
  }

  onEdit(): void {
    this.action.emit({
      type: 'edit',
      appointment: this.appointment
    });
  }

  onDelete(): void {
    this.action.emit({
      type: 'delete',
      appointment: this.appointment
    });
  }

  onShareEmail(): void {
    this.action.emit({
      type: 'share',
      appointment: this.appointment,
      shareMethod: 'email'
    });
  }

  onShareWhatsapp(): void {
    this.action.emit({
      type: 'share',
      appointment: this.appointment,
      shareMethod: 'whatsapp'
    });
  }

  onClose(): void {
    this.action.emit({
      type: 'close',
      appointment: this.appointment
    });
  }

  get formattedTime(): string {
    return `${this.appointment.startTime} - ${this.appointment.endTime}`;
  }

  get duration(): string {
    const [startHour, startMin] = this.appointment.startTime.split(':').map(Number);
    const [endHour, endMin] = this.appointment.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const durationMinutes = endMinutes - startMinutes;

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}min`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}min`;
    }
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('it-IT', options);
  }

  get hasInstruments(): boolean {
    return !!(this.appointment.instruments && this.appointment.instruments.length > 0);
  }

  getInstrumentTimeRange(instrument: { startOffsetMinutes: number; endOffsetMinutes: number }): string {
    const startTime = this.addMinutesToTime(this.appointment.startTime, instrument.startOffsetMinutes);
    const endTime = this.addMinutesToTime(this.appointment.startTime, instrument.endOffsetMinutes);
    return `${startTime} - ${endTime}`;
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }
}