/**
 * Recurring Resolution List — Calendario V3
 * Layer 1: Dumb Component
 *
 * Elenco delle occorrenze di una serie ricorrente con la decisione presa su
 * ciascuna: conferma, sposta, salta. Le occorrenze senza conflitto restano
 * raccolte in una riga di riepilogo, così il riquadro parla solo di quello su
 * cui serve decidere.
 *
 * Il pannello di spostamento vive dentro la riga perché è uno stato della
 * riga, non un componente riusabile altrove: separarlo significherebbe
 * rimbalzare avanti e indietro sette Input/Output senza guadagnarci nulla.
 *
 * Solo @Input/@Output: gli slot liberi li cerca il container.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  OccurrenceResolution, OccurrenceDecision, OccurrenceDestination,
  MoveSlotOption, MoveSearchSpan,
} from '../../models/recurring-resolution.model';

/** Richiesta di ricerca slot per una riga, inoltrata al container. */
export interface MoveSearchRequest {
  index: number;
  span: MoveSearchSpan;
  includeOtherOperators: boolean;
}

@Component({
  selector: 'app-v3-recurring-resolution-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatButtonToggleModule,
    MatIconModule, MatTooltipModule, MatCheckboxModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="resolution-list">
      <!-- Occorrenze pulite: una riga sola, non c'è niente da decidere. -->
      @if (cleanCount > 0) {
        <div class="clean-summary">
          <mat-icon>check_circle</mat-icon>
          <span>
            {{ cleanCount }} {{ cleanCount === 1 ? 'occorrenza' : 'occorrenze' }}
            senza problemi, {{ cleanCount === 1 ? 'verrà creata' : 'verranno create' }} come previsto
          </span>
        </div>
      }

      @for (row of resolutions; track row.preview.date + row.preview.startTime; let i = $index) {
        @if (row.preview.conflict) {
          <div class="occ-row"
               [class.skipped]="row.decision === 'skip'"
               [class.moved]="row.decision === 'move'"
               [class.confirmed]="row.decision === 'confirm'">

            <div class="occ-head">
              <mat-icon class="occ-icon"
                        [class.overlap]="row.preview.conflict.type === 'overlap'">
                {{ row.preview.conflict.type === 'overlap' ? 'event_busy' : 'block' }}
              </mat-icon>

              <div class="occ-when">
                <span class="occ-date">{{ formatDate(row.preview.date) }}</span>
                <span class="occ-time">{{ row.preview.startTime }}–{{ row.preview.endTime }}</span>
                <span class="occ-reason">{{ row.preview.conflict.reason }}</span>
                @if (row.decision === 'move' && row.destination) {
                  <span class="occ-destination">
                    <mat-icon>east</mat-icon>
                    {{ formatDate(row.destination.date) }}
                    {{ row.destination.startTime }}–{{ row.destination.endTime }}
                    @if (row.destination.operatorName) {
                      <span class="dest-operator">· {{ row.destination.operatorName }}</span>
                    }
                  </span>
                }
              </div>

              <mat-button-toggle-group class="occ-actions"
                                       [value]="row.decision"
                                       (change)="onDecision(i, $event.value)"
                                       hideSingleSelectionIndicator>
                <!-- Una sovrapposizione non è forzabile: due pazienti nello
                     stesso slot sono un errore di dato, non una scelta. -->
                @if (allowConfirm && row.preview.conflict.type !== 'overlap') {
                  <mat-button-toggle value="confirm"
                                     matTooltip="Crealo comunque in questo orario">
                    <mat-icon>check</mat-icon>
                  </mat-button-toggle>
                }
                <mat-button-toggle value="move" matTooltip="Spostalo altrove">
                  <mat-icon>swap_horiz</mat-icon>
                </mat-button-toggle>
                <mat-button-toggle value="skip" matTooltip="Non crearlo">
                  <mat-icon>block</mat-icon>
                </mat-button-toggle>
              </mat-button-toggle-group>
            </div>

            <!-- Pannello spostamento della riga -->
            @if (row.decision === 'move') {
              <div class="move-panel">
                <div class="move-controls">
                  <span class="move-label">Cerca slot</span>
                  <mat-button-toggle-group [value]="spanFor(i)"
                                           (change)="onSpanChange(i, $event.value)"
                                           hideSingleSelectionIndicator
                                           class="span-toggle">
                    <mat-button-toggle [value]="0">Solo quel giorno</mat-button-toggle>
                    <mat-button-toggle [value]="1">± 1 g</mat-button-toggle>
                    <mat-button-toggle [value]="3">± 3 g</mat-button-toggle>
                    <mat-button-toggle [value]="7">± 7 g</mat-button-toggle>
                  </mat-button-toggle-group>

                  <mat-checkbox [checked]="otherOperatorsFor(i)"
                                (change)="onOtherOperatorsChange(i, $event.checked)">
                    Anche altri operatori
                  </mat-checkbox>
                </div>

                @if (isLoadingSlots(i)) {
                  <div class="move-state"><mat-spinner diameter="22"></mat-spinner></div>
                } @else if (slotsFor(i).length === 0) {
                  <div class="move-state hint">
                    Nessuno slot libero con questi criteri. Allarga la ricerca ai giorni
                    vicini, prova con altri operatori, oppure indica tu data e ora qui sotto.
                  </div>
                } @else {
                  <div class="slot-grid">
                    @for (slot of slotsFor(i); track slot.date + slot.startTime + slot.operatorId) {
                      <button class="slot-chip"
                              type="button"
                              [class.selected]="isSelectedSlot(row, slot)"
                              [class.other-operator]="!slot.isOriginalOperator"
                              (click)="onPickSlot(i, slot)">
                        <span class="slot-day">{{ formatShortDate(slot.date) }}</span>
                        <span class="slot-time">{{ slot.startTime }}</span>
                        @if (!slot.isOriginalOperator) {
                          <span class="slot-op">{{ slot.operatorName }}</span>
                        }
                      </button>
                    }
                  </div>
                }

                <div class="manual-move">
                  <span class="move-label">Oppure a mano</span>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="manual-field">
                    <mat-label>Data</mat-label>
                    <input matInput type="date"
                           [ngModel]="row.destination?.date ?? row.preview.date"
                           (ngModelChange)="onManualChange(i, { date: $event })">
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="manual-field">
                    <mat-label>Ora</mat-label>
                    <input matInput type="time"
                           [ngModel]="row.destination?.startTime ?? row.preview.startTime"
                           (ngModelChange)="onManualChange(i, { startTime: $event })">
                  </mat-form-field>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .resolution-list { display: flex; flex-direction: column; gap: 8px; }

    .clean-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 8px;
      color: #047857;
      font-size: 0.82rem;
    }
    .clean-summary mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .occ-row {
      border: 1px solid #fed7aa;
      border-radius: 8px;
      background: #fffbeb;
      padding: 8px 10px;
    }
    .occ-row.confirmed { border-color: #bfdbfe; background: #eff6ff; }
    .occ-row.moved { border-color: #a7f3d0; background: #f0fdf4; }
    .occ-row.skipped { border-color: #e2e8f0; background: #f8fafc; opacity: 0.72; }

    .occ-head { display: flex; align-items: flex-start; gap: 8px; }
    .occ-icon { color: #d97706; font-size: 20px; width: 20px; height: 20px; flex: 0 0 auto; }
    .occ-icon.overlap { color: #dc2626; }

    .occ-when { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .occ-date { font-weight: 600; font-size: 0.85rem; color: #1e293b; text-transform: capitalize; }
    .occ-time { font-size: 0.8rem; color: #475569; }
    .occ-reason { font-size: 0.76rem; color: #92400e; }
    .occ-destination {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.78rem;
      color: #047857;
      font-weight: 500;
      margin-top: 2px;
    }
    .occ-destination mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .dest-operator { font-weight: 400; }

    .occ-actions { flex: 0 0 auto; height: 30px; }
    ::ng-deep .occ-actions .mat-button-toggle-label-content {
      line-height: 28px;
      padding: 0 8px;
    }
    ::ng-deep .occ-actions .mat-icon { font-size: 17px; width: 17px; height: 17px; }

    .move-panel {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .move-controls, .manual-move {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .move-label { font-size: 0.76rem; color: #64748b; font-weight: 600; }
    .span-toggle { height: 28px; }
    ::ng-deep .span-toggle .mat-button-toggle-label-content {
      line-height: 26px;
      font-size: 0.72rem;
      padding: 0 8px;
    }
    .manual-field { width: 140px; }

    .move-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px;
      font-size: 0.78rem;
      color: #64748b;
    }
    .move-state.hint { font-style: italic; text-align: center; }

    .slot-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .slot-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      padding: 4px 9px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      font-size: 0.76rem;
      color: #1e293b;
      line-height: 1.25;
    }
    .slot-chip:hover { border-color: #38bdf8; background: #f0f9ff; }
    .slot-chip.selected { border-color: #0284c7; background: #e0f2fe; font-weight: 600; }
    .slot-chip.other-operator { border-style: dashed; }
    .slot-day { text-transform: capitalize; color: #64748b; font-size: 0.7rem; }
    .slot-op { color: #7c3aed; font-size: 0.68rem; }
  `],
})
export class V3RecurringResolutionListComponent {
  @Input() resolutions: OccurrenceResolution[] = [];
  /** Falso dove confermare non è ammesso (modifica di una serie esistente). */
  @Input() allowConfirm = true;
  /** Slot proposti per riga, indicizzati per indice di riga. */
  @Input() slotsByRow: Record<number, MoveSlotOption[]> = {};
  @Input() loadingRows: Record<number, boolean> = {};
  @Input() spanByRow: Record<number, MoveSearchSpan> = {};
  @Input() otherOperatorsByRow: Record<number, boolean> = {};

  @Output() decisionChange = new EventEmitter<{ index: number; decision: OccurrenceDecision }>();
  @Output() destinationChange = new EventEmitter<{ index: number; destination: OccurrenceDestination }>();
  @Output() searchRequest = new EventEmitter<MoveSearchRequest>();

  get cleanCount(): number {
    return this.resolutions.filter(r => !r.preview.conflict).length;
  }

  slotsFor(index: number): MoveSlotOption[] {
    return this.slotsByRow[index] ?? [];
  }

  isLoadingSlots(index: number): boolean {
    return !!this.loadingRows[index];
  }

  spanFor(index: number): MoveSearchSpan {
    return this.spanByRow[index] ?? 0;
  }

  otherOperatorsFor(index: number): boolean {
    return !!this.otherOperatorsByRow[index];
  }

  onDecision(index: number, decision: OccurrenceDecision): void {
    this.decisionChange.emit({ index, decision });
  }

  onSpanChange(index: number, span: MoveSearchSpan): void {
    this.searchRequest.emit({
      index, span, includeOtherOperators: this.otherOperatorsFor(index),
    });
  }

  onOtherOperatorsChange(index: number, includeOtherOperators: boolean): void {
    this.searchRequest.emit({
      index, span: this.spanFor(index), includeOtherOperators,
    });
  }

  onPickSlot(index: number, slot: MoveSlotOption): void {
    this.destinationChange.emit({
      index,
      destination: {
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        operatorId: slot.isOriginalOperator ? undefined : slot.operatorId,
        operatorName: slot.isOriginalOperator ? undefined : slot.operatorName,
      },
    });
  }

  /**
   * Modifica manuale di data o ora. L'orario di fine segue quello di inizio
   * mantenendo la durata originale: chi sposta un appuntamento vuole
   * cambiarne la collocazione, non accorciarlo di nascosto.
   */
  onManualChange(index: number, patch: { date?: string; startTime?: string }): void {
    const row = this.resolutions[index];
    if (!row) return;
    const current = row.destination ?? {
      date: row.preview.date,
      startTime: row.preview.startTime,
      endTime: row.preview.endTime,
    };
    const startTime = patch.startTime ?? current.startTime;
    const durationMin = this.minutesBetween(row.preview.startTime, row.preview.endTime);
    this.destinationChange.emit({
      index,
      destination: {
        ...current,
        date: patch.date ?? current.date,
        startTime,
        endTime: this.addMinutes(startTime, durationMin),
      },
    });
  }

  isSelectedSlot(row: OccurrenceResolution, slot: MoveSlotOption): boolean {
    const d = row.destination;
    if (!d) return false;
    return d.date === slot.date
      && d.startTime === slot.startTime
      && (d.operatorId ?? '') === (slot.isOriginalOperator ? '' : slot.operatorId);
  }

  formatDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }

  formatShortDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  }

  private minutesBetween(start: string, end: string): number {
    return this.toMinutes(end) - this.toMinutes(start);
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  private addMinutes(time: string, minutes: number): string {
    const total = this.toMinutes(time) + minutes;
    const h = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const m = String(total % 60).padStart(2, '0');
    return `${h}:${m}`;
  }
}
