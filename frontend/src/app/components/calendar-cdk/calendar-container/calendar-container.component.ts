import { Component, OnInit, OnDestroy, ViewContainerRef, Injector, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, combineLatest, debounceTime, firstValueFrom } from 'rxjs';
import { Overlay, OverlayRef, OverlayConfig, ConnectedPosition } from '@angular/cdk/overlay';
import { OverlayModule } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

// Services
import { CalendarStateService, CalendarConfig, AppointmentSearchFilters, AvailableSlot } from '../services/calendar-state.service';
import { ApiService } from '../../../services/api.service';
import { OperatorService } from '../../../services/operator.service';
import { InstrumentService } from '../../../services/instrument.service';
import { SettingsService } from '../../../services/settings.service';
import { AvailabilityAppointmentService, AppointmentInstrumentInput } from '../../../services/availability-appointment.service';

// GraphQL types
import { Operator, OperatorMacroCategory, InstrumentCategory, InstrumentSlotInput } from '../../../graphql/generated/types';

// Components
import { CalendarHeaderComponent } from '../calendar-header/calendar-header.component';
import { CalendarSidebarComponent } from '../calendar-sidebar/calendar-sidebar.component';
import { CalendarToolbarComponent } from '../calendar-toolbar/calendar-toolbar.component';
import { CalendarGridComponent } from '../calendar-grid/calendar-grid.component';
import { CalendarWeeklyGridComponent } from '../calendar-weekly-grid/calendar-weekly-grid.component';
import { EventDialogComponent, EventDialogData, EventDialogResult } from '../event-dialog/event-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { AppointmentSummaryComponent, SummaryAction } from '../appointment-summary/appointment-summary.component';
import { UsersLegendComponent } from '../users-legend/users-legend.component';
import { WorkingHoursDialogComponent, WorkingHoursDialogData, WorkingHoursDialogResult } from '../working-hours-dialog/working-hours-dialog.component';
import { CellEvent } from '../calendar-cell/calendar-cell.component';
import { EventAction } from '../calendar-event/calendar-event.component';
import { AvailableSlotClickEvent } from '../available-slot-overlay/available-slot-overlay.component';

// Models
import { Appointment } from '../../../models/appointment.model';
import { User } from '../../../models/user.model';
import { Patient } from '../../../models/patient.model';
import { Availability } from '../../../models/availability.model';

// Utils
import { mapAvailabilityAppointmentToAppointment } from '../../../utils/appointment.mapper';

