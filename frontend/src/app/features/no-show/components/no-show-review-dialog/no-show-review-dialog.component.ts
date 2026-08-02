import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
  NoShowDecision,
  NoShowEvent,
  eventTypeLabel,
} from '../../models/no-show.model';

export interface NoShowReviewDialogData {
  event: NoShowEvent;
}

export interface NoShowReviewDialogResult {
  decision: NoShowDecision;
  notes?: string;
  chargedAmount?: number | null;
  /** Rimuove la valutazione esistente e riporta l'evento a "da valutare". */
  clear?: boolean;
}

/**
 * Decisione dello staff su una singola assenza (componente dumb: restituisce
 * la scelta, non chiama nulla).
 *
 * Sta qui e non nel calendario di proposito: la decisione si prende
 * guardando lo storico del paziente, non davanti al singolo appuntamento.
 */
@Component({
  selector: 'app-no-show-review-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Valutazione assenza</h2>

    <mat-dialog-content>
      <div class="event-recap">
        <div class="line">
          <strong>{{ data.event.patientName }}</strong>
          <span class="badge">{{ typeLabel(data.event) }}</span>
        </div>
        <div class="line muted">
          {{ data.event.appointmentDate | date: 'EEEE dd/MM/yyyy' }} alle {{ data.event.startTime }}
          @if (data.event.operatorName) { · {{ data.event.operatorName }} }
          @if (data.event.gymRoomName) { · {{ data.event.gymRoomName }} }
        </div>
        @if (data.event.cancellationHoursNotice != null) {
          <div class="line muted">
            Preavviso: {{ data.event.cancellationHoursNotice | number: '1.0-1' }}h
            @if (data.event.cancellationReason) { — {{ data.event.cancellationReason }} }
          </div>
        }
        @if (data.event.serviceNames.length) {
          <div class="line muted">Servizi: {{ data.event.serviceNames.join(', ') }}</div>
        }
      </div>

      <div class="decisions">
        @for (option of options; track option.value) {
          <button
            type="button"
            class="decision"
            [class.active]="decision === option.value"
            [attr.data-decision]="option.value"
            (click)="decision = option.value">
            <mat-icon>{{ option.icon }}</mat-icon>
            <span class="label">{{ option.label }}</span>
            <span class="hint">{{ option.hint }}</span>
          </button>
        }
      </div>

      @if (decision === 'TO_CHARGE') {
        <label class="field">
          Importo da addebitare (€)
          <input type="number" min="0" step="0.01" [(ngModel)]="chargedAmount" placeholder="Facoltativo">
        </label>
      }

      <label class="field">
        Note
        <textarea rows="3" [(ngModel)]="notes" placeholder="Motivo della decisione, accordi presi col paziente…"></textarea>
      </label>

      @if (data.event.review?.decidedAt) {
        <div class="previous">
          Valutata il {{ data.event.review!.decidedAt | date: 'dd/MM/yyyy HH:mm' }}
          @if (data.event.review!.decidedByName) { da {{ data.event.review!.decidedByName }} }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (data.event.review) {
        <button mat-button class="clear-btn" (click)="clear()">
          <mat-icon>backspace</mat-icon> Rimuovi valutazione
        </button>
      }
      <button mat-button mat-dialog-close>Annulla</button>
      <button mat-flat-button color="primary" (click)="save()">Salva</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 440px; max-width: 560px; }
    .event-recap {
      background: #f7f7f8; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px;
      display: flex; flex-direction: column; gap: 3px;
    }
    .line { font-size: 13.5px; display: flex; align-items: center; gap: 8px; }
    .line.muted { color: rgba(0,0,0,0.6); font-size: 12.5px; }
    .badge {
      font-size: 11.5px; padding: 1px 8px; border-radius: 10px;
      background: #ffebee; color: #c62828;
    }

    .decisions { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; margin-bottom: 14px; }
    .decision {
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
      padding: 9px 11px; border: 1px solid rgba(0,0,0,0.16); border-radius: 6px;
      background: #fff; cursor: pointer; text-align: left; font: inherit;
    }
    .decision:hover { background: #fafafa; }
    .decision mat-icon { font-size: 19px; width: 19px; height: 19px; color: rgba(0,0,0,0.45); }
    .decision .label { font-size: 13.5px; font-weight: 500; }
    .decision .hint { font-size: 11.5px; color: rgba(0,0,0,0.5); }
    .decision.active { border-color: #3f51b5; background: #e8eaf6; }
    .decision.active mat-icon { color: #3f51b5; }
    .decision.active[data-decision="TO_CHARGE"] { border-color: #c62828; background: #ffebee; }
    .decision.active[data-decision="TO_CHARGE"] mat-icon { color: #c62828; }
    .decision.active[data-decision="WAIVED"] { border-color: #2e7d32; background: #e8f5e9; }
    .decision.active[data-decision="WAIVED"] mat-icon { color: #2e7d32; }
    .decision.active[data-decision="JUSTIFIED"] { border-color: #1565c0; background: #e3f2fd; }
    .decision.active[data-decision="JUSTIFIED"] mat-icon { color: #1565c0; }

    .field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: rgba(0,0,0,0.65); margin-bottom: 10px; }
    .field input, .field textarea {
      border: 1px solid rgba(0,0,0,0.24); border-radius: 4px; padding: 6px 8px;
      font: inherit; font-size: 13px; resize: vertical;
    }
    .previous { font-size: 11.5px; color: rgba(0,0,0,0.45); }
    .clear-btn { margin-right: auto; color: rgba(0,0,0,0.6); }
  `],
})
export class NoShowReviewDialogComponent {
  decision: NoShowDecision;
  notes: string;
  chargedAmount: number | null;

  readonly options: {
    value: NoShowDecision;
    label: string;
    hint: string;
    icon: string;
  }[] = [
    { value: 'PENDING', label: 'Da valutare', hint: 'Rimanda la decisione', icon: 'pending_actions' },
    { value: 'TO_CHARGE', label: 'Da addebitare', hint: 'Si fa pagare la seduta', icon: 'payments' },
    { value: 'WAIVED', label: 'Esonera', hint: 'Stavolta si soprassiede', icon: 'volunteer_activism' },
    { value: 'JUSTIFIED', label: 'Giustifica', hint: 'Non conta nei totali', icon: 'verified' },
  ];

  constructor(
    private readonly dialogRef: MatDialogRef<NoShowReviewDialogComponent, NoShowReviewDialogResult>,
    @Inject(MAT_DIALOG_DATA) public readonly data: NoShowReviewDialogData,
  ) {
    const review = data.event.review;
    this.decision = review?.decision ?? 'TO_CHARGE';
    this.notes = review?.notes ?? '';
    this.chargedAmount = review?.chargedAmount ?? null;
  }

  typeLabel(event: NoShowEvent): string {
    return eventTypeLabel(event.eventType);
  }

  save(): void {
    this.dialogRef.close({
      decision: this.decision,
      notes: this.notes?.trim() || undefined,
      chargedAmount: this.decision === 'TO_CHARGE' ? this.chargedAmount : null,
    });
  }

  clear(): void {
    this.dialogRef.close({ decision: 'PENDING', clear: true });
  }
}
