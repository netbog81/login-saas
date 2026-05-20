/**
 * Calendar V3 Container
 * Layer 2: Smart Component (Orchestratore)
 *
 * Variante di CalendarV2Container con layout compatto: header e toolbar
 * accorpati in un'unica barra (CalendarV3ToolbarComponent), per ridurre
 * l'ingombro verticale e mostrare piu' celle senza scroll.
 *
 * Riusa servizi e componenti (sidebar, griglie) da features/calendar-v2:
 * sono singleton/dumb condivisibili, niente duplicazione di logica.
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
import { Subject, combineLatest, firstValueFrom } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';

// Angular Material
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

// Componente nuovo v3
import { CalendarV3ToolbarComponent } from '../components/calendar-toolbar/calendar-v3-toolbar.component';

// Componente nuovo v3
import { OperatorGridV3Component } from '../components/operator-grid/operator-grid-v3.component';

// Componenti riusati da calendar-v2 (Layer 1 - Dumb)
import { CalendarV2SidebarComponent } from '../../calendar-v2/components/calendar-sidebar/calendar-v2-sidebar.component';
import { GymGridComponent, GymRoom } from '../../calendar-v2/components/gym-grid/gym-grid.component';

// Dialog Material esistenti
import { MatDialog } from '@angular/material/dialog';
import { EventMatDialogComponent, EventMatDialogData, EventMatDialogResult } from '../../../shared/components/event-mat-dialog';
import { GymAppointmentMatDialogComponent, GymAppointmentMatDialogData, GymAppointmentMatDialogResult } from '../../../shared/components/gym-appointment-mat-dialog';
import { Patient } from '../../../models/patient.model';
import { User } from '../../../models/user.model';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { InstrumentService } from '../../../services/instrument.service';
import { SseService } from '../../../services/sse.service';

// Services riusati da calendar-v2
import { CalendarV2StateService } from '../../calendar-v2/services/calendar-v2-state.service';
import { CalendarV2DataService } from '../../calendar-v2/services/calendar-v2-data.service';
import { CalendarV2GridService } from '../../calendar-v2/services/calendar-v2-grid.service';
import { OperatorService } from '../../../services/operator.service';
import { SettingsService } from '../../../services/settings.service';

// Models riusati da calendar-v2
import { CalendarV2Config, CalendarOperator, OperatorGridData, CellClickEvent, EventClickEvent, DragMoveEvent, AvailableSlotPosition, SearchFilters } from '../../calendar-v2/models/calendar-v2.model';
import { Appointment } from '../../../models/appointment.model';
import { Treatment } from '../../../models/treatment.model';

@Component({
  selector: 'app-calendar-v3-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    CalendarV3ToolbarComponent,
    CalendarV2SidebarComponent,
    OperatorGridV3Component,
    GymGridComponent,
  ],
  template: `
    <div class="calendar-v3">
      <!-- Barra unica: navigazione date + controlli + toggle vista -->
      <app-calendar-v3-toolbar
        [dateLabel]="currentDateLabel"
        [viewMode]="config.viewMode"
        [viewType]="config.viewType"
        [slotDuration]="config.slotDuration"
        [zoom]="config.zoom"
        [showWorkingHoursOnly]="config.showWorkingHoursOnly"
        [showWeekend]="config.showWeekend"
        [compactMode]="config.compactMode"
        (prev)="onNavigatePrev()"
        (next)="onNavigateNext()"
        (today)="onNavigateToday()"
        (viewTypeChange)="onViewTypeChange($event)"
        (viewModeChange)="onViewModeChange($event)"
        (slotDurationChange)="onSlotDurationChange($event)"
        (zoomChange)="onZoomChange($event)"
        (showWorkingHoursOnlyChange)="onShowWorkingHoursOnlyChange($event)"
        (showWeekendChange)="onShowWeekendChange($event)"
        (compactModeChange)="onCompactModeChange($event)"
        (openWaitingList)="onOpenWaitingList()"
        (openTreatments)="onOpenTreatments()">
      </app-calendar-v3-toolbar>

      <!-- Content -->
      <div class="calendar-v3-body">
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
            [treatments]="treatments"
            [instrumentCategories]="instrumentCategories"
            [collapsed]="sidebarCollapsed"
            (toggleOperator)="stateService.toggleOperator($event)"
            (setOperatorSelection)="stateService.setOperatorSelection($event.operatorIds, $event.selected)"
            (toggleCollapsed)="sidebarCollapsed = !sidebarCollapsed"
            (slotSearchToggle)="onSlotSearchToggle($event)"
            (searchFiltersChange)="onSearchFiltersChange($event)">
          </app-calendar-v2-sidebar>
        }

        <!-- Main grid area -->
        <div class="calendar-v3-main">
          @if (config.viewMode === 'operators' && operatorGridData) {
            <app-operator-grid-v3
              [gridData]="operatorGridData"
              [columnWidth]="config.compactMode ? 0 : (config.viewType === 'weekly' ? 120 : 180)"
              [showDateInHeader]="config.viewType === 'weekly'"
              [currentTimeTop]="currentTimeTop"
              [compactMode]="config.compactMode"
              [availableSlots]="availableSlots"
              (cellDblClick)="onCellDblClick($event)"
              (availableSlotDblClick)="onAvailableSlotDblClick($event)"
              (eventClick)="onEventClick($event)"
              (eventDblClick)="onEventDblClick($event)"
              (dragMove)="onDragMove($event)"
              (resizeEnd)="onResizeEnd($event)">
            </app-operator-grid-v3>
          }

          @if (config.viewMode === 'gyms') {
            <app-gym-grid-v2
              [timeSlots]="gymTimeSlots"
              [gymRooms]="gymRooms"
              [dates]="visibleDates"
              [allSlotsInfo]="gymSlotsData"
              [allAppointments]="gymAppointmentsData"
              [slotHeight]="60 * config.zoom"
              [columnWidth]="config.compactMode ? 0 : 200"
              [compactMode]="config.compactMode"
              [isWeekly]="config.viewType === 'weekly'"
              (slotClick)="onGymSlotClick($event)"
              (slotDblClick)="onGymSlotDblClick($event)"
              (appointmentClick)="onGymAppointmentClick($event)">
            </app-gym-grid-v2>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-v3 {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f8fafc;
    }

    .calendar-v3-body {
      flex: 1;
      display: flex;
      overflow: hidden;
      position: relative;
    }

    .calendar-v3-main {
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
  `],
})
export class CalendarV3Container implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);

  stateService = inject(CalendarV2StateService);
  private dataService = inject(CalendarV2DataService);
  private gridService = inject(CalendarV2GridService);
  private operatorService = inject(OperatorService);
  private settingsService = inject(SettingsService);
  private dialog = inject(MatDialog);
  private appointmentService = inject(AvailabilityAppointmentService);
  private sseService = inject(SseService);
  private instrumentService = inject(InstrumentService);

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

  // Search slot state
  slotSearchEnabled = false;
  searchFilters: SearchFilters = {
    duration: 45, withInstrument: false, instrumentCount: 1,
    instrumentPosition: 'first', instrumentOrderMatters: false,
    instrumentCategoryId: null, instrument2CategoryId: null,
  };
  availableSlots: AvailableSlotPosition[] = [];
  instrumentCategories: any[] = [];

  // Shared data for dialogs
  patients: Patient[] = [];
  allUsers: User[] = [];

  // Gym state
  gymRooms: GymRoom[] = [];
  gymTimeSlots: any[] = [];
  gymSlotsData: Map<string, Map<string, any[]>> = new Map();
  gymAppointmentsData: Map<string, Map<string, any[]>> = new Map();

  ngOnInit(): void {
    this.loadInitialData();
    this.subscribeToState();
    this.startCurrentTimeUpdates();
    this.subscribeToSse();
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
      try {
        const settings = await this.settingsService.getCalendarSettings().toPromise();
        if (settings) {
          const hasStoredState = sessionStorage.getItem('calendar-v2-state') !== null;
          this.stateService.updateConfig({
            workingHoursStart: settings.startHour,
            workingHoursEnd: settings.endHour,
            ...(!hasStoredState ? {
              slotDuration: settings.slotDuration,
              showWorkingHoursOnly: settings.showWorkingHoursOnly,
              showWeekend: settings.showWeekend,
              viewType: settings.defaultView as any,
            } : {}),
          });
        }
      } catch { /* usa defaults */ }

      const operators = await this.operatorService.getOperators(undefined, undefined, true)
        .toPromise() || [];

      const calendarOperators: CalendarOperator[] = operators.map(op => ({
        id: op.id,
        operatorId: op.id,
        name: `${op.name}${op.surname ? ' ' + op.surname : ''}`,
        color: op.color || '#667eea',
        active: true,
        selected: true,
        hasTemplate: true,
        macroCategory: op.macroCategory,
      }));

      this.stateService.setOperators(calendarOperators);

      this.allUsers = operators.map(op => ({
        id: op.id,
        name: `${op.name}${op.surname ? ' ' + op.surname : ''}`,
        type: 'operator',
        color: op.color || '#667eea',
        active: true,
        operatorId: op.id,
        hasTemplate: true,
        macroCategory: op.macroCategory,
      }));

      this.dataService.loadPatients().pipe(takeUntil(this.destroy$)).subscribe({
        next: (patients) => { this.patients = patients; },
      });

      this.instrumentService.getInstrumentCategories().pipe(takeUntil(this.destroy$)).subscribe({
        next: (cats) => {
          this.instrumentCategories = cats.filter((c: any) => c.isActive !== false);
          this.cdr.markForCheck();
        },
      });
    } catch (error) {
      console.error('[CalendarV3] Error loading initial data:', error);
    }

    this.loading = false;
    this.cdr.markForCheck();
  }

  // ==================== STATE SUBSCRIPTIONS ====================

  private subscribeToState(): void {
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

            this.operatorGridData = this.gridService.computeOperatorGrid(
              config, dates, operators, result.appointments, result.availabilities,
            );
            this.updateCurrentTimeTop();

            if (this.slotSearchEnabled) {
              this.searchAvailableSlots();
            }

            this.loading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.loading = false;
            this.cdr.markForCheck();
          },
        });
    } else if (config.viewMode === 'gyms') {
      this.loadGymData(dates);
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
    if (viewMode === 'gyms') {
      this.stateService.updateConfig({ viewMode, slotDuration: 60 });
    } else {
      this.stateService.updateConfig({ viewMode });
    }
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

  private waitingListDialogRef: any = null;
  private treatmentsDialogRef: any = null;

  onOpenWaitingList(): void {
    if (this.waitingListDialogRef) return;
    import('../../../shared/components/waiting-list/waiting-list-dialog/waiting-list-dialog.container').then(m => {
      this.waitingListDialogRef = this.dialog.open(m.WaitingListDialogContainer, {
        width: '650px',
        height: '80vh',
        hasBackdrop: false,
        panelClass: 'waiting-list-dialog-panel',
        disableClose: false,
      });
      this.waitingListDialogRef.afterClosed().subscribe(() => {
        this.waitingListDialogRef = null;
      });
    });
  }

  onOpenTreatments(): void {
    if (this.treatmentsDialogRef) return;
    const today = this.stateService.formatDate(this.stateService.currentDate);
    import('../../trattamenti/containers/trattamenti-dialog.container').then(m => {
      this.treatmentsDialogRef = this.dialog.open(m.TrattamentiDialogContainer, {
        data: {
          initialFilters: { dateFrom: today, dateTo: today },
          initialViewMode: 'flat',
        },
        width: '1100px',
        maxWidth: '95vw',
        height: '80vh',
        maxHeight: '90vh',
        hasBackdrop: false,
        panelClass: 'trattamenti-dialog-pane',
        disableClose: false,
        autoFocus: false,
      });
      this.treatmentsDialogRef.afterClosed().subscribe(() => {
        this.treatmentsDialogRef = null;
      });
    });
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

  // ==================== SLOT SEARCH ====================

  onSlotSearchToggle(enabled: boolean): void {
    this.slotSearchEnabled = enabled;
    if (enabled) {
      this.searchAvailableSlots();
    } else {
      this.availableSlots = [];
      this.cdr.markForCheck();
    }
  }

  onSearchFiltersChange(filters: SearchFilters): void {
    this.searchFilters = filters;
    if (this.slotSearchEnabled) {
      this.searchAvailableSlots();
    }
  }

  onAvailableSlotDblClick(slot: AvailableSlotPosition): void {
    const endMinutes = this.timeToMinutes(slot.startTime) + this.searchFilters.duration;
    this.openEventDialog({
      defaultDate: slot.date,
      defaultStartTime: slot.startTime,
      defaultEndTime: this.minutesToTime(endMinutes),
      defaultOperatorId: slot.operatorId,
      users: this.allUsers,
      patients: this.patients,
      searchFilters: {
        duration: this.searchFilters.duration,
        withInstrument: this.searchFilters.withInstrument,
        instrumentCount: this.searchFilters.instrumentCount,
        instrumentCategoryId: this.searchFilters.instrumentCategoryId,
        instrument2CategoryId: this.searchFilters.instrument2CategoryId,
        instrumentPosition: this.searchFilters.instrumentPosition,
        instrumentOrderMatters: this.searchFilters.instrumentOrderMatters,
        suggestedInstruments: slot.availableInstruments,
      },
    });
  }

  private searchAvailableSlots(): void {
    if (!this.operatorGridData) return;

    const operators = this.stateService.selectedOperators.filter(o => o.hasTemplate);
    if (operators.length === 0) {
      this.availableSlots = [];
      this.cdr.markForCheck();
      return;
    }

    const operatorIds = operators.map(o => o.operatorId);
    const operatorMap = new Map(operators.map(o => [o.operatorId, o]));

    this.operatorService.getPhysiotherapistAvailableSlotsBatch(
      operatorIds,
      this.visibleDates,
      this.searchFilters.duration,
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (slots) => {
        this.availableSlots = slots
          .filter(s => s.available)
          .map(s => {
            const op = operatorMap.get(s.operatorId);
            return this.buildSlotPosition(
              op || { operatorId: s.operatorId, color: '#667eea' } as any,
              s.date,
              s,
            );
          });
        this.cdr.markForCheck();
      },
      error: () => {
        this.availableSlots = [];
        this.cdr.markForCheck();
      },
    });
  }

  private buildSlotPosition(op: CalendarOperator, date: string, slot: any): AvailableSlotPosition {
    const gridData = this.operatorGridData!;
    const gridStartMinutes = gridData.timeSlots.length > 0
      ? this.timeToMinutes(gridData.timeSlots[0].time) : 0;
    const slotDuration = gridData.timeSlots.length > 1
      ? this.timeToMinutes(gridData.timeSlots[1].time) - gridStartMinutes : 45;
    const pxPerMinute = gridData.slotHeightPx / slotDuration;

    const startMin = this.timeToMinutes(slot.startTime);
    const endMin = this.timeToMinutes(slot.endTime);

    return {
      operatorId: op.operatorId,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      topPx: (startMin - gridStartMinutes) * pxPerMinute,
      heightPx: (endMin - startMin) * pxPerMinute,
      color: op.color,
      availableInstruments: slot.suggestedInstruments?.map((i: any) => ({
        id: i.instrumentId, name: i.categoryName, categoryId: i.instrumentCategoryId,
      })),
    };
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ==================== SSE ====================

  private subscribeToSse(): void {
    this.sseService.getAppointmentEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event: any) => {
          if (event.type === 'appointment_status_changed') {
            if (this.config.viewMode === 'operators') {
              this.reloadCurrentView();
            }
          }
          if (['treatment_created', 'treatment_status_changed', 'treatment_deleted'].includes(event.type)) {
            this.reloadCurrentView();
          }
        },
      });
  }

  // ==================== GYM DATA ====================

  private async loadGymData(dates: string[]): Promise<void> {
    if (this.gymRooms.length === 0) {
      try {
        const rooms = await this.dataService.loadGymRooms().toPromise() || [];
        this.gymRooms = rooms.map(r => ({
          id: r.id,
          name: r.name,
          color: r.color || '#10b981',
          maxCapacity: r.maxCapacity,
        }));
      } catch { this.gymRooms = []; }
    }

    if (this.gymRooms.length === 0) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.gymTimeSlots = this.stateService.computeTimeSlotsPublic(this.config);

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const roomIds = this.gymRooms.map(r => r.id);

    this.dataService.loadGymData(roomIds, startDate, endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.gymSlotsData = new Map();
          this.gymAppointmentsData = new Map();

          for (const date of dates) {
            const dateSlots = new Map<string, any[]>();
            const dateApts = new Map<string, any[]>();

            for (const roomId of roomIds) {
              const allSlots = result.slotsInfo.get(date) || [];
              dateSlots.set(roomId, allSlots.filter((s: any) => s.gymRoomId === roomId));

              const allApts = result.appointments.get(date) || [];
              dateApts.set(roomId, allApts.filter((a: any) => a.gymRoomId === roomId));
            }

            this.gymSlotsData.set(date, dateSlots);
            this.gymAppointmentsData.set(date, dateApts);
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  getGymSlotsForDate(date: string): Map<string, any[]> {
    return this.gymSlotsData.get(date) || new Map();
  }

  getGymAppointmentsForDate(date: string): Map<string, any[]> {
    return this.gymAppointmentsData.get(date) || new Map();
  }

  // ==================== GYM INTERACTIONS ====================

  onGymSlotClick(event: any): void {
    this.openGymAppointmentDialog(event);
  }

  onGymSlotDblClick(event: any): void {
    this.openGymAppointmentDialog(event);
  }

  onGymAppointmentClick(event: any): void {
    console.log('[CalendarV3] Gym appointment click:', event.appointment?.id);
  }

  private openGymAppointmentDialog(event: any): void {
    const dialogRef = this.dialog.open(GymAppointmentMatDialogComponent, {
      width: '600px',
      disableClose: false,
      data: {
        gymRoom: event.gymRoom,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        slotInfo: event.slotInfo,
        patients: this.patients,
      } as GymAppointmentMatDialogData,
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: GymAppointmentMatDialogResult | undefined) => {
      if (result?.created) {
        this.reloadCurrentView();
      }
    });
  }

  // ==================== GRID INTERACTIONS ====================

  onCellDblClick(event: CellClickEvent): void {
    const operator = this.stateService.operators.find(o => o.operatorId === event.operatorId);
    const isGymInstructor = operator?.macroCategory === 'gym_instructor';

    if (!isGymInstructor && this.operatorGridData) {
      const col = this.operatorGridData.columns.find(
        c => c.operatorId === event.operatorId && c.date === event.date
      );
      if (col) {
        const hasOverlap = col.events.some(e => {
          return e.originalStartTime < event.endTime && e.originalEndTime > event.startTime;
        });
        if (hasOverlap) {
          alert('Esiste già un appuntamento in questa fascia oraria per questo operatore.');
          return;
        }
      }
    }

    this.openEventDialog({
      defaultDate: event.date,
      defaultStartTime: event.startTime,
      defaultEndTime: event.endTime,
      defaultOperatorId: event.operatorId,
      users: this.allUsers,
      patients: this.patients,
    });
  }

  onEventClick(event: EventClickEvent): void {
    this.openEventDialog({
      appointment: event.appointment,
      users: this.allUsers,
      patients: this.patients,
    });
  }

  onEventDblClick(event: EventClickEvent): void {
    this.openEventDialog({
      appointment: event.appointment,
      users: this.allUsers,
      patients: this.patients,
    });
  }

  onResizeEnd(event: { appointmentId: string; newEndTime: string }): void {
    this.appointmentService.updateAppointment(event.appointmentId, {
      endTime: event.newEndTime,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.reloadCurrentView(),
      error: (err: any) => {
        console.error('[CalendarV3] Error resizing appointment:', err);
        alert('Errore nel ridimensionamento dell\'appuntamento');
      },
    });
  }

  onDragMove(event: DragMoveEvent): void {
    this.appointmentService.updateAppointment(event.appointmentId, {
      startTime: event.newStartTime,
      endTime: event.newEndTime,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.reloadCurrentView(),
      error: (err: any) => {
        console.error('[CalendarV3] Error moving appointment:', err);
        alert('Errore nello spostamento dell\'appuntamento');
      },
    });
  }

  // ==================== DIALOG APERTURA ====================

  private openEventDialog(data: EventMatDialogData): void {
    const dialogData = { ...data, instrumentCategories: this.instrumentCategories };
    const dialogRef = this.dialog.open(EventMatDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      disableClose: false,
      data: dialogData,
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(async (result: EventMatDialogResult | undefined) => {
      if (!result || result.action === 'cancel') return;

      if (result.action === 'save' && result.appointment) {
        await this.saveAppointment(result);
      } else if (result.action === 'delete' && result.appointment) {
        try {
          await firstValueFrom(this.appointmentService.deleteAppointment(String(result.appointment.id)));
        } catch (err: any) {
          alert(err?.graphQLErrors?.[0]?.message || 'Errore nell\'eliminazione');
        }
      }
      this.reloadCurrentView();
    });
  }

  private async saveAppointment(result: EventMatDialogResult): Promise<void> {
    const apt = result.appointment!;
    const servicesWithOrder = result.services?.map((s, idx) => ({ ...s, orderPosition: idx }));

    try {
      const isUpdate = apt.id && typeof apt.id === 'string' && apt.id.length > 10;

      if (isUpdate) {
        await firstValueFrom(this.appointmentService.updateAppointment(
          apt.id as string,
          {
            services: servicesWithOrder,
            clientName: apt.title,
            patientId: apt.patientId,
            appointmentDate: apt.date,
            startTime: apt.startTime,
            endTime: apt.endTime,
            notes: apt.notes,
            instrumentOrderMatters: result.instrumentOrderMatters,
            instruments: result.instruments,
            nonRetribuito: result.nonRetribuito,
          },
        ));
      } else {
        await firstValueFrom(this.appointmentService.createAppointment({
          operatorId: apt.operatorId,
          services: servicesWithOrder,
          clientName: apt.title,
          patientId: apt.patientId,
          appointmentDate: apt.date,
          startTime: apt.startTime,
          endTime: apt.endTime,
          notes: apt.notes,
          instrumentOrderMatters: result.instrumentOrderMatters,
          instruments: result.instruments,
          repeatConfig: result.repeatConfig,
          nonRetribuito: result.nonRetribuito,
        }));
      }
    } catch (error: any) {
      let msg = 'Errore durante il salvataggio';
      if (error?.graphQLErrors?.[0]?.message) {
        msg = error.graphQLErrors[0].message;
      } else if (error?.message?.includes('CombinedGraphQLErrors:')) {
        msg = error.message.replace('CombinedGraphQLErrors: ', '');
      } else if (error?.message) {
        msg = error.message;
      }
      console.error('[CalendarV3] Save error:', error);
      alert(msg);
    }
  }

  private reloadCurrentView(): void {
    this.loadData(this.config, this.visibleDates, this.stateService.selectedOperators);
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
    this.currentTimeTop = (currentMinutes - firstSlotMinutes) * pxPerMinute + 44;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
