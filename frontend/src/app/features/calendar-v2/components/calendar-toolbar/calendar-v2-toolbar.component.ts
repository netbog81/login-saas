/**
 * Calendar V2 Toolbar Component
 * Layer 1: Dumb Component
 *
 * Controlli: slot duration, zoom, mode toggle (operatori/palestre),
 * working hours, weekend.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { CalendarV2ViewMode, CalendarV2ViewType } from '../../models/calendar-v2.model';

@Component({
  selector: 'app-calendar-v2-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatButtonToggleModule,
    MatSlideToggleModule, MatMenuModule, MatTooltipModule, FormsModule,
  ],
  template: `
    <div class="cal-toolbar">
      <!-- Mode toggle -->
      <mat-button-toggle-group [value]="viewMode" (change)="viewModeChange.emit($event.value)" hideSingleSelectionIndicator>
        <mat-button-toggle value="operators">
          <mat-icon>people</mat-icon>
          Operatori
        </mat-button-toggle>
        <mat-button-toggle value="gyms">
          <mat-icon>fitness_center</mat-icon>
          Palestre
        </mat-button-toggle>
      </mat-button-toggle-group>

      <div class="toolbar-divider"></div>

      <!-- Slot duration -->
      <div class="slot-duration">
        <span class="toolbar-label">Slot</span>
        <mat-button-toggle-group [value]="slotDuration" (change)="slotDurationChange.emit(+$event.value)" hideSingleSelectionIndicator>
          @for (d of slotDurations; track d) {
            <mat-button-toggle [value]="d">{{ d }}'</mat-button-toggle>
          }
        </mat-button-toggle-group>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Zoom -->
      <div class="zoom-controls">
        <button mat-icon-button (click)="onZoomOut()" matTooltip="Zoom out" [disabled]="zoom <= 0.5">
          <mat-icon>zoom_out</mat-icon>
        </button>
        <span class="zoom-label">{{ zoom * 100 | number:'1.0-0' }}%</span>
        <button mat-icon-button (click)="onZoomIn()" matTooltip="Zoom in" [disabled]="zoom >= 2">
          <mat-icon>zoom_in</mat-icon>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Toggles -->
      <mat-slide-toggle [ngModel]="showWorkingHoursOnly" (ngModelChange)="showWorkingHoursOnlyChange.emit($event)"
                        matTooltip="Mostra solo orario lavorativo">
        Orario lavoro
      </mat-slide-toggle>

      @if (viewType === 'weekly') {
        <mat-slide-toggle [ngModel]="showWeekend" (ngModelChange)="showWeekendChange.emit($event)"
                          matTooltip="Mostra sabato e domenica">
          Weekend
        </mat-slide-toggle>
      }

      <div class="toolbar-divider"></div>

      <!-- Lista d'attesa -->
      <button mat-stroked-button (click)="openWaitingList.emit()" matTooltip="Lista d'attesa">
        <mat-icon>list_alt</mat-icon>
        Lista d'attesa
      </button>

      <div class="toolbar-divider"></div>

      <!-- Toggle vista compatta/espansa -->
      <mat-button-toggle-group [value]="compactMode ? 'compact' : 'expanded'"
                               (change)="compactModeChange.emit($event.value === 'compact')"
                               hideSingleSelectionIndicator>
        <mat-button-toggle value="compact" matTooltip="Vista compatta: colonne adattive allo schermo">
          <mat-icon>view_compact</mat-icon>
        </mat-button-toggle>
        <mat-button-toggle value="expanded" matTooltip="Vista espansa: colonne fisse con scorrimento">
          <mat-icon>view_array</mat-icon>
        </mat-button-toggle>
      </mat-button-toggle-group>
    </div>
  `,
  styles: [`
    .cal-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 16px;
      background: white;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }

    .toolbar-divider {
      width: 1px;
      height: 28px;
      background: #e2e8f0;
    }

    .toolbar-label {
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      margin-right: 4px;
    }

    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .zoom-label {
      font-size: 0.8rem;
      color: #475569;
      min-width: 40px;
      text-align: center;
    }

    mat-slide-toggle {
      font-size: 0.8rem;
    }
  `],
})
export class CalendarV2ToolbarComponent {
  @Input() viewMode: CalendarV2ViewMode = 'operators';
  @Input() viewType: CalendarV2ViewType = 'daily';
  @Input() slotDuration = 45;
  @Input() zoom = 1;
  @Input() showWorkingHoursOnly = false;
  @Input() showWeekend = true;
  @Input() compactMode = true;

  @Output() viewModeChange = new EventEmitter<CalendarV2ViewMode>();
  @Output() slotDurationChange = new EventEmitter<number>();
  @Output() zoomChange = new EventEmitter<number>();
  @Output() showWorkingHoursOnlyChange = new EventEmitter<boolean>();
  @Output() showWeekendChange = new EventEmitter<boolean>();
  @Output() compactModeChange = new EventEmitter<boolean>();
  @Output() openWaitingList = new EventEmitter<void>();

  slotDurations = [15, 30, 45, 60];

  onZoomIn(): void {
    const steps = [0.5, 1, 1.5, 2];
    const idx = steps.indexOf(this.zoom);
    if (idx < steps.length - 1) {
      this.zoomChange.emit(steps[idx + 1]);
    }
  }

  onZoomOut(): void {
    const steps = [0.5, 1, 1.5, 2];
    const idx = steps.indexOf(this.zoom);
    if (idx > 0) {
      this.zoomChange.emit(steps[idx - 1]);
    }
  }
}
