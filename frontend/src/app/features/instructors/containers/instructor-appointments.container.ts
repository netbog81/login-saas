/**
 * Instructor Appointments Container
 * Layer 2: Smart Component
 *
 * Responsabilità:
 * - Tab 1: Appuntamenti giornata/settimana raggruppati per slot + palestra
 * - Sottoscrive selectedOperator$ e selectedDate$ dal state service
 * - Carica appuntamenti tramite InstructorWorkspaceService
 * - Raggruppa in SlotGroup[] e WeekDay[]
 * - Toggle vista Giorno / Settimana
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, filter, distinctUntilChanged } from 'rxjs/operators';

import { AvailabilityAppointment } from '../../../graphql/generated/types';
import { InstructorWorkspaceStateService } from '../services/instructor-workspace-state.service';
import { InstructorWorkspaceService } from '../services/instructor-workspace.service';
import {
  SlotGroup,
  WeekDay,
  ViewMode,
  groupAppointmentsBySlot,
  buildWeekDays,
} from '../models/instructor-workspace.model';
import { SlotGroupCardComponent } from '../components/slot-group-card/slot-group-card.component';
import { InstructorWeekGridComponent } from '../components/instructor-week-grid/instructor-week-grid.component';

@Component({
  selector: 'app-instructor-appointments-container',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    SlotGroupCardComponent,
    InstructorWeekGridComponent,
  ],
  template: `
    <div class="appointments-container">
      <!-- Toolbar -->
      <div class="toolbar">
        <mat-button-toggle-group
          [value]="viewMode"
          (change)="onViewModeChange($event.value)">
          <mat-button-toggle value="day">
            <mat-icon>today</mat-icon>
            <span class="toggle-label">Giorno</span>
          </mat-button-toggle>
          <mat-button-toggle value="week">
            <mat-icon>date_range</mat-icon>
            <span class="toggle-label">Settimana</span>
          </mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <!-- Loading -->
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <span>Caricamento appuntamenti...</span>
        </div>
      }

      <!-- Error -->
      @if (error) {
        <div class="error-message">{{ error }}</div>
      }

      <!-- Vista Giorno -->
      @if (!loading && viewMode === 'day') {
        <div class="day-view">
          @if (daySlots.length === 0 && !error) {
            <div class="empty-state">
              <mat-icon>event_busy</mat-icon>
              <p>Nessun appuntamento per questa giornata</p>
            </div>
          }
          @for (slot of daySlots; track slot.key) {
            <app-slot-group-card [slotGroup]="slot"></app-slot-group-card>
          }
        </div>
      }

      <!-- Vista Settimana -->
      @if (!loading && viewMode === 'week') {
        <app-instructor-week-grid
          [weekDays]="weekDays"
          [selectedDate]="stateService.selectedDate"
          (dayClick)="onDayClick($event)">
        </app-instructor-week-grid>
      }
    </div>
  `,
  styles: [`
    .appointments-container {
      padding: 16px 24px;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .toggle-label {
      margin-left: 4px;
      font-size: 0.85rem;
    }

    .loading-container {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 32px;
      justify-content: center;
      color: #64748b;
    }

    .error-message {
      padding: 16px;
      background: #fee2e2;
      color: #dc2626;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .day-view {
      display: flex;
      flex-direction: column;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: #94a3b8;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
      }

      p {
        font-size: 1rem;
        margin: 0;
      }
    }

    @media (max-width: 599px) {
      .appointments-container {
        padding: 12px;
      }

      .toggle-label {
        display: none;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorAppointmentsContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  viewMode: ViewMode = 'day';
  loading = false;
  error: string | null = null;

  daySlots: SlotGroup[] = [];
  weekDays: WeekDay[] = [];

  private allAppointments: AvailabilityAppointment[] = [];

  constructor(
    public stateService: InstructorWorkspaceStateService,
    private workspaceService: InstructorWorkspaceService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Reagisce a cambi di operatore o data
    combineLatest([
      this.stateService.selectedOperator$.pipe(
        filter((op) => op !== null),
        distinctUntilChanged((a, b) => a?.id === b?.id),
      ),
      this.stateService.selectedDate$.pipe(
        distinctUntilChanged((a, b) => a.toDateString() === b.toDateString()),
      ),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([operator, date]) => {
        if (operator) {
          this.loadAppointments(operator.id, date);
        }
      });

    // Reagisce a cambi di viewMode dallo state
    this.stateService.viewMode$.pipe(takeUntil(this.destroy$)).subscribe((mode) => {
      this.viewMode = mode;
      this.rebuildViews();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onViewModeChange(mode: ViewMode): void {
    this.viewMode = mode;
    this.stateService.setViewMode(mode);
    this.loadAppointments(
      this.stateService.selectedOperatorId!,
      this.stateService.selectedDate,
    );
  }

  onDayClick(date: Date): void {
    this.stateService.setSelectedDate(date);
    this.stateService.setViewMode('day');
  }

  private loadAppointments(operatorId: string, date: Date): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const { startDate, endDate } = this.getDateRange(date);

    this.workspaceService
      .loadAppointments(operatorId, startDate, endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.loading = false;
          this.allAppointments = result.appointments;
          this.error = result.error || null;
          this.rebuildViews();
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.error = 'Errore nel caricamento degli appuntamenti';
          this.cdr.markForCheck();
        },
      });
  }

  private rebuildViews(): void {
    const date = this.stateService.selectedDate;

    if (this.viewMode === 'day') {
      const dateStr = date.toISOString().split('T')[0];
      const dayAppts = this.allAppointments.filter((a) => a.appointmentDate === dateStr);
      this.daySlots = groupAppointmentsBySlot(dayAppts);
    }

    // Sempre costruire weekDays per la griglia settimana
    this.weekDays = buildWeekDays(date, this.allAppointments);
  }

  private getDateRange(date: Date): { startDate: string; endDate: string } {
    if (this.viewMode === 'day') {
      const dateStr = date.toISOString().split('T')[0];
      return { startDate: dateStr, endDate: dateStr };
    }

    // Settimana: lunedì-domenica
    const monday = new Date(date);
    const dayOfWeek = monday.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + diff);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDate: monday.toISOString().split('T')[0],
      endDate: sunday.toISOString().split('T')[0],
    };
  }
}
