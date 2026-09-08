import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';

import {
  MyAppointment,
  MyAppointmentStatus,
} from '../../../models/my-appointments.model';

interface AppointmentGroup {
  patientLabel: string;
  appointments: MyAppointment[];
}

const STATUS_LABEL: Record<MyAppointmentStatus, string> = {
  scheduled: 'Prenotato',
  confirmed: 'Confermato',
  cancelled: 'Disdetto',
  cancelled_early: 'Disdetto in anticipo',
  cancelled_late: 'Disdetto in ritardo',
  no_show: 'No-show',
  attended: 'Eseguito',
};

const STATUS_COLOR: Record<MyAppointmentStatus, string> = {
  scheduled: '#1976d2',
  confirmed: '#0288d1',
  cancelled: '#9e9e9e',
  cancelled_early: '#9e9e9e',
  cancelled_late: '#f57c00',
  no_show: '#d32f2f',
  attended: '#388e3c',
};

/**
 * Lista dumb degli appuntamenti operatore.
 *
 * Layer 1 (presentational): renderizza una tabella Material con colonne
 * data/ora, paziente, servizio, stato. Niente chiamate, niente business
 * logic — il container si occupa di filtrare/raggruppare e passare i
 * dati già pronti.
 *
 * Due modalità render: piatta (tabella) o per paziente (gruppi).
 */
