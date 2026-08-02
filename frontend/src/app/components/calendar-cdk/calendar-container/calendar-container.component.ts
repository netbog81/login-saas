import { Component, OnInit, OnDestroy, ViewContainerRef, Injector, ChangeDetectorRef, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, combineLatest, debounceTime, firstValueFrom, forkJoin } from 'rxjs';
import { Overlay, OverlayRef, OverlayConfig, ConnectedPosition } from '@angular/cdk/overlay';
import { OverlayModule } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

// Services
import { CalendarStateService, CalendarConfig, AppointmentSearchFilters, AvailableSlot } from '../services/calendar-state.service';
import { ApiService } from '../../../services/api.service';
import { OperatorService } from '../../../services/operator.service';
import { InstrumentService } from '../../../services/instrument.service';
import { SettingsService } from '../../../services/settings.service';
import { AvailabilityAppointmentService, AppointmentInstrumentInput } from '../../../services/availability-appointment.service';
import { GymRoomService, GymRoom, GymSlotInfo, GymAppointment } from '../../../services/gym-room.service';
import { PatientService } from '../../../services/patient.service';
import { TreatmentService } from '../../../services/treatment.service';
import { SseService, AppointmentEvent } from '../../../services/sse.service';

// GraphQL types
import { Operator, OperatorMacroCategory, InstrumentCategory, InstrumentSlotInput } from '../../../graphql/generated/types';

// Components
import { CalendarHeaderComponent } from '../calendar-header/calendar-header.component';
import { CalendarSidebarComponent } from '../calendar-sidebar/calendar-sidebar.component';
import { CalendarToolbarComponent } from '../calendar-toolbar/calendar-toolbar.component';
import { CalendarGridComponent } from '../calendar-grid/calendar-grid.component';
import { CalendarWeeklyGridComponent } from '../calendar-weekly-grid/calendar-weekly-grid.component';
import { GymCalendarGridComponent, GymSlotClickEvent } from '../gym-calendar-grid/gym-calendar-grid.component';
import { GymWeeklyGridComponent } from '../gym-weekly-grid/gym-weekly-grid.component';
import { EventDialogComponent, EventDialogData, EventDialogResult } from '../event-dialog/event-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { AppointmentSummaryComponent, SummaryAction } from '../appointment-summary/appointment-summary.component';
import { GymSlotSummaryComponent, GymSlotSummaryAction } from '../gym-slot-summary/gym-slot-summary.component';
import { UsersLegendComponent } from '../users-legend/users-legend.component';
import { WorkingHoursDialogComponent, WorkingHoursDialogData, WorkingHoursDialogResult } from '../working-hours-dialog/working-hours-dialog.component';
import { GymAppointmentDialogComponent, GymAppointmentDialogData, GymAppointmentDialogResult } from '../gym-appointment-dialog/gym-appointment-dialog.component';
import { CellEvent } from '../calendar-cell/calendar-cell.component';
import { EventAction } from '../calendar-event/calendar-event.component';
import { AvailableSlotClickEvent } from '../available-slot-overlay/available-slot-overlay.component';

// Models
import { Appointment } from '../../../models/appointment.model';
import { User } from '../../../models/user.model';
import { Patient } from '../../../models/patient.model';
import { Availability } from '../../../models/availability.model';
import { Treatment } from '../../../models/treatment.model';

// Utils
import { mapAvailabilityAppointmentToAppointment } from '../../../utils/appointment.mapper';

// Shared Components
import { NewPatientDialogComponent, NewPatientDialogResult } from '../../../shared/components/new-patient-dialog';
import { GymAppointmentMatDialogComponent, GymAppointmentMatDialogResult } from '../../../shared/components/gym-appointment-mat-dialog';
import { EventMatDialogComponent, EventMatDialogResult } from '../../../shared/components/event-mat-dialog';

