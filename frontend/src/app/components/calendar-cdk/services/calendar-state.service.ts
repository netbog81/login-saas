import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { Appointment } from '../../../models/appointment.model';
import { User } from '../../../models/user.model';
import { Availability } from '../../../models/availability.model';
import { CalendarSettings } from '../../../services/settings.service';

export interface TimeSlot {
  time: string; // HH:MM
  date: string; // YYYY-MM-DD
  index: number;
}

export interface CalendarConfig {
  slotDuration: number; // minuti (5, 10, 15, 20, 30)
  startHour: number; // 0-23
  endHour: number; // 0-23
  zoom: number; // 1-3
  viewType: 'daily' | 'weekly';
  showWorkingHoursOnly: boolean;
  workingHoursStart: number; // 0-23
  workingHoursEnd: number; // 0-23
  showWeekend: boolean;
  showOperatorsLegend: boolean;
}

export interface CalendarView {
  currentDate: Date;
  selectedOperators: User[];
  visibleDates: string[]; // YYYY-MM-DD
  timeSlots: TimeSlot[];
}

export interface DragOperation {
  type: 'create' | 'move' | 'resize' | null;
  appointmentId?: number;
  startSlot?: TimeSlot;
  endSlot?: TimeSlot;
  operatorId?: string;
  previewPosition?: { top: number; height: number };
}

export interface AppointmentSearchFilters {
  duration: 15 | 30 | 45 | 60;           // Durata appuntamento in minuti
  withInstrument: boolean;               // Richiede strumento?
  instrumentCount?: 1 | 2;               // Numero strumenti (se withInstrument)
  instrumentPosition?: 'first' | 'second'; // Posizione strumento (se 1 strumento e durata > 30)
  instrumentOrderMatters?: boolean;      // Ordine importante (se 2 strumenti)
  instrumentCategoryId?: string | null;  // Categoria primo strumento (o unico strumento)
  instrument2CategoryId?: string | null; // Categoria secondo strumento (se 2 strumenti)
}

export interface AvailableSlot {
  operatorId: string;
  date: string;
  startTime: string;
  endTime: string;
  color: string;  // colore operatore per il bordo
  availableInstruments?: {
    id: string;
    name: string;
    categoryId: string;
  }[];
}

/**
 * Interfaccia per lo stato persistito - solo dati non sensibili
 * Conforme ISO 27001 A.8.11 - nessun dato personale, solo ID numerici
 */
