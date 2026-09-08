/**
 * Gym Occurrence Resolution List
 * Layer 1: Dumb Component (presentazionale, OnPush)
 *
 * Il piano di una serie palestra, occorrenza per occorrenza, con la decisione
 * presa su ciascuna di quelle in conflitto.
 *
 * DUE DECISIONI, NON TRE. La versione operatori ne offre anche una terza,
 * "conferma comunque": là un'occorrenza fuori disponibilità si può prenotare
 * lo stesso, perché l'operatore fisicamente può farla. Qui no — i tre
 * conflitti possibili sono fascia chiusa, nessun istruttore assegnato e sala
 * piena, e il backend li rifiuta tutti e tre. Offrire "conferma comunque"
 * significherebbe promettere qualcosa che al salvataggio verrebbe negato.
 * Restano quindi: spostare l'occorrenza, oppure saltarla.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { GymMoveSlot } from '../../models/gym-move.model';

/** Cosa fare di una occorrenza della serie palestra. */
export type GymOccurrenceDecision = 'keep' | 'move' | 'skip';

/** Conflitto rilevato dal backend su una occorrenza. */
export interface GymOccurrenceConflict {
  type: string;
  reason: string;
}

/** Riga del piano: l'occorrenza proposta più la decisione presa. */
export interface GymOccurrenceRow {
  date: string;
  startTime: string;
  endTime: string;
  conflict?: GymOccurrenceConflict | null;
  decision: GymOccurrenceDecision;
  destination?: GymMoveSlot | null;
}

/** Richiesta di slot alternativi per una riga. */
export interface GymSlotRequest {
  index: number;
  /** Giorni da guardare attorno alla data dell'occorrenza. */
  span: number;
  /** Includere anche le altre sale. */
  includeOtherRooms: boolean;
}