@Component({
  selector: 'app-my-appointments-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatButtonModule,
  ],
  template: `
    @if (loading) {
      <div class="state-empty">
        <mat-spinner diameter="32"></mat-spinner>
        <p>Caricamento appuntamenti...</p>
      </div>
    } @else if (appointments.length === 0) {
      <div class="state-empty">
        <mat-icon>event_busy</mat-icon>
        <p>Nessun appuntamento trovato</p>
      </div>
    } @else if (groupedView && groups.length > 0) {
      <!-- Vista raggruppata per paziente -->
      @for (g of groups; track g.patientLabel) {
        <div class="patient-group">
          <h3 class="patient-header">
            <mat-icon>person</mat-icon>
            {{ g.patientLabel }}
            <span class="count">({{ g.appointments.length }})</span>
          </h3>
          <table mat-table [dataSource]="g.appointments" class="appt-table">
            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef>Data e ora</th>
              <td mat-cell *matCellDef="let a">
                <div class="cell-date">{{ formatDate(a.appointmentDate) }}</div>
                <div class="cell-time">{{ a.startTime }}–{{ a.endTime }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="service">
              <th mat-header-cell *matHeaderCellDef>Servizio</th>
              <td mat-cell *matCellDef="let a">
                {{ a.service?.name || '—' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Stato</th>
              <td mat-cell *matCellDef="let a">
                <span
                  class="status-chip"
                  [style.background]="statusColor(a.bookingStatus)">
                  {{ statusLabel(a.bookingStatus) }}
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="attendance">
              <th mat-header-cell *matHeaderCellDef>Presenza</th>
              <td mat-cell *matCellDef="let a">
                @if (a.bookingStatus === 'no_show') {
                  <button mat-stroked-button color="primary" type="button"
                          [disabled]="pendingId === a.id"
                          matTooltip="Il paziente è arrivato: annulla l'assenza"
                          (click)="markAttended.emit(a.id)">
                    <mat-icon>person_add</mat-icon>
                    Arrivato
                  </button>
                } @else if (canMarkNoShow(a)) {
                  <button mat-stroked-button color="warn" type="button"
                          [disabled]="pendingId === a.id"
                          matTooltip="Registra l'assenza: si può togliere in qualsiasi momento"
                          (click)="markNoShow.emit(a.id)">
                    <mat-icon>person_off</mat-icon>
                    Non presentato
                  </button>
                } @else {
                  <span class="no-action">—</span>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="groupedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: groupedColumns"></tr>
          </table>
        </div>
      }
    } @else {
      <!-- Vista piatta -->
      <table mat-table [dataSource]="appointments" class="appt-table">
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Data e ora</th>
          <td mat-cell *matCellDef="let a">
            <div class="cell-date">{{ formatDate(a.appointmentDate) }}</div>
            <div class="cell-time">{{ a.startTime }}–{{ a.endTime }}</div>
          </td>
        </ng-container>
        <ng-container matColumnDef="patient">
          <th mat-header-cell *matHeaderCellDef>Paziente</th>
          <td mat-cell *matCellDef="let a">
            {{ a.clientName || '—' }}
          </td>
        </ng-container>
        <ng-container matColumnDef="service">
          <th mat-header-cell *matHeaderCellDef>Servizio</th>
          <td mat-cell *matCellDef="let a">
            {{ a.service?.name || '—' }}
          </td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Stato</th>
          <td mat-cell *matCellDef="let a">
            <span
              class="status-chip"
              [style.background]="statusColor(a.bookingStatus)">
              {{ statusLabel(a.bookingStatus) }}
            </span>
          </td>
        </ng-container>
        <ng-container matColumnDef="attendance">
          <th mat-header-cell *matHeaderCellDef>Presenza</th>
          <td mat-cell *matCellDef="let a">
            <!-- L'operatore in sala e' chi si accorge per primo che il
                 paziente non e' venuto. La colonna compare solo se
                 l'impostazione «Permetti agli operatori di segnare i no show»
                 e' attiva; il gesto e' reversibile e non falsa i conteggi
                 (rimettendo «Arrivato» l'assenza torna un ritardo). -->
            @if (a.bookingStatus === 'no_show') {
              <button mat-stroked-button color="primary" type="button"
                      [disabled]="pendingId === a.id"
                      matTooltip="Il paziente è arrivato: annulla l'assenza"
                      (click)="markAttended.emit(a.id)">
                <mat-icon>person_add</mat-icon>
                Arrivato
              </button>
            } @else if (canMarkNoShow(a)) {
              <button mat-stroked-button color="warn" type="button"
                      [disabled]="pendingId === a.id"
                      matTooltip="Registra l'assenza: si può togliere in qualsiasi momento"
                      (click)="markNoShow.emit(a.id)">
                <mat-icon>person_off</mat-icon>
                Non presentato
              </button>
            } @else {
              <span class="no-action">—</span>
            }
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="flatColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: flatColumns"></tr>
      </table>
    }
  `,
  styles: [
    `
      .state-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 48px 24px;
        color: rgba(0, 0, 0, 0.55);
      }
      .state-empty mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        opacity: 0.4;
      }
      .appt-table {
        width: 100%;
      }
      .cell-date {
        font-weight: 500;
      }
      .cell-time {
        font-size: 0.85rem;
        color: rgba(0, 0, 0, 0.55);
      }
      .status-chip {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        color: white;
        font-size: 0.75rem;
        font-weight: 500;
      }
      .patient-group {
        margin-bottom: 24px;
      }
      .patient-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1rem;
        font-weight: 500;
        margin: 0 0 8px;
        color: #1976d2;
      }
      .no-action {
        color: rgba(0, 0, 0, 0.35);
      }
      .patient-header .count {
        color: rgba(0, 0, 0, 0.55);
        font-weight: 400;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class MyAppointmentsListComponent {
  @Input() appointments: MyAppointment[] = [];
  @Input() groups: AppointmentGroup[] = [];
  @Input() groupedView = false;
  @Input() loading = false;
  /**
   * L'operatore puo' marcare presenze/assenze? Deciso dal backend
   * (`canMarkAttendance`), non dal ruolo indovinato qui.
   */
  @Input() canMarkAttendance = false;
  /** Appuntamento con una marcatura in volo: bottone disabilitato. */
  @Input() pendingId: string | null = null;

  @Output() markNoShow = new EventEmitter<string>();
  @Output() markAttended = new EventEmitter<string>();

  get flatColumns(): string[] {
    const base = ['date', 'patient', 'service', 'status'];
    return this.canMarkAttendance ? [...base, 'attendance'] : base;
  }

  get groupedColumns(): string[] {
    const base = ['date', 'service', 'status'];
    return this.canMarkAttendance ? [...base, 'attendance'] : base;
  }

  /**
   * Si segna assente solo un appuntamento vivo e gia' iniziato: prima
   * dell'orario non si puo' sapere, e su disdette o cancellazioni l'assenza
   * non ha significato.
   */
  canMarkNoShow(a: MyAppointment): boolean {
    if (!['scheduled', 'confirmed', 'attended'].includes(a.bookingStatus)) {
      return false;
    }
    const start = new Date(`${a.appointmentDate}T${a.startTime}`);
    return !Number.isNaN(start.getTime()) && start.getTime() <= Date.now();
  }

  statusLabel(s: MyAppointmentStatus): string {
    return STATUS_LABEL[s] ?? s;
  }

  statusColor(s: MyAppointmentStatus): string {
    return STATUS_COLOR[s] ?? '#9e9e9e';
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
}

export type { AppointmentGroup };
