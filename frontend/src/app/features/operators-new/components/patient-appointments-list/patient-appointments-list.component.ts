/**
 * Patient Appointments List Component
 * Layer 1: UI Component (Dumb)
 *
 * Responsabilita':
 * - Visualizzare la lista degli appuntamenti futuri di un paziente
 * - Filtrare per periodo (settimana, mese, intervallo, tutti)
 * - Emettere eventi per cancellazione e invio recap WhatsApp
 *   (singolo o unico messaggio per tutti i filtrati)
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

type PeriodFilter = 'all' | 'week' | 'month' | 'range';

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
      <!-- Barra filtri + invio recap unico sui filtrati -->
      <div class="filter-bar">
        <div class="filter-chips">
          <button type="button" class="filter-chip" [class.active]="filterMode === 'all'"
                  (click)="setFilter('all')">Tutti</button>
          <button type="button" class="filter-chip" [class.active]="filterMode === 'week'"
                  (click)="setFilter('week')">Questa settimana</button>
          <button type="button" class="filter-chip" [class.active]="filterMode === 'month'"
                  (click)="setFilter('month')">Questo mese</button>
          <button type="button" class="filter-chip" [class.active]="filterMode === 'range'"
                  (click)="setFilter('range')">Intervallo</button>
        </div>

        @if (filterMode === 'range') {
          <div class="range-inputs">
            <input type="date" [value]="rangeFrom" (change)="onRangeFromChange($event)"
                   title="Dal" />
            <span class="range-sep">→</span>
            <input type="date" [value]="rangeTo" (change)="onRangeToChange($event)"
                   title="Al" />
          </div>
        }

        <button mat-flat-button color="primary" class="send-all-btn"
                [disabled]="sendingBatch || recapCandidates.length === 0"
                matTooltip="Invia un unico messaggio WhatsApp con il riepilogo degli appuntamenti filtrati"
                (click)="onSendRecapBatch()">
          <mat-icon>send</mat-icon>
          {{ sendingBatch ? 'Invio...' : 'Invia recap (' + recapCandidates.length + ')' }}
        </button>
      </div>

      @if (filteredAppointments.length === 0) {
        <div class="empty-state">
          <mat-icon>filter_alt_off</mat-icon>
          <p>Nessun appuntamento nel periodo selezionato</p>
        </div>
      } @else {
        <div class="appointments-list">
          @for (apt of filteredAppointments; track apt.id; let last = $last) {
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

    .filter-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px 16px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .filter-chip {
      padding: 4px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      background: white;
      color: #475569;
      font-size: 0.8125rem;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #f1f5f9;
      }

      &.active {
        background: #6366f1;
        border-color: #6366f1;
        color: white;
        font-weight: 600;
      }
    }

    .range-inputs {
      display: flex;
      align-items: center;
      gap: 4px;

      input[type='date'] {
        padding: 4px 6px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 0.8125rem;
        color: #334155;
      }

      .range-sep {
        color: #94a3b8;
      }
    }

    .send-all-btn {
      margin-left: auto;

      mat-icon {
        margin-right: 4px;
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

      .send-all-btn {
        margin-left: 0;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientAppointmentsListComponent {
  @Input() appointments: AvailabilityAppointment[] = [];
  @Input() loading = false;
  /** True mentre l'invio del recap multiplo è in corso (disabilita il bottone). */
  @Input() sendingBatch = false;
  /**
   * Mostra il pulsante "Cancella appuntamento". Solo segreteria/admin possono
   * cancellare: gli operatori non creano, modificano né cancellano appuntamenti
   * (il backend lo blocca via CalendarWriteGuard; qui nascondiamo il bottone
   * per coerenza UX).
   */
  @Input() canCancel = true;

  @Output() cancelAppointment = new EventEmitter<AvailabilityAppointment>();
  @Output() sendRecap = new EventEmitter<AvailabilityAppointment>();
  /** Invio di un unico recap WhatsApp per gli appuntamenti filtrati (attivi). */
  @Output() sendRecapBatch = new EventEmitter<AvailabilityAppointment[]>();

  // Filtro periodo
  filterMode: PeriodFilter = 'all';
  rangeFrom = '';
  rangeTo = '';

  private readonly statusLabels: Record<string, string> = {
    [BookingStatus.Scheduled]: 'Programmato',
    [BookingStatus.Confirmed]: 'Confermato',
    [BookingStatus.Attended]: 'Presente',
    [BookingStatus.NoShow]: 'Non presentato',
    [BookingStatus.Cancelled]: 'Cancellato',
    [BookingStatus.CancelledEarly]: 'Cancellato (in anticipo)',
    [BookingStatus.CancelledLate]: 'Cancellato (in ritardo)',
  };

  // ==================== FILTRO PERIODO ====================

  setFilter(mode: PeriodFilter): void {
    this.filterMode = mode;
  }

  onRangeFromChange(event: Event): void {
    this.rangeFrom = (event.target as HTMLInputElement).value;
  }

  onRangeToChange(event: Event): void {
    this.rangeTo = (event.target as HTMLInputElement).value;
  }

  /** Confini [from, to] (YYYY-MM-DD, inclusivi) del filtro corrente; null = nessun limite. */
  private get filterBounds(): { from: string | null; to: string | null } {
    const today = new Date();
    const toStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    switch (this.filterMode) {
      case 'week': {
        // Lunedì → domenica della settimana corrente
        const monday = new Date(today);
        const dow = (today.getDay() + 6) % 7; // 0 = lunedì
        monday.setDate(today.getDate() - dow);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { from: toStr(monday), to: toStr(sunday) };
      }
      case 'month': {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { from: toStr(first), to: toStr(last) };
      }
      case 'range':
        return { from: this.rangeFrom || null, to: this.rangeTo || null };
      default:
        return { from: null, to: null };
    }
  }

  get filteredAppointments(): AvailabilityAppointment[] {
    const { from, to } = this.filterBounds;
    if (!from && !to) return this.appointments;
    return this.appointments.filter((apt) => {
      const date = String(apt.appointmentDate).slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }

  /** Filtrati e ancora attivi: sono quelli che entrano nel recap unico. */
  get recapCandidates(): AvailabilityAppointment[] {
    return this.filteredAppointments.filter((apt) =>
      [BookingStatus.Scheduled, BookingStatus.Confirmed].includes(apt.bookingStatus),
    );
  }

  onSendRecapBatch(): void {
    const candidates = this.recapCandidates;
    if (candidates.length > 0) {
      this.sendRecapBatch.emit(candidates);
    }
  }

  // ==================== HELPERS ====================

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
