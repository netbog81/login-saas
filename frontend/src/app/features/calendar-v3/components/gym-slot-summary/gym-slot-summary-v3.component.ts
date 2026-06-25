/**
 * Gym Slot Summary V3
 * Layer 1: Dumb Component (presentazionale, OnPush)
 *
 * Riquadro riassunto di uno slot palestra: mostra room, orario, operatore,
 * capacita' e la lista delle prenotazioni dello slot, con azioni
 * aggiungi / modifica / elimina. Nessuna logica business o GraphQL: tutto
 * passa via @Input e ogni azione viene notificata via @Output `action`.
 *
 * Versione Material di `components/calendar-cdk/gym-slot-summary` (v1),
 * conforme alla spec architetturale (Angular Material + responsive + OnPush).
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { GymRoom } from '../../../calendar-v2/components/gym-grid/gym-grid.component';
import { GymSlotInfo, GymAppointment } from '../../../../services/gym-room.service';

/** Azione emessa dal riquadro verso il container (Layer 2). */
export interface GymSlotSummaryV3Action {
  type: 'edit' | 'delete' | 'add' | 'close';
  /** Valorizzato per `edit` / `delete`. */
  appointment?: GymAppointment;
}

@Component({
  selector: 'app-gym-slot-summary-v3',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <mat-card class="gym-summary" (click)="$event.stopPropagation()">
      <!-- Header -->
      <div class="summary-header" [style.background]="gymRoom.color || '#10b981'">
        <div class="header-text">
          <span class="room-name">{{ gymRoom.name }}</span>
          <span class="slot-time">{{ slotInfo.startTime }} - {{ slotInfo.endTime }}</span>
        </div>
        <div class="header-actions">
          <button mat-icon-button
                  *ngIf="canAddMore"
                  type="button"
                  matTooltip="Aggiungi prenotazione"
                  (click)="emitAdd()">
            <mat-icon>add</mat-icon>
          </button>
          <button mat-icon-button type="button" matTooltip="Chiudi" (click)="emitClose()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <mat-card-content class="summary-content">
        <!-- Info -->
        <div class="info-grid">
          <div class="info-row">
            <mat-icon>event</mat-icon>
            <span>{{ formatDate(date) }}</span>
          </div>
          <div class="info-row" *ngIf="operatorName">
            <mat-icon>person</mat-icon>
            <span>{{ operatorName }}</span>
          </div>
          <div class="info-row">
            <mat-icon>groups</mat-icon>
            <span>
              {{ slotInfo.currentCount }}/{{ slotInfo.maxCapacity }}
              <span class="capacity-note" *ngIf="availableSpots > 0">
                ({{ availableSpots }} {{ availableSpots === 1 ? 'posto libero' : 'posti liberi' }})
              </span>
              <span class="capacity-note full" *ngIf="availableSpots === 0">(Completo)</span>
            </span>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Lista prenotazioni -->
        <div class="appointments" *ngIf="appointments.length > 0; else emptyState">
          <div class="list-label">Prenotazioni ({{ appointments.length }})</div>
          <div class="appointment-item" *ngFor="let apt of appointments; trackBy: trackByAppointment">
            <div class="apt-info">
              <div class="apt-name">
                {{ getPatientName(apt) }}
                <mat-icon class="recurring-icon"
                          *ngIf="apt.isRecurring"
                          matTooltip="Appuntamento ricorrente">repeat</mat-icon>
              </div>
              <div class="apt-phone" *ngIf="apt.clientPhone">
                <mat-icon>call</mat-icon>{{ apt.clientPhone }}
              </div>
              <div class="apt-notes" *ngIf="apt.notes">{{ apt.notes }}</div>
            </div>
            <div class="apt-actions">
              <button mat-icon-button type="button" matTooltip="Modifica" (click)="emitEdit(apt)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button type="button" color="warn" matTooltip="Elimina" (click)="emitDelete(apt)">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <ng-template #emptyState>
          <div class="empty-state">
            <mat-icon>event_busy</mat-icon>
            <p>Nessuna prenotazione per questo slot</p>
            <button mat-flat-button color="primary" *ngIf="canAddMore" (click)="emitAdd()">
              <mat-icon>add</mat-icon> Aggiungi prenotazione
            </button>
          </div>
        </ng-template>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .gym-summary {
      width: clamp(280px, 92vw, 360px);
      max-height: min(70vh, 520px);
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
      border-radius: 12px;
    }

    .summary-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 8px 10px 16px;
      color: #fff;
    }

    .header-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .room-name {
      font-weight: 600;
      font-size: 1rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .slot-time {
      font-size: 0.8125rem;
      opacity: 0.92;
    }

    .header-actions {
      display: flex;
      flex-shrink: 0;
      color: #fff;
    }

    .summary-content {
      padding: 12px 16px 16px;
      overflow-y: auto;
    }

    .info-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #444;
      font-size: 0.9rem;
    }

    .info-row mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #667eea;
      flex-shrink: 0;
    }

    .capacity-note {
      color: #2e7d32;
      font-size: 0.825rem;
    }

    .capacity-note.full {
      color: #c62828;
    }

    .appointments {
      margin-top: 12px;
    }

    .list-label {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: rgba(0, 0, 0, 0.55);
      margin-bottom: 8px;
    }

    .appointment-item {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      padding: 8px;
      border-radius: 8px;
      background: #f7f8fa;
      margin-bottom: 8px;
    }

    .apt-info {
      min-width: 0;
      flex: 1;
    }

    .apt-name {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      color: #222;
    }

    .recurring-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #f57c00;
    }

    .apt-phone {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #666;
      font-size: 0.8125rem;
      margin-top: 2px;
    }

    .apt-phone mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .apt-notes {
      color: #777;
      font-size: 0.8125rem;
      margin-top: 2px;
      white-space: pre-wrap;
    }

    .apt-actions {
      display: flex;
      flex-shrink: 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 8px 8px;
      text-align: center;
      color: #888;
    }

    .empty-state mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      opacity: 0.5;
    }

    .empty-state p {
      margin: 0;
      font-size: 0.9rem;
    }
  `],
})
export class GymSlotSummaryV3Component {
  @Input() gymRoom!: GymRoom;
  @Input() slotInfo!: GymSlotInfo;
  @Input() appointments: GymAppointment[] = [];
  @Input() date!: string;

  @Output() action = new EventEmitter<GymSlotSummaryV3Action>();

  get availableSpots(): number {
    return Math.max(0, this.slotInfo.maxCapacity - this.slotInfo.currentCount);
  }

  get canAddMore(): boolean {
    return this.slotInfo.isAvailable && !this.slotInfo.isClosed && this.availableSpots > 0;
  }

  get operatorName(): string {
    const op = this.slotInfo?.operator;
    if (!op) return '';
    return op.surname ? `${op.name} ${op.surname}` : op.name;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  getPatientName(apt: GymAppointment): string {
    return apt.clientName || 'Paziente senza nome';
  }

  trackByAppointment(_index: number, apt: GymAppointment): string {
    return apt.id;
  }

  emitAdd(): void {
    this.action.emit({ type: 'add' });
  }

  emitClose(): void {
    this.action.emit({ type: 'close' });
  }

  emitEdit(apt: GymAppointment): void {
    this.action.emit({ type: 'edit', appointment: apt });
  }

  emitDelete(apt: GymAppointment): void {
    this.action.emit({ type: 'delete', appointment: apt });
  }
}
