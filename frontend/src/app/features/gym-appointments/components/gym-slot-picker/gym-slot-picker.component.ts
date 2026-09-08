/**
 * Gym Slot Picker
 * Layer 1: Dumb Component (presentazionale, OnPush)
 *
 * Elenco degli slot palestra liberi fra cui scegliere la destinazione di uno
 * spostamento, raggruppati per giorno.
 *
 * OGNI CHIP MOSTRA I POSTI LIBERI, non solo l'orario. In palestra uno slot
 * non è libero o occupato: è pieno per gradi, e "2 posti" contro "8 posti" è
 * l'informazione su cui la segreteria decide davvero quando deve spostarci
 * dentro qualcuno. Il nome della sala compare solo sugli slot di sale
 * DIVERSE da quella di partenza: ripeterlo su tutte le righe della sala
 * corrente sarebbe rumore.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  GymMoveSlot,
  GymMoveSlotsByDay,
  GymMoveSearchSpan,
  GymRoomOption,
} from '../../models/gym-move.model';

@Component({
  selector: 'app-gym-slot-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="slot-picker">
      <!-- Ampiezza della ricerca attorno alla data originale -->
      <div class="picker-controls">
        <div class="control-group">
          <span class="control-label">Cerca</span>
          <mat-button-toggle-group [value]="span" (change)="spanChange.emit($event.value)"
                                   [disabled]="loading" [hideSingleSelectionIndicator]="true">
            <mat-button-toggle [value]="0">Stesso giorno</mat-button-toggle>
            <mat-button-toggle [value]="1">± 1 giorno</mat-button-toggle>
            <mat-button-toggle [value]="3">± 3 giorni</mat-button-toggle>
            <mat-button-toggle [value]="7">± 1 settimana</mat-button-toggle>
          </mat-button-toggle-group>
        </div>
      </div>

      <!-- Sale incluse nella ricerca -->
      <div class="rooms-filter" *ngIf="rooms.length > 1">
        <span class="control-label">Sale</span>
        <div class="room-chips">
          <mat-checkbox *ngFor="let r of rooms"
                        [checked]="r.selected"
                        [disabled]="loading"
                        (change)="toggleRoom.emit(r.id)">
            <span class="room-dot" [style.background]="r.color || '#10b981'"></span>
            {{ r.name }}
            <span class="room-original" *ngIf="r.isOriginal">(attuale)</span>
          </mat-checkbox>
        </div>
      </div>

      <!-- Esito -->
      @if (loading) {
        <div class="picker-state">
          <mat-spinner diameter="28"></mat-spinner>
          <span>Ricerca slot liberi…</span>
        </div>
      } @else if (slotsByDay.length === 0) {
        <div class="picker-state empty">
          <mat-icon>search_off</mat-icon>
          <span>
            Nessuno slot libero con questi criteri. Allarga la ricerca ai
            giorni vicini o includi altre sale.
          </span>
        </div>
      } @else {
        <div class="days">
          <div class="day-column" *ngFor="let day of slotsByDay">
            <div class="day-header">{{ formatDay(day.date) }}</div>
            <div class="day-slots">
              <button type="button" class="slot-chip"
                      *ngFor="let slot of day.slots"
                      [class.selected]="isSelected(slot)"
                      [class.other-room]="!slot.isOriginalRoom"
                      [matTooltip]="tooltipFor(slot)"
                      (click)="select.emit(slot)">
                <span class="slot-time">{{ slot.startTime }} - {{ slot.endTime }}</span>
                <span class="slot-room" *ngIf="!slot.isOriginalRoom">{{ slot.gymRoomName }}</span>
                <span class="slot-spots"
                      [class.tight]="slot.freeSpots === 1">
                  {{ slot.freeSpots }} {{ slot.freeSpots === 1 ? 'posto' : 'posti' }}
                </span>
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .slot-picker {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .picker-controls, .rooms-filter {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .control-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .control-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #64748b;
    }

    .room-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
    }

    .room-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 4px;
      vertical-align: middle;
    }

    .room-original { color: #64748b; font-size: 0.8125rem; margin-left: 4px; }

    .picker-state {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px;
      justify-content: center;
      color: #64748b;
      font-size: 0.875rem;
      text-align: center;
    }

    .picker-state.empty { max-width: 46ch; margin: 0 auto; }

    .days {
      display: flex;
      gap: 12px;
      /* Le colonne-giorno scorrono QUI dentro: con ±1 settimana sono
         quindici, e il dialog non deve prendere lo scroll orizzontale. */
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .day-column {
      flex: 0 0 auto;
      min-width: 150px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .day-header {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0f172a;
      text-transform: capitalize;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }

    .day-slots {
      display: flex;
      flex-direction: column;
      gap: 6px;
      /* Un giorno pieno può avere venti fasce: scorre la colonna, non il
         dialog intero. */
      max-height: 260px;
      overflow-y: auto;
    }

    .slot-chip {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
      padding: 6px 10px;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      background: #f0fdf4;
      color: #14532d;
      cursor: pointer;
      font: inherit;
      text-align: left;
      transition: background 0.12s, border-color 0.12s;
    }

    .slot-chip:hover { background: #dcfce7; }

    .slot-chip.selected {
      border-color: #16a34a;
      background: #bbf7d0;
      box-shadow: inset 0 0 0 1px #16a34a;
    }

    /* Sala diversa da quella di partenza: bordo tratteggiato. Lo spostamento
       resta legittimo, ma è un cambiamento in più da comunicare al paziente
       e deve distinguersi senza dover leggere il nome della sala. */
    .slot-chip.other-room {
      border-style: dashed;
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1e3a8a;
    }

    .slot-chip.other-room:hover { background: #dbeafe; }

    .slot-time { font-weight: 600; font-size: 0.8125rem; }
    .slot-room { font-size: 0.6875rem; opacity: 0.9; }

    .slot-spots {
      font-size: 0.6875rem;
      opacity: 0.85;
    }

    .slot-spots.tight { font-weight: 700; opacity: 1; }

    @media (max-width: 599px) {
      .day-column { min-width: 132px; }
    }
  `],
})
export class GymSlotPickerComponent {
  @Input() slotsByDay: GymMoveSlotsByDay[] = [];
  @Input() rooms: GymRoomOption[] = [];
  @Input() span: GymMoveSearchSpan = 0;
  @Input() selected: GymMoveSlot | null = null;
  @Input() loading = false;

  @Output() select = new EventEmitter<GymMoveSlot>();
  @Output() spanChange = new EventEmitter<GymMoveSearchSpan>();
  @Output() toggleRoom = new EventEmitter<string>();

  isSelected(slot: GymMoveSlot): boolean {
    const s = this.selected;
    return (
      !!s &&
      s.gymRoomId === slot.gymRoomId &&
      s.date === slot.date &&
      s.startTime === slot.startTime
    );
  }

  tooltipFor(slot: GymMoveSlot): string {
    const parts = [`${slot.gymRoomName} · ${slot.startTime}-${slot.endTime}`];
    if (slot.operatorName) parts.push(`Istruttore: ${slot.operatorName}`);
    parts.push(`Occupazione: ${slot.currentCount}/${slot.maxCapacity}`);
    return parts.join('\n');
  }

  formatDay(date: string): string {
    const d = new Date(date + 'T00:00:00');
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('it-IT', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  }
}
