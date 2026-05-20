/**
 * Calendar V3 Toolbar Component
 * Layer 1: Dumb Component
 *
 * Barra unica compatta che accorpa la navigazione date (ex header v2)
 * e i controlli funzionali (ex toolbar v2) su una sola riga, per
 * ridurre l'ingombro verticale e mostrare piu' celle senza scroll.
 *
 * Layout: [< Oggi > data] | [Operatori/Palestre] | [Slot] | [Zoom] |
 *         [toggles] | [Lista attesa] | [Trattamenti] | [Giorno/Settimana]
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
import { CalendarV2ViewMode, CalendarV2ViewType } from '../../../calendar-v2/models/calendar-v2.model';

@Component({
  selector: 'app-calendar-v3-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatButtonToggleModule,
    MatSlideToggleModule, MatMenuModule, MatTooltipModule, FormsModule,
  ],
  template: `
    <div class="cal-bar">
      <!-- Navigazione date -->
      <div class="nav-group">
        <button mat-icon-button class="dense-icon-btn" (click)="prev.emit()" aria-label="Precedente">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <button mat-stroked-button class="today-btn" (click)="today.emit()">Oggi</button>
        <button mat-icon-button class="dense-icon-btn" (click)="next.emit()" aria-label="Successivo">
          <mat-icon>chevron_right</mat-icon>
        </button>
        <span class="date-label">{{ dateLabel }}</span>
      </div>

      <div class="bar-divider"></div>

      <!-- Mode toggle operatori/palestre -->
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

      <div class="bar-divider"></div>

      <!-- Slot duration -->
      <div class="slot-duration">
        <span class="bar-label">Slot</span>
        <mat-button-toggle-group [value]="slotDuration" (change)="slotDurationChange.emit(+$event.value)" hideSingleSelectionIndicator>
          @for (d of slotDurations; track d) {
            <mat-button-toggle [value]="d">{{ d }}'</mat-button-toggle>
          }
        </mat-button-toggle-group>
      </div>

      <div class="bar-divider"></div>

      <!-- Zoom -->
      <div class="zoom-controls">
        <button mat-icon-button class="dense-icon-btn" (click)="onZoomOut()" matTooltip="Zoom out" [disabled]="zoom <= 0.5">
          <mat-icon>zoom_out</mat-icon>
        </button>
        <span class="zoom-label">{{ zoom * 100 | number:'1.0-0' }}%</span>
        <button mat-icon-button class="dense-icon-btn" (click)="onZoomIn()" matTooltip="Zoom in" [disabled]="zoom >= 2">
          <mat-icon>zoom_in</mat-icon>
        </button>
      </div>

      <div class="bar-divider"></div>

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

      <div class="bar-divider"></div>

      <!-- Lista d'attesa -->
      <button mat-stroked-button class="action-btn" (click)="openWaitingList.emit()" matTooltip="Lista d'attesa">
        <mat-icon>list_alt</mat-icon>
        Lista d'attesa
      </button>

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

      <!-- Apri dialog Trattamenti -->
      <button mat-stroked-button class="action-btn" (click)="openTreatments.emit()" matTooltip="Trattamenti del giorno">
        <mat-icon>healing</mat-icon>
        Trattamenti
      </button>

      <!-- Spinge il toggle vista in fondo a destra -->
      <span class="bar-spacer"></span>

      <!-- Toggle vista giorno/settimana (ex header v2) -->
      <mat-button-toggle-group [value]="viewType" (change)="viewTypeChange.emit($event.value)" hideSingleSelectionIndicator>
        <mat-button-toggle value="daily">
          <mat-icon>view_day</mat-icon>
          Giorno
        </mat-button-toggle>
        <mat-button-toggle value="weekly">
          <mat-icon>view_week</mat-icon>
          Settimana
        </mat-button-toggle>
      </mat-button-toggle-group>
    </div>
  `,
  styles: [`
    .cal-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 12px;
      background: white;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      min-height: 40px;
    }

    .nav-group {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .bar-divider {
      width: 1px;
      height: 22px;
      background: #e2e8f0;
    }

    .bar-spacer {
      flex: 1 1 auto;
      min-width: 8px;
    }

    .bar-label {
      font-size: 0.7rem;
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      margin-right: 4px;
    }

    .date-label {
      font-size: 0.9rem;
      font-weight: 500;
      color: #1e293b;
      margin-left: 6px;
      text-transform: capitalize;
      white-space: nowrap;
    }

    .today-btn {
      font-size: 0.78rem;
      line-height: 28px;
      padding: 0 10px;
      min-width: 0;
    }

    .slot-duration {
      display: flex;
      align-items: center;
    }

    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .zoom-label {
      font-size: 0.75rem;
      color: #475569;
      min-width: 36px;
      text-align: center;
    }

    mat-slide-toggle {
      font-size: 0.75rem;
    }

    /* Bottoni icona compatti: 32px invece dei 40px default */
    .dense-icon-btn {
      width: 32px;
      height: 32px;
      line-height: 32px;
      padding: 0;
    }
    .dense-icon-btn .mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      line-height: 20px;
    }

    /* Bottoni testuali compatti */
    .action-btn {
      font-size: 0.78rem;
      line-height: 30px;
      padding: 0 10px;
      min-width: 0;
    }
    .action-btn .mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 4px;
    }

    /* Button-toggle compatti */
    ::ng-deep .cal-bar .mat-button-toggle-group {
      height: 30px;
      border-radius: 6px;
    }
    ::ng-deep .cal-bar .mat-button-toggle .mat-button-toggle-label-content {
      line-height: 30px;
      padding: 0 8px;
      font-size: 0.78rem;
    }
    ::ng-deep .cal-bar .mat-button-toggle .mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
      vertical-align: middle;
      margin-right: 3px;
    }
  `],
})
export class CalendarV3ToolbarComponent {
  // Navigazione date (ex header v2)
  @Input() dateLabel = '';

  // Controlli funzionali (ex toolbar v2)
  @Input() viewMode: CalendarV2ViewMode = 'operators';
  @Input() viewType: CalendarV2ViewType = 'daily';
  @Input() slotDuration = 45;
  @Input() zoom = 1;
  @Input() showWorkingHoursOnly = false;
  @Input() showWeekend = true;
  @Input() compactMode = true;

  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() today = new EventEmitter<void>();
  @Output() viewTypeChange = new EventEmitter<CalendarV2ViewType>();

  @Output() viewModeChange = new EventEmitter<CalendarV2ViewMode>();
  @Output() slotDurationChange = new EventEmitter<number>();
  @Output() zoomChange = new EventEmitter<number>();
  @Output() showWorkingHoursOnlyChange = new EventEmitter<boolean>();
  @Output() showWeekendChange = new EventEmitter<boolean>();
  @Output() compactModeChange = new EventEmitter<boolean>();
  @Output() openWaitingList = new EventEmitter<void>();
  @Output() openTreatments = new EventEmitter<void>();

  slotDurations = [15, 30, 45, 60];

  private static readonly ZOOM_STEP = 0.1;
  private static readonly ZOOM_MIN = 0.5;
  private static readonly ZOOM_MAX = 2;

  onZoomIn(): void {
    this.emitZoom(this.zoom + CalendarV3ToolbarComponent.ZOOM_STEP);
  }

  onZoomOut(): void {
    this.emitZoom(this.zoom - CalendarV3ToolbarComponent.ZOOM_STEP);
  }

  /** Arrotonda al 10% piu' vicino e applica i limiti min/max. */
  private emitZoom(value: number): void {
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.min(
      CalendarV3ToolbarComponent.ZOOM_MAX,
      Math.max(CalendarV3ToolbarComponent.ZOOM_MIN, rounded),
    );
    if (clamped !== this.zoom) {
      this.zoomChange.emit(clamped);
    }
  }
}
