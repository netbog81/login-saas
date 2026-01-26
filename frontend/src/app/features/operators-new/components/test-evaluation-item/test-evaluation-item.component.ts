import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import {
  TestWithEvaluations,
  getProgressLabel
} from '../../models/objectives-tracking.model';

@Component({
  selector: 'app-test-evaluation-item',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSliderModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <div class="test-item" [class.evaluated]="hasEvaluation()">
      <div class="test-info">
        <div class="test-header">
          <mat-icon [class.evaluated]="hasEvaluation()">
            {{ hasEvaluation() ? 'check_circle' : 'radio_button_unchecked' }}
          </mat-icon>
          <span class="test-name">{{ test.nome }}</span>

          <!-- Pulsante cancella - solo se canDelete=true -->
          @if (!readonly && canDelete) {
            <button mat-icon-button
                    class="delete-btn"
                    matTooltip="Elimina test"
                    (click)="onDelete()">
              <mat-icon>delete</mat-icon>
            </button>
          }
        </div>

        @if (!readonly) {
          <div class="evaluation-control">
            <!-- CASO 1: Nessuna valutazione ancora - mostra slider + Conferma -->
            @if (!hasEvaluation() && !isEditing() && !isAddingEvaluation()) {
              <div class="first-evaluation">
                <span class="evaluation-label">Valutazione:</span>
                <div class="slider-row">
                  <mat-slider [min]="0" [max]="5" [step]="1" [discrete]="true" [showTickMarks]="true">
                    <input matSliderThumb [value]="pendingLevel()" (valueChange)="pendingLevel.set($event)">
                  </mat-slider>
                  <span class="level-display">{{ pendingLevel() }}/5</span>
                </div>
                <mat-form-field appearance="outline" class="note-field">
                  <mat-label>Note (opzionale)</mat-label>
                  <textarea matInput [(ngModel)]="pendingNote" rows="2"></textarea>
                </mat-form-field>
                <div class="action-buttons">
                  <button mat-flat-button color="primary"
                          matTooltip="Conferma valutazione"
                          [disabled]="pendingLevel() === 0"
                          (click)="confirmEvaluation()">
                    <mat-icon>check</mat-icon>
                    Conferma
                  </button>
                </div>
              </div>
            }

            <!-- CASO 2: Ha valutazione - mostra valore + azioni -->
            @if (hasEvaluation() && !isEditing() && !isAddingEvaluation()) {
              <div class="evaluated-display">
                <div class="current-value">
                  <span class="label">Valutazione attuale:</span>
                  <span class="value">{{ test.currentLevel }}/5</span>
                  <span class="date">({{ formatDate(getLastEvaluationDate()) }})</span>
                </div>
                <div class="action-buttons">
                  <button mat-stroked-button (click)="startEdit()">
                    <mat-icon>edit</mat-icon>
                    Modifica
                  </button>
                  <button mat-stroked-button color="primary" (click)="startAddEvaluation()">
                    <mat-icon>refresh</mat-icon>
                    Ripeti Test
                  </button>
                  <button mat-icon-button
                          matTooltip="Reset valutazione"
                          (click)="onReset()">
                    <mat-icon>restart_alt</mat-icon>
                  </button>
                </div>
              </div>
            }

            <!-- CASO 3: Modalità modifica voto esistente -->
            @if (isEditing()) {
              <div class="edit-evaluation">
                <span class="evaluation-label">Modifica valutazione:</span>
                <div class="slider-row">
                  <mat-slider [min]="0" [max]="5" [step]="1" [discrete]="true" [showTickMarks]="true">
                    <input matSliderThumb [value]="pendingLevel()" (valueChange)="pendingLevel.set($event)">
                  </mat-slider>
                  <span class="level-display">{{ pendingLevel() }}/5</span>
                </div>
                <mat-form-field appearance="outline" class="note-field">
                  <mat-label>Note (opzionale)</mat-label>
                  <textarea matInput [(ngModel)]="pendingNote" rows="2"></textarea>
                </mat-form-field>
                <div class="action-buttons">
                  <button mat-button (click)="cancelEdit()">Annulla</button>
                  <button mat-flat-button color="primary"
                          [disabled]="pendingLevel() === 0"
                          (click)="confirmEdit()">
                    Salva
                  </button>
                </div>
              </div>
            }

            <!-- CASO 4: Form ripetizione test (nuova valutazione con storico) -->
            @if (isAddingEvaluation()) {
              <div class="repeat-evaluation-form">
                <div class="slider-row">
                  <span>Nuova valutazione:</span>
                  <mat-slider [min]="0" [max]="5" [step]="1" [discrete]="true" [showTickMarks]="true">
                    <input matSliderThumb [value]="pendingLevel()" (valueChange)="pendingLevel.set($event)">
                  </mat-slider>
                  <span class="level-display">{{ pendingLevel() }}/5</span>
                </div>
                <mat-form-field appearance="outline" class="note-field">
                  <mat-label>Note (opzionale)</mat-label>
                  <textarea matInput [(ngModel)]="pendingNote" rows="2"></textarea>
                </mat-form-field>
                <div class="form-actions">
                  <button mat-button (click)="cancelEvaluation()">Annulla</button>
                  <button mat-flat-button color="primary"
                          [disabled]="pendingLevel() === 0"
                          (click)="confirmEvaluation()">
                    Salva Valutazione
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- Readonly mode -->
          @if (hasEvaluation()) {
            <div class="readonly-display">
              <span class="label">Valutazione:</span>
              <span class="value">{{ test.currentLevel }}/5</span>
            </div>
          } @else {
            <div class="readonly-display not-evaluated">
              <span class="label">Non ancora valutato</span>
            </div>
          }
        }

        @if (test.evaluationHistory?.length) {
          <button mat-button class="history-btn" (click)="viewHistory.emit()">
            <mat-icon>history</mat-icon>
            {{ test.evaluationHistory.length }} valutazion{{ test.evaluationHistory.length === 1 ? 'e' : 'i' }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .test-item {
      padding: 12px 16px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      transition: all 0.2s ease;

      &:hover {
        border-color: #cbd5e1;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }

      &.evaluated {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-color: #93c5fd;
      }
    }

    .test-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;

      mat-icon {
        color: #94a3b8;

        &.evaluated {
          color: #3b82f6;
        }
      }

      .test-name {
        flex: 1;
        font-size: 0.9375rem;
        font-weight: 500;
        color: #334155;
      }

      .delete-btn {
        color: #94a3b8;
        opacity: 0;
        transition: opacity 0.2s ease;

        &:hover {
          color: #ef4444;
        }
      }
    }

    .test-item:hover .delete-btn {
      opacity: 1;
    }

    .evaluation-control {
      margin-top: 8px;
    }

    .first-evaluation,
    .edit-evaluation,
    .repeat-evaluation-form {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .note-field {
        width: 100%;
      }
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 12px;

      mat-slider {
        flex: 1;
        max-width: 250px;
      }

      .level-display {
        font-weight: 500;
        color: #334155;
        min-width: 40px;
      }
    }

    .evaluation-label {
      font-size: 0.8125rem;
      color: #64748b;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      button {
        font-size: 0.8125rem;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
    }

    .evaluated-display {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .current-value {
        display: flex;
        align-items: baseline;
        gap: 8px;

        .label {
          font-size: 0.8125rem;
          color: #64748b;
        }

        .value {
          font-size: 1.25rem;
          font-weight: 600;
          color: #3b82f6;
        }

        .date {
          font-size: 0.75rem;
          color: #94a3b8;
        }
      }
    }

    .repeat-evaluation-form {
      background: #f8fafc;
      padding: 12px;
      border-radius: 8px;
      margin-top: 8px;

      .note-field {
        width: 100%;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    }

    .readonly-display {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;

      .label {
        font-size: 0.8125rem;
        color: #64748b;
      }

      .value {
        font-size: 1.125rem;
        font-weight: 600;
        color: #3b82f6;
      }

      &.not-evaluated {
        .label {
          font-style: italic;
          color: #94a3b8;
        }
      }
    }

    .history-btn {
      margin-top: 8px;
      font-size: 0.75rem;
      color: #64748b;
      padding: 0 8px;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-right: 4px;
      }
    }

    @media (max-width: 599px) {
      .slider-row {
        flex-wrap: wrap;

        mat-slider {
          max-width: none;
          width: 100%;
        }
      }

      .action-buttons {
        flex-direction: column;

        button {
          width: 100%;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TestEvaluationItemComponent {
  @Input() test!: TestWithEvaluations;
  @Input() readonly = false;
  @Input() canDelete = false;
  @Input() anamnesisId = '';

  @Output() addEvaluation = new EventEmitter<{ level: number; note?: string }>();
  @Output() editEvaluation = new EventEmitter<{ level: number; note?: string }>();
  @Output() resetEvaluation = new EventEmitter<void>();
  @Output() deleteTest = new EventEmitter<void>();
  @Output() viewHistory = new EventEmitter<void>();

  isAddingEvaluation = signal(false);
  isEditing = signal(false);
  pendingLevel = signal(0);
  pendingNote = '';

  hasEvaluation(): boolean {
    return (this.test.evaluationHistory?.length ?? 0) > 0;
  }

  getLastEvaluationDate(): Date | null {
    return this.test.evaluationHistory?.[0]?.createdAt ?? null;
  }

  // === Prima valutazione / Ripetizione ===
  confirmEvaluation(): void {
    this.addEvaluation.emit({
      level: this.pendingLevel(),
      note: this.pendingNote || undefined
    });
    this.resetForm();
  }

  // === Modifica voto esistente ===
  startEdit(): void {
    this.isEditing.set(true);
    this.pendingLevel.set(this.test.currentLevel);
    // Precarica note dell'ultima valutazione se presente
    this.pendingNote = this.test.evaluationHistory?.[0]?.note || '';
  }

  cancelEdit(): void {
    this.isEditing.set(false);
    this.pendingLevel.set(0);
    this.pendingNote = '';
  }

  confirmEdit(): void {
    this.editEvaluation.emit({
      level: this.pendingLevel(),
      note: this.pendingNote || undefined
    });
    this.cancelEdit();
  }

  // === Ripetizione test (aggiunge allo storico) ===
  startAddEvaluation(): void {
    this.isAddingEvaluation.set(true);
    this.pendingLevel.set(0);
    this.pendingNote = '';
  }

  cancelEvaluation(): void {
    this.isAddingEvaluation.set(false);
    this.pendingLevel.set(0);
    this.pendingNote = '';
  }

  // === Reset e Delete ===
  onReset(): void {
    this.resetEvaluation.emit();
  }

  onDelete(): void {
    this.deleteTest.emit();
  }

  private resetForm(): void {
    this.isAddingEvaluation.set(false);
    this.isEditing.set(false);
    this.pendingLevel.set(0);
    this.pendingNote = '';
  }

  formatDate(date: Date | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
}
