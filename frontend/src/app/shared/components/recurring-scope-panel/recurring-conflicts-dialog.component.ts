import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RecurringOccurrenceConflict } from '../../../services/availability-appointment.service';

export interface RecurringConflictsDialogData {
  title?: string;
  /** Testo introduttivo custom (default: wording avvisa-e-blocca). */
  intro?: string;
  conflicts: RecurringOccurrenceConflict[];
}

/**
 * Riepilogo conflitti su una serie ricorrente (occorrenze fuori disponibilità
 * o sovrapposte). Mostrato quando una modifica/creazione viene BLOCCATA.
 */
@Component({
  selector: 'app-recurring-conflicts-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="conflict-title">
      <mat-icon>error_outline</mat-icon>
      {{ data.title || 'Conflitti rilevati' }}
    </h2>
    <mat-dialog-content>
      <p class="intro">{{ introText }}</p>
      <div class="conflict-list">
        @for (c of data.conflicts; track c.date + c.startTime) {
          <div class="conflict-row" [class.overlap]="c.type === 'overlap'" [class.unavailable]="c.type === 'unavailable'">
            <mat-icon>{{ c.type === 'overlap' ? 'event_busy' : 'block' }}</mat-icon>
            <div class="conflict-text">
              <span class="conflict-when">{{ formatDate(c.date) }} · {{ c.startTime }}–{{ c.endTime }}</span>
              <span class="conflict-reason">{{ c.reason }}</span>
            </div>
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" (click)="ref.close()">Ho capito</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .conflict-title { display: flex; align-items: center; gap: 8px; color: #b91c1c; }
    .intro { font-size: 0.85rem; color: #475569; margin: 0 0 10px; }
    .conflict-list { display: flex; flex-direction: column; gap: 6px; max-height: 50vh; overflow: auto; }
    .conflict-row {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 8px 10px; border-radius: 6px; background: #fef2f2;
      border-left: 3px solid #ef4444;
    }
    .conflict-row.unavailable { background: #fffbeb; border-left-color: #f59e0b; }
    .conflict-row mat-icon { color: #b91c1c; font-size: 20px; width: 20px; height: 20px; }
    .conflict-row.unavailable mat-icon { color: #b45309; }
    .conflict-text { display: flex; flex-direction: column; }
    .conflict-when { font-weight: 600; font-size: 0.8rem; color: #1e293b; }
    .conflict-reason { font-size: 0.75rem; color: #64748b; }
  `],
})
export class RecurringConflictsDialogComponent {
  constructor(
    public ref: MatDialogRef<RecurringConflictsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RecurringConflictsDialogData,
  ) {}

  get introText(): string {
    if (this.data.intro) return this.data.intro;
    const n = this.data.conflicts.length;
    return `L'operazione è stata annullata: ${n} ${n === 1 ? 'occorrenza è in conflitto' : 'occorrenze sono in conflitto'}. ` +
      'Modifica gli orari o gli appuntamenti coinvolti e riprova.';
  }

  formatDate(d: string): string {
    const dt = new Date(d + 'T00:00:00');
    if (isNaN(dt.getTime())) return d;
    const s = dt.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
