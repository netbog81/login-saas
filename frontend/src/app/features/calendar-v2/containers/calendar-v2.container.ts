/**
 * Calendar V2 Container
 * Layer 2: Smart Component (Orchestratore)
 *
 * Responsabilita':
 * - Orchestrazione stato tramite CalendarV2StateService
 * - Caricamento dati tramite CalendarV2DataService
 * - Dispatch azioni ai service
 * - Nessun accesso diretto ad Apollo/GraphQL
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

// Angular Material
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

// Components (Layer 1 - Dumb)
import { CalendarV2HeaderComponent } from '../components/calendar-header/calendar-v2-header.component';
import { CalendarV2ToolbarComponent } from '../components/calendar-toolbar/calendar-v2-toolbar.component';
import { CalendarV2SidebarComponent } from '../components/calendar-sidebar/calendar-v2-sidebar.component';
import { OperatorGridComponent } from '../components/operator-grid/operator-grid.component';

// Services
import { CalendarV2StateService } from '../services/calendar-v2-state.service';
import { CalendarV2DataService, OperatorLoadResult } from '../services/calendar-v2-data.service';
import { CalendarV2GridService } from '../services/calendar-v2-grid.service';
import { OperatorService } from '../../../services/operator.service';
import { SettingsService } from '../../../services/settings.service';

// Models
import { CalendarV2Config, CalendarOperator, OperatorGridData, CellClickEvent, EventClickEvent, DragMoveEvent } from '../models/calendar-v2.model';
import { Appointment } from '../../../models/appointment.model';
import { Treatment } from '../../../models/treatment.model';

@Component({
  selector: 'app-calendar-v2-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    CalendarV2HeaderComponent,
    CalendarV2ToolbarComponent,
    CalendarV2SidebarComponent,
    OperatorGridComponent,
  ],
  template: `
    <div class="calendar-v2">
      <!-- Header -->
      <app-calendar-v2-header
        [dateLabel]="currentDateLabel"
        [viewType]="config.viewType"
        (prev)="onNavigatePrev()"
        (next)="onNavigateNext()"
        (today)="onNavigateToday()"
        (viewTypeChange)="onViewTypeChange($event)">
      </app-calendar-v2-header>

      <!-- Toolbar -->
      <app-calendar-v2-toolbar
        [viewMode]="config.viewMode"
        [viewType]="config.viewType"
        [slotDuration]="config.slotDuration"
        [zoom]="config.zoom"
        [showWorkingHoursOnly]="config.showWorkingHoursOnly"
        [showWeekend]="config.showWeekend"
        [compactMode]="config.compactMode"
        (viewModeChange)="onViewModeChange($event)"
        (slotDurationChange)="onSlotDurationChange($event)"
        (zoomChange)="onZoomChange($event)"
        (showWorkingHoursOnlyChange)="onShowWorkingHoursOnlyChange($event)"
        (showWeekendChange)="onShowWeekendChange($event)"
        (compactModeChange)="onCompactModeChange($event)">
      </app-calendar-v2-toolbar>

      <!-- Content -->
      <div class="calendar-v2-body">
        @if (loading) {
          <div class="loading-overlay">
            <mat-spinner diameter="48"></mat-spinner>
            <span>Caricamento...</span>
          </div>
        }

        <!-- Sidebar operatori -->
        @if (config.viewMode === 'operators') {
          <app-calendar-v2-sidebar
            [operators]="stateService.operators"
            [collapsed]="sidebarCollapsed"
            (toggleOperator)="stateService.toggleOperator($event)"
            (selectAll)="stateService.selectAllOperators()"
            (deselectAll)="stateService.deselectAllOperators()"
            (toggleCollapsed)="sidebarCollapsed = !sidebarCollapsed">
          </app-calendar-v2-sidebar>
        }

        <!-- Main grid area -->
        <div class="calendar-v2-main">
          @if (config.viewMode === 'operators' && operatorGridData) {
            <app-operator-grid
              [gridData]="operatorGridData"
              [columnWidth]="config.compactMode ? 0 : (config.viewType === 'weekly' ? 120 : 180)"
              [showDateInHeader]="config.viewType === 'weekly'"
              [currentTimeTop]="currentTimeTop"
              [compactMode]="config.compactMode"
              (cellDblClick)="onCellDblClick($event)"
              (eventClick)="onEventClick($event)"
              (eventDblClick)="onEventDblClick($event)"
              (dragMove)="onDragMove($event)">
            </app-operator-grid>
          }

          @if (config.viewMode === 'gyms') {
            <div class="placeholder">
              <mat-icon>fitness_center</mat-icon>
              <p>Vista palestra - da implementare</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-v2 {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f8fafc;
    }

    .calendar-v2-body {
      flex: 1;
      display: flex;
      overflow: hidden;
      position: relative;
    }

    .calendar-v2-main {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }

    .loading-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: rgba(248, 250, 252, 0.8);
      z-index: 10;
      color: #64748b;
    }

    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #94a3b8;
      gap: 12px;

      mat-icon { font-size: 48px; width: 48px; height: 48px; }
    }
  `],
})
export class CalendarV2Container implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);

  stateService = inject(CalendarV2StateService);
  private dataService = inject(CalendarV2DataService);
  private gridService = inject(CalendarV2GridService);
  private operatorService = inject(OperatorService);
  private settingsService = inject(SettingsService);

  // State
  loading = false;
  config: CalendarV2Config = this.stateService.config;
  visibleDates: string[] = [];
  appointmentCount = 0;
  treatments: Treatment[] = [];
  currentDateLabel = '';
  sidebarCollapsed = false;
  operatorGridData: OperatorGridData | null = null;
  currentTimeTop = -1;
  private currentTimeInterval: any;

  ngOnInit(): void {
    this.loadInitialData();
    this.subscribeToState();
    this.startCurrentTimeUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.currentTimeInterval) clearInterval(this.currentTimeInterval);
  }

  // ==================== INITIALIZATION ====================

  private async loadInitialData(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();

    try {
      // Carica impostazioni calendario dal backend
      try {
        const settings = await this.settingsService.getCalendarSettings().toPromise();
        if (settings) {
          this.stateService.updateConfig({
            workingHoursStart: settings.startHour,
            workingHoursEnd: settings.endHour,
            slotDuration: settings.slotDuration,
            showWorkingHoursOnly: settings.showWorkingHoursOnly,
            showWeekend: settings.showWeekend,
          });
        }
      } catch { /* usa defaults */ }

      // Carica operatori
      const operators = await this.operatorService.getOperators(undefined, undefined, true)
        .toPromise() || [];

      const calendarOperators: CalendarOperator[] = operators.map(op => ({
        id: op.id,
        operatorId: op.id,
        name: `${op.name}${op.surname ? ' ' + op.surname : ''}`,
        color: op.color || '#667eea',
        active: true,
        selected: true,
        hasTemplate: true, // TODO: verificare da backend
        macroCategory: op.macroCategory,
      }));

      this.stateService.setOperators(calendarOperators);
    } catch (error) {
      console.error('[CalendarV2] Error loading initial data:', error);
    }

    this.loading = false;
    this.cdr.markForCheck();
  }

  // ==================== STATE SUBSCRIPTIONS ====================

  private subscribeToState(): void {
    // Reagisci a cambiamenti di config, date, operatori
    combineLatest([
      this.stateService.config$,
      this.stateService.visibleDates$,
      this.stateService.selectedOperators$,
    ]).pipe(
      debounceTime(300),
      takeUntil(this.destroy$),
    ).subscribe(([config, dates, operators]) => {
      this.config = config;
      this.visibleDates = dates;
      this.updateDateLabel();
      this.loadData(config, dates, operators);
    });
  }

  private loadData(
    config: CalendarV2Config,
    dates: string[],
    operators: CalendarOperator[],
  ): void {
    if (dates.length === 0) return;

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    this.loading = true;
    this.cdr.markForCheck();

    if (config.viewMode === 'operators') {
      const operatorIds = operators.map(o => o.operatorId);
      const withTemplate = operators.filter(o => o.hasTemplate).map(o => o.operatorId);
      const today = this.stateService.formatDate(new Date());

      this.dataService.loadOperatorData(operatorIds, withTemplate, startDate, endDate, today)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            this.appointmentCount = this.countAppointments(result.appointments);
            this.treatments = result.treatments;

            // Pre-calcola griglia in una passata
            this.operatorGridData = this.gridService.computeOperatorGrid(
              config, dates, operators, result.appointments, result.availabilities,
            );
            this.updateCurrentTimeTop();

            this.loading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.loading = false;
            this.cdr.markForCheck();
          },
        });
    } else {
      // TODO: gym mode
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // ==================== ACTIONS ====================

  onNavigatePrev(): void { this.stateService.navigatePrev(); }
  onNavigateNext(): void { this.stateService.navigateNext(); }
  onNavigateToday(): void { this.stateService.navigateToday(); }

  onViewTypeChange(viewType: 'daily' | 'weekly'): void {
    this.stateService.updateConfig({ viewType });
  }

  onViewModeChange(viewMode: 'operators' | 'gyms'): void {
    this.stateService.updateConfig({ viewMode });
  }

  onSlotDurationChange(slotDuration: number): void {
    this.stateService.updateConfig({ slotDuration });
  }

  onZoomChange(zoom: number): void {
    this.stateService.updateConfig({ zoom });
  }

  onShowWorkingHoursOnlyChange(showWorkingHoursOnly: boolean): void {
    this.stateService.updateConfig({ showWorkingHoursOnly });
  }

  onShowWeekendChange(showWeekend: boolean): void {
    this.stateService.updateConfig({ showWeekend });
  }

  onCompactModeChange(compactMode: boolean): void {
    this.stateService.updateConfig({ compactMode });
  }

  // ==================== UTILITIES ====================

  private updateDateLabel(): void {
    const date = this.stateService.currentDate;
    if (this.config.viewType === 'daily') {
      this.currentDateLabel = date.toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    } else {
      const start = new Date(this.visibleDates[0] + 'T00:00:00');
      const end = new Date(this.visibleDates[this.visibleDates.length - 1] + 'T00:00:00');
      this.currentDateLabel = `${start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  }

  private countAppointments(map: Map<string, Map<string, Appointment[]>>): number {
    let count = 0;
    for (const dateMap of map.values()) {
      for (const apts of dateMap.values()) {
        count += apts.length;
      }
    }
    return count;
  }

  // ==================== GRID INTERACTIONS ====================

  onCellDblClick(event: CellClickEvent): void {
    console.log('[CalendarV2] Cell dblclick:', event);
    // TODO: aprire dialog creazione appuntamento
  }

  onEventClick(event: EventClickEvent): void {
    console.log('[CalendarV2] Event click:', event.appointment.id);
    // TODO: aprire summary popup
  }

  onEventDblClick(event: EventClickEvent): void {
    console.log('[CalendarV2] Event dblclick:', event.appointment.id);
    // TODO: aprire dialog modifica appuntamento
  }

  onDragMove(event: DragMoveEvent): void {
    console.log('[CalendarV2] Drag move:', event);
    // TODO: chiamare mutation per spostare appuntamento
  }

  // ==================== CURRENT TIME INDICATOR ====================

  private startCurrentTimeUpdates(): void {
    this.updateCurrentTimeTop();
    this.currentTimeInterval = setInterval(() => {
      this.updateCurrentTimeTop();
      this.cdr.markForCheck();
    }, 60000);
  }

  private updateCurrentTimeTop(): void {
    if (!this.operatorGridData?.timeSlots?.length) {
      this.currentTimeTop = -1;
      return;
    }

    const today = this.stateService.formatDate(new Date());
    if (!this.visibleDates.includes(today)) {
      this.currentTimeTop = -1;
      return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const firstSlotMinutes = this.timeToMinutes(this.operatorGridData.timeSlots[0].time);
    const lastSlot = this.operatorGridData.timeSlots[this.operatorGridData.timeSlots.length - 1];
    const slotDuration = this.operatorGridData.timeSlots.length > 1
      ? this.timeToMinutes(this.operatorGridData.timeSlots[1].time) - firstSlotMinutes
      : 45;
    const lastSlotEndMinutes = this.timeToMinutes(lastSlot.time) + slotDuration;

    if (currentMinutes < firstSlotMinutes || currentMinutes > lastSlotEndMinutes) {
      this.currentTimeTop = -1;
      return;
    }

    const pxPerMinute = this.operatorGridData.slotHeightPx / slotDuration;
    // +44px per l'header della griglia (approssimazione)
    this.currentTimeTop = (currentMinutes - firstSlotMinutes) * pxPerMinute + 44;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
