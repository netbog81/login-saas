/**
 * Patient Appointments List — Calendario V3
 * Layer 1: Dumb Component
 *
 * Elenco appuntamenti del paziente selezionato. Per ogni appuntamento:
 * dettagli sintetici, "Vai al calendario" e "Sposta".
 * Solo @Input/@Output, nessuna logica, nessun GraphQL.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AvailabilityAppointment, AppointmentService,
} from '../../../../graphql/generated/types';

@Component({
  selector: 'app-v3-patient-appointments-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    @if (loading) {
      <div class="list-state">
        <mat-spinner diameter="28"></mat-spinner>
      </div>
    } @else if (!patientSelected) {
      <div class="list-state hint">Seleziona un paziente per vedere gli appuntamenti</div>
    } @else if (appointments.length === 0) {
      <div class="list-state hint">Nessun appuntamento per questo paziente</div>
    } @else {
      <div class="appt-list">
        @for (a of appointments; track a.id) {
          <div class="appt-card" [class.selected]="a.id === selectedAppointmentId">
            <div class="appt-info">
              <div class="appt-when">
                <mat-icon class="appt-icon">event</mat-icon>
                <span class="appt-date">{{ formatDate(a.appointmentDate) }}</span>
                <span class="appt-time">{{ a.startTime }} - {{ a.endTime }}</span>
              </div>
              <div class="appt-meta">
                <span class="appt-operator">
                  <mat-icon class="meta-icon">person</mat-icon>
                  {{ operatorName(a) }}
                </span>
                @if (serviceNames(a); as svc) {
                  <span class="appt-service">
                    <mat-icon class="meta-icon">medical_services</mat-icon>
                    {{ svc }}
                  </span>
                }
                @if (a.instruments && a.instruments.length > 0) {
                  <span class="appt-instruments" matTooltip="Strumenti assegnati">
                    <mat-icon class="meta-icon">build</mat-icon>
                    {{ a.instruments.length }}
                  </span>
                }
              </div>
              @if (a.notes) {
                <div class="appt-notes">{{ a.notes }}</div>
              }
            </div>
            <div class="appt-actions">
              <button mat-stroked-button class="act-btn"
                      (click)="goToCalendar.emit(a)"
                      matTooltip="Mostra sul calendario">
                <mat-icon>calendar_month</mat-icon>
                Calendario
              </button>
              <button mat-stroked-button class="act-btn"
                      (click)="editAppointment.emit(a)"
                      matTooltip="Modifica l'appuntamento">
                <mat-icon>edit</mat-icon>
                Modifica
              </button>
              <button mat-flat-button color="primary" class="act-btn"
                      (click)="moveAppointment.emit(a)"
                      matTooltip="Sposta questo appuntamento">
                <mat-icon>swap_horiz</mat-icon>
                Sposta
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .list-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #64748b;
      font-size: 0.85rem;
      height: 100%;
    }
    .list-state.hint { font-style: italic; }
    .appt-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      height: 100%;
      padding-right: 4px;
    }
    .appt-card {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: white;
    }
    .appt-card.selected {
      border-color: #38bdf8;
      background: #f0f9ff;
    }
    .appt-info { min-width: 0; flex: 1; }
    .appt-when {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .appt-icon { color: #0284c7; font-size: 18px; width: 18px; height: 18px; }
    .appt-date {
      font-weight: 600;
      font-size: 0.88rem;
      color: #1e293b;
      text-transform: capitalize;
    }
    .appt-time { font-size: 0.82rem; color: #475569; }
    .appt-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 4px;
      font-size: 0.78rem;
      color: #64748b;
    }
    .appt-meta span {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .meta-icon { font-size: 15px; width: 15px; height: 15px; }
    .appt-notes {
      margin-top: 4px;
      font-size: 0.76rem;
      color: #94a3b8;
      font-style: italic;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .appt-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 0 0 auto;
      justify-content: center;
    }
    .act-btn {
      font-size: 0.76rem;
      line-height: 30px;
      padding: 0 10px;
      min-width: 116px;
    }
    .act-btn .mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-right: 3px;
    }
  `],
})
export class V3PatientAppointmentsListComponent {
  @Input() appointments: AvailabilityAppointment[] = [];
  @Input() loading = false;
  @Input() patientSelected = false;
  @Input() selectedAppointmentId: string | null = null;

  @Output() goToCalendar = new EventEmitter<AvailabilityAppointment>();
  @Output() editAppointment = new EventEmitter<AvailabilityAppointment>();
  @Output() moveAppointment = new EventEmitter<AvailabilityAppointment>();

  formatDate(date: string): string {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('it-IT', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  operatorName(a: AvailabilityAppointment): string {
    const op = a.operator;
    if (!op) return '—';
    return `${op.name ?? ''} ${op.surname ?? ''}`.trim() || '—';
  }

  serviceNames(a: AvailabilityAppointment): string {
    const svcs: AppointmentService[] = a.appointmentServices ?? [];
    return svcs
      .map(s => s.service?.name)
      .filter((n): n is string => !!n)
      .join(', ');
  }
}
