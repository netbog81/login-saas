import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  ObjectiveWithProgress,
  getProgressColor,
  getProgressLabel
} from '../../models/objectives-tracking.model';

@Component({
  selector: 'app-objective-progress-item',
  standalone: true,
  imports: [
    CommonModule,
    MatSliderModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
  ],
  template: `
    <div class="objective-item" [class.completed]="isCompleted()">
      <div class="objective-info">
        <div class="objective-header">
          <mat-icon [class.completed]="isCompleted()">
            {{ isCompleted() ? 'check_circle' : 'radio_button_unchecked' }}
          </mat-icon>
          <span class="objective-description">{{ objective.descrizione }}</span>
        </div>

        <div class="progress-control">
          <span class="progress-label">{{ getProgressLabelText() }}</span>

          @if (!readonly) {
            <div class="slider-container">
              <mat-slider
                [min]="0"
                [max]="5"
                [step]="1"
                [discrete]="true"
                [showTickMarks]="true"
                class="progress-slider">
                <input matSliderThumb
                       [value]="pendingLevel()"
                       (valueChange)="onSliderChange($event)">
              </mat-slider>
            </div>
            <button mat-icon-button
                    class="confirm-btn"
                    [class.active]="hasChanged()"
                    matTooltip="Conferma modifica"
                    [disabled]="!hasChanged()"
                    (click)="onConfirm()">
              <mat-icon>check</mat-icon>
            </button>
          } @else {
            <div class="progress-bar-container">
              <div class="progress-bar">
                <div class="progress-fill"
                     [style.width.%]="(objective.progressLevel / 5) * 100"
                     [style.background-color]="getProgressBarColor()">
                </div>
              </div>
              <span class="progress-value">{{ objective.progressLevel }}/5</span>
            </div>
          }
        </div>

        @if (objective.progressHistory?.length) {
          <button mat-button class="history-btn" (click)="viewHistory.emit()">
            <mat-icon>history</mat-icon>
            {{ objective.progressHistory.length }} aggiornament{{ objective.progressHistory.length === 1 ? 'o' : 'i' }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .objective-item {
      padding: 12px 16px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      transition: all 0.2s ease;

      &:hover {
        border-color: #cbd5e1;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }

      &.completed {
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border-color: #86efac;
      }
    }

    .objective-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 12px;

      mat-icon {
        color: #94a3b8;
        margin-top: 2px;

        &.completed {
          color: #22c55e;
        }
      }

      .objective-description {
        flex: 1;
        font-size: 0.9375rem;
        color: #334155;
        line-height: 1.5;
      }
    }

    .progress-control {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;

      .progress-label {
        font-size: 0.8125rem;
        color: #64748b;
        min-width: 100px;
      }

      .slider-container {
        flex: 1;
        min-width: 150px;
        max-width: 250px;
      }

      .progress-slider {
        width: 100%;
      }

      .confirm-btn {
        color: #94a3b8;
        transition: all 0.2s ease;

        &.active {
          color: #22c55e;
          background: #f0fdf4;
        }

        &:disabled {
          opacity: 0.5;
        }
      }
    }

    .progress-bar-container {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;

      .progress-bar {
        flex: 1;
        height: 8px;
        background: #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
        max-width: 200px;

        .progress-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
      }

      .progress-value {
        font-size: 0.8125rem;
        font-weight: 500;
        color: #64748b;
        min-width: 30px;
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
      .progress-control {
        flex-direction: column;
        align-items: stretch;

        .slider-container {
          max-width: none;
        }

        .confirm-btn {
          align-self: flex-end;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ObjectiveProgressItemComponent {
  @Input() objective!: ObjectiveWithProgress;
  @Input() readonly = false;

  @Output() progressChange = new EventEmitter<{ newLevel: number; note?: string }>();
  @Output() viewHistory = new EventEmitter<void>();

  pendingLevel = signal<number>(0);
  private initialized = false;

  ngOnChanges(): void {
    if (this.objective && !this.initialized) {
      this.pendingLevel.set(this.objective.progressLevel);
      this.initialized = true;
    }
  }

  isCompleted(): boolean {
    return this.objective.progressLevel === 5;
  }

  hasChanged(): boolean {
    return this.pendingLevel() !== this.objective.progressLevel;
  }

  getProgressLabelText(): string {
    return getProgressLabel(this.pendingLevel());
  }

  getProgressBarColor(): string {
    return getProgressColor(this.objective.progressLevel);
  }

  onSliderChange(value: number): void {
    this.pendingLevel.set(value);
  }

  onConfirm(): void {
    if (this.hasChanged()) {
      this.progressChange.emit({ newLevel: this.pendingLevel() });
      // Note: Non resettiamo pendingLevel qui, lo farà il parent dopo il salvataggio
    }
  }
}