@Component({
  selector: 'app-calendar-container',
  standalone: true,
  imports: [
    CommonModule,
    OverlayModule,
    MatButtonModule,
    CalendarHeaderComponent,
    CalendarSidebarComponent,
    CalendarToolbarComponent,
    CalendarGridComponent,
    CalendarWeeklyGridComponent,
    GymCalendarGridComponent,
    GymWeeklyGridComponent,
    EventDialogComponent,
    ConfirmDialogComponent,
    UsersLegendComponent,
    WorkingHoursDialogComponent,
    GymAppointmentDialogComponent,
    GymSlotSummaryComponent
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
  gymTimeSlots: any[] = []; // TimeSlots specifici per palestre (60 min)

  // Dialog state
  showEventDialog: boolean = false;
  eventDialogData!: EventDialogData;
  showDeleteConfirmDialog: boolean = false;
  appointmentToDelete: Appointment | null = null;
  showWorkingHoursDialog: boolean = false;
  workingHoursDialogData!: WorkingHoursDialogData;
  showGymAppointmentDialog: boolean = false;
  gymAppointmentDialogData!: GymAppointmentDialogData;

  // Summary overlay
  summaryOverlayRef: OverlayRef | null = null;
  currentSummaryAppointment: Appointment | null = null;
  isSummaryOpen: boolean = false;

  // Gym slot summary overlay
  gymSlotSummaryOverlayRef: OverlayRef | null = null;
  isGymSlotSummaryOpen: boolean = false;
  currentGymSlotData: { gymRoom: GymRoom; slotInfo: GymSlotInfo; date: string; appointments: GymAppointment[] } | null = null;

  // Click/double-click debounce for gym slots
  private gymSlotClickTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingGymSlotClick: GymSlotClickEvent | null = null;

  // Gym appointment delete confirmation
  showGymDeleteConfirmDialog: boolean = false;
  gymAppointmentToDelete: GymAppointment | null = null;

  // Drag state
  dragStartCell: CellEvent | null = null;
  dragCurrentCell: CellEvent | null = null;
  isDragging: boolean = false;

  // Loading state
  isLoading: boolean = false;

  // Concurrency guard for loadAppointmentsForCurrentView.
  // Prevents overlapping invocations (e.g. SSE events arriving during initial load)
  // from racing each other and from triggering concurrent rebuildCache calls server-side.
  // If a load is requested while one is already in flight, we mark a "pending" reload
  // that will be executed once the current one completes.
  private loadInFlight: Promise<void> | null = null;
  private loadPending: boolean = false;

  // Category filter
  selectedMacroCategory: OperatorMacroCategory | null = null;

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  // Search filters
  searchFilters: AppointmentSearchFilters = { duration: 45, withInstrument: false };
  instrumentCategories: InstrumentCategory[] = [];
  availableSlots: AvailableSlot[] = [];
  slotSearchEnabled: boolean = false;

  // Treatments in progress state (for sidebar)
  ongoingTreatments: Treatment[] = [];
  loadingTreatments: boolean = false;

  // Gym view state
  gymRooms: GymRoom[] = [];
  // Vista giornaliera: gymRoomId -> slots
  gymSlotsInfo: Map<string, GymSlotInfo[]> = new Map();
  gymAppointments: Map<string, GymAppointment[]> = new Map();
  // Vista settimanale: date -> gymRoomId -> slots
  gymWeeklySlotsInfo: Map<string, Map<string, GymSlotInfo[]>> = new Map();
  gymWeeklyAppointments: Map<string, Map<string, GymAppointment[]>> = new Map();

  // Cache per ottimizzazione performance transizione vista
  // Cache key format: `${operatorId}-${startDate}-${endDate}`
  private operatorAppointmentsCache: Map<string, {
    appointments: Appointment[];
    timestamp: number;
  }> = new Map();

  // MatDialog per i dialog Angular Material (es. NewPatientDialog, GymAppointmentMatDialog)
  private dialog = inject(MatDialog);

  /**
   * Flag per switch tra vecchio e nuovo dialog creazione appuntamento palestra.
   * - true: usa il nuovo GymAppointmentMatDialogComponent (MatDialog)
   * - false: usa il vecchio GymAppointmentDialogComponent (overlay custom)
   * Mantenere false per rollback se necessario.
   */
  private useNewGymAppointmentDialog = true;

  /**
   * Flag per switch tra vecchio e nuovo dialog creazione appuntamento operatori.
   * - true: usa il nuovo EventMatDialogComponent (MatDialog)
   * - false: usa il vecchio EventDialogComponent (overlay custom)
   * Mantenere false per rollback se necessario.
   */
  private useNewEventDialog = true;

  constructor(
    public stateService: CalendarStateService,
    private apiService: ApiService,
    private operatorService: OperatorService,
    private instrumentService: InstrumentService,
    private settingsService: SettingsService,
    private availabilityAppointmentService: AvailabilityAppointmentService,
    private gymRoomService: GymRoomService,
    private patientService: PatientService,
    private treatmentService: TreatmentService,
    private sseService: SseService,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
    private injector: Injector,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.subscribeToState();
    this.loadInitialData();
    this.subscribeToSseEvents();
  }

  /**
   * Sottoscrive agli eventi SSE per aggiornamenti real-time
   * Gestisce sia eventi appuntamenti che eventi trattamenti
   */
  private subscribeToSseEvents(): void {
    this.sseService.getAppointmentEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event: AppointmentEvent) => {
          // Eventi appuntamenti (auto-attendance)
          if (event.type === 'appointment_status_changed') {
            // In modalità palestra, non ricaricare su SSE generici
            // (la vista gym si ricarica solo su azioni esplicite)
            if (this.config.viewMode === 'gyms') return;

            console.log('[Calendar] SSE: Appointment status changed, reloading...');
            this.ngZone.run(async () => {
              this.invalidateOperatorCache();
              await this.loadAppointmentsForCurrentView();
              this.cdr.detectChanges();
            });
          }

          // Eventi trattamenti (creazione, completamento, chiusura, cancellazione)
          if (['treatment_created', 'treatment_status_changed', 'treatment_deleted'].includes(event.type)) {
            console.log('[Calendar] SSE: Treatment event:', event.type);
            this.ngZone.run(() => {
              // Ricarica la lista dei trattamenti in corso nella sidebar
              this.loadOngoingTreatments();
              this.cdr.detectChanges();
            });
          }

          // Struttura orari cambiata da un altro utente (template, eccezioni,
          // assenze, festività): la griglia disponibilità è stale.
          if (event.type === 'availability_changed') {
            if (this.config.viewMode === 'gyms') return;
            this.ngZone.run(async () => {
              this.invalidateOperatorCache();
              await this.loadAppointmentsForCurrentView();
              this.cdr.detectChanges();
            });
          }
        },
        error: (err) => {
          console.warn('[Calendar] SSE connection error:', err);
          // Non propagare l'errore - SSE si riconnetterà automaticamente
        }
      });
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
        // Genera timeSlots specifici per palestre con slotDuration di 60 minuti
        this.gymTimeSlots = this.generateGymTimeSlots();
        this.cdr.markForCheck();
      });

    // Combine config, date, and operator changes and debounce to avoid multiple API calls
    combineLatest([
      this.stateService.config$,
      this.stateService.currentDate$,
      this.stateService.selectedOperators$
    ])
      .pipe(
        debounceTime(300), // Debounce to group rapid changes at startup
        takeUntil(this.destroy$)
      )
      .subscribe(([config, date, operators]) => {
        // Quick Win: Mostra loading state immediatamente per feedback visivo
        this.isLoading = true;
        this.cdr.markForCheck();

        this.loadAppointmentsForCurrentView();

        // Pre-carica dati operatori in background quando su vista palestre
        // Questo permette transizione veloce gyms -> operators
        if (config.viewMode === 'gyms' && operators.length > 0) {
          this.preloadOperatorDataInBackground(operators);
        }
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

      // Load patients via GraphQL
      const patients = await firstValueFrom(this.patientService.getPatients());

      this.patients = patients || [];
      this.isLoading = false;
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.isLoading = false;
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
        return;
      } else {
        console.log('[Calendar] Stored operators no longer valid, using defaults');
      }
    }

    // Default: select all active users (only on first load or if stored selection is invalid)
    const activeUsers = this.allUsers.filter(u => u.active);
    this.stateService.setSelectedOperators(activeUsers);
  }

  private mapOperatorsToUsers(operators: Operator[]): User[] {
    return operators.map(op => {
      const hasCurrentTemplate = op.templateAssignments?.some(ta => ta.isCurrent) ?? false;

      return {
        id: op.legacyUserId?.toString() ?? op.id,
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
      [OperatorMacroCategory.GymInstructor]: 'Istruttore Palestra',
      [OperatorMacroCategory.Other]: 'Altro'
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

  /**
   * Public entrypoint for loading appointments. Serializes concurrent calls:
   * if a load is already in progress, marks a pending reload that will run
   * once the current one completes (collapsing multiple pending requests into one).
   *
   * This prevents the race where, during initial calendar load, an SSE event
   * triggers a second loadAppointmentsForCurrentView while the first is still
   * fetching availability — which used to fire concurrent operatorAvailability
   * GraphQL queries that violated the availability_cache UNIQUE constraint.
   */
  private async loadAppointmentsForCurrentView(): Promise<void> {
    if (this.loadInFlight) {
      this.loadPending = true;
      return this.loadInFlight;
    }

    this.loadInFlight = (async () => {
      try {
        await this.doLoadAppointmentsForCurrentView();
        // Drain any reload requested while we were running. Loop because another
        // request may arrive during the drain itself.
        while (this.loadPending) {
          this.loadPending = false;
          await this.doLoadAppointmentsForCurrentView();
        }
      } finally {
        this.loadInFlight = null;
      }
    })();

    return this.loadInFlight;
  }

  private async doLoadAppointmentsForCurrentView(): Promise<void> {
    // Usa il metodo bulk ottimizzato (3 query invece di N*2+N)
    return this.doLoadAppointmentsForCurrentViewBulk();
  }

  /**
   * @deprecated Metodo originale per-operatore. Mantenuto per rollback.
   */
  private async doLoadAppointmentsForCurrentViewLegacy(): Promise<void> {
    // Salva il viewMode corrente per verificare che non sia cambiato durante il caricamento
    const currentViewMode = this.config?.viewMode;

    // Se siamo in modalità palestre, carica i dati delle palestre invece degli operatori
    if (currentViewMode === 'gyms') {
      await this.loadGymDataForCurrentView();
      return;
    }

    if (this.selectedOperators.length === 0) {
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

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

      if (operatorsWithId.length === 0) {
        this.isLoading = false;
        this.cdr.markForCheck();
        return;
      }

      // Carica appuntamenti e disponibilità in PARALLELO per tutti gli operatori
      await Promise.all(operatorsWithId.map(async (user) => {
        // Prova prima dalla cache
        let appointments = this.getCachedOperatorAppointments(user.operatorId!, startDate, endDate);

        if (!appointments) {
          // Cache miss: carica da API
          const gqlAppointments = await firstValueFrom(
            this.availabilityAppointmentService.getAppointmentsByOperator(
              user.operatorId!,
              startDate,
              endDate
            )
          );

          // Converti in formato Appointment frontend
          appointments = gqlAppointments.map(mapAvailabilityAppointmentToAppointment);

          // Salva in cache per prossime richieste
          this.setCachedOperatorAppointments(user.operatorId!, startDate, endDate, appointments);
        }

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

      // Quick Win: Verifica che il viewMode non sia cambiato durante il caricamento
      // Se l'utente ha cambiato vista, scarta i risultati
      if (this.config?.viewMode !== currentViewMode) {
        return;
      }

      this.stateService.setAppointments(appointmentsMap);
      this.stateService.setAvailabilities(availabilitiesMap);
      this.isLoading = false;
      this.cdr.markForCheck();

      // Carica anche i trattamenti in corso per la sidebar
      this.loadOngoingTreatments();
    } catch (error) {
      console.error('Error loading appointments:', error);
      this.isLoading = false;
      this.cdr.markForCheck();
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
              id: `${user.id}-slot-${++slotCounter}`,
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

  // ==========================================
  // BULK LOAD - Caricamento ottimizzato operatori (3 query invece di N*2+N)
  // ==========================================

  /**
   * Caricamento bulk per vista operatori: 3 query parallele
   * invece di N query per appuntamenti + N per disponibilità + N per trattamenti.
   */
  private async doLoadAppointmentsForCurrentViewBulk(): Promise<void> {
    const currentViewMode = this.config?.viewMode;
    if (currentViewMode === 'gyms') {
      await this.loadGymDataForCurrentView();
      return;
    }

    const operatorsWithId = this.selectedOperators.filter(u => u.operatorId);
    if (operatorsWithId.length === 0) {
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      const startDate = this.config.viewType === 'daily'
        ? this.formatDate(this.currentDate)
        : this.visibleDates[0];
      const endDate = this.config.viewType === 'daily'
        ? this.formatDate(this.currentDate)
        : this.visibleDates[this.visibleDates.length - 1];

      const operatorIds = operatorsWithId.map(u => u.operatorId!);
      const operatorsWithTemplate = operatorsWithId.filter(u => u.hasTemplate).map(u => u.operatorId!);

      // 3 query parallele (invece di N*2 + N)
      const [allAppointments, availabilityResults] = await Promise.all([
        // 1. Appuntamenti per tutti gli operatori selezionati (1 query)
        firstValueFrom(this.availabilityAppointmentService.getAppointments(startDate, endDate, operatorIds)),
        // 2. Disponibilità per operatori con template (1 query)
        operatorsWithTemplate.length > 0
          ? firstValueFrom(this.operatorService.getOperatorsAvailability(operatorsWithTemplate, startDate, endDate))
          : Promise.resolve([]),
      ]);

      if (this.config?.viewMode !== currentViewMode) return;

      // Mappa appuntamenti per operatorId → date → appointments
      const appointmentsMap = new Map<string, Map<string, Appointment[]>>();
      const appointments = allAppointments.map(mapAvailabilityAppointmentToAppointment);

      for (const apt of appointments) {
        if (!appointmentsMap.has(apt.operatorId)) {
          appointmentsMap.set(apt.operatorId, new Map());
        }
        const dateMap = appointmentsMap.get(apt.operatorId)!;
        if (!dateMap.has(apt.date)) dateMap.set(apt.date, []);
        dateMap.get(apt.date)!.push(apt);
      }

      // Mappa disponibilità per operatorId → date → availabilities
      const availabilitiesMap = new Map<string, Map<string, Availability[]>>();
      let slotCounter = 0;
      for (const opResult of (availabilityResults as { operatorId: string; availability: any[] }[])) {
        if (!availabilitiesMap.has(opResult.operatorId)) {
          availabilitiesMap.set(opResult.operatorId, new Map());
        }
        const opDateMap = availabilitiesMap.get(opResult.operatorId)!;
        const user = operatorsWithId.find(u => u.operatorId === opResult.operatorId);

        for (const daily of opResult.availability) {
          if (daily.hasAvailability && daily.slots) {
            const avails: Availability[] = daily.slots
              .filter((slot: any) => slot.isAvailable)
              .map((slot: any) => ({
                id: `${user?.id || opResult.operatorId}-slot-${++slotCounter}`,
                operatorId: opResult.operatorId,
                date: daily.date,
                startTime: slot.startTime,
                endTime: slot.endTime,
                available: true,
              }));
            opDateMap.set(daily.date, avails);
          }
        }
      }

      this.stateService.setAppointments(appointmentsMap);
      this.stateService.setAvailabilities(availabilitiesMap);
      this.isLoading = false;
      this.cdr.markForCheck();

      // 3. Trattamenti in corso (1 query bulk)
      this.loadOngoingTreatmentsBulk();
    } catch (error) {
      console.error('Error loading appointments (bulk):', error);
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // TREATMENTS IN PROGRESS - Per sidebar calendario
  // ==========================================

  /**
   * Carica i trattamenti in corso per tutti gli operatori (bulk - 1 query).
   */
  private loadOngoingTreatmentsBulk(): void {
    if (this.config?.viewMode !== 'operators') {
      this.ongoingTreatments = [];
      return;
    }

    const operatorsWithId = this.allUsers.filter(u => u.operatorId);
    if (operatorsWithId.length === 0) {
      this.ongoingTreatments = [];
      this.loadingTreatments = false;
      this.cdr.markForCheck();
      return;
    }

    this.loadingTreatments = true;
    this.cdr.markForCheck();

    const date = this.formatDate(this.currentDate);
    const operatorIds = operatorsWithId.map(op => op.operatorId!);

    this.treatmentService.getTreatmentsByOperators(operatorIds, date)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (treatments) => {
          this.ngZone.run(() => {
            this.ongoingTreatments = [...treatments];
            this.loadingTreatments = false;
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('Errore caricamento trattamenti in corso:', err);
          this.loadingTreatments = false;
          this.ongoingTreatments = [];
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Carica i trattamenti in corso per tutti gli operatori.
   * @deprecated Usare loadOngoingTreatmentsBulk per performance migliori
   */
  private loadOngoingTreatments(): void {
    // Solo per vista operatori
    if (this.config?.viewMode !== 'operators') {
      this.ongoingTreatments = [];
      return;
    }

    // Prendi tutti gli operatori con operatorId valido
    const operatorsWithId = this.allUsers.filter(u => u.operatorId);

    if (operatorsWithId.length === 0) {
      this.ongoingTreatments = [];
      this.loadingTreatments = false;
      this.cdr.markForCheck();
      return;
    }

    this.loadingTreatments = true;
    this.cdr.markForCheck();

    const date = this.formatDate(this.currentDate);

    // Carica trattamenti per tutti gli operatori in parallelo
    const observables = operatorsWithId.map(op =>
      this.treatmentService.getTreatmentsByOperator(op.operatorId!, date)
    );

    forkJoin(observables)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.ngZone.run(() => {
            // Unisci tutti i trattamenti - crea nuovo array per forzare change detection
            this.ongoingTreatments = [...results.flat()];
            this.loadingTreatments = false;
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('Errore caricamento trattamenti in corso:', err);
          this.loadingTreatments = false;
          this.ongoingTreatments = [];
          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // CACHE MANAGEMENT - Ottimizzazione transizione vista
  // ==========================================

  /**
   * Genera la chiave cache per un operatore e range di date
   */
  private getOperatorCacheKey(operatorId: string, startDate: string, endDate: string): string {
    return `${operatorId}-${startDate}-${endDate}`;
  }

  /**
   * Ottiene gli appuntamenti dalla cache se disponibili
   */
  private getCachedOperatorAppointments(operatorId: string, startDate: string, endDate: string): Appointment[] | null {
    const cacheKey = this.getOperatorCacheKey(operatorId, startDate, endDate);
    const cached = this.operatorAppointmentsCache.get(cacheKey);
    return cached?.appointments || null;
  }

  /**
   * Salva gli appuntamenti nella cache
   */
  private setCachedOperatorAppointments(operatorId: string, startDate: string, endDate: string, appointments: Appointment[]): void {
    const cacheKey = this.getOperatorCacheKey(operatorId, startDate, endDate);
    this.operatorAppointmentsCache.set(cacheKey, {
      appointments,
      timestamp: Date.now()
    });
  }

  /**
   * Invalida tutta la cache degli appuntamenti operatori
   * Chiamato dopo create/update/delete di appuntamenti
   */
  private invalidateOperatorCache(): void {
    this.operatorAppointmentsCache.clear();
  }

  /**
   * Pre-carica i dati degli operatori in background quando l'utente è su vista palestre.
   * Questo permette una transizione veloce quando passa a vista operatori.
   */
  private preloadOperatorDataInBackground(operators: User[]): void {
    const startDate = this.config.viewType === 'daily'
      ? this.formatDate(this.currentDate)
      : this.visibleDates[0];
    const endDate = this.config.viewType === 'daily'
      ? this.formatDate(this.currentDate)
      : this.visibleDates[this.visibleDates.length - 1];

    // Pre-carica solo operatori con operatorId che non sono già in cache
    const operatorsToPreload = operators.filter(u => {
      if (!u.operatorId) return false;
      const cacheKey = this.getOperatorCacheKey(u.operatorId, startDate, endDate);
      return !this.operatorAppointmentsCache.has(cacheKey);
    });

    if (operatorsToPreload.length === 0) return;

    // Carica in background senza bloccare l'UI
    operatorsToPreload.forEach(user => {
      this.availabilityAppointmentService.getAppointmentsByOperator(
        user.operatorId!,
        startDate,
        endDate
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (gqlAppointments) => {
          const appointments = gqlAppointments.map(mapAvailabilityAppointmentToAppointment);
          this.setCachedOperatorAppointments(user.operatorId!, startDate, endDate, appointments);
        },
        error: (err) => {
          // Ignora errori nel pre-caricamento - non è critico
          console.warn(`[Cache] Preload failed for operator ${user.operatorId}:`, err);
        }
      });
    });
  }

  // ==========================================
  // METODI PER VISTA PALESTRE (GYM VIEW)
  // ==========================================

  /**
   * Carica i dati delle palestre per la vista corrente
   */
  private async loadGymDataForCurrentView(): Promise<void> {
    this.isLoading = true;
    this.cdr.markForCheck();

    try {
      // Carica le palestre se non ancora caricate
      if (this.gymRooms.length === 0) {
        await this.loadGymRooms();
      }

      if (this.gymRooms.length === 0) {
        this.isLoading = false;
        this.cdr.markForCheck();
        return;
      }

      if (this.config.viewType === 'daily') {
        await this.loadGymDailyData();
      } else {
        await this.loadGymWeeklyData();
      }

      this.isLoading = false;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading gym data:', error);
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Carica i dati delle palestre per vista giornaliera
   */
  private async loadGymDailyData(): Promise<void> {
    const date = this.formatDate(this.currentDate);
    const gymRoomIds = this.gymRooms.map(r => r.id);

    // 2 query parallele batch invece di 2*N query singole
    const [allSlots, allAppointments] = await Promise.all([
      firstValueFrom(this.gymRoomService.getAvailableSlotsForRooms(gymRoomIds, date, date)).catch(() => []),
      firstValueFrom(this.gymRoomService.getAppointmentsForRooms(gymRoomIds, date, date)).catch(() => [] as GymAppointment[]),
    ]);

    // Raggruppa per gymRoomId
    const slotsMap = new Map<string, GymSlotInfo[]>();
    const appointmentsMap = new Map<string, GymAppointment[]>();

    for (const roomId of gymRoomIds) {
      slotsMap.set(roomId, (allSlots as any[]).filter(s => s.gymRoomId === roomId));
      appointmentsMap.set(roomId, (allAppointments as GymAppointment[]).filter(a => a.gymRoomId === roomId));
    }

    this.gymSlotsInfo = slotsMap;
    this.gymAppointments = appointmentsMap;
  }

  /**
   * Carica i dati delle palestre per vista settimanale
   */
  private async loadGymWeeklyData(): Promise<void> {
    const gymRoomIds = this.gymRooms.map(r => r.id);
    const startDate = this.visibleDates[0];
    const endDate = this.visibleDates[this.visibleDates.length - 1];

    // 2 query parallele batch invece di 2*D*N query singole
    const [allSlots, allAppointments] = await Promise.all([
      firstValueFrom(this.gymRoomService.getAvailableSlotsForRooms(gymRoomIds, startDate, endDate)).catch(() => []),
      firstValueFrom(this.gymRoomService.getAppointmentsForRooms(gymRoomIds, startDate, endDate)).catch(() => [] as GymAppointment[]),
    ]);

    // Raggruppa per date -> gymRoomId
    const weeklySlotsMap = new Map<string, Map<string, GymSlotInfo[]>>();
    const weeklyAppointmentsMap = new Map<string, Map<string, GymAppointment[]>>();

    for (const date of this.visibleDates) {
      const dateSlotsMap = new Map<string, GymSlotInfo[]>();
      const dateAppointmentsMap = new Map<string, GymAppointment[]>();

      for (const roomId of gymRoomIds) {
        dateSlotsMap.set(roomId, (allSlots as any[]).filter(s => s.gymRoomId === roomId && s.date === date));
        dateAppointmentsMap.set(roomId, (allAppointments as GymAppointment[]).filter(a => a.gymRoomId === roomId && a.appointmentDate === date));
      }

      weeklySlotsMap.set(date, dateSlotsMap);
      weeklyAppointmentsMap.set(date, dateAppointmentsMap);
    }

    this.gymWeeklySlotsInfo = weeklySlotsMap;
    this.gymWeeklyAppointments = weeklyAppointmentsMap;
  }

  /**
   * Carica le palestre attive
   */
  private async loadGymRooms(): Promise<void> {
    try {
      this.gymRooms = await firstValueFrom(this.gymRoomService.getAll(true));
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading gym rooms:', error);
      this.gymRooms = [];
    }
  }

  /**
   * Gestisce il click su uno slot della palestra - mostra il riepilogo
   * Utilizza un debounce per evitare conflitto con il doppio click
   */
  onGymSlotClick(event: GymSlotClickEvent): void {
    // Se lo slot non ha template, non fare nulla
    if (!event.slotInfo) {
      return;
    }

    // Cancella eventuali timer precedenti
    if (this.gymSlotClickTimer) {
      clearTimeout(this.gymSlotClickTimer);
      this.gymSlotClickTimer = null;
    }

    // Salva l'evento per il debounce
    this.pendingGymSlotClick = event;

    // Aspetta 250ms prima di mostrare il summary per vedere se arriva un double-click
    this.gymSlotClickTimer = setTimeout(() => {
      if (this.pendingGymSlotClick) {
        // Ottieni gli appuntamenti per questo slot
        const appointments = this.getGymSlotAppointments(
          this.pendingGymSlotClick.gymRoom.id,
          this.pendingGymSlotClick.date,
          this.pendingGymSlotClick.startTime
        );

        // Mostra il summary overlay
        this.showGymSlotSummary(this.pendingGymSlotClick, appointments);
        this.pendingGymSlotClick = null;
      }
      this.gymSlotClickTimer = null;
    }, 250);
  }

  /**
   * Ottiene gli appuntamenti per uno slot specifico della palestra
   */
  private getGymSlotAppointments(gymRoomId: string, date: string, startTime: string): GymAppointment[] {
    if (this.config.viewType === 'daily') {
      const roomAppointments = this.gymAppointments.get(gymRoomId) || [];
      return roomAppointments.filter(apt => this.normalizeTime(apt.startTime) === this.normalizeTime(startTime));
    } else {
      const dateAppointments = this.gymWeeklyAppointments.get(date);
      if (!dateAppointments) return [];
      const roomAppointments = dateAppointments.get(gymRoomId) || [];
      return roomAppointments.filter(apt => this.normalizeTime(apt.startTime) === this.normalizeTime(startTime));
    }
  }

  /**
   * Normalizza il formato dell'orario a HH:MM
   */
  private normalizeTime(time: string): string {
    if (!time) return time;
    const parts = time.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }

  /**
   * Mostra il summary overlay per uno slot della palestra
   */
  private showGymSlotSummary(event: GymSlotClickEvent, appointments: GymAppointment[]): void {
    // Chiudi summary esistente se aperto
    if (this.isGymSlotSummaryOpen) {
      this.closeGymSlotSummary();
    }

    // Ottieni l'elemento cliccato per posizionare l'overlay
    const target = event.mouseEvent?.target as HTMLElement;
    if (!target) {
      return;
    }

    const slotElement = target.closest('.gym-slot, .gym-time-slot, .slot-cell') as HTMLElement;
    if (!slotElement) {
      return;
    }

    // Crea l'overlay con posizionamento flessibile
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(slotElement)
      .withPositions([
        // Prova a mostrare a destra
        {
          originX: 'end',
          originY: 'center',
          overlayX: 'start',
          overlayY: 'center',
          offsetX: 8
        },
        // Se non c'è spazio a destra, mostra a sinistra
        {
          originX: 'start',
          originY: 'center',
          overlayX: 'end',
          overlayY: 'center',
          offsetX: -8
        },
        // Se non c'è spazio orizzontale, mostra sotto
        {
          originX: 'center',
          originY: 'bottom',
          overlayX: 'center',
          overlayY: 'top',
          offsetY: 8
        },
        // Se non c'è spazio sotto, mostra sopra
        {
          originX: 'center',
          originY: 'top',
          overlayX: 'center',
          overlayY: 'bottom',
          offsetY: -8
        }
      ]);

    const overlayConfig = new OverlayConfig({
      positionStrategy,
      hasBackdrop: false,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      panelClass: 'gym-slot-summary-overlay'
    });

    this.gymSlotSummaryOverlayRef = this.overlay.create(overlayConfig);

    try {
      // Crea il component portal
      const portal = new ComponentPortal(GymSlotSummaryComponent, this.viewContainerRef);
      const componentRef = this.gymSlotSummaryOverlayRef.attach(portal);

      // Imposta gli input del componente
      const instance = componentRef.instance as GymSlotSummaryComponent;
      instance.gymRoom = event.gymRoom;
      instance.slotInfo = event.slotInfo;
      instance.appointments = appointments;
      instance.date = event.date;

      // Gestisci gli output
      instance.action.subscribe((action: GymSlotSummaryAction) => {
        this.handleGymSlotSummaryAction(action);
      });

      instance.clickOutside.subscribe(() => {
        this.closeGymSlotSummary();
      });

      this.currentGymSlotData = {
        gymRoom: event.gymRoom,
        slotInfo: event.slotInfo,
        date: event.date,
        appointments
      };
      this.isGymSlotSummaryOpen = true;

      // Forza aggiornamento posizione dopo il rendering
      setTimeout(() => {
        this.gymSlotSummaryOverlayRef?.updatePosition();
      }, 0);
    } catch (error) {
      console.error('Error creating gym slot summary overlay:', error);
    }

    this.cdr.markForCheck();
  }

  /**
   * Chiude il summary overlay della palestra
   */
  closeGymSlotSummary(): void {
    if (this.gymSlotSummaryOverlayRef) {
      this.gymSlotSummaryOverlayRef.dispose();
      this.gymSlotSummaryOverlayRef = null;
    }
    this.currentGymSlotData = null;
    this.isGymSlotSummaryOpen = false;
  }

  /**
   * Gestisce le azioni dal summary della palestra
   */
  private handleGymSlotSummaryAction(action: GymSlotSummaryAction): void {
    switch (action.type) {
      case 'edit':
        if (action.appointment) {
          this.closeGymSlotSummary();
          this.openGymAppointmentEditDialog(action.appointment, action.gymRoom!, action.slotInfo!, action.date!);
        }
        break;
      case 'delete':
        if (action.appointment) {
          this.closeGymSlotSummary();
          this.gymAppointmentToDelete = action.appointment;
          this.showGymDeleteConfirmDialog = true;
        }
        break;
      case 'add':
        if (action.gymRoom && action.slotInfo && action.date) {
          this.closeGymSlotSummary();
          if (this.useNewGymAppointmentDialog) {
            // NUOVO: Apre MatDialog con Angular Material
            this.openGymAppointmentMatDialogFromSummary(action);
          } else {
            // VECCHIO: Overlay custom (mantenuto per rollback)
            this.gymAppointmentDialogData = {
              gymRoom: action.gymRoom,
              date: action.date,
              startTime: action.slotInfo.startTime,
              endTime: action.slotInfo.endTime,
              slotInfo: action.slotInfo,
              patients: this.patients
            };
            this.showGymAppointmentDialog = true;
          }
        }
        break;
      case 'close':
        this.closeGymSlotSummary();
        break;
    }
    this.cdr.markForCheck();
  }

  /**
   * Apre il dialog per modificare un appuntamento palestra
   */
  private openGymAppointmentEditDialog(
    appointment: GymAppointment,
    gymRoom: GymRoom,
    slotInfo: GymSlotInfo,
    date: string
  ): void {
    this.gymAppointmentDialogData = {
      gymRoom,
      date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      slotInfo,
      patients: this.patients,
      appointment // Passa l'appuntamento per modalità edit
    };
    this.showGymAppointmentDialog = true;
    this.cdr.markForCheck();
  }

  /**
   * Conferma eliminazione appuntamento palestra
   */
  async onGymDeleteConfirm(): Promise<void> {
    this.showGymDeleteConfirmDialog = false;
    if (this.gymAppointmentToDelete) {
      try {
        await firstValueFrom(this.gymRoomService.deleteAppointment(this.gymAppointmentToDelete.id));
        await this.loadGymDataForCurrentView();
      } catch (error) {
        console.error('Error deleting gym appointment:', error);
        alert('Errore durante l\'eliminazione dell\'appuntamento');
      }
      this.gymAppointmentToDelete = null;
    }
    this.cdr.markForCheck();
  }

  /**
   * Annulla eliminazione appuntamento palestra
   */
  onGymDeleteCancel(): void {
    this.showGymDeleteConfirmDialog = false;
    this.gymAppointmentToDelete = null;
    this.cdr.markForCheck();
  }

  /**
   * Gestisce il doppio click su uno slot della palestra per creare appuntamento
   */
  onGymSlotDblClick(event: GymSlotClickEvent): void {
    // Cancella il timer del single-click per evitare che si apra anche il summary
    if (this.gymSlotClickTimer) {
      clearTimeout(this.gymSlotClickTimer);
      this.gymSlotClickTimer = null;
    }
    this.pendingGymSlotClick = null;

    // Chiudi il summary se è aperto
    if (this.isGymSlotSummaryOpen) {
      this.closeGymSlotSummary();
    }

    if (!event.slotInfo.isAvailable || event.slotInfo.isClosed) {
      return;
    }

    // Switch tra nuovo e vecchio dialog
    if (this.useNewGymAppointmentDialog) {
      // NUOVO: Apre MatDialog con Angular Material
      this.openGymAppointmentMatDialog(event);
    } else {
      // VECCHIO: Overlay custom (mantenuto per rollback)
      this.gymAppointmentDialogData = {
        gymRoom: event.gymRoom,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        slotInfo: event.slotInfo,
        patients: this.patients
      };
      this.showGymAppointmentDialog = true;
      this.cdr.markForCheck();
    }
  }

  /**
   * Apre il nuovo dialog per creare un appuntamento palestra usando MatDialog.
   * Questo risolve i problemi di change detection dell'overlay custom.
   */
  private openGymAppointmentMatDialog(event: GymSlotClickEvent): void {
    const dialogRef = this.dialog.open(GymAppointmentMatDialogComponent, {
      width: '600px',
      disableClose: false,
      data: {
        gymRoom: event.gymRoom,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        slotInfo: event.slotInfo,
        patients: this.patients
      }
    });

    dialogRef.afterClosed().subscribe((result: GymAppointmentMatDialogResult | undefined) => {
      if (result?.created) {
        console.log('[Calendar] Appuntamento palestra creato con ID:', result.appointmentId);
        // Ricarica gli appuntamenti per aggiornare il calendario
        this.loadGymDataForCurrentView();
      }
    });
  }

  /**
   * Apre il nuovo dialog MatDialog per creare un appuntamento palestra dal summary.
   * Usato quando l'utente clicca su "Crea appuntamento" nel summary dello slot.
   */
  private openGymAppointmentMatDialogFromSummary(action: GymSlotSummaryAction): void {
    const dialogRef = this.dialog.open(GymAppointmentMatDialogComponent, {
      width: '600px',
      disableClose: false,
      data: {
        gymRoom: action.gymRoom,
        date: action.date,
        startTime: action.slotInfo!.startTime,
        endTime: action.slotInfo!.endTime,
        slotInfo: action.slotInfo,
        patients: this.patients
      }
    });

    dialogRef.afterClosed().subscribe((result: GymAppointmentMatDialogResult | undefined) => {
      if (result?.created) {
        console.log('[Calendar] Appuntamento palestra creato da summary con ID:', result.appointmentId);
        this.loadGymDataForCurrentView();
      }
    });
  }

  /**
   * Gestisce il risultato del dialog appuntamento palestra
   */
  async onGymAppointmentDialogResult(result: GymAppointmentDialogResult): Promise<void> {
    this.showGymAppointmentDialog = false;

    if (result.action === 'cancel') {
      return;
    } else if (result.action === 'series-deleted') {
      await this.loadGymDataForCurrentView();
    } else if (result.action === 'status-changed') {
      // Stato appuntamento cambiato (presente, non presentato, disdetto, annullato)
      // Ricaricare i dati per aggiornare la UI
      await this.loadGymDataForCurrentView();
    } else if (result.action === 'save' && result.input) {
      try {
        await firstValueFrom(this.gymRoomService.createAppointment(result.input));
        await this.loadGymDataForCurrentView();
      } catch (error: any) {
        console.error('Error creating gym appointment:', error);
        const errorMessage = this.extractErrorMessage(error) || 'Errore durante la creazione dell\'appuntamento';
        alert(errorMessage);
      }
    } else if (result.action === 'update' && result.updateInput && result.appointmentId) {
      try {
        await firstValueFrom(this.gymRoomService.updateAppointment(result.appointmentId, result.updateInput));
        await this.loadGymDataForCurrentView();
      } catch (error: any) {
        console.error('Error updating gym appointment:', error);
        const errorMessage = this.extractErrorMessage(error) || 'Errore durante l\'aggiornamento dell\'appuntamento';
        alert(errorMessage);
      }
    }

    this.cdr.markForCheck();
  }

  /**
   * Gestisce il click su un appuntamento della palestra
   */
  onGymAppointmentClick(_event: { appointment: GymAppointment; mouseEvent?: MouseEvent }): void {
    // Click su appuntamento singolo - gestito tramite il summary dello slot
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
    this.ngZone.run(() => {
      // If summary is open, close it and don't start dragging
      if (this.isSummaryOpen) {
        this.closeSummary();
        return;
      }

      this.dragStartCell = event;
      this.dragCurrentCell = event;
      this.isDragging = true;
    });
  }

  onCellMouseEnter(event: CellEvent): void {
    this.ngZone.run(() => {
      if (this.isDragging) {
        this.dragCurrentCell = event;
      }
    });
  }

  onCellMouseUp(event: CellEvent): void {
    this.ngZone.run(() => {
      // Don't create appointment if we just closed the summary
      if (this.isDragging && this.dragStartCell && !this.isSummaryOpen) {
        this.createAppointmentFromDrag();
      }
      this.isDragging = false;
      this.dragStartCell = null;
      this.dragCurrentCell = null;
    });
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
    // Usa NgZone.run per garantire che Angular rilevi il cambio di stato immediatamente
    this.ngZone.run(() => {
      this.appointmentToDelete = action.appointment;
      this.showDeleteConfirmDialog = true;
      this.cdr.markForCheck();
    });
  }

  // Dialog events
  openEventDialog(data: EventDialogData): void {
    if (this.useNewEventDialog) {
      // NUOVO: Apre MatDialog con Angular Material
      this.openEventMatDialog(data);
    } else {
      // VECCHIO: Overlay custom (mantenuto per rollback)
      // Forza esecuzione dentro NgZone per garantire change detection
      // Il doppio click sullo slot può arrivare da contesto fuori zona
      this.ngZone.run(() => {
        this.eventDialogData = {
          ...data,
          instrumentCategories: this.instrumentCategories
        };
        this.showEventDialog = true;
      });
    }
  }

  /**
   * Apre il nuovo dialog per creare/modificare un appuntamento usando MatDialog.
   * Questo risolve i problemi di change detection dell'overlay custom.
   */
  private openEventMatDialog(data: EventDialogData): void {
    const dialogRef = this.dialog.open(EventMatDialogComponent, {
      width: '600px',
      maxHeight: '90vh',
      disableClose: false,
      data: {
        ...data,
        instrumentCategories: this.instrumentCategories
      }
    });

    dialogRef.afterClosed().subscribe(async (result: EventMatDialogResult | undefined) => {
      if (!result) return;

      if (result.action === 'cancel') {
        return;
      }

      if (result.action === 'series-deleted') {
        await this.loadAppointmentsForCurrentView();
        this.cdr.markForCheck();
        return;
      }

      if (result.action === 'delete' && result.appointment) {
        await this.deleteAppointment(result.appointment);
      }

      if (result.action === 'save' && result.appointment) {
        this.saveAppointment(
          result.appointment,
          result.services,
          result.instruments,
          result.instrumentOrderMatters,
          result.repeatConfig,
          result.nonRetribuito
        );
      }

      if (result.action === 'mark-attended' && result.appointmentId) {
        await this.runStatusAction(
          () => this.availabilityAppointmentService.markAsAttended(result.appointmentId!),
          'segnare come presentato',
        );
      } else if (result.action === 'mark-no-show' && result.appointmentId) {
        await this.runStatusAction(
          () => this.availabilityAppointmentService.markAsNoShow(result.appointmentId!),
          'segnare come non presentato',
        );
      } else if (result.action === 'revert-attended' && result.appointmentId) {
        await this.runStatusAction(
          () => this.availabilityAppointmentService.revertAttended(result.appointmentId!),
          'annullare lo stato presentato',
        );
      } else if (result.action === 'cancel-with-notice' && result.appointmentId) {
        await this.runStatusAction(
          () => this.availabilityAppointmentService.cancelWithNotice(result.appointmentId!, 'Annullato da segreteria', 'secretary'),
          'disdire l\'appuntamento',
        );
      }
    });
  }

  private async runStatusAction(
    op: () => import('rxjs').Observable<unknown>,
    azione: string,
  ): Promise<void> {
    try {
      await firstValueFrom(op());
      await this.loadAppointmentsForCurrentView();
      this.cdr.markForCheck();
    } catch (err: any) {
      alert(err?.graphQLErrors?.[0]?.message || `Errore nel ${azione}`);
    }
  }

  async onDialogResult(result: EventDialogResult): Promise<void> {
    this.showEventDialog = false;

    if (result.action === 'cancel') {
      return;
    }

    if (result.action === 'delete' && result.appointment) {
      await this.deleteAppointment(result.appointment);
    }

    if (result.action === 'series-deleted') {
      // Eliminazione serie avvenuta nel dialog - ricarica
      await this.loadAppointmentsForCurrentView();
      this.cdr.markForCheck();
      return;
    }

    if (result.action === 'save' && result.appointment) {
      await this.saveAppointment(
        result.appointment,
        result.services,
        result.instruments,
        result.instrumentOrderMatters,
        result.repeatConfig,
        result.nonRetribuito
      );
    }
  }

  /**
   * Salva un appuntamento usando il sistema unificato GraphQL (AvailabilityAppointment)
   * Tutti gli appuntamenti passano per questo sistema, con o senza strumenti
   */
  private async saveAppointment(
    appointment: Appointment,
    services?: { serviceId: string; customPrice?: number; customDuration?: number; orderPosition?: number }[],
    instruments?: AppointmentInstrumentInput[],
    instrumentOrderMatters?: boolean,
    repeatConfig?: any,
    nonRetribuito?: boolean
  ): Promise<void> {
    try {
      const isUpdate = appointment.id && typeof appointment.id === 'string' && appointment.id.length > 10;

      // Prepara services con orderPosition se mancante
      const servicesWithOrder = services?.map((s, idx) => ({
        ...s,
        orderPosition: s.orderPosition ?? idx
      }));

      if (isUpdate) {
        // Update appuntamento esistente (non supporta ricorrenza)
        const updateInput = {
          services: servicesWithOrder,  // Multi-servizio
          clientName: appointment.title,
          patientId: appointment.patientId,
          appointmentDate: appointment.date,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          notes: appointment.notes,
          instrumentOrderMatters: instrumentOrderMatters,
          instruments: instruments,
          nonRetribuito: nonRetribuito
        };
        console.log('[Calendar] Updating appointment with input:', JSON.stringify(updateInput, null, 2));
        await firstValueFrom(
          this.availabilityAppointmentService.updateAppointment(
            appointment.id as string,
            updateInput
          )
        );
        console.log('[Calendar] Updated appointment:', appointment.id);
      } else {
        // Crea nuovo appuntamento (supporta ricorrenza)
        const created = await firstValueFrom(
          this.availabilityAppointmentService.createAppointment({
            operatorId: appointment.operatorId,
            services: servicesWithOrder,  // Multi-servizio
            clientName: appointment.title,
            patientId: appointment.patientId,
            appointmentDate: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            notes: appointment.notes,
            instrumentOrderMatters: instrumentOrderMatters,
            instruments: instruments,
            repeatConfig: repeatConfig,
            nonRetribuito: nonRetribuito
          })
        );
        console.log('[Calendar] Created appointment:', created.id, repeatConfig ? '(recurring)' : '');
      }

      // Invalida la cache degli appuntamenti operatori dopo modifica
      this.invalidateOperatorCache();

      // Ricarica gli appuntamenti per visualizzare le modifiche
      await this.loadAppointmentsForCurrentView();

      // Se la ricerca slot è attiva, forza il refresh degli slot disponibili
      // (lo slot occupato dal nuovo appuntamento non sarà più disponibile)
      if (this.slotSearchEnabled) {
        await this.searchAvailableSlots(
          this.searchFilters,
          this.selectedOperators,
          this.currentDate,
          this.config
        );
      }
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

      // Invalida la cache degli appuntamenti operatori dopo eliminazione
      this.invalidateOperatorCache();

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

  // Overlay click handlers (previene chiusura durante selezione testo con click-and-drag)
  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent, dialogType: 'event' | 'delete' | 'workingHours' | 'gymAppointment' | 'gymDelete'): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      switch (dialogType) {
        case 'event':
          this.onDialogResult({ action: 'cancel' });
          break;
        case 'delete':
          this.onDeleteCancel();
          break;
        case 'workingHours':
          this.onWorkingHoursDialogResult({ action: 'cancel' });
          break;
        case 'gymAppointment':
          this.onGymAppointmentDialogResult({ action: 'cancel' });
          break;
        case 'gymDelete':
          this.onGymDeleteCancel();
          break;
      }
    }
    this.overlayMouseDownTarget = null;
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

  // Waiting List Dialog
  private waitingListDialogRef: import('@angular/material/dialog').MatDialogRef<any> | null = null;

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

  /**
   * Genera timeSlots specifici per la vista palestre con slotDuration di 60 minuti
   */
  private generateGymTimeSlots(): any[] {
    const slots: any[] = [];
    const gymSlotDuration = 60; // Palestre sempre con slot da 60 minuti

    const effectiveStartHour = this.config.showWorkingHoursOnly
      ? this.config.workingHoursStart
      : this.config.startHour;
    const effectiveEndHour = this.config.showWorkingHoursOnly
      ? this.config.workingHoursEnd
      : this.config.endHour;

    const startMinutes = effectiveStartHour * 60;
    const endMinutes = effectiveEndHour * 60;

    let index = 0;
    for (let minutes = startMinutes; minutes < endMinutes; minutes += gymSlotDuration) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

      slots.push({ time, date: '', index });
      index++;
    }

    return slots;
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
        // Usa NgZone.run per garantire che Angular rilevi il cambio di stato immediatamente
        this.ngZone.run(() => {
          this.appointmentToDelete = action.appointment;
          this.showDeleteConfirmDialog = true;
          this.cdr.markForCheck();
        });
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

  getUserById(userId: string): User | undefined {
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
    // Se ci sono 2 strumenti e l'ordine NON importa, prova entrambe le combinazioni
    const instrumentSlotsCombinations = this.buildInstrumentSlotsCombinations(filters);

    // Cerca slot per ogni fisioterapista, data e combinazione strumenti
    const searchPromises: Promise<void>[] = [];

    for (const physio of physiotherapists) {
      for (const date of datesToSearch) {
        for (const instrumentSlots of instrumentSlotsCombinations) {
          searchPromises.push(
            this.searchSlotsForOperator(physio, date, filters.duration, instrumentSlots, availableSlots)
          );
        }
      }
    }

    try {
      await Promise.all(searchPromises);
      // Rimuovi duplicati (stesso operatore, data, startTime)
      const uniqueSlots = this.removeDuplicateSlots(availableSlots);
      this.stateService.setAvailableSlots(uniqueSlots);
    } catch (error) {
      console.error('Error searching available slots:', error);
      this.stateService.clearAvailableSlots();
    }
  }

  /**
   * Rimuove slot duplicati (stesso operatore, data, orario)
   */
  private removeDuplicateSlots(slots: AvailableSlot[]): AvailableSlot[] {
    const seen = new Set<string>();
    return slots.filter(slot => {
      const key = `${slot.operatorId}-${slot.date}-${slot.startTime}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Costruisce le combinazioni di instrument slots da cercare.
   * Se ci sono 2 strumenti e l'ordine NON importa, restituisce entrambe le combinazioni.
   */
  private buildInstrumentSlotsCombinations(filters: AppointmentSearchFilters): (InstrumentSlotInput[] | undefined)[] {
    // Se non ci sono strumenti o c'è un solo strumento, restituisci una sola combinazione
    if (!filters.withInstrument || filters.instrumentCount !== 2 || filters.instrumentOrderMatters) {
      return [this.buildInstrumentSlots(filters)];
    }

    // 2 strumenti con ordine NON importante: prova entrambe le combinazioni
    const combinations: (InstrumentSlotInput[] | undefined)[] = [];

    // Combinazione 1: ordine originale (A-B)
    combinations.push(this.buildInstrumentSlots(filters));

    // Combinazione 2: ordine invertito (B-A)
    const invertedFilters = {
      ...filters,
      instrumentCategoryId: filters.instrument2CategoryId,
      instrument2CategoryId: filters.instrumentCategoryId,
      instrumentOrderMatters: true // Forza ordine specifico per questa ricerca
    };
    combinations.push(this.buildInstrumentSlots(invertedFilters));

    return combinations;
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

      // Per durata 45 minuti: usa blocchi da 30 min con overlap (0-30 e 15-45)
      // Per durata 60 minuti: usa blocchi da 30 min senza overlap (0-30 e 30-60)
      const instrumentDuration = 30;  // Ogni strumento occupa 30 minuti
      const slot1Start = 0;
      const slot1End = instrumentDuration;
      let slot2Start: number;
      const slot2End = duration;

      if (duration === 45) {
        // Overlap: strumento 2 inizia a metà del primo (15 minuti)
        slot2Start = 15;
      } else {
        // No overlap: strumento 2 inizia dopo il primo
        slot2Start = instrumentDuration;
      }

      if (filters.instrumentOrderMatters) {
        // Ordine specifico
        slots.push({
          instrumentCategoryId: filters.instrumentCategoryId,
          startOffsetMinutes: slot1Start,
          endOffsetMinutes: slot1End
        });
        slots.push({
          instrumentCategoryId: filters.instrument2CategoryId,
          startOffsetMinutes: slot2Start,
          endOffsetMinutes: slot2End
        });
      } else {
        // Ordine non importante - prova entrambe le combinazioni (il backend gestirà)
        slots.push({
          instrumentCategoryId: filters.instrumentCategoryId,
          startOffsetMinutes: slot1Start,
          endOffsetMinutes: slot1End
        });
        slots.push({
          instrumentCategoryId: filters.instrument2CategoryId,
          startOffsetMinutes: slot2Start,
          endOffsetMinutes: slot2End
        });
      }
    }

    return slots.length > 0 ? slots : undefined;
  }

  // ============================================
  // Available Slot Click Handlers
  // ============================================

  onAvailableSlotClick(_event: AvailableSlotClickEvent): void {
    // Single click - potrebbe mostrare info sullo slot (non implementato)
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

  /**
   * Estrae il messaggio di errore da un errore GraphQL o generico
   */
  private extractErrorMessage(error: any): string | null {
    if (error?.graphQLErrors?.length > 0) {
      return error.graphQLErrors[0].message;
    }
    if (error?.message) {
      const match = error.message.match(/CombinedGraphQLErrors: (.+)/);
      if (match) {
        return match[1];
      }
      return error.message;
    }
    return null;
  }

  // ============================================
}
