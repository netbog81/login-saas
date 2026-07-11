/**
 * Patient Appointments List Component
 * Layer 1: UI Component (Dumb)
 *
 * Responsabilita':
 * - Visualizzare la lista degli appuntamenti futuri di un paziente
 * - Emettere eventi per cancellazione e invio recap WhatsApp
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { AvailabilityAppointment, BookingStatus } from '../../../../graphql/generated/types';

@Component({
  selector: 'app-patient-appointments-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatChipsModule,
  ],
  template: `
    @if (loading) {
      <div class="loading-container">
        <mat-spinner diameter="32"></mat-spinner>
      </div>
    } @else if (appointments.length === 0) {
      <div class="empty-state">
        <mat-icon>event_busy</mat-icon>
        <p>Nessun appuntamento futuro</p>
      </div>
    } @else {
      <div class="appointments-list">
        @for (apt of appointments; track apt.id; let last = $last) {
          <div class="appointment-row">
            <div class="appointment-info">
              <div class="appointment-date">
                <mat-icon class="date-icon">calendar_today</mat-icon>
                <span class="date-text">{{ formatDate(apt.appointmentDate) }}</span>
              </div>
              <div class="appointment-time">
                <mat-icon class="time-icon">schedule</mat-icon>
                <span>{{ apt.startTime }} - {{ apt.endTime }}</span>
              </div>
              <div class="appointment-details">
                @if (apt.operator) {
                  <span class="detail-chip operator">
                    <mat-icon>person</mat-icon>
                    {{ apt.operator.name }} {{ apt.operator.surname }}
                  </span>
                }
                @if (apt.service) {
                  <span class="detail-chip service">
                    <mat-icon>medical_services</mat-icon>
                    {{ apt.service.name }}
                  </span>
                }
                @if (apt.appointmentServices && apt.appointmentServices.length > 0) {
                  @for (aptSvc of apt.appointmentServices; track aptSvc.id) {
                    <span class="detail-chip service">
                      <mat-icon>medical_services</mat-icon>
                      {{ aptSvc.service?.name }}
                    </span>
                  }
                }
              </div>
              <div class="appointment-status">
                <span class="status-badge" [class]="'status-' + apt.bookingStatus.toLowerCase()">
                  {{ getStatusLabel(apt.bookingStatus) }}
                </span>
              </div>
            </div>
            <div class="appointment-actions">
              <button mat-icon-button
                      color="primary"
                      matTooltip="Invia recap WhatsApp"
                      (click)="onSendRecap(apt)">
                <mat-icon>send</mat-icon>
              </button>
              @if (canCancel) {
                <button mat-icon-button
                        color="warn"
                        matTooltip="Cancella appuntamento"
                        [disabled]="isCancelled(apt)"
                        (click)="onCancel(apt)">
                  <mat-icon>cancel</mat-icon>
                </button>
              }
            </div>
          </div>
          @if (!last) {
            <mat-divider></mat-divider>
          }
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      color: #64748b;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      p {
        margin: 0;
        font-size: 0.9375rem;
      }
    }

    .appointments-list {
      display: flex;
      flex-direction: column;
    }

    .appointment-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      gap: 12px;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: #f8fafc;
      }
    }

    .appointment-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .appointment-date {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 0.9375rem;
      color: #1e293b;

      .date-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #6366f1;
      }
    }

    .appointment-time {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8125rem;
      color: #64748b;

      .time-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .appointment-details {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .detail-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      &.operator {
        background: #eff6ff;
        color: #3b82f6;
      }

      &.service {
        background: #f0fdf4;
        color: #22c55e;
      }
    }

    .appointment-status {
      margin-top: 4px;
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;

      &.status-scheduled {
        background: #fef3c7;
        color: #d97706;
      }
      &.status-confirmed {
        background: #dbeafe;
        color: #2563eb;
      }
      &.status-attended {
        background: #dcfce7;
        color: #16a34a;
      }
      &.status-no_show {
        background: #fee2e2;
        color: #dc2626;
      }
      &.status-cancelled,
      &.status-cancelled_early,
      &.status-cancelled_late {
        background: #f1f5f9;
        color: #94a3b8;
      }
    }

    .appointment-actions {
      display: flex;
      flex-shrink: 0;
      gap: 0;
    }

    @media (max-width: 599px) {
      .appointment-row {
        flex-direction: column;
        align-items: flex-start;
      }

      .appointment-actions {
        align-self: flex-end;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientAppointmentsListComponent {
  @Input() appointments: AvailabilityAppointment[] = [];
  @Input() loading = false;
  /**
   * Mostra il pulsante "Cancella appuntamento". Solo segreteria/admin possono
   * cancellare: gli operatori non creano, modificano né cancellano appuntamenti
   * (il backend lo blocca via CalendarWriteGuard; qui nascondiamo il bottone
   * per coerenza UX).
   */
  @Input() canCancel = true;

  @Output() cancelAppointment = new EventEmitter<AvailabilityAppointment>();
  @Output() sendRecap = new EventEmitter<AvailabilityAppointment>();

  private readonly statusLabels: Record<string, string> = {
    [BookingStatus.Scheduled]: 'Programmato',
    [BookingStatus.Confirmed]: 'Confermato',
    [BookingStatus.Attended]: 'Presente',
    [BookingStatus.NoShow]: 'Non presentato',
    [BookingStatus.Cancelled]: 'Cancellato',
    [BookingStatus.CancelledEarly]: 'Cancellato (in anticipo)',
    [BookingStatus.CancelledLate]: 'Cancellato (in ritardo)',
  };

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getStatusLabel(status: BookingStatus): string {
    return this.statusLabels[status] || status;
  }

  isCancelled(apt: AvailabilityAppointment): boolean {
    return [
      BookingStatus.Cancelled,
      BookingStatus.CancelledEarly,
      BookingStatus.CancelledLate,
    ].includes(apt.bookingStatus);
  }

  onSendRecap(apt: AvailabilityAppointment): void {
    this.sendRecap.emit(apt);
  }

  onCancel(apt: AvailabilityAppointment): void {
    this.cancelAppointment.emit(apt);
  }
}
