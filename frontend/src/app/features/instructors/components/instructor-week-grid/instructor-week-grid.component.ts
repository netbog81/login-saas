/**
 * Instructor Week Grid Component
 * Layer 1: Dumb Component
 *
 * Responsabilità:
 * - Visualizzare griglia settimanale (colonne = giorni, righe = slot orari)
 * - Ogni cella mostra count pazienti + nome palestra
 * - Click su cella emette evento per navigare al giorno
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WeekDay, SlotGroup } from '../../models/instructor-workspace.model';

@Component({
  selector: 'app-instructor-week-grid',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="week-grid-container">
      <div class="week-grid">
        <!-- Header giorni -->
        <div class="grid-header">
          <div class="header-spacer"></div>
          @for (day of weekDays; track day.dateString) {
            <div class="header-day" [class.today]="day.isToday" [class.selected]="isSelected(day)">
              <span class="day-label">{{ day.dayLabel }}</span>
              @if (day.slots.length > 0) {
                <span class="day-count">{{ getTotalPatients(day) }} paz.</span>
              }
            </div>
          }
        </div>

        <!-- Righe per slot orario -->
        @for (timeSlot of uniqueTimeSlots; track timeSlot) {
          <div class="grid-row">
            <div class="row-time">{{ timeSlot }}</div>
            @for (day of weekDays; track day.dateString) {
              <div class="grid-cell"
                   [class.has-appointments]="getSlotsForCell(day, timeSlot).length > 0"
                   (click)="onCellClick(day)">
                @for (slot of getSlotsForCell(day, timeSlot); track slot.key) {
                  <div class="cell-slot" [style.border-left-color]="slot.gymRoom.color || '#94a3b8'">
                    <span class="slot-gym-name">{{ slot.gymRoom.name }}</span>
                    <span class="slot-patient-count">{{ slot.appointments.length }}/{{ slot.gymRoom.maxCapacity }}</span>
                  </div>
                }
              </div>
            }
          </div>
        }

        @if (uniqueTimeSlots.length === 0) {
          <div class="empty-week">
            <mat-icon>event_busy</mat-icon>
            <p>Nessun appuntamento in questa settimana</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .week-grid-container {
      overflow-x: auto;
    }

    .week-grid {
      min-width: 700px;
    }

    .grid-header {
      display: grid;
      grid-template-columns: 80px repeat(7, 1fr);
      gap: 1px;
      background: #e2e8f0;
      border-radius: 8px 8px 0 0;
      overflow: hidden;
    }

    .header-spacer {
      background: #f8fafc;
      padding: 8px;
    }

    .header-day {
      background: #f1f5f9;
      padding: 8px 6px;
      text-align: center;
      font-size: 0.8rem;
    }

    .header-day.today {
      background: #dbeafe;
      font-weight: 600;
    }

    .header-day.selected {
      background: #bfdbfe;
    }

    .day-label {
      display: block;
      font-weight: 500;
      color: #334155;
    }

    .day-count {
      display: block;
      font-size: 0.7rem;
      color: #64748b;
      margin-top: 2px;
    }

    .grid-row {
      display: grid;
      grid-template-columns: 80px repeat(7, 1fr);
      gap: 1px;
      background: #e2e8f0;
    }

    .row-time {
      background: #f8fafc;
      padding: 8px;
      font-size: 0.75rem;
      font-weight: 500;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .grid-cell {
      background: white;
      padding: 4px;
      min-height: 50px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .grid-cell:hover {
      background: #f0f9ff;
    }

    .grid-cell.has-appointments {
      background: #fefce8;
    }

    .grid-cell.has-appointments:hover {
      background: #fef9c3;
    }

    .cell-slot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 6px;
      margin-bottom: 2px;
      border-radius: 4px;
      border-left: 3px solid;
      background: white;
      font-size: 0.7rem;
    }

    .slot-gym-name {
      color: #334155;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .slot-patient-count {
      color: #64748b;
      font-weight: 600;
      flex-shrink: 0;
      margin-left: 4px;
    }

    .empty-week {
      text-align: center;
      padding: 48px 24px;
      background: white;
      color: #94a3b8;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
      }

      p {
        margin: 8px 0 0;
      }
    }

    @media (max-width: 599px) {
      .week-grid {
        min-width: 500px;
      }

      .grid-header {
        grid-template-columns: 60px repeat(7, 1fr);
      }

      .grid-row {
        grid-template-columns: 60px repeat(7, 1fr);
      }

      .row-time {
        font-size: 0.65rem;
        padding: 4px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorWeekGridComponent {
  @Input({ required: true }) weekDays: WeekDay[] = [];
  @Input({ required: true }) selectedDate!: Date;

  @Output() dayClick = new EventEmitter<Date>();

  get uniqueTimeSlots(): string[] {
    const timeSet = new Set<string>();
    for (const day of this.weekDays) {
      for (const slot of day.slots) {
        timeSet.add(`${slot.startTime} - ${slot.endTime}`);
      }
    }
    return Array.from(timeSet).sort();
  }

  isSelected(day: WeekDay): boolean {
    return day.dateString === this.selectedDate.toISOString().split('T')[0];
  }

  getTotalPatients(day: WeekDay): number {
    return day.slots.reduce((sum, slot) => sum + slot.appointments.length, 0);
  }

  getSlotsForCell(day: WeekDay, timeSlot: string): SlotGroup[] {
    const [start, end] = timeSlot.split(' - ');
    return day.slots.filter((s) => s.startTime === start && s.endTime === end);
  }

  onCellClick(day: WeekDay): void {
    this.dayClick.emit(day.date);
  }
}
