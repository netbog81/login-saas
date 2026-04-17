/**
 * Calendar V2 Header Component
 * Layer 1: Dumb Component
 *
 * Navigazione date + toggle vista giornaliera/settimanale.
 * Solo @Input/@Output, nessun service iniettato.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CalendarV2ViewType } from '../../models/calendar-v2.model';

@Component({
  selector: 'app-calendar-v2-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatButtonToggleModule],
  template: `
    <div class="cal-header">
      <div class="cal-header-left">
        <button mat-icon-button (click)="prev.emit()" aria-label="Precedente">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <button mat-stroked-button class="today-btn" (click)="today.emit()">Oggi</button>
        <button mat-icon-button (click)="next.emit()" aria-label="Successivo">
          <mat-icon>chevron_right</mat-icon>
        </button>
        <span class="date-label">{{ dateLabel }}</span>
      </div>

      <div class="cal-header-right">
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
    </div>
  `,
  styles: [`
    .cal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: white;
      border-bottom: 1px solid #e2e8f0;
    }

    .cal-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .today-btn {
      font-size: 0.85rem;
    }

    .date-label {
      font-size: 1.05rem;
      font-weight: 500;
      color: #1e293b;
      margin-left: 8px;
      text-transform: capitalize;
    }

    .cal-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  `],
})
export class CalendarV2HeaderComponent {
  @Input() dateLabel = '';
  @Input() viewType: CalendarV2ViewType = 'daily';

  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() today = new EventEmitter<void>();
  @Output() viewTypeChange = new EventEmitter<CalendarV2ViewType>();
}