@Component({
  selector: 'app-gym-occurrence-resolution-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="occ-list">
      <div class="occ-row" *ngFor="let row of rows; let i = index"
           [class.has-conflict]="!!row.conflict"
           [class.skipped]="row.decision === 'skip'">

        <div class="occ-main">
          <div class="occ-when">
            <mat-icon class="occ-icon"
                      [class.ok]="!row.conflict"
                      [class.ko]="!!row.conflict">
              {{ row.conflict ? 'warning' : 'check_circle' }}
            </mat-icon>
            <span class="occ-date">{{ formatDate(row.date) }}</span>
            <span class="occ-time">{{ row.startTime }} - {{ row.endTime }}</span>
          </div>

          <div class="occ-reason" *ngIf="row.conflict">{{ row.conflict.reason }}</div>

          <div class="occ-destination" *ngIf="row.decision === 'move' && row.destination">
            <mat-icon>arrow_forward</mat-icon>
            {{ formatDate(row.destination.date) }} · {{ row.destination.startTime }}
            <span class="dest-room" *ngIf="!row.destination.isOriginalRoom">
              · {{ row.destination.gymRoomName }}
            </span>
          </div>
        </div>

        <!-- Solo le righe in conflitto hanno qualcosa da decidere -->
        <div class="occ-actions" *ngIf="row.conflict">
          <mat-button-toggle-group [value]="row.decision" [hideSingleSelectionIndicator]="true"
                                   (change)="decide.emit({ index: i, decision: $event.value })">
            <mat-button-toggle value="move"
                               matTooltip="Scegli un altro slot per questa data">
              Sposta
            </mat-button-toggle>
            <mat-button-toggle value="skip"
                               matTooltip="Non creare questa occorrenza">
              Salta
            </mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        <!-- Ricerca slot alternativi, aperta solo sulla riga in spostamento -->
        <div class="occ-slots" *ngIf="row.decision === 'move'">
          <div class="slots-controls">
            <mat-button-toggle-group [value]="spanFor(i)" [hideSingleSelectionIndicator]="true"
                                     (change)="requestSlots.emit({ index: i, span: $event.value, includeOtherRooms: otherRoomsFor(i) })">
              <mat-button-toggle [value]="0">Stesso giorno</mat-button-toggle>
              <mat-button-toggle [value]="1">± 1 g</mat-button-toggle>
              <mat-button-toggle [value]="3">± 3 g</mat-button-toggle>
            </mat-button-toggle-group>

            <button mat-stroked-button type="button"
                    [class.active]="otherRoomsFor(i)"
                    (click)="requestSlots.emit({ index: i, span: spanFor(i), includeOtherRooms: !otherRoomsFor(i) })">
              <mat-icon>fitness_center</mat-icon>
              Anche altre sale
            </button>
          </div>

          @if (loadingRow === i) {
            <div class="slots-state">
              <mat-spinner diameter="20"></mat-spinner>
              <span>Ricerca slot…</span>
            </div>
          } @else if ((slotsByRow[i] || []).length === 0) {
            <div class="slots-state empty">
              Nessuno slot libero: allarga la ricerca, includi altre sale,
              oppure salta questa occorrenza.
            </div>
          } @else {
            <div class="slot-chips">
              <button type="button" class="slot-chip"
                      *ngFor="let slot of slotsByRow[i]"
                      [class.selected]="isChosen(row, slot)"
                      [class.other-room]="!slot.isOriginalRoom"
                      [matTooltip]="slot.gymRoomName + ' · ' + slot.currentCount + '/' + slot.maxCapacity"
                      (click)="chooseSlot.emit({ index: i, slot })">
                <span class="chip-when">{{ formatShort(slot.date) }} {{ slot.startTime }}</span>
                <span class="chip-room" *ngIf="!slot.isOriginalRoom">{{ slot.gymRoomName }}</span>
                <span class="chip-spots">{{ slot.freeSpots }} liberi</span>
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .occ-list { display: flex; flex-direction: column; gap: 8px; }

    .occ-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
    }

    .occ-row.has-conflict {
      border-left: 4px solid #dc2626;
      background: #fffbfb;
    }

    .occ-row.skipped { opacity: 0.55; }

    .occ-main { flex: 1 1 240px; min-width: 0; }

    .occ-when {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .occ-icon { font-size: 18px; width: 18px; height: 18px; }
    .occ-icon.ok { color: #16a34a; }
    .occ-icon.ko { color: #dc2626; }

    .occ-date { font-weight: 600; text-transform: capitalize; }
    .occ-time { color: #475569; font-size: 0.875rem; }

    .occ-reason {
      margin-top: 3px;
      font-size: 0.8125rem;
      color: #b91c1c;
    }

    .occ-destination {
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8125rem;
      color: #14532d;
    }

    .occ-destination mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .dest-room { font-weight: 500; }

    .occ-actions { flex: 0 0 auto; }

    .occ-slots {
      flex: 1 1 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px dashed #e2e8f0;
    }

    .slots-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .slots-controls button.active {
      border-color: #2563eb;
      color: #1d4ed8;
    }

    .slots-controls mat-icon {
      font-size: 16px; width: 16px; height: 16px;
      margin-right: 4px; vertical-align: middle;
    }

    .slots-state {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8125rem;
      color: #64748b;
    }

    .slots-state.empty { max-width: 52ch; }

    .slot-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      /* Un ±3 giorni su tre sale produce parecchi chip: si limita l'altezza
         e si scorre qui, non nel dialog. */
      max-height: 150px;
      overflow-y: auto;
    }

    .slot-chip {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 5px 9px;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      background: #f0fdf4;
      color: #14532d;
      cursor: pointer;
      font: inherit;
      text-align: left;
    }

    .slot-chip:hover { background: #dcfce7; }

    .slot-chip.selected {
      border-color: #16a34a;
      background: #bbf7d0;
      box-shadow: inset 0 0 0 1px #16a34a;
    }

    .slot-chip.other-room {
      border-style: dashed;
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1e3a8a;
    }

    .chip-when { font-weight: 600; font-size: 0.75rem; }
    .chip-room { font-size: 0.6875rem; }
    .chip-spots { font-size: 0.6875rem; opacity: 0.85; }

    @media (max-width: 599px) {
      .occ-actions { flex: 1 1 100%; }
      .occ-actions mat-button-toggle-group { width: 100%; }
    }
  `],
})
export class GymOccurrenceResolutionListComponent {
  @Input() rows: GymOccurrenceRow[] = [];

  /** Slot proposti, per indice di riga. */
  @Input() slotsByRow: Record<number, GymMoveSlot[]> = {};

  /** Ampiezza di ricerca scelta, per indice di riga. */
  @Input() spanByRow: Record<number, number> = {};

  /** "Anche altre sale" attivo, per indice di riga. */
  @Input() otherRoomsByRow: Record<number, boolean> = {};

  /** Indice della riga che sta caricando slot (-1 = nessuna). */
  @Input() loadingRow = -1;

  @Output() decide = new EventEmitter<{ index: number; decision: GymOccurrenceDecision }>();
  @Output() chooseSlot = new EventEmitter<{ index: number; slot: GymMoveSlot }>();
  @Output() requestSlots = new EventEmitter<GymSlotRequest>();

  spanFor(index: number): number {
    return this.spanByRow[index] ?? 0;
  }

  otherRoomsFor(index: number): boolean {
    return !!this.otherRoomsByRow[index];
  }

  isChosen(row: GymOccurrenceRow, slot: GymMoveSlot): boolean {
    const d = row.destination;
    return (
      !!d &&
      d.gymRoomId === slot.gymRoomId &&
      d.date === slot.date &&
      d.startTime === slot.startTime
    );
  }

  formatDate(date: string): string {
    const d = new Date(date + 'T00:00:00');
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('it-IT', {
      weekday: 'long', day: '2-digit', month: '2-digit',
    });
  }

  formatShort(date: string): string {
    const d = new Date(date + 'T00:00:00');
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  }
}
