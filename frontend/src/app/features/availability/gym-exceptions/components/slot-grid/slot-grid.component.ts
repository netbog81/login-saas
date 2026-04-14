import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule, MatChipListboxChange } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  OperatorSlotOnDate,
  AvailableOperator,
} from '../../../../../services/gym-exception.service';

/**
 * Identifica univocamente uno slot: combinazione di gymRoomId + fascia oraria.
 */
export function slotKey(slot: {
  gymRoomId: string;
  startTime: string;
  endTime: string;
}): string {
  return `${slot.gymRoomId}|${slot.startTime}|${slot.endTime}`;
}

/**
 * Valore sentinel usato nelle `assignments` per indicare che lo slot è
 * marcato come "Palestra chiusa" (substituteOperatorId NULL + isClosed true).
 * Il container traduce questo sentinel in `{substituteOperatorId: undefined,
 * isClosed: true}` quando costruisce il payload da inviare al backend.
 */
export const CLOSED_SLOT_VALUE = '__CLOSED__';

/**
 * Dumb component: griglia di slot-casella (una card per ogni slot originale
 * dell'operatore assente). Due modalità:
 *  - simpleMode=true: ogni card mostra solo un riepilogo readonly del
 *    sostituto unico assegnato (gestito dal container via Input assignments).
 *  - simpleMode=false ("mostra operatori disponibili"): ogni card mostra
 *    una lista di MatChip per ciascun operatore candidato, cliccabili per
 *    assegnare/disassegnare.
 */
