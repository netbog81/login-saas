/**
 * Appointment Paste Bar Component
 * Layer 1: Dumb Component
 *
 * Banner fluttuante mostrato durante il flusso copia/incolla appuntamento.
 *
 * Due stati visivi guidati dall'input `phase`:
 * - 'selecting' → invita a cliccare l'appuntamento da copiare;
 * - 'pasting'   → mostra il riepilogo dell'appuntamento copiato e invita a
 *                 scegliere uno slot (click) o a trascinare la chip (drag).
 *
 * Niente logica di business: solo Input (riepilogo/fase) e Output
 * (cancel/dragStarted/dragEnded). La gestione del flusso e' nel container.
 *
 * Responsivo: barra in alto su desktop, compatta su schermi stretti.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { ClipboardPhase } from '../../services/appointment-clipboard.service';

@Component({
  selector: 'app-appointment-paste-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, DragDropModule],
  template: `
    <div class="paste-bar" [class.paste-bar-selecting]="phase === 'selecting'">
      <mat-icon class="lead-icon">content_copy</mat-icon>

      @if (phase === 'selecting') {
        <div class="paste-text">
          <span class="paste-title">Modalità copia attiva</span>
          <span class="paste-hint">Clicca l'appuntamento da copiare</span>
        </div>
      } @else if (phase === 'pasting') {
        <!-- Chip trascinabile: rappresenta l'appuntamento copiato. Su slot
             validi (drop-target nella griglia) il rilascio crea il nuovo
             appuntamento. Su touch resta primario il click sullo slot. -->
        <div class="paste-chip"
             cdkDrag
             [cdkDragData]="'paste-appointment'"
             (cdkDragStarted)="dragStarted.emit()"
             (cdkDragEnded)="onDragEnded($event)"
             matTooltip="Trascina su uno slot disponibile">
          <mat-icon class="drag-handle">drag_indicator</mat-icon>
          <span class="chip-summary">{{ summary }}</span>
          <div class="chip-drag-preview" *cdkDragPreview>
            <mat-icon>event</mat-icon>
            <span>{{ summary }}</span>
          </div>
        </div>
        <span class="paste-hint">Clicca uno slot evidenziato o trascina qui</span>
      }

      <span class="spacer"></span>

      <button mat-stroked-button class="cancel-btn" (click)="cancel.emit()" type="button"
              matTooltip="Annulla copia (Esc)">
        <mat-icon>close</mat-icon>
        Annulla
      </button>
    </div>
  `,
  styles: [`
    .paste-bar {
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: calc(100% - 24px);
      padding: 8px 12px;
      background: #1e293b;
      color: white;
      border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
      animation: paste-bar-in 0.18s ease-out;
    }

    @keyframes paste-bar-in {
      from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .paste-bar-selecting {
      background: #4338ca;
    }

    .lead-icon {
      flex: 0 0 auto;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .paste-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .paste-title {
      font-size: 0.82rem;
      font-weight: 600;
    }

    .paste-hint {
      font-size: 0.72rem;
      opacity: 0.85;
      white-space: nowrap;
    }

    /* Chip trascinabile con il riepilogo dell'appuntamento copiato. */
    .paste-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.14);
      border: 1px dashed rgba(255, 255, 255, 0.5);
      border-radius: 8px;
      cursor: grab;
      user-select: none;
    }
    .paste-chip:active { cursor: grabbing; }

    .drag-handle {
      font-size: 18px;
      width: 18px;
      height: 18px;
      opacity: 0.8;
    }

    .chip-summary {
      font-size: 0.8rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 320px;
    }

    /* Preview trascinata sotto il cursore. */
    .chip-drag-preview {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #1e293b;
      color: white;
      border-radius: 8px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
      font-size: 0.8rem;
      font-weight: 600;
    }
    .chip-drag-preview mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .spacer { flex: 1 1 auto; min-width: 8px; }

    .cancel-btn {
      flex: 0 0 auto;
      color: white;
      border-color: rgba(255, 255, 255, 0.4);
      line-height: 30px;
      font-size: 0.78rem;
    }
    .cancel-btn .mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 2px;
    }

    /* Responsivo: su schermi stretti nasconde l'hint testuale e accorcia. */
    @media (max-width: 640px) {
      .paste-bar {
        top: auto;
        bottom: 12px;
        gap: 8px;
        padding: 6px 10px;
      }
      .paste-hint { display: none; }
      .chip-summary { max-width: 150px; }
    }
  `],
})
export class AppointmentPasteBarComponent {
  /** Fase del flusso: 'selecting' o 'pasting' (mai 'idle': il banner non si mostra). */
  @Input() phase: ClipboardPhase = 'idle';
  /** Riepilogo dell'appuntamento copiato (es. "Mario Rossi · 60 min · 1 strumento"). */
  @Input() summary = '';

  /** Annulla il flusso copia/incolla. */
  @Output() cancel = new EventEmitter<void>();
  /** Inizio trascinamento della chip (per evidenziare gli slot droppabili). */
  @Output() dragStarted = new EventEmitter<void>();
  /**
   * Fine trascinamento della chip: emette le coordinate del punto di rilascio,
   * con cui il container fa l'hit-test dello slot bersaglio nella griglia.
   */
  @Output() dragEnded = new EventEmitter<{ x: number; y: number }>();

  onDragEnded(event: CdkDragEnd): void {
    // reset() riporta la chip nel banner: il drop "vero" e' un evento logico
    // (incolla nello slot), non uno spostamento DOM della chip.
    const point = event.dropPoint;
    event.source.reset();
    this.dragEnded.emit({ x: point.x, y: point.y });
  }
}
