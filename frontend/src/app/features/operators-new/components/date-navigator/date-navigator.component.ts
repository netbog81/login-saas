/**
 * Date Navigator Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare data selezionata
 * - Navigazione giorno precedente/successivo
 * - Pulsante "Oggi"
 * - NON gestisce logica business
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-date-navigator',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    DatePipe
  ],
  template: `
    <div class="date-navigator">
      <!-- Previous day -->
      <button
        mat-icon-button
        matTooltip="Giorno precedente"
        (click)="onPreviousDay()"
        [disabled]="disabled">
        <mat-icon>chevron_left</mat-icon>
      </button>

      <!-- Current date display -->
      <div class="date-display" (click)="onDateClick()">
        <span class="day-name">{{ getDayName(selectedDate) }}</span>
        <span class="date-value">{{ selectedDate | date:'d MMMM yyyy':'':'it' }}</span>
      </div>

      <!-- Next day -->
      <button
        mat-icon-button
        matTooltip="Giorno successivo"
        (click)="onNextDay()"
        [disabled]="disabled">
        <mat-icon>chevron_right</mat-icon>
      </button>

      <!-- Today button -->
      <button
        mat-stroked-button
        class="today-btn"
        matTooltip="Vai a oggi"
        (click)="onTodayClick()"
        [disabled]="disabled || isToday">
        Oggi
      </button>
    </div>
  `,
  styles: [`
    .date-navigator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    button[mat-icon-button] {
      color: rgba(255, 255, 255, 0.9);

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
      }

      &:disabled {
        color: rgba(255, 255, 255, 0.3);
      }

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
    }

    .date-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.25rem 1rem;
      cursor: pointer;
      border-radius: 8px;
      transition: background 0.2s;
      min-width: 160px;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }

    .day-name {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
      color: rgba(255, 255, 255, 0.8);
    }

    .date-value {
      font-size: 1rem;
      font-weight: 500;
      color: white;
    }

    .today-btn {
      margin-left: 0.5rem;
      color: white;
      border-color: rgba(255, 255, 255, 0.5);

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.7);
      }

      &:disabled {
        color: rgba(255, 255, 255, 0.3);
        border-color: rgba(255, 255, 255, 0.2);
      }
    }

    @media (max-width: 599px) {
      .date-display {
        min-width: auto;
        padding: 0.25rem 0.5rem;
      }

      .day-name {
        display: none;
      }

      .today-btn {
        display: none;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateNavigatorComponent {
  @Input() selectedDate: Date = new Date();
  @Input() disabled = false;

  @Output() dateChange = new EventEmitter<Date>();
  @Output() todayClick = new EventEmitter<void>();

  private dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  get isToday(): boolean {
    const today = new Date();
    return this.isSameDay(this.selectedDate, today);
  }

  getDayName(date: Date): string {
    return this.dayNames[date.getDay()];
  }

  onPreviousDay(): void {
    const newDate = new Date(this.selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    this.dateChange.emit(newDate);
  }

  onNextDay(): void {
    const newDate = new Date(this.selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    this.dateChange.emit(newDate);
  }

  onTodayClick(): void {
    this.todayClick.emit();
    this.dateChange.emit(new Date());
  }

  onDateClick(): void {
    // TODO: Aprire date picker
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }
}