@Component({
  selector: 'app-calendar-container',
  standalone: true,
  imports: [
    CommonModule,
    OverlayModule,
    CalendarHeaderComponent,
    CalendarSidebarComponent,
    CalendarToolbarComponent,
    CalendarGridComponent,
    CalendarWeeklyGridComponent,
    EventDialogComponent,
    ConfirmDialogComponent,
    UsersLegendComponent,
    WorkingHoursDialogComponent
  ],
  templateUrl: './calendar-container.component.html',
  styleUrls: ['./calendar-container.component.scss']
})
export class CalendarContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // State from service
  config!: CalendarConfig;
  currentDate!: Date;
  visibleDates: string[] = [];
  selectedOperators: User[] = [];
  allUsers: User[] = [];
  appointments: Map<string, Map<string, Appointment[]>> = new Map();
  availabilities: Map<string, Map<string, Availability[]>> = new Map();
  patients: Patient[] = [];
  sidebarCollapsed: boolean = false;
  timeSlots: any[] = [];

  // Dialog state
  showEventDialog: boolean = false;
  eventDialogData!: EventDialogData;
  showDeleteConfirmDialog: boolean = false;
  appointmentToDelete: Appointment | null = null;
  showWorkingHoursDialog: boolean = false;
  workingHoursDialogData!: WorkingHoursDialogData;

  // Summary overlay
  summaryOverlayRef: OverlayRef | null = null;
  currentSummaryAppointment: Appointment | null = null;
  isSummaryOpen: boolean = false;

  // Drag state
  dragStartCell: CellEvent | null = null;
  dragCurrentCell: CellEvent | null = null;
  isDragging: boolean = false;

  // Loading state
  isLoading: boolean = false;

  // Category filter
  selectedMacroCategory: OperatorMacroCategory | null = null;

  // Search filters
  searchFilters: AppointmentSearchFilters = { duration: 45, withInstrument: false };
  instrumentCategories: InstrumentCategory[] = [];
  availableSlots: AvailableSlot[] = [];
  slotSearchEnabled: boolean = false;

  constructor(
    public stateService: CalendarStateService,
    private apiService: ApiService,
    private operatorService: OperatorService,
    private instrumentService: InstrumentService,
    private settingsService: SettingsService,
    private availabilityAppointmentService: AvailabilityAppointmentService,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
    private injector: Injector,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscribeToState();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.closeSummary();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToState(): void {
    // Subscribe to config changes (except when triggered by date changes)
    this.stateService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe(config => {
        this.config = { ...config };
        this.cdr.markForCheck();
      });

    // Subscribe to current date changes
    this.stateService.currentDate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(date => {
        this.currentDate = date;
        this.cdr.markForCheck();
      });

    // Subscribe to view changes
    this.stateService.view$
      .pipe(takeUntil(this.destroy$))
      .subscribe(view => {
        this.visibleDates = view.visibleDates;
        this.timeSlots = view.timeSlots;
        this.cdr.markForCheck();
      });

    // Combine config, date, and operator changes and debounce to avoid multiple API calls
    combineLatest([
      this.stateService.config$,
      this.stateService.currentDate$,
      this.stateService.selectedOperators$
    ])
      .pipe(
        debounceTime(50), // Small debounce to group rapid changes
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadAppointmentsForCurrentView();
      });

    // Subscribe to selected operators
    this.stateService.selectedOperators$
      .pipe(takeUntil(this.destroy$))
      .subscribe(operators => {
        this.selectedOperators = operators;
        this.cdr.markForCheck();
      });

    // Subscribe to appointments
    this.stateService.appointments$
      .pipe(takeUntil(this.destroy$))
      .subscribe(appointments => {
        this.appointments = appointments;
        this.cdr.markForCheck();
      });

    // Subscribe to availabilities
    this.stateService.availabilities$
      .pipe(takeUntil(this.destroy$))
      .subscribe(availabilities => {
        this.availabilities = availabilities;
        this.cdr.markForCheck();
      });

    // Subscribe to sidebar state
    this.stateService.sidebarCollapsed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(collapsed => {
        this.sidebarCollapsed = collapsed;
        this.cdr.markForCheck();
      });

    // Subscribe to search filters
    this.stateService.searchFilters$
      .pipe(takeUntil(this.destroy$))
      .subscribe(filters => {
        this.searchFilters = filters;
        this.cdr.markForCheck();
      });

    // Subscribe to available slots
    this.stateService.availableSlots$
      .pipe(takeUntil(this.destroy$))
      .subscribe(slots => {
        this.availableSlots = slots;
        this.cdr.markForCheck();
      });

    // Subscribe to slot search toggle
    this.stateService.slotSearchEnabled$
      .pipe(takeUntil(this.destroy$))
      .subscribe(enabled => {
        this.slotSearchEnabled = enabled;
        this.cdr.markForCheck();
      });

    // Load instrument categories when selected operators change
    this.stateService.selectedOperators$
      .pipe(
        debounceTime(100),
        takeUntil(this.destroy$)
      )
      .subscribe(operators => {
        this.loadInstrumentCategoriesForOperators(operators);
      });

    // Search available slots when filters, operators, date, or toggle change
    combineLatest([
      this.stateService.searchFilters$,
      this.stateService.selectedOperators$,
      this.stateService.currentDate$,
      this.stateService.config$,
      this.stateService.slotSearchEnabled$
    ])
      .pipe(
        debounceTime(150),
        takeUntil(this.destroy$)
      )
      .subscribe(([filters, operators, date, config, searchEnabled]) => {
        if (searchEnabled) {
          this.searchAvailableSlots(filters, operators, date, config);
        } else {
          this.stateService.clearAvailableSlots();
        }
      });
  }

  private async loadInitialData(): Promise<void> {
    try {
      this.isLoading = true;

      // Load calendar settings from backend first
      await this.loadCalendarSettings();

      // Load operators from GraphQL
      await this.loadOperators();

      // Load patients
      const patients = await this.apiService.getPatients().toPromise();
      this.patients = patients || [];

      this.isLoading = false;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  private async loadCalendarSettings(): Promise<void> {
    try {
      const settings = await firstValueFrom(this.settingsService.getCalendarSettings());
      this.stateService.applyBackendSettings(settings);
    } catch (error) {
      console.warn('Error loading calendar settings, using defaults:', error);
    }
  }

  private async loadOperators(): Promise<void> {
    const operators = await firstValueFrom(
      this.operatorService.getOperators(
        this.selectedMacroCategory || undefined,
        undefined,
        true // onlyActive
      )
    );
    this.allUsers = this.mapOperatorsToUsers(operators);

    // Try to restore previously selected operators from storage
    const storedIds = this.stateService.getStoredOperatorIds();

    if (storedIds.length > 0) {
      // Filter only operators that still exist and are active
      const restoredOperators = this.allUsers.filter(
        u => u.active && storedIds.includes(u.id)
      );

      if (restoredOperators.length > 0) {
        console.log('[Calendar] Restored operator selection:', restoredOperators.length);
        this.stateService.setSelectedOperators(restoredOperators);
        this.cdr.markForCheck();
        return;
      } else {
        console.log('[Calendar] Stored operators no longer valid, using defaults');
      }
    }

    // Default: select all active users (only on first load or if stored selection is invalid)
    const activeUsers = this.allUsers.filter(u => u.active);
    this.stateService.setSelectedOperators(activeUsers);
    this.cdr.markForCheck();
  }

  private mapOperatorsToUsers(operators: Operator[]): User[] {
    return operators.map(op => {
      const hasCurrentTemplate = op.templateAssignments?.some(ta => ta.isCurrent) ?? false;

      return {
        id: op.legacyUserId ?? this.hashUUID(op.id),
        name: `${op.name} ${op.surname || ''}`.trim(),
        type: this.translateCategory(op.macroCategory),
        macroCategory: op.macroCategory,
        color: op.color || '#3498db',
        active: op.isActive,
        operatorId: op.id,
        hasTemplate: hasCurrentTemplate
      };
    });
  }

  private translateCategory(cat: OperatorMacroCategory): string {
    const labels: Record<OperatorMacroCategory, string> = {
      [OperatorMacroCategory.Doctor]: 'Medico',
      [OperatorMacroCategory.Physiotherapist]: 'Fisioterapista',
      [OperatorMacroCategory.GymInstructor]: 'Istruttore Palestra'
    };
    return labels[cat] || cat;
  }

  private hashUUID(uuid: string): number {
    // Convert first 8 chars of UUID to number
    return parseInt(uuid.substring(0, 8), 16) % 2147483647;
  }

  async onMacroCategoryChange(category: OperatorMacroCategory | null): Promise<void> {
    this.selectedMacroCategory = category;
    await this.loadOperators();
  }

  private async loadAppointmentsForCurrentView(): Promise<void> {
    if (this.selectedOperators.length === 0) return;

    try {
      const appointmentsMap = new Map<string, Map<string, Appointment[]>>();
      const availabilitiesMap = new Map<string, Map<string, Availability[]>>();

      // Determina le date da caricare
      const startDate = this.config.viewType === 'daily'
        ? this.formatDate(this.currentDate)
        : this.visibleDates[0];
      const endDate = this.config.viewType === 'daily'
        ? this.formatDate(this.currentDate)
        : this.visibleDates[this.visibleDates.length - 1];

      // Filtra operatori con operatorId valido
      const operatorsWithId = this.selectedOperators.filter(u => u.operatorId);

      if (operatorsWithId.length === 0) return;

      // Carica appuntamenti e disponibilità in PARALLELO per tutti gli operatori
      await Promise.all(operatorsWithId.map(async (user) => {
        // Carica appuntamenti da GraphQL (nuovo sistema unificato)
        const gqlAppointments = await firstValueFrom(
          this.availabilityAppointmentService.getAppointmentsByOperator(
            user.operatorId!,
            startDate,
            endDate
          )
        );

        // Converti in formato Appointment frontend
        const appointments = gqlAppointments.map(mapAvailabilityAppointmentToAppointment);

        if (!appointmentsMap.has(user.operatorId!)) {
          appointmentsMap.set(user.operatorId!, new Map());
        }

        // Raggruppa per data
        const operatorDateMap = appointmentsMap.get(user.operatorId!)!;
        appointments.forEach(apt => {
          if (!operatorDateMap.has(apt.date)) {
            operatorDateMap.set(apt.date, []);
          }
          operatorDateMap.get(apt.date)!.push(apt);
        });

        // Carica disponibilità per operatori con template
        if (user.hasTemplate) {
          await this.loadAvailabilityForUser(user, startDate, endDate, availabilitiesMap);
        }
      }));

      this.stateService.setAppointments(appointmentsMap);
      this.stateService.setAvailabilities(availabilitiesMap);
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  }

  private async loadAvailabilityForUser(
    user: User,
    startDate: string,
    endDate: string,
    availabilitiesMap: Map<string, Map<string, Availability[]>>
  ): Promise<void> {
    if (!user.operatorId) return;

    try {
      const dailyAvailabilities = await firstValueFrom(
        this.operatorService.getOperatorAvailability(user.operatorId, startDate, endDate)
      );

      if (!availabilitiesMap.has(user.operatorId)) {
        availabilitiesMap.set(user.operatorId, new Map());
      }

      const operatorDateMap = availabilitiesMap.get(user.operatorId)!;

      let slotCounter = 0;
      for (const daily of dailyAvailabilities) {
        if (daily.hasAvailability && daily.slots) {
          const availabilities: Availability[] = daily.slots
            .filter(slot => slot.isAvailable)
            .map(slot => ({
              id: user.id * 1000000 + (++slotCounter),
              operatorId: user.operatorId!,
              date: daily.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              available: true
            }));

          operatorDateMap.set(daily.date, availabilities);
        }
      }
    } catch (error) {
      console.error(`Error loading availability for operator ${user.operatorId}:`, error);
    }
  }

  // Header events
  onNavigateToday(): void {
    this.stateService.navigateToToday();
  }

  onNavigatePrevious(): void {
    this.stateService.navigatePrevious();
  }

  onNavigateNext(): void {
    this.stateService.navigateNext();
  }

  onViewTypeChange(viewType: 'daily' | 'weekly'): void {
    this.stateService.updateConfig({ viewType });
  }

  // Sidebar events
  onUserToggle(user: User): void {
    this.stateService.toggleOperator(user);
  }

  onSelectAllUsers(): void {
    this.stateService.setSelectedOperators(this.allUsers.filter(u => u.active));
  }

  onDeselectAllUsers(): void {
    this.stateService.setSelectedOperators([]);
  }

  onToggleSidebar(): void {
    this.stateService.toggleSidebar();
  }

  // Toolbar events
  onConfigChange(configUpdate: Partial<CalendarConfig>): void {
    this.stateService.updateConfig(configUpdate);
  }

  // Grid cell events
  onCellMouseDown(event: CellEvent): void {
    // If summary is open, close it and don't start dragging
    if (this.isSummaryOpen) {
      this.closeSummary();
      return;
    }

    this.dragStartCell = event;
    this.dragCurrentCell = event;
    this.isDragging = true;
  }

  onCellMouseEnter(event: CellEvent): void {
    if (this.isDragging) {
      this.dragCurrentCell = event;
    }
  }

  onCellMouseUp(event: CellEvent): void {
    // Don't create appointment if we just closed the summary
    if (this.isDragging && this.dragStartCell && !this.isSummaryOpen) {
      this.createAppointmentFromDrag();
    }
    this.isDragging = false;
    this.dragStartCell = null;
    this.dragCurrentCell = null;
  }

  onCellDblClick(event: CellEvent): void {
    // Close summary if open
    if (this.isSummaryOpen) {
      this.closeSummary();
    }

    const user = this.getUserById(event.userId);
    this.openEventDialog({
      defaultDate: event.date,
      defaultStartTime: event.timeSlot.time,
      defaultEndTime: this.addMinutesToTime(event.timeSlot.time, this.config.slotDuration),
      defaultOperatorId: user?.operatorId,
      users: this.allUsers,
      patients: this.patients
    });
  }

  private createAppointmentFromDrag(): void {
    if (!this.dragStartCell || !this.dragCurrentCell) return;

    const startTime = this.dragStartCell.timeSlot.time;
    const endTime = this.addMinutesToTime(this.dragCurrentCell.timeSlot.time, this.config.slotDuration);

    const user = this.getUserById(this.dragStartCell.userId);
    this.openEventDialog({
      defaultDate: this.dragStartCell.date,
      defaultStartTime: startTime,
      defaultEndTime: endTime,
      defaultOperatorId: user?.operatorId,
      users: this.allUsers,
      patients: this.patients
    });
  }

  // Event events
  onEventClick(action: EventAction): void {
    // Show appointment summary on click
    this.showAppointmentSummary(action.appointment, action.mouseEvent);
  }

  onEventDblClick(action: EventAction): void {
    this.openEventDialog({
      appointment: action.appointment,
      users: this.allUsers,
      patients: this.patients
    });
  }

  onEventDragStart(appointment: Appointment): void {
    // Event drag started
  }

  async onEventDragEnd(action: EventAction): Promise<void> {
    if (!action.newStartTime || !action.newEndTime) return;

    try {
      if (typeof action.appointment.id === 'string') {
        await firstValueFrom(
          this.availabilityAppointmentService.updateAppointment(
            action.appointment.id,
            {
              startTime: action.newStartTime,
              endTime: action.newEndTime
            }
          )
        );
      }

      const updated: Appointment = {
        ...action.appointment,
        startTime: action.newStartTime,
        endTime: action.newEndTime
      };
      this.stateService.updateAppointment(updated);
    } catch (error) {
      console.error('Error updating appointment:', error);
      alert('Errore durante lo spostamento dell\'appuntamento');
      // Ricarica per ripristinare lo stato corretto
      await this.loadAppointmentsForCurrentView();
    }
  }

  async onEventResize(action: EventAction): Promise<void> {
    if (!action.newEndTime) return;

    try {
      if (typeof action.appointment.id === 'string') {
        await firstValueFrom(
          this.availabilityAppointmentService.updateAppointment(
            action.appointment.id,
            {
              endTime: action.newEndTime
            }
          )
        );
      }

      const updated: Appointment = {
        ...action.appointment,
        endTime: action.newEndTime
      };
      this.stateService.updateAppointment(updated);
    } catch (error) {
      console.error('Error resizing appointment:', error);
      alert('Errore durante il ridimensionamento dell\'appuntamento');
      // Ricarica per ripristinare lo stato corretto
      await this.loadAppointmentsForCurrentView();
    }
  }

  async onEventDelete(action: EventAction): Promise<void> {
    this.appointmentToDelete = action.appointment;
    this.showDeleteConfirmDialog = true;
  }

  // Dialog events
  openEventDialog(data: EventDialogData): void {
    // Add instrument categories to dialog data
    this.eventDialogData = {
      ...data,
      instrumentCategories: this.instrumentCategories
    };
    this.showEventDialog = true;
  }

  async onDialogResult(result: EventDialogResult): Promise<void> {
    this.showEventDialog = false;

    if (result.action === 'cancel') {
      return;
    }

    if (result.action === 'delete' && result.appointment) {
      await this.deleteAppointment(result.appointment);
    }

    if (result.action === 'save' && result.appointment) {
      await this.saveAppointment(result.appointment, result.instruments, result.instrumentOrderMatters, result.repeatConfig);
    }
  }

  /**
   * Salva un appuntamento usando il sistema unificato GraphQL (AvailabilityAppointment)
   * Tutti gli appuntamenti passano per questo sistema, con o senza strumenti
   */
  private async saveAppointment(
    appointment: Appointment,
    instruments?: AppointmentInstrumentInput[],
    instrumentOrderMatters?: boolean,
    repeatConfig?: any
  ): Promise<void> {
    try {
      const isUpdate = appointment.id && typeof appointment.id === 'string' && appointment.id.length > 10;

      if (isUpdate) {
        // Update appuntamento esistente (non supporta ricorrenza)
        await firstValueFrom(
          this.availabilityAppointmentService.updateAppointment(
            appointment.id as string,
            {
              clientName: appointment.title,
              patientId: appointment.patientId,
              appointmentDate: appointment.date,
              startTime: appointment.startTime,
              endTime: appointment.endTime,
              notes: appointment.notes,
              instrumentOrderMatters: instrumentOrderMatters,
              instruments: instruments
            }
          )
        );
        console.log('[Calendar] Updated appointment:', appointment.id);
      } else {
        // Crea nuovo appuntamento (supporta ricorrenza)
        const created = await firstValueFrom(
          this.availabilityAppointmentService.createAppointment({
            operatorId: appointment.operatorId,
            clientName: appointment.title,
            patientId: appointment.patientId,
            appointmentDate: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            notes: appointment.notes,
            instrumentOrderMatters: instrumentOrderMatters,
            instruments: instruments,
            repeatConfig: repeatConfig
          })
        );
        console.log('[Calendar] Created appointment:', created.id, repeatConfig ? '(recurring)' : '');
      }

      // Ricarica gli appuntamenti per visualizzare le modifiche
      // Questo triggererà automaticamente anche la ricerca slot disponibili
      await this.loadAppointmentsForCurrentView();
    } catch (error: any) {
      console.error('Error saving appointment:', error);

      // Estrai il messaggio di errore da GraphQL
      let errorMessage = 'Errore durante il salvataggio dell\'appuntamento';

      if (error?.graphQLErrors?.length > 0) {
        // Errore GraphQL con messaggio specifico
        errorMessage = error.graphQLErrors[0].message;
      } else if (error?.message) {
        // Messaggio di errore generico
        const match = error.message.match(/CombinedGraphQLErrors: (.+)/);
        if (match) {
          errorMessage = match[1];
        } else {
          errorMessage = error.message;
        }
      }

      alert(errorMessage);
    }
  }

  private async deleteAppointment(appointment: Appointment): Promise<void> {
    try {
      // Usa GraphQL per eliminare l'appuntamento (sistema unificato)
      if (typeof appointment.id === 'string') {
        await firstValueFrom(
          this.availabilityAppointmentService.deleteAppointment(appointment.id)
        );
      }
      this.stateService.removeAppointment(appointment.id);
      await this.loadAppointmentsForCurrentView();

      // Se la ricerca slot è attiva, forza il refresh degli slot disponibili
      // (lo slot liberato dalla cancellazione potrebbe ora essere disponibile)
      if (this.slotSearchEnabled) {
        await this.searchAvailableSlots(
          this.searchFilters,
          this.selectedOperators,
          this.currentDate,
          this.config
        );
      }
    } catch (error: any) {
      console.error('Error deleting appointment:', error);

      // Estrai il messaggio di errore da GraphQL
      let errorMessage = 'Errore durante l\'eliminazione dell\'appuntamento';

      if (error?.graphQLErrors?.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      } else if (error?.message) {
        const match = error.message.match(/CombinedGraphQLErrors: (.+)/);
        if (match) {
          errorMessage = match[1];
        } else {
          errorMessage = error.message;
        }
      }

      alert(errorMessage);
    }
  }

  async onDeleteConfirm(): Promise<void> {
    this.showDeleteConfirmDialog = false;
    if (this.appointmentToDelete) {
      await this.deleteAppointment(this.appointmentToDelete);
      this.appointmentToDelete = null;
    }
  }

  onDeleteCancel(): void {
    this.showDeleteConfirmDialog = false;
    this.appointmentToDelete = null;
  }

  // Working Hours Dialog
  onOpenWorkingHoursDialog(): void {
    this.workingHoursDialogData = {
      workingHoursStart: this.config.workingHoursStart,
      workingHoursEnd: this.config.workingHoursEnd
    };
    this.showWorkingHoursDialog = true;
  }

  onWorkingHoursDialogResult(result: WorkingHoursDialogResult): void {
    if (result.action === 'save' && result.workingHoursStart !== undefined && result.workingHoursEnd !== undefined) {
      this.stateService.updateConfig({
        workingHoursStart: result.workingHoursStart,
        workingHoursEnd: result.workingHoursEnd
      });
    }
    this.showWorkingHoursDialog = false;
  }

  // Utility methods
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  get slotHeight(): number {
    return Math.round(60 * this.config.zoom);
  }

  get mainDate(): string {
    return this.config.viewType === 'daily' ? this.formatDate(this.currentDate) : this.visibleDates[0];
  }

  // Appointment Summary methods
  showAppointmentSummary(appointment: Appointment, event?: MouseEvent): void {

    // If summary is already open for a different appointment, close it first
    if (this.isSummaryOpen && this.currentSummaryAppointment?.id !== appointment.id) {
      this.closeSummary();
    }

    // If same appointment, just close it
    if (this.currentSummaryAppointment?.id === appointment.id && this.isSummaryOpen) {
      this.closeSummary();
      return;
    }

    // Get the event element position
    const target = event?.target as HTMLElement;
    if (!target) {
      return;
    }

    const eventElement = target.closest('.calendar-event') as HTMLElement;
    if (!eventElement) {
      return;
    }

    // Create overlay
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(eventElement)
      .withPositions([
        // Try to show on the right
        {
          originX: 'end',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'top',
          offsetX: 8
        },
        // If no space on right, show on left
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'end',
          overlayY: 'top',
          offsetX: -8
        },
        // If no horizontal space, show below
        {
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top',
          offsetY: 8
        },
        // If no space below, show above
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -8
        }
      ]);

    const overlayConfig = new OverlayConfig({
      positionStrategy,
      hasBackdrop: false,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      panelClass: 'appointment-summary-overlay'
    });

    this.summaryOverlayRef = this.overlay.create(overlayConfig);

    // Create component portal
    const portal = new ComponentPortal(AppointmentSummaryComponent, this.viewContainerRef);
    const componentRef = this.summaryOverlayRef.attach(portal);

    // Set component inputs
    const instance = componentRef.instance as AppointmentSummaryComponent;
    instance.appointment = appointment;
    instance.user = this.getUserByOperatorId(appointment.operatorId);

    // Handle component outputs
    instance.action.subscribe((action: SummaryAction) => {
      this.handleSummaryAction(action);
    });

    instance.clickOutside.subscribe(() => {
      if (!this.isDragging) {
        this.closeSummary();
      }
    });

    this.currentSummaryAppointment = appointment;
    this.isSummaryOpen = true;

    // Force update position after the component is rendered
    setTimeout(() => {
      this.summaryOverlayRef?.updatePosition();
    }, 0);
  }

  closeSummary(): void {
    if (this.summaryOverlayRef) {
      this.summaryOverlayRef.dispose();
      this.summaryOverlayRef = null;
    }
    this.currentSummaryAppointment = null;
    this.isSummaryOpen = false;
  }

  handleSummaryAction(action: SummaryAction): void {
    switch (action.type) {
      case 'edit':
        this.closeSummary();
        this.openEventDialog({
          appointment: action.appointment,
          users: this.allUsers,
          patients: this.patients
        });
        break;
      case 'delete':
        this.closeSummary();
        this.appointmentToDelete = action.appointment;
        this.showDeleteConfirmDialog = true;
        break;
      case 'share':
        this.shareAppointment(action.appointment, action.shareMethod);
        break;
      case 'close':
        this.closeSummary();
        break;
    }
  }

  shareAppointment(appointment: Appointment, method?: 'email' | 'whatsapp'): void {
    const user = this.getUserByOperatorId(appointment.operatorId);
    const text = `Appuntamento: ${appointment.title}\nData: ${this.formatDateLocalized(new Date(appointment.date + 'T00:00:00'))}\nOra: ${appointment.startTime} - ${appointment.endTime}\nOperatore: ${user?.name || 'N/A'}${appointment.notes ? '\nNote: ' + appointment.notes : ''}`;

    if (method === 'whatsapp') {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
    } else if (method === 'email') {
      const subject = `Appuntamento - ${appointment.title}`;
      const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      window.location.href = mailtoUrl;
    }
  }

  getUserById(userId: number): User | undefined {
    return this.allUsers.find(u => u.id === userId);
  }

  getUserByOperatorId(operatorId: string): User | undefined {
    return this.allUsers.find(u => u.operatorId === operatorId);
  }

  private formatDateLocalized(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('it-IT', options);
  }

  // ============================================
  // Search Filters & Available Slots Methods
  // ============================================

  onSearchFiltersChange(filters: Partial<AppointmentSearchFilters>): void {
    this.stateService.updateSearchFilters(filters);
  }

  onSlotSearchToggle(enabled: boolean): void {
    this.stateService.setSlotSearchEnabled(enabled);
  }

  /**
   * Carica le categorie strumenti disponibili per gli operatori selezionati
   * Filtra in base alla macroCategory degli operatori
   */
  private async loadInstrumentCategoriesForOperators(operators: User[]): Promise<void> {
    if (operators.length === 0) {
      this.instrumentCategories = [];
      return;
    }

    // Ottieni le macro-categorie uniche degli operatori selezionati
    const macroCategories = new Set<OperatorMacroCategory>();
    for (const op of operators) {
      if (op.macroCategory) {
        macroCategories.add(op.macroCategory);
      }
    }

    // Se nessuna macro-categoria, carica tutte le categorie
    if (macroCategories.size === 0) {
      try {
        const categories = await firstValueFrom(this.instrumentService.getInstrumentCategories());
        this.instrumentCategories = categories.filter(c => c.isActive);
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading instrument categories:', error);
      }
      return;
    }

    // Carica categorie per ogni macro-categoria
    try {
      const allCategories: InstrumentCategory[] = [];
      for (const macroCategory of macroCategories) {
        const categories = await firstValueFrom(
          this.instrumentService.getInstrumentCategories(macroCategory)
        );
        allCategories.push(...categories.filter(c => c.isActive));
      }

      // Rimuovi duplicati
      const uniqueCategories = allCategories.filter(
        (cat, index, self) => self.findIndex(c => c.id === cat.id) === index
      );

      this.instrumentCategories = uniqueCategories;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading instrument categories:', error);
    }
  }

  /**
   * Cerca gli slot disponibili per gli operatori selezionati
   */
  private async searchAvailableSlots(
    filters: AppointmentSearchFilters,
    operators: User[],
    currentDate: Date,
    config: CalendarConfig
  ): Promise<void> {
    if (operators.length === 0) {
      this.stateService.clearAvailableSlots();
      return;
    }

    // Solo fisioterapisti con template possono avere slot disponibili
    const physiotherapists = operators.filter(
      op => op.hasTemplate && op.operatorId && op.macroCategory === OperatorMacroCategory.Physiotherapist
    );

    if (physiotherapists.length === 0) {
      this.stateService.clearAvailableSlots();
      return;
    }

    const availableSlots: AvailableSlot[] = [];

    // Determina le date da cercare
    const datesToSearch: string[] = config.viewType === 'daily'
      ? [this.formatDate(currentDate)]
      : this.visibleDates;

    // Costruisci gli instrument slots in base ai filtri
    const instrumentSlots = this.buildInstrumentSlots(filters);

    // Cerca slot per ogni fisioterapista e data
    const searchPromises: Promise<void>[] = [];

    for (const physio of physiotherapists) {
      for (const date of datesToSearch) {
        searchPromises.push(
          this.searchSlotsForOperator(physio, date, filters.duration, instrumentSlots, availableSlots)
        );
      }
    }

    try {
      await Promise.all(searchPromises);
      this.stateService.setAvailableSlots(availableSlots);
    } catch (error) {
      console.error('Error searching available slots:', error);
      this.stateService.clearAvailableSlots();
    }
  }

  /**
   * Cerca slot disponibili per un singolo operatore e data
   */
  private async searchSlotsForOperator(
    operator: User,
    date: string,
    duration: number,
    instrumentSlots: InstrumentSlotInput[] | undefined,
    results: AvailableSlot[]
  ): Promise<void> {
    try {
      const slots = await firstValueFrom(
        this.operatorService.getPhysiotherapistAvailableSlots({
          operatorId: operator.operatorId!,
          date,
          durationMinutes: duration,
          customInstrumentSlots: instrumentSlots
        })
      );

      // Filtra solo slot disponibili e aggiungi ai risultati
      for (const slot of slots) {
        if (slot.available) {
          results.push({
            operatorId: operator.operatorId!,
            date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            color: operator.color,
            availableInstruments: slot.suggestedInstruments?.map(s => ({
              id: s.instrumentId || '',
              name: s.categoryName,
              categoryId: s.instrumentCategoryId
            }))
          });
        }
      }
    } catch (error) {
      console.error(`Error searching slots for operator ${operator.id}:`, error);
    }
  }

  /**
   * Costruisce gli InstrumentSlotInput in base ai filtri di ricerca
   */
  private buildInstrumentSlots(filters: AppointmentSearchFilters): InstrumentSlotInput[] | undefined {
    if (!filters.withInstrument) {
      return undefined;
    }

    const slots: InstrumentSlotInput[] = [];
    const duration = filters.duration;

    if (filters.instrumentCount === 1) {
      // Un solo strumento
      if (!filters.instrumentCategoryId) return undefined;

      if (duration === 30) {
        // Tutto il tempo con strumento
        slots.push({
          instrumentCategoryId: filters.instrumentCategoryId,
          startOffsetMinutes: 0,
          endOffsetMinutes: 30
        });
      } else if (duration === 45 || duration === 60) {
        // Posizione strumento
        const instrumentDuration = 30;
        if (filters.instrumentPosition === 'first') {
          slots.push({
            instrumentCategoryId: filters.instrumentCategoryId,
            startOffsetMinutes: 0,
            endOffsetMinutes: instrumentDuration
          });
        } else if (filters.instrumentPosition === 'second') {
          slots.push({
            instrumentCategoryId: filters.instrumentCategoryId,
            startOffsetMinutes: duration - instrumentDuration,
            endOffsetMinutes: duration
          });
        }
      }
    } else if (filters.instrumentCount === 2) {
      // Due strumenti
      if (!filters.instrumentCategoryId || !filters.instrument2CategoryId) return undefined;

      const halfDuration = duration / 2;

      if (filters.instrumentOrderMatters) {
        // Ordine specifico
        slots.push({
          instrumentCategoryId: filters.instrumentCategoryId,
          startOffsetMinutes: 0,
          endOffsetMinutes: halfDuration
        });
        slots.push({
          instrumentCategoryId: filters.instrument2CategoryId,
          startOffsetMinutes: halfDuration,
          endOffsetMinutes: duration
        });
      } else {
        // Ordine non importante - prova entrambe le combinazioni (il backend gestirà)
        slots.push({
          instrumentCategoryId: filters.instrumentCategoryId,
          startOffsetMinutes: 0,
          endOffsetMinutes: halfDuration
        });
        slots.push({
          instrumentCategoryId: filters.instrument2CategoryId,
          startOffsetMinutes: halfDuration,
          endOffsetMinutes: duration
        });
      }
    }

    return slots.length > 0 ? slots : undefined;
  }

  // ============================================
  // Available Slot Click Handlers
  // ============================================

  onAvailableSlotClick(event: AvailableSlotClickEvent): void {
    // Single click - potrebbe mostrare info sullo slot
    console.log('[Calendar] Available slot clicked:', event);
  }

  onAvailableSlotDblClick(event: AvailableSlotClickEvent): void {
    // Double click - apri dialog per creare appuntamento
    // Calcola l'endTime basato sulla durata dei filtri di ricerca
    const endTime = this.addMinutesToTime(event.startTime, this.searchFilters.duration);

    // Costruisci i searchFilters da passare al dialog
    const dialogSearchFilters = this.slotSearchEnabled && this.searchFilters.withInstrument ? {
      duration: this.searchFilters.duration,
      withInstrument: this.searchFilters.withInstrument,
      instrumentCount: this.searchFilters.instrumentCount,
      instrumentCategoryId: this.searchFilters.instrumentCategoryId,
      instrument2CategoryId: this.searchFilters.instrument2CategoryId,
      instrumentPosition: this.searchFilters.instrumentPosition,
      instrumentOrderMatters: this.searchFilters.instrumentOrderMatters,
      // Includi anche gli strumenti suggeriti dallo slot
      suggestedInstruments: event.availableInstruments
    } : undefined;

    this.openEventDialog({
      defaultDate: event.date,
      defaultStartTime: event.startTime,
      defaultEndTime: endTime,
      defaultOperatorId: event.operatorId,
      users: this.allUsers,
      patients: this.patients,
      searchFilters: dialogSearchFilters
    });
  }
}
