import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CalendarCellComponent, CellEvent } from '../calendar-cell/calendar-cell.component';
import { CalendarEventComponent, EventAction } from '../calendar-event/calendar-event.component';
import { AvailableSlotOverlayComponent, type AvailableSlotClickEvent } from '../available-slot-overlay/available-slot-overlay.component';
import { TimeSlot, AvailableSlot } from '../services/calendar-state.service';
import { Appointment } from '../../../models/appointment.model';
import { User } from '../../../models/user.model';
import { Availability } from '../../../models/availability.model';

interface EventPosition {
  appointment: Appointment;
  top: number;
  height: number;
  left: number;
  width: number;
}

interface AvailableSlotPosition {
  slot: AvailableSlot;
  top: number;
  height: number;
}

interface DayColumn {
  date: string;
  dayName: string;
  dayNumber: number;
}

@Component({
  selector: 'app-calendar-weekly-grid',
  standalone: true,
  imports: [CommonModule, ScrollingModule, CalendarCellComponent, CalendarEventComponent, AvailableSlotOverlayComponent],
  templateUrl: './calendar-weekly-grid.component.html',
  styleUrl: './calendar-weekly-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarWeeklyGridComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('gridBody') gridBodyRef!: ElementRef<HTMLDivElement>;

  constructor(private cdr: ChangeDetectorRef) {}

  @Input() timeSlots: TimeSlot[] = [];
  @Input() users: User[] = [];
  @Input() dates: string[] = [];
  @Input() appointments: Map<string, Map<string, Appointment[]>> = new Map();
  @Input() availabilities: Map<string, Map<string, Availability[]>> = new Map();
  @Input() slotDuration: number = 15;
  @Input() slotHeight: number = 60;
  @Input() startHour: number = 0;
  @Input() showWorkingHoursOnly: boolean = false;
  @Input() showWeekend: boolean = true;
  @Input() enableHorizontalScroll: boolean = false;
  @Input() minColumnWidth: number = 40; // Reduced for better responsive design
  @Input() dragStartCell: CellEvent | null = null;
  @Input() dragCurrentCell: CellEvent | null = null;
  @Input() isDragging: boolean = false;
  @Input() searchAvailableSlots: AvailableSlot[] = [];

  @Output() cellMouseDown = new EventEmitter<CellEvent>();
  @Output() cellMouseEnter = new EventEmitter<CellEvent>();
  @Output() cellMouseUp = new EventEmitter<CellEvent>();
  @Output() cellDblClick = new EventEmitter<CellEvent>();
  @Output() eventClick = new EventEmitter<EventAction>();
  @Output() eventDblClick = new EventEmitter<EventAction>();
  @Output() eventDragStart = new EventEmitter<Appointment>();
  @Output() eventDragEnd = new EventEmitter<EventAction>();
  @Output() eventResize = new EventEmitter<EventAction>();
  @Output() eventDelete = new EventEmitter<EventAction>();
  @Output() availableSlotClick = new EventEmitter<AvailableSlotClickEvent>();
  @Output() availableSlotDblClick = new EventEmitter<AvailableSlotClickEvent>();

  dayColumns: DayColumn[] = [];
  eventPositions: Map<string, Map<string, EventPosition[]>> = new Map();
  availableSlotPositions: Map<string, Map<string, AvailableSlotPosition[]>> = new Map(); // date -> operatorId -> positions
  gridHeight: number = 0;
  showUserNames: boolean = true;

  // Current time indicator
  currentTimeTop: number = 0;
  currentTimeVisible: boolean = false;
  private currentTimeInterval: any;

  // Cache per memoization dei calcoli delle celle
  private cellAvailabilityCache: Map<string, boolean> = new Map();
  private cellOccupiedCache: Map<string, boolean> = new Map();
  private userColorCache: Map<string, string> = new Map();

  ngOnInit(): void {
    this.buildDayColumns();
    this.calculateEventPositions();
    this.calculateGridHeight();
    this.updateCurrentTimeIndicator();
    this.startCurrentTimeUpdates();
  }

  ngOnDestroy(): void {
    if (this.currentTimeInterval) {
      clearInterval(this.currentTimeInterval);
    }
  }

  ngAfterViewInit(): void {
    if (this.gridBodyRef) {
      this.syncHorizontalScroll();
      this.adjustHeaderForScrollbar();
    }
    // Adjust header for scrollbar after view init
    setTimeout(() => {
      this.adjustHeaderForScrollbar();
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Invalida cache quando cambiano i dati rilevanti
    if (changes['availabilities'] || changes['dates'] || changes['users']) {
      this.cellAvailabilityCache.clear();
    }
    if (changes['appointments'] || changes['dates']) {
      this.cellOccupiedCache.clear();
    }
    if (changes['users']) {
      this.userColorCache.clear();
    }

    if (changes['dates'] || changes['showWeekend']) {
      this.buildDayColumns();
      // Recalculate event positions when dates change since the columns have changed
      this.calculateEventPositions();
    }
    if (changes['appointments'] || changes['timeSlots'] || changes['slotHeight']) {
      this.calculateEventPositions();
    }
    if (changes['timeSlots'] || changes['slotHeight']) {
      this.calculateGridHeight();
    }
    // Recalculate available slot positions when slots or display params change
    if (changes['searchAvailableSlots'] || changes['slotHeight'] || changes['startHour'] || changes['slotDuration']) {
      this.calculateAvailableSlotPositions();
    }
    // Adjust header for scrollbar whenever content changes
    setTimeout(() => this.adjustHeaderForScrollbar(), 0);
  }

  /**
   * Calcola le posizioni degli slot disponibili per ogni giorno/utente
   */
  private calculateAvailableSlotPositions(): void {
    this.availableSlotPositions.clear();

    if (!this.searchAvailableSlots || this.searchAvailableSlots.length === 0) {
      return;
    }

    for (const slot of this.searchAvailableSlots) {
      // Find user by operatorId
      const user = this.users.find(u => u.operatorId === slot.operatorId);
      if (!user) continue;

      // Calculate top and height
      const top = this.calculateTopPosition(slot.startTime);
      const height = this.calculateHeight(slot.startTime, slot.endTime);

      const position: AvailableSlotPosition = {
        slot,
        top,
        height
      };

      // Store by date -> operatorId
      if (!this.availableSlotPositions.has(slot.date)) {
        this.availableSlotPositions.set(slot.date, new Map());
      }
      const dateMap = this.availableSlotPositions.get(slot.date)!;
      if (!dateMap.has(user.operatorId!)) {
        dateMap.set(user.operatorId!, []);
      }
      dateMap.get(user.operatorId!)!.push(position);
    }
  }

  private buildDayColumns(): void {
    this.dayColumns = [];
    for (const dateStr of this.dates) {
      const date = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = date.getDay();

      if (!this.showWeekend && (dayOfWeek === 0 || dayOfWeek === 6)) {
        continue;
      }

      this.dayColumns.push({
        date: dateStr,
        dayName: this.getDayName(dayOfWeek),
        dayNumber: date.getDate()
      });
    }
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    return days[dayOfWeek];
  }

  private syncHorizontalScroll(): void {
    const gridBody = this.gridBodyRef.nativeElement;
    const headerContainer = gridBody.closest('.grid-content')?.querySelector('.days-headers-container') as HTMLElement;

    if (headerContainer) {
      gridBody.addEventListener('scroll', () => {
        headerContainer.scrollLeft = gridBody.scrollLeft;
      });
    }
  }

  private adjustHeaderForScrollbar(): void {
    if (!this.gridBodyRef?.nativeElement) {
      return;
    }

    const gridBody = this.gridBodyRef.nativeElement;
    const headerContainer = gridBody.closest('.grid-content')?.querySelector('.days-headers-container') as HTMLElement;

    if (headerContainer) {
      // Calculate scrollbar width
      const scrollbarWidth = gridBody.offsetWidth - gridBody.clientWidth;

      // Apply padding to header to compensate for scrollbar
      if (scrollbarWidth > 0) {
        headerContainer.style.paddingRight = `${scrollbarWidth}px`;
      } else {
        headerContainer.style.paddingRight = '0';
      }
    }
  }

  onGridScroll(event: Event): void {
    // Scroll sync handled
  }

  private calculateGridHeight(): void {
    this.gridHeight = this.timeSlots.length * this.slotHeight;
  }

  private calculateEventPositions(): void {
    this.eventPositions.clear();

    // Safety check: only proceed if we have day columns
    if (!this.dayColumns || this.dayColumns.length === 0) {
      return;
    }

    for (const day of this.dayColumns) {
      const dateMap = new Map<string, EventPosition[]>();

      for (const user of this.users) {
        if (!user.operatorId) continue;
        const operatorAppointments = this.appointments.get(user.operatorId);
        if (!operatorAppointments) continue;

        const dateAppointments = operatorAppointments.get(day.date);
        if (!dateAppointments || dateAppointments.length === 0) continue;

        const positions: EventPosition[] = [];
        const sorted = [...dateAppointments].sort((a, b) => {
          return this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime);
        });

        const columns: EventPosition[][] = [];

        for (const appointment of sorted) {
          const top = this.calculateTopPosition(appointment.startTime);
          const height = this.calculateHeight(appointment.startTime, appointment.endTime);

          let columnIndex = 0;
          for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const hasOverlap = column.some(pos =>
              this.eventsOverlap(pos.appointment, appointment)
            );

            if (!hasOverlap) {
              columnIndex = i;
              break;
            }

            if (i === columns.length - 1) {
              columnIndex = columns.length;
            }
          }

          if (columnIndex >= columns.length) {
            columns.push([]);
          }

          const position: EventPosition = {
            appointment,
            top,
            height,
            left: 0,
            width: 100
          };

          columns[columnIndex].push(position);
          positions.push(position);
        }

        const totalColumns = columns.length;
        if (totalColumns > 0) {
          for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            for (const position of column) {
              position.width = 100 / totalColumns;
              position.left = (100 / totalColumns) * i;
            }
          }
        }

        dateMap.set(user.operatorId, positions);
      }

      this.eventPositions.set(day.date, dateMap);
    }
  }

  private eventsOverlap(a: Appointment, b: Appointment): boolean {
    const aStart = this.timeToMinutes(a.startTime);
    const aEnd = this.timeToMinutes(a.endTime);
    const bStart = this.timeToMinutes(b.startTime);
    const bEnd = this.timeToMinutes(b.endTime);

    return aStart < bEnd && bStart < aEnd;
  }

  private calculateTopPosition(time: string): number {
    const minutes = this.timeToMinutes(time);
    const startMinutes = this.startHour * 60;
    const minutesFromStart = minutes - startMinutes;
    const pixelsPerMinute = this.slotHeight / this.slotDuration;
    return minutesFromStart * pixelsPerMinute;
  }

  private calculateHeight(startTime: string, endTime: string): number {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    const duration = endMinutes - startMinutes;
    const pixelsPerMinute = this.slotHeight / this.slotDuration;
    return duration * pixelsPerMinute;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  isCellAvailable(operatorId: string, date: string, timeSlot: string): boolean {
    // Memoization: usa cache per evitare ricalcoli
    const cacheKey = `${operatorId}-${date}-${timeSlot}`;
    if (this.cellAvailabilityCache.has(cacheKey)) {
      return this.cellAvailabilityCache.get(cacheKey)!;
    }

    const result = this.calculateCellAvailability(operatorId, date, timeSlot);
    this.cellAvailabilityCache.set(cacheKey, result);
    return result;
  }

  private calculateCellAvailability(operatorId: string, date: string, timeSlot: string): boolean {
    // Trova l'utente per verificare se ha template
    const user = this.users.find(u => u.operatorId === operatorId);

    // Se l'utente non ha template assegnato, tutte le celle sono disponibili
    if (!user?.hasTemplate) {
      return true;
    }

    // L'utente ha un template, verifichiamo la disponibilità
    const operatorAvailabilities = this.availabilities.get(operatorId);
    if (!operatorAvailabilities) {
      // Nessuna disponibilità caricata - non disponibile
      return false;
    }

    const dateAvailabilities = operatorAvailabilities.get(date);
    if (!dateAvailabilities || dateAvailabilities.length === 0) {
      // Nessuna disponibilità per questo giorno - non disponibile
      return false;
    }

    // Calcola i limiti della cella
    const cellStartMinutes = this.timeToMinutes(timeSlot);
    const cellEndMinutes = cellStartMinutes + this.slotDuration;

    // Verifica se c'è QUALSIASI disponibilità che si sovrappone alla cella
    // (anche parzialmente) - in quel caso la cella è considerata disponibile
    // e gli overlay parziali mostreranno le parti non disponibili
    for (const availability of dateAvailabilities) {
      if (!availability.available) continue;

      const availStartMinutes = this.timeToMinutes(availability.startTime);
      const availEndMinutes = this.timeToMinutes(availability.endTime);

      // Se c'è sovrapposizione tra disponibilità e cella
      if (availStartMinutes < cellEndMinutes && availEndMinutes > cellStartMinutes) {
        return true; // La cella ha almeno disponibilità parziale
      }
    }

    // Nessuna disponibilità si sovrappone alla cella - non disponibile
    return false;
  }

  isCellOccupied(operatorId: string, date: string, timeSlot: string): boolean {
    // Memoization: usa cache per evitare ricalcoli
    const cacheKey = `${operatorId}-${date}-${timeSlot}`;
    if (this.cellOccupiedCache.has(cacheKey)) {
      return this.cellOccupiedCache.get(cacheKey)!;
    }

    const result = this.calculateCellOccupied(operatorId, date, timeSlot);
    this.cellOccupiedCache.set(cacheKey, result);
    return result;
  }

  private calculateCellOccupied(operatorId: string, date: string, timeSlot: string): boolean {
    const operatorAppointments = this.appointments.get(operatorId);
    if (!operatorAppointments) return false;

    const dateAppointments = operatorAppointments.get(date);
    if (!dateAppointments) return false;

    const slotMinutes = this.timeToMinutes(timeSlot);

    return dateAppointments.some(apt => {
      const startMinutes = this.timeToMinutes(apt.startTime);
      const endMinutes = this.timeToMinutes(apt.endTime);
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });
  }

  getEventsForDayAndUser(date: string, operatorId: string): EventPosition[] {
    const dateMap = this.eventPositions.get(date);
    if (!dateMap) return [];
    return dateMap.get(operatorId) || [];
  }

  isCellInDragSelection(operatorId: string, date: string, time: string): boolean {
    if (!this.isDragging || !this.dragStartCell || !this.dragCurrentCell) {
      return false;
    }

    // Check if this cell is in the same column (user and date) as the drag
    if (this.dragStartCell.operatorId !== operatorId || this.dragStartCell.date !== date) {
      return false;
    }

    // Get the time range of the drag selection
    const startMinutes = this.timeToMinutes(this.dragStartCell.timeSlot.time);
    const currentMinutes = this.timeToMinutes(this.dragCurrentCell.timeSlot.time);
    const cellMinutes = this.timeToMinutes(time);

    // Check if this cell's time is within the drag range
    const minTime = Math.min(startMinutes, currentMinutes);
    const maxTime = Math.max(startMinutes, currentMinutes) + this.slotDuration;

    return cellMinutes >= minTime && cellMinutes < maxTime;
  }

  getUserColorForDrag(operatorId: string): string {
    // Memoization: usa cache per evitare find ripetuti
    if (this.userColorCache.has(operatorId)) {
      return this.userColorCache.get(operatorId)!;
    }

    const user = this.users.find(u => u.operatorId === operatorId);
    const color = user?.color || '#3b82f6';
    this.userColorCache.set(operatorId, color);
    return color;
  }

  getAvailableSlotsForDayAndUser(date: string, operatorId: string): AvailableSlotPosition[] {
    const dateMap = this.availableSlotPositions.get(date);
    if (!dateMap) return [];
    return dateMap.get(operatorId) || [];
  }

  /**
   * Calcola le percentuali di indisponibilità parziale per una cella.
   * Usato quando la disponibilità dell'operatore non coincide con i bordi della cella.
   */
  getUnavailablePercents(operatorId: string, date: string, slotTime: string): { top: number; bottom: number } {
    // Trova l'utente per verificare se ha template
    const user = this.users.find(u => u.operatorId === operatorId);

    // Se l'utente non ha template, nessuna indisponibilità parziale
    if (!user?.hasTemplate) {
      return { top: 0, bottom: 0 };
    }

    // Calcola i minuti della cella
    const cellStartMinutes = this.timeToMinutes(slotTime);
    const cellEndMinutes = cellStartMinutes + this.slotDuration;

    // Trova le disponibilità dell'operatore per questa data
    const operatorAvailabilities = this.availabilities.get(operatorId);
    if (!operatorAvailabilities) {
      return { top: 0, bottom: 0 };
    }

    const dateAvailabilities = operatorAvailabilities.get(date) || [];

    // Calcola quale parte della cella è coperta da disponibilità
    let availableStart = cellEndMinutes; // Default: nessuna disponibilità (tutto non disponibile)
    let availableEnd = cellStartMinutes;

    for (const avail of dateAvailabilities) {
      if (!avail.available) continue;
      const availStart = this.timeToMinutes(avail.startTime);
      const availEnd = this.timeToMinutes(avail.endTime);

      // Se c'è sovrapposizione con la cella
      if (availStart < cellEndMinutes && availEnd > cellStartMinutes) {
        // Espandi l'intervallo disponibile
        availableStart = Math.min(availableStart, Math.max(availStart, cellStartMinutes));
        availableEnd = Math.max(availableEnd, Math.min(availEnd, cellEndMinutes));
      }
    }

    // Se non c'è nessuna disponibilità nella cella, restituisci 0 (sarà gestito da isAvailable)
    if (availableStart >= cellEndMinutes || availableEnd <= cellStartMinutes) {
      return { top: 0, bottom: 0 };
    }

    // Calcola i minuti non disponibili
    const topUnavailable = Math.max(0, availableStart - cellStartMinutes);
    const bottomUnavailable = Math.max(0, cellEndMinutes - availableEnd);

    // Converti in percentuali
    return {
      top: (topUnavailable / this.slotDuration) * 100,
      bottom: (bottomUnavailable / this.slotDuration) * 100
    };
  }

  onCellMouseDown(event: CellEvent): void {
    this.cellMouseDown.emit(event);
  }

  onCellMouseEnter(event: CellEvent): void {
    this.cellMouseEnter.emit(event);
  }

  onCellMouseUp(event: CellEvent): void {
    this.cellMouseUp.emit(event);
  }

  onCellDblClick(event: CellEvent): void {
    this.cellDblClick.emit(event);
  }

  onEventClick(action: EventAction): void {
    this.eventClick.emit(action);
  }

  onEventDblClick(action: EventAction): void {
    this.eventDblClick.emit(action);
  }

  onEventDragStart(appointment: Appointment): void {
    this.eventDragStart.emit(appointment);
  }

  onEventDragEnd(action: EventAction): void {
    this.eventDragEnd.emit(action);
  }

  onEventResize(action: EventAction): void {
    this.eventResize.emit(action);
  }

  onEventDelete(action: EventAction): void {
    this.eventDelete.emit(action);
  }

  onAvailableSlotClick(event: AvailableSlotClickEvent): void {
    this.availableSlotClick.emit(event);
  }

  onAvailableSlotDblClick(event: AvailableSlotClickEvent): void {
    this.availableSlotDblClick.emit(event);
  }

  // TrackBy functions per ottimizzare *ngFor
  trackByDay(index: number, day: DayColumn): string {
    return day.date;
  }

  trackByUser(index: number, user: User): string {
    return user.operatorId || index.toString();
  }

  trackByTimeSlot(index: number, slot: TimeSlot): string {
    return slot.time;
  }

  trackByEventPosition(index: number, eventPos: EventPosition): string {
    return String(eventPos.appointment.id);
  }

  trackBySlotPosition(index: number, slotPos: AvailableSlotPosition): string {
    return `${slotPos.slot.operatorId}-${slotPos.slot.date}-${slotPos.slot.startTime}`;
  }

  // ==================== CURRENT TIME INDICATOR ====================

  /**
   * Controlla se il giorno è oggi
   */
  isToday(date: string): boolean {
    const today = new Date();
    const checkDate = new Date(date + 'T00:00:00');
    return today.getFullYear() === checkDate.getFullYear() &&
           today.getMonth() === checkDate.getMonth() &&
           today.getDate() === checkDate.getDate();
  }

  /**
   * Aggiorna la posizione e la visibilità dell'indicatore dell'ora corrente
   */
  private updateCurrentTimeIndicator(): void {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    // Calcola i limiti dell'orario visualizzato
    const startMinutes = this.startHour * 60;
    const endMinutes = startMinutes + (this.timeSlots.length * this.slotDuration);

    // Mostra l'indicatore solo se l'ora corrente è nell'intervallo visualizzato
    // e se oggi è incluso nelle date visualizzate
    const today = new Date().toISOString().split('T')[0];
    const isTodayVisible = this.dates.includes(today);

    if (isTodayVisible && currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      this.currentTimeTop = this.calculateCurrentTimePosition(currentMinutes, startMinutes);
      this.currentTimeVisible = true;
    } else {
      this.currentTimeVisible = false;
    }
  }

  /**
   * Calcola la posizione verticale in pixel per l'ora corrente
   */
  private calculateCurrentTimePosition(currentMinutes: number, startMinutes: number): number {
    const minutesFromStart = currentMinutes - startMinutes;
    const pixelsPerMinute = this.slotHeight / this.slotDuration;
    return minutesFromStart * pixelsPerMinute;
  }

  /**
   * Avvia l'aggiornamento periodico dell'indicatore ogni minuto
   */
  private startCurrentTimeUpdates(): void {
    this.currentTimeInterval = setInterval(() => {
      this.updateCurrentTimeIndicator();
      this.cdr.markForCheck();
    }, 60000); // Aggiorna ogni 60 secondi
  }
}
