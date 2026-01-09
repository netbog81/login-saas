/**
 * Appointment Card Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare singola card appuntamento
 * - Mostrare orario, nome paziente, servizio, stato
 * - Emettere evento click
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AvailabilityAppointment, BookingStatus } from '../../../../graphql/generated/types';

@Component({
  selector: 'app-appointment-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <mat-card
      class="appointment-card"
      [class.selected]="selected"
      [class.status-scheduled]="isScheduled()"
      [class.status-confirmed]="isConfirmed()"
      [class.status-attended]="isNoShow()"
      [class.status-cancelled]="isCancelled()"
      (click)="onSelect()">

      <div class="card-content">
        <!-- Orario -->
        <div class="time-section">
          <mat-icon class="time-icon">schedule</mat-icon>
          <span class="time">{{ appointment.startTime }}</span>
        </div>

        <!-- Info paziente -->
        <div class="patient-section">
          <span class="patient-name">{{ appointment.clientName || 'N/D' }}</span>
          @if (getServiceName()) {
            <span class="service-name">{{ getServiceName() }}</span>
          }
        </div>

        <!-- Stato -->
        <div class="status-section">
          <span class="status-badge" [matTooltip]="getStatusLabel()">
            <mat-icon class="status-icon">{{ getStatusIcon() }}</mat-icon>
          </span>
        </div>
      </div>
    </mat-card>
  `,
  styles: [`
    .appointment-card {
      cursor: pointer;
      transition: all 0.2s ease;
      border-left: 4px solid transparent;
      margin-bottom: 8px;

      &:hover {
        transform: translateX(4px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      &.selected {
        border-left-color: #667eea;
        background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
      }

      // Status colors
      &.status-scheduled {
        border-left-color: #3b82f6;
      }

      &.status-confirmed {
        border-left-color: #22c55e;
      }

      &.status-attended {
        border-left-color: #f59e0b;
      }

      &.status-cancelled {
        border-left-color: #ef4444;
        opacity: 0.7;

        .patient-name {
          text-decoration: line-through;
        }
      }
    }

    .card-content {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
    }

    .time-section {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;

      .time-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #64748b;
      }

      .time {
        font-weight: 600;
        font-size: 0.9375rem;
        color: #334155;
        font-family: 'SF Mono', 'Roboto Mono', monospace;
      }
    }

    .patient-section {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;

      .patient-name {
        font-weight: 500;
        color: #1e293b;
        font-size: 0.875rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .service-name {
        font-size: 0.75rem;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .status-section {
      flex-shrink: 0;

      .status-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #f1f5f9;
      }

      .status-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    // Status icon colors
    .status-scheduled .status-icon { color: #3b82f6; }
    .status-confirmed .status-icon { color: #22c55e; }
    .status-attended .status-icon { color: #f59e0b; }
    .status-cancelled .status-icon { color: #ef4444; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppointmentCardComponent {
  @Input({ required: true }) appointment!: AvailabilityAppointment;
  @Input() selected = false;

  @Output() select = new EventEmitter<void>();

  onSelect(): void {
    this.select.emit();
  }

  // Helper methods for status checks
  isScheduled(): boolean {
    return this.appointment.bookingStatus === BookingStatus.Scheduled;
  }

  isConfirmed(): boolean {
    return this.appointment.bookingStatus === BookingStatus.Confirmed;
  }

  isNoShow(): boolean {
    return this.appointment.bookingStatus === BookingStatus.NoShow;
  }

  isCancelled(): boolean {
    return this.appointment.bookingStatus === BookingStatus.Cancelled;
  }

  getServiceName(): string | null {
    // serviceName potrebbe essere in un campo diverso o non presente
    return (this.appointment as any).serviceName || null;
  }

  getStatusIcon(): string {
    switch (this.appointment.bookingStatus) {
      case BookingStatus.Scheduled: return 'event';
      case BookingStatus.Confirmed: return 'check_circle';
      case BookingStatus.NoShow: return 'person_off';
      case BookingStatus.Cancelled: return 'cancel';
      default: return 'help';
    }
  }

  getStatusLabel(): string {
    switch (this.appointment.bookingStatus) {
      case BookingStatus.Scheduled: return 'Prenotato';
      case BookingStatus.Confirmed: return 'Confermato';
      case BookingStatus.NoShow: return 'Non presentato';
      case BookingStatus.Cancelled: return 'Cancellato';
      default: return 'Sconosciuto';
    }
  }
}