@Component({
  selector: 'app-slot-grid',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slots-grid">
      <mat-card
        *ngFor="let slot of slots; trackBy: trackBySlot"
        class="slot-card"
        [class.covered]="isSlotCovered(slot)"
        [class.uncovered]="isSlotUncovered(slot)"
        [class.closed]="isSlotClosed(slot)"
      >
        <mat-card-header>
          <mat-card-title>{{ slot.gymRoom.name }}</mat-card-title>
          <mat-card-subtitle>
            {{ slot.startTime }} – {{ slot.endTime }}
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <!-- Modalità semplice: riepilogo readonly -->
          <ng-container *ngIf="simpleMode">
            <div *ngIf="isSlotCovered(slot)" class="assigned-summary">
              <mat-icon class="check">check_circle</mat-icon>
              <span>
                Sostituto:
                <strong>{{ getOperatorName(getAssignedId(slot)!) }}</strong>
              </span>
            </div>
            <div *ngIf="isSlotClosed(slot)" class="closed-summary">
              <mat-icon class="closed-icon">lock</mat-icon>
              <span>Palestra chiusa</span>
            </div>
            <div *ngIf="isSlotUncovered(slot)" class="uncovered-summary">
              <mat-icon class="warn">warning</mat-icon>
              <span>Nessun sostituto — slot scoperto</span>
            </div>
          </ng-container>

          <!-- Modalità "mostra operatori disponibili" -->
          <ng-container *ngIf="!simpleMode">
            <div
              *ngIf="isLoadingForSlot(slot)"
              class="loading"
            >
              <mat-icon>hourglass_empty</mat-icon>
              Caricamento candidati...
            </div>

            <ng-container *ngIf="!isLoadingForSlot(slot)">
              <mat-chip-listbox
                aria-label="Operatori disponibili"
                [value]="getAssignedId(slot)"
                (change)="onListboxChange(slot, $event)"
              >
                <mat-chip-option
                  [value]="CLOSED_VALUE"
                  class="closed-chip"
                >
                  <mat-icon class="closed-chip-icon">lock</mat-icon>
                  Palestra chiusa
                </mat-chip-option>
                <mat-chip-option
                  *ngFor="let op of getCandidatesForSlot(slot)"
                  [value]="op.id"
                  class="candidate-chip"
                >
                  {{ op.name }} {{ op.surname }}
                </mat-chip-option>
              </mat-chip-listbox>

              <div
                *ngIf="getCandidatesForSlot(slot).length === 0"
                class="no-candidates-hint"
              >
                <mat-icon class="warn">block</mat-icon>
                Nessun operatore libero in questa fascia
              </div>

              <div
                *ngIf="isSlotUncovered(slot)"
                class="slot-uncovered-hint"
              >
                <mat-icon class="warn">warning</mat-icon>
                Slot scoperto
              </div>
            </ng-container>
          </ng-container>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .slots-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }
      .slot-card {
        border-left: 4px solid transparent;
      }
      .slot-card.covered {
        border-left-color: #4caf50;
      }
      .slot-card.uncovered {
        border-left-color: #f44336;
      }
      .slot-card.closed {
        border-left-color: #607d8b;
        background: #eceff1;
      }
      .assigned-summary,
      .uncovered-summary,
      .closed-summary,
      .loading,
      .no-candidates-hint,
      .slot-uncovered-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
      }
      .assigned-summary .check {
        color: #4caf50;
      }
      .closed-summary .closed-icon {
        color: #607d8b;
      }
      .closed-summary {
        color: #455a64;
        font-weight: 500;
      }
      .warn {
        color: #f44336;
      }
      mat-chip-listbox {
        display: block;
      }
      .candidate-chip {
        cursor: pointer;
      }
      .closed-chip {
        cursor: pointer;
        --mdc-chip-elevated-container-color: #cfd8dc;
      }
      .closed-chip-icon {
        font-size: 16px;
        height: 16px;
        width: 16px;
        margin-right: 4px;
        vertical-align: middle;
      }
      .slot-uncovered-hint,
      .no-candidates-hint {
        margin-top: 8px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.54);
      }
    `,
  ],
})
export class SlotGridComponent {
  @Input() slots: OperatorSlotOnDate[] = [];

  /**
   * Mappa slotKey → substituteOperatorId | null (null = slot scoperto).
   */
  @Input() assignments: Record<string, string | null> = {};

  /**
   * Mappa slotKey → lista operatori candidati (solo in "slotMode").
   */
  @Input() candidatesBySlot: Record<string, AvailableOperator[]> = {};

  /**
   * Slot in fase di caricamento candidati (solo in "slotMode").
   */
  @Input() loadingSlots: Record<string, boolean> = {};

  /**
   * Mappa operatorId → label "Nome Cognome" per i sostituti assegnati
   * in modalità semplice (dove non ci sono candidati caricati).
   */
  @Input() operatorLabels: Record<string, string> = {};

  @Input() simpleMode = true;

  @Output() assignmentChange = new EventEmitter<{
    slotKey: string;
    substituteOperatorId: string | null;
  }>();

  /** Esposto al template per il chip "Palestra chiusa". */
  readonly CLOSED_VALUE = CLOSED_SLOT_VALUE;

  trackBySlot = (_: number, slot: OperatorSlotOnDate) =>
    slotKey({
      gymRoomId: slot.gymRoom.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });

  getKey(slot: OperatorSlotOnDate): string {
    return slotKey({
      gymRoomId: slot.gymRoom.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
  }

  getAssignedId(slot: OperatorSlotOnDate): string | null {
    const key = this.getKey(slot);
    return key in this.assignments ? this.assignments[key] : null;
  }

  /** True se lo slot ha un sostituto operatore attivo (non chiuso, non scoperto). */
  isSlotCovered(slot: OperatorSlotOnDate): boolean {
    const v = this.getAssignedId(slot);
    return !!v && v !== CLOSED_SLOT_VALUE;
  }

  /** True se lo slot è marcato esplicitamente come "Palestra chiusa". */
  isSlotClosed(slot: OperatorSlotOnDate): boolean {
    return this.getAssignedId(slot) === CLOSED_SLOT_VALUE;
  }

  /** True se lo slot è scoperto (nessun sostituto e non esplicitamente chiuso). */
  isSlotUncovered(slot: OperatorSlotOnDate): boolean {
    return this.getAssignedId(slot) === null;
  }

  getCandidatesForSlot(slot: OperatorSlotOnDate): AvailableOperator[] {
    return this.candidatesBySlot[this.getKey(slot)] || [];
  }

  isLoadingForSlot(slot: OperatorSlotOnDate): boolean {
    return !!this.loadingSlots[this.getKey(slot)];
  }

  getOperatorName(operatorId: string): string {
    return this.operatorLabels[operatorId] || operatorId;
  }

  /**
   * Handler del mat-chip-listbox: riceve MatChipListboxChange con `.value` che
   * è l'id del candidato selezionato, oppure undefined/null se l'utente
   * deseleziona (click sullo stesso chip già selezionato).
   */
  onListboxChange(slot: OperatorSlotOnDate, event: MatChipListboxChange): void {
    const key = this.getKey(slot);
    const next: string | null = event.value ?? null;
    this.assignmentChange.emit({ slotKey: key, substituteOperatorId: next });
  }
}
