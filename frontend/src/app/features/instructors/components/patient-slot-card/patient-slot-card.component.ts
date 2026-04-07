/**
 * Patient Slot Card Component
 * Layer 1: Dumb Component
 *
 * Responsabilità:
 * - Visualizzare un singolo paziente all'interno di uno slot
 * - Mostrare nome, status booking, status trattamento
 * - Solo Input, nessuna logica business
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AvailabilityAppointment, BookingStatus } from '../../../../graphql/generated/types';

@Component({
  selector: 'app-patient-slot-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="patient-card" [class]="'status-' + appointment.bookingStatus.toLowerCase()">
      <div class="patient-name">
        {{ appointment.clientName }}
      </div>
      <div class="patient-status">
        <span class="status-badge" [class]="'badge-' + appointment.bookingStatus.toLowerCase()">
          {{ getStatusLabel(appointment.bookingStatus) }}
        </span>
        @if (appointment.treatmentStatus) {
          <span class="treatment-badge">
            {{ getTreatmentStatusLabel(appointment.treatmentStatus) }}
          </span>
        }
      </div>
      @if (appointment.appointmentServices?.length) {
        <div class="patient-services">
          @for (svc of appointment.appointmentServices; track svc.id) {
            <span class="service-chip">{{ svc.service?.name }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .patient-card {
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid #94a3b8;
      background: white;
      transition: box-shadow 0.2s;
    }

    .patient-card:hover {
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    }

    .patient-card.status-attended {
      border-left-color: #f59e0b;
    }

    .patient-card.status-confirmed {
      border-left-color: #22c55e;
    }

    .patient-card.status-scheduled {
      border-left-color: #3b82f6;
    }

    .patient-card.status-no_show {
      border-left-color: #ef4444;
      opacity: 0.7;
    }

    .patient-card.status-cancelled_early,
    .patient-card.status-cancelled_late {
      border-left-color: #ef4444;
      opacity: 0.5;
      text-decoration: line-through;
    }

    .patient-name {
      font-weight: 500;
      font-size: 0.875rem;
      color: #1e293b;
    }

    .patient-status {
      display: flex;
      gap: 6px;
      margin-top: 4px;
      flex-wrap: wrap;
    }

    .status-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 0.7rem;
      font-weight: 500;
    }

    .badge-scheduled { background: #dbeafe; color: #1d4ed8; }
    .badge-confirmed { background: #dcfce7; color: #15803d; }
    .badge-attended { background: #fef3c7; color: #92400e; }
    .badge-no_show { background: #fee2e2; color: #dc2626; }
    .badge-cancelled_early,
    .badge-cancelled_late { background: #fecaca; color: #b91c1c; }

    .treatment-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 0.7rem;
      font-weight: 500;
      background: #e0e7ff;
      color: #4338ca;
    }

    .patient-services {
      display: flex;
      gap: 4px;
      margin-top: 4px;
      flex-wrap: wrap;
    }

    .service-chip {
      font-size: 0.7rem;
      background: #f1f5f9;
      color: #475569;
      padding: 1px 6px;
      border-radius: 4px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientSlotCardComponent {
  @Input({ required: true }) appointment!: AvailabilityAppointment;

  getStatusLabel(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.Scheduled: return 'Prenotato';
      case BookingStatus.Confirmed: return 'Confermato';
      case BookingStatus.Attended: return 'Presentato';
      case BookingStatus.NoShow: return 'Non presentato';
      case BookingStatus.CancelledEarly: return 'Cancellato';
      case BookingStatus.CancelledLate: return 'Cancellato tardi';
      default: return status;
    }
  }

  getTreatmentStatusLabel(status: string): string {
    switch (status?.toLowerCase()) {
      case 'in_progress': return 'In corso';
      case 'operator_completed': return 'Completato';
      case 'closed': return 'Chiuso';
      default: return status || '';
    }
  }
}