interface PersistedCalendarState {
  version: number;                    // Per migrazioni future
  timestamp: number;                  // Unix timestamp per scadenza
  selectedOperatorIds: number[];      // Solo ID numerici, no nomi
  searchFilters: AppointmentSearchFilters | null;
  slotSearchEnabled: boolean;         // Toggle ricerca slot disponibili
  config: {
    viewType: 'daily' | 'weekly';
    showWeekend: boolean;
    showWorkingHoursOnly: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CalendarStateService {
  // Storage configuration - ISO 27001 compliant
  private readonly STORAGE_KEY = 'calendar-state-v2';
  private readonly STORAGE_VERSION = 2;
  private readonly MAX_STATE_AGE_MS = 8 * 60 * 60 * 1000; // 8 ore
  private readonly MAX_OPERATORS = 100; // Limite operatori per sicurezza
  private readonly MAX_STORAGE_SIZE = 50000; // 50KB max

  // Track selected operator IDs for persistence (ISO 27001 A.8.11 - only IDs, no personal data)
  private _selectedOperatorIds = new Set<number>();
  // State streams
  private configSubject = new BehaviorSubject<CalendarConfig>({
    slotDuration: 15,
    startHour: 0,
    endHour: 24,
    zoom: 1,
    viewType: 'daily',
    showWorkingHoursOnly: false,
    workingHoursStart: 8,
    workingHoursEnd: 20,
    showWeekend: true,
    showOperatorsLegend: false
  });

  private currentDateSubject = new BehaviorSubject<Date>(new Date());
  private selectedOperatorsSubject = new BehaviorSubject<User[]>([]);
  private appointmentsSubject = new BehaviorSubject<Map<string, Map<string, Appointment[]>>>(new Map());
  private availabilitiesSubject = new BehaviorSubject<Map<string, Map<string, Availability[]>>>(new Map());
  private dragOperationSubject = new BehaviorSubject<DragOperation>({ type: null });
  private sidebarCollapsedSubject = new BehaviorSubject<boolean>(false);
  private searchFiltersSubject = new BehaviorSubject<AppointmentSearchFilters>({
    duration: 45,
    withInstrument: false
  });
  private availableSlotsSubject = new BehaviorSubject<AvailableSlot[]>([]);
  private slotSearchEnabledSubject = new BehaviorSubject<boolean>(false); // Default: disabilitato

  // Public observables
  config$: Observable<CalendarConfig> = this.configSubject.asObservable();
  currentDate$: Observable<Date> = this.currentDateSubject.asObservable();
  selectedOperators$: Observable<User[]> = this.selectedOperatorsSubject.asObservable();
  appointments$: Observable<Map<string, Map<string, Appointment[]>>> = this.appointmentsSubject.asObservable();
  availabilities$: Observable<Map<string, Map<string, Availability[]>>> = this.availabilitiesSubject.asObservable();
  dragOperation$: Observable<DragOperation> = this.dragOperationSubject.asObservable();
  sidebarCollapsed$: Observable<boolean> = this.sidebarCollapsedSubject.asObservable();
  searchFilters$: Observable<AppointmentSearchFilters> = this.searchFiltersSubject.asObservable();
  availableSlots$: Observable<AvailableSlot[]> = this.availableSlotsSubject.asObservable();
  slotSearchEnabled$: Observable<boolean> = this.slotSearchEnabledSubject.asObservable();

  // Computed observables
  view$: Observable<CalendarView> = combineLatest([
    this.config$,
    this.currentDate$,
    this.selectedOperators$
  ]).pipe(
    map(([config, currentDate, selectedOperators]) => {
      return {
        currentDate,
        selectedOperators,
        visibleDates: this.calculateVisibleDates(currentDate, config.viewType, config.showWeekend),
        timeSlots: this.generateTimeSlots(config)
      };
    })
  );

  constructor() {
    // Load persisted state on initialization (ISO 27001 A.14.2 - validated input)
    this.loadFromStorage();
  }

  // Config methods
  updateConfig(config: Partial<CalendarConfig>): void {
    this.configSubject.next({ ...this.configSubject.value, ...config });
    this.saveToStorage();
  }

  getConfig(): CalendarConfig {
    return this.configSubject.value;
  }

  /**
   * Applica le impostazioni del calendario caricate dal backend
   * Viene chiamato una volta all'inizializzazione del calendario
   */
  applyBackendSettings(settings: CalendarSettings): void {
    const currentConfig = this.configSubject.value;

    // Applica i settings dal backend solo se non ci sono preferenze salvate
    // o se è la prima volta che viene caricato il calendario
    const hasStoredConfig = this.hasStoredState();

    const newConfig: CalendarConfig = {
      ...currentConfig,
      // Range completo sempre fisso (tutto il giorno) per permettere al toggle di funzionare
      startHour: 0,
      endHour: 24,
      // Orario lavorativo dal backend
      workingHoursStart: settings.startHour,
      workingHoursEnd: settings.endHour,
      slotDuration: settings.slotDuration,
      // Questi vengono sovrascritti dalle preferenze utente se presenti
      showWorkingHoursOnly: hasStoredConfig ? currentConfig.showWorkingHoursOnly : settings.showWorkingHoursOnly,
      showWeekend: hasStoredConfig ? currentConfig.showWeekend : settings.showWeekend,
      viewType: hasStoredConfig ? currentConfig.viewType : settings.defaultView,
    };

    this.configSubject.next(newConfig);
    console.log('[CalendarState] Backend settings applied:', {
      startHour: settings.startHour,
      endHour: settings.endHour,
      slotDuration: settings.slotDuration,
      hasStoredConfig
    });
  }

  // Date navigation
  setCurrentDate(date: Date): void {
    this.currentDateSubject.next(date);
  }

  navigateToToday(): void {
    this.currentDateSubject.next(new Date());
  }

  navigateNext(): void {
    const config = this.configSubject.value;
    const currentDate = this.currentDateSubject.value;
    const newDate = new Date(currentDate);

    if (config.viewType === 'daily') {
      newDate.setDate(newDate.getDate() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }

    this.currentDateSubject.next(newDate);
  }

  navigatePrevious(): void {
    const config = this.configSubject.value;
    const currentDate = this.currentDateSubject.value;
    const newDate = new Date(currentDate);

    if (config.viewType === 'daily') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }

    this.currentDateSubject.next(newDate);
  }

  // Operator selection
  setSelectedOperators(operators: User[]): void {
    // Save only IDs for persistence (ISO 27001 A.8.11 - no personal data)
    this._selectedOperatorIds = new Set(
      operators
        .filter(o => o && typeof o.id === 'number')
        .map(o => o.id)
    );
    this.selectedOperatorsSubject.next(operators);
    this.saveToStorage();
  }

  toggleOperator(operator: User): void {
    const current = this.selectedOperatorsSubject.value;
    const index = current.findIndex(u => u.id === operator.id);

    let newOperators: User[];
    if (index >= 0) {
      newOperators = current.filter(u => u.id !== operator.id);
      this._selectedOperatorIds.delete(operator.id);
    } else {
      newOperators = [...current, operator];
      this._selectedOperatorIds.add(operator.id);
    }

    this.selectedOperatorsSubject.next(newOperators);
    this.saveToStorage();
  }

  // Appointments
  setAppointments(appointments: Map<string, Map<string, Appointment[]>>): void {
    this.appointmentsSubject.next(appointments);
  }

  addAppointment(appointment: Appointment): void {
    const current = new Map(this.appointmentsSubject.value);

    if (!current.has(appointment.operatorId)) {
      current.set(appointment.operatorId, new Map());
    }

    const operatorAppointments = current.get(appointment.operatorId)!;
    if (!operatorAppointments.has(appointment.date)) {
      operatorAppointments.set(appointment.date, []);
    }

    operatorAppointments.get(appointment.date)!.push(appointment);
    this.appointmentsSubject.next(current);
  }

  updateAppointment(appointment: Appointment): void {
    const current = new Map(this.appointmentsSubject.value);

    // Remove old appointment
    for (const [operatorId, dateMap] of current.entries()) {
      for (const [date, appointments] of dateMap.entries()) {
        const index = appointments.findIndex(a => a.id === appointment.id);
        if (index >= 0) {
          appointments.splice(index, 1);
          break;
        }
      }
    }

    // Add updated appointment
    if (!current.has(appointment.operatorId)) {
      current.set(appointment.operatorId, new Map());
    }

    const operatorAppointments = current.get(appointment.operatorId)!;
    if (!operatorAppointments.has(appointment.date)) {
      operatorAppointments.set(appointment.date, []);
    }

    operatorAppointments.get(appointment.date)!.push(appointment);
    this.appointmentsSubject.next(current);
  }

  removeAppointment(appointmentId: number): void {
    const current = new Map(this.appointmentsSubject.value);

    for (const [operatorId, dateMap] of current.entries()) {
      for (const [date, appointments] of dateMap.entries()) {
        const index = appointments.findIndex(a => a.id === appointmentId);
        if (index >= 0) {
          appointments.splice(index, 1);
          this.appointmentsSubject.next(current);
          return;
        }
      }
    }
  }

  getAppointmentForSlot(operatorId: string, date: string, timeSlot: string): Appointment | null {
    const operatorAppointments = this.appointmentsSubject.value.get(operatorId);
    if (!operatorAppointments) return null;

    const dateAppointments = operatorAppointments.get(date);
    if (!dateAppointments) return null;

    const slotMinutes = this.timeToMinutes(timeSlot);

    return dateAppointments.find(apt => {
      const startMinutes = this.timeToMinutes(apt.startTime);
      const endMinutes = this.timeToMinutes(apt.endTime);
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    }) || null;
  }

  // Availabilities
  setAvailabilities(availabilities: Map<string, Map<string, Availability[]>>): void {
    this.availabilitiesSubject.next(availabilities);
  }

  // Drag operations
  startDrag(operation: DragOperation): void {
    this.dragOperationSubject.next(operation);
  }

  updateDrag(updates: Partial<DragOperation>): void {
    this.dragOperationSubject.next({
      ...this.dragOperationSubject.value,
      ...updates
    });
  }

  endDrag(): void {
    this.dragOperationSubject.next({ type: null });
  }

  getDragOperation(): DragOperation {
    return this.dragOperationSubject.value;
  }

  // Sidebar
  toggleSidebar(): void {
    this.sidebarCollapsedSubject.next(!this.sidebarCollapsedSubject.value);
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsedSubject.next(collapsed);
  }

  // Utility methods
  private calculateVisibleDates(currentDate: Date, viewType: 'daily' | 'weekly', showWeekend: boolean): string[] {
    const dates: string[] = [];

    if (viewType === 'daily') {
      dates.push(this.formatDate(currentDate));
    } else {
      // Weekly view - get week starting from Monday
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
      startOfWeek.setDate(startOfWeek.getDate() + diff);

      const daysToShow = showWeekend ? 7 : 5;

      for (let i = 0; i < daysToShow; i++) {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        dates.push(this.formatDate(date));
      }
    }

    return dates;
  }

  private generateTimeSlots(config: CalendarConfig): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const { slotDuration, startHour, endHour, showWorkingHoursOnly, workingHoursStart, workingHoursEnd } = config;

    const effectiveStartHour = showWorkingHoursOnly ? workingHoursStart : startHour;
    const effectiveEndHour = showWorkingHoursOnly ? workingHoursEnd : endHour;

    const startMinutes = effectiveStartHour * 60;
    const endMinutes = effectiveEndHour * 60;

    let index = 0;
    for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

      slots.push({ time, date: '', index });
      index++;
    }

    return slots;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Helper method to calculate event position and height
  calculateEventDimensions(appointment: Appointment, slotDuration: number, startHour: number): { top: number; height: number } {
    const startMinutes = this.timeToMinutes(appointment.startTime);
    const endMinutes = this.timeToMinutes(appointment.endTime);
    const duration = endMinutes - startMinutes;

    const startOfDayMinutes = startHour * 60;
    const pixelsPerMinute = 60 / slotDuration; // Assuming each slot is 60px height

    const top = (startMinutes - startOfDayMinutes) * pixelsPerMinute;
    const height = duration * pixelsPerMinute;

    return { top, height };
  }

  // Search Filters methods
  updateSearchFilters(filters: Partial<AppointmentSearchFilters>): void {
    const current = this.searchFiltersSubject.value;
    const updated = { ...current, ...filters };

    // Reset dependent fields when parent changes
    if (filters.duration !== undefined) {
      if (filters.duration < 30) {
        updated.withInstrument = false;
        updated.instrumentCount = undefined;
        updated.instrumentPosition = undefined;
        updated.instrumentOrderMatters = undefined;
      } else if (filters.duration === 30) {
        updated.instrumentCount = updated.withInstrument ? 1 : undefined;
        updated.instrumentPosition = undefined;
        updated.instrumentOrderMatters = undefined;
      } else if (filters.duration === 45 || filters.duration === 60) {
        // Keep instrumentCount but reset position/order based on count
        if (updated.instrumentCount === 1) {
          updated.instrumentOrderMatters = undefined;
        } else if (updated.instrumentCount === 2) {
          updated.instrumentPosition = undefined;
        }
      }
    }

    if (filters.withInstrument === false) {
      updated.instrumentCount = undefined;
      updated.instrumentPosition = undefined;
      updated.instrumentOrderMatters = undefined;
      updated.instrumentCategoryId = null;
      updated.instrument2CategoryId = null;
    }

    if (filters.instrumentCount === 1) {
      updated.instrumentOrderMatters = undefined;
      updated.instrument2CategoryId = null; // Reset secondo strumento
    } else if (filters.instrumentCount === 2) {
      updated.instrumentPosition = undefined;
    }

    // Sanitize and save
    const sanitized = this.sanitizeFilters(updated);
    this.searchFiltersSubject.next(sanitized);
    this.saveToStorage();
  }

  getSearchFilters(): AppointmentSearchFilters {
    return this.searchFiltersSubject.value;
  }

  resetSearchFilters(): void {
    this.searchFiltersSubject.next({
      duration: 45,
      withInstrument: false
    });
  }

  // Available Slots methods
  setAvailableSlots(slots: AvailableSlot[]): void {
    this.availableSlotsSubject.next(slots);
  }

  clearAvailableSlots(): void {
    this.availableSlotsSubject.next([]);
  }

  getAvailableSlots(): AvailableSlot[] {
    return this.availableSlotsSubject.value;
  }

  // Slot Search Toggle methods
  setSlotSearchEnabled(enabled: boolean): void {
    this.slotSearchEnabledSubject.next(enabled);
    if (!enabled) {
      this.clearAvailableSlots();
    }
    this.saveToStorage();
  }

  isSlotSearchEnabled(): boolean {
    return this.slotSearchEnabledSubject.value;
  }

  isSlotAvailable(operatorId: string, date: string, startTime: string): boolean {
    const slots = this.availableSlotsSubject.value;
    return slots.some(slot =>
      slot.operatorId === operatorId &&
      slot.date === date &&
      slot.startTime === startTime
    );
  }

  getAvailableSlotAt(operatorId: string, date: string, startTime: string): AvailableSlot | undefined {
    const slots = this.availableSlotsSubject.value;
    return slots.find(slot =>
      slot.operatorId === operatorId &&
      slot.date === date &&
      slot.startTime === startTime
    );
  }

  // ============================================
  // State Persistence Methods - ISO 27001 Compliant
  // ============================================

  /**
   * Validates persisted state structure and expiry
   * Conforme ISO 27001 A.14.2 - Validazione input
   */
  private validateState(data: unknown): PersistedCalendarState | null {
    if (!data || typeof data !== 'object') return null;

    const state = data as Record<string, unknown>;

    // Verify version
    if (typeof state['version'] !== 'number' || state['version'] !== this.STORAGE_VERSION) {
      console.warn('[CalendarState] Version mismatch, discarding stored state');
      return null;
    }

    // Verify timestamp and expiry
    if (typeof state['timestamp'] !== 'number') return null;
    if (Date.now() - (state['timestamp'] as number) > this.MAX_STATE_AGE_MS) {
      console.warn('[CalendarState] Stored state expired, discarding');
      return null;
    }

    // Verify selectedOperatorIds
    if (!Array.isArray(state['selectedOperatorIds'])) return null;
    const operatorIds = state['selectedOperatorIds'] as unknown[];
    if (!operatorIds.every(id => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
      console.warn('[CalendarState] Invalid operator IDs in stored state');
      return null;
    }

    // Verify searchFilters (optional)
    if (state['searchFilters'] !== null && typeof state['searchFilters'] !== 'object') return null;

    // Verify config
    if (!state['config'] || typeof state['config'] !== 'object') return null;
    const config = state['config'] as Record<string, unknown>;
    if (!['daily', 'weekly'].includes(config['viewType'] as string)) return null;
    if (typeof config['showWeekend'] !== 'boolean') return null;
    if (typeof config['showWorkingHoursOnly'] !== 'boolean') return null;

    return state as unknown as PersistedCalendarState;
  }

  /**
   * Loads state from sessionStorage with full validation
   * Conforme ISO 27001 A.14.2 - Validazione input
   */
  private loadFromStorage(): void {
    try {
      const raw = sessionStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (parseError) {
        console.error('[CalendarState] Invalid JSON in storage, clearing');
        this.clearStorage();
        return;
      }

      const validated = this.validateState(parsed);
      if (!validated) {
        console.warn('[CalendarState] Invalid state structure, clearing');
        this.clearStorage();
        return;
      }

      // Apply validated state
      this._selectedOperatorIds = new Set(validated.selectedOperatorIds);

      if (validated.searchFilters) {
        const sanitized = this.sanitizeFilters(validated.searchFilters);
        this.searchFiltersSubject.next(sanitized);
      }

      if (validated.config) {
        this.configSubject.next({
          ...this.configSubject.value,
          viewType: validated.config.viewType,
          showWeekend: validated.config.showWeekend,
          showWorkingHoursOnly: validated.config.showWorkingHoursOnly,
        });
      }

      // Restore slot search toggle (default false if not present)
      if (typeof validated.slotSearchEnabled === 'boolean') {
        this.slotSearchEnabledSubject.next(validated.slotSearchEnabled);
      }

      const ageMinutes = Math.round((Date.now() - validated.timestamp) / 1000 / 60);
      console.log('[CalendarState] State restored successfully', {
        operatorCount: this._selectedOperatorIds.size,
        age: `${ageMinutes} min`,
      });

    } catch (error) {
      // ISO 27001 A.12.4 - Log for audit
      console.error('[CalendarState] Failed to load state:', error);
      this.clearStorage();
    }
  }

  /**
   * Saves state to sessionStorage
   * Only non-sensitive data, conforme ISO 27001 A.8.11
   */
  private saveToStorage(): void {
    try {
      // Sanitize: only allowed values
      const state: PersistedCalendarState = {
        version: this.STORAGE_VERSION,
        timestamp: Date.now(),
        selectedOperatorIds: Array.from(this._selectedOperatorIds)
          .filter(id => Number.isInteger(id) && id > 0)
          .slice(0, this.MAX_OPERATORS),
        searchFilters: this.searchFiltersSubject.value,
        slotSearchEnabled: this.slotSearchEnabledSubject.value,
        config: {
          viewType: this.configSubject.value.viewType || 'daily',
          showWeekend: Boolean(this.configSubject.value.showWeekend),
          showWorkingHoursOnly: Boolean(this.configSubject.value.showWorkingHoursOnly),
        }
      };

      const serialized = JSON.stringify(state);

      // Size limit check
      if (serialized.length > this.MAX_STORAGE_SIZE) {
        console.warn('[CalendarState] State too large, not saving');
        return;
      }

      sessionStorage.setItem(this.STORAGE_KEY, serialized);

    } catch (error) {
      // QuotaExceededError or other
      console.error('[CalendarState] Failed to save state:', error);
      // Don't propagate error, graceful degradation
    }
  }

  /**
   * Secure storage cleanup
   * Conforme ISO 27001 A.8.10
   */
  private clearStorage(): void {
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.error('[CalendarState] Failed to clear storage:', e);
    }
  }

  /**
   * Sanitize search filters to ensure valid values
   * Conforme ISO 27001 A.14.2 - Input validation
   */
  private sanitizeFilters(filters: AppointmentSearchFilters): AppointmentSearchFilters {
    const validDurations = [15, 30, 45, 60] as const;
    return {
      duration: validDurations.includes(filters.duration as any) ? filters.duration : 45,
      withInstrument: Boolean(filters.withInstrument),
      instrumentCount: filters.instrumentCount === 2 ? 2 : (filters.instrumentCount === 1 ? 1 : undefined),
      instrumentPosition: ['first', 'second'].includes(filters.instrumentPosition || '')
        ? filters.instrumentPosition : undefined,
      instrumentOrderMatters: filters.instrumentOrderMatters === true ? true : undefined,
      instrumentCategoryId: typeof filters.instrumentCategoryId === 'string'
        ? filters.instrumentCategoryId : null,
      instrument2CategoryId: typeof filters.instrument2CategoryId === 'string'
        ? filters.instrument2CategoryId : null,
    };
  }

  /**
   * Explicit state cleanup - call on logout
   * Conforme ISO 27001 A.8.10 - Secure deletion
   */
  public clearState(): void {
    this._selectedOperatorIds.clear();
    this.searchFiltersSubject.next({
      duration: 45,
      withInstrument: false
    });
    this.clearStorage();
    console.log('[CalendarState] State cleared');
  }

  /**
   * Check if an operator was previously selected (from storage)
   */
  wasOperatorSelected(operatorId: number): boolean {
    if (!Number.isInteger(operatorId) || operatorId <= 0) return false;
    return this._selectedOperatorIds.has(operatorId);
  }

  /**
   * Check if there is stored state available
   */
  hasStoredState(): boolean {
    return this._selectedOperatorIds.size > 0;
  }

  /**
   * Get stored operator IDs (for restoration in CalendarContainerComponent)
   */
  getStoredOperatorIds(): number[] {
    return Array.from(this._selectedOperatorIds);
  }
}
