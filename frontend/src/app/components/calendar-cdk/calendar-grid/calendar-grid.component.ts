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

@Component({
  selector: 'app-calendar-grid',
  standalone: true,
  imports: [CommonModule, ScrollingModule, CalendarCellComponent, CalendarEventComponent, AvailableSlotOverlayComponent],
  templateUrl: './calendar-grid.component.html',
  styleUrls: ['./calendar-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarGridComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('gridBody') gridBodyRef!: ElementRef<HTMLDivElement>;

  constructor(private cdr: ChangeDetectorRef) {}
  @Input() timeSlots: TimeSlot[] = [];
  @Input() users: User[] = [];
  @Input() date: string = ''; // YYYY-MM-DD
  @Input() appointments: Map<string, Map<string, Appointment[]>> = new Map();
  @Input() availabilities: Map<string, Map<string, Availability[]>> = new Map();
  @Input() slotDuration: number = 15;
  @Input() slotHeight: number = 60; // pixels
  @Input() startHour: number = 0;
  @Input() viewType: 'daily' | 'weekly' = 'daily';
  @Input() showWorkingHoursOnly: boolean = false;
  @Input() showUnavailableCellsBackground: boolean = true;
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

  eventPositions: Map<string, EventPosition[]> = new Map();
  availableSlotPositions: Map<string, AvailableSlotPosition[]> = new Map();
  gridHeight: number = 0;

  // Current time indicator
  currentTimeTop: number = 0;
  currentTimeVisible: boolean = false;
  private currentTimeInterval: any;

  // Cache per memoization dei calcoli delle celle
  private cellAvailabilityCache: Map<string, boolean> = new Map();
  private cellOccupiedCache: Map<string, boolean> = new Map();
  private userColorCache: Map<string, string> = new Map();
  private unavailablePercentsCache: Map<string, { top: number; bottom: number }> = new Map();

  ngOnInit(): void {
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
      this.adjustHeaderForScrollbar();
    }
    // Check after view init
    setTimeout(() => {
      this.adjustHeaderForScrollbar();
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Invalida cache quando cambiano i dati rilevanti
    if (changes['availabilities'] || changes['date'] || changes['users']) {
      this.cellAvailabilityCache.clear();
      this.unavailablePercentsCache.clear();
    }
    if (changes['appointments'] || changes['date']) {
      this.cellOccupiedCache.clear();
    }
    if (changes['users']) {
      this.userColorCache.clear();
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
   * Calcola le posizioni degli slot disponibili per ogni utente
   */
  private calculateAvailableSlotPositions(): void {
    this.availableSlotPositions.clear();

    if (!this.searchAvailableSlots || this.searchAvailableSlots.length === 0) {
      return;
    }

    // Raggruppa gli slot per operatorId
    for (const slot of this.searchAvailableSlots) {
      // Trova l'utente corrispondente all'operatorId
      const user = this.users.find(u => u.operatorId === slot.operatorId);
      if (!user) continue;

      // Calcola posizione top e height
      const top = this.calculateTopPosition(slot.startTime);
      const height = this.calculateHeight(slot.startTime, slot.endTime);

      const position: AvailableSlotPosition = {
        slot,
        top,
        height
      };

      if (!this.availableSlotPositions.has(user.operatorId!)) {
        this.availableSlotPositions.set(user.operatorId!, []);
      }
      this.availableSlotPositions.get(user.operatorId!)!.push(position);
    }

  }

  private calculateGridHeight(): void {
    this.gridHeight = this.timeSlots.length * this.slotHeight;
  }

  private calculateEventPositions(): void {
    this.eventPositions.clear();

    for (const user of this.users) {
      if (!user.operatorId) continue;
      const operatorAppointments = this.appointments.get(user.operatorId);
      if (!operatorAppointments) continue;

      const dateAppointments = operatorAppointments.get(this.date);
      if (!dateAppointments || dateAppointments.length === 0) continue;

      const positions: EventPosition[] = [];

      // Sort appointments by start time
      const sorted = [...dateAppointments].sort((a, b) => {
        return this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime);
      });

      // Calculate positions and handle overlaps
      const columns: EventPosition[][] = [];

      for (const appointment of sorted) {
        const top = this.calculateTopPosition(appointment.startTime);
        const height = this.calculateHeight(appointment.startTime, appointment.endTime);

        // Find a column for this event
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

        // Create new column if needed
        if (columnIndex >= columns.length) {
          columns.push([]);
        }

        const position: EventPosition = {
          appointment,
          top,
          height,
          left: 0, // Will be calculated after all events are placed
          width: 100 // Will be calculated after all events are placed
        };

        columns[columnIndex].push(position);
        positions.push(position);
      }

      // Calculate widths and left positions based on columns
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

      this.eventPositions.set(user.operatorId, positions);
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

  getEventsForUser(operatorId: string): EventPosition[] {
    return this.eventPositions.get(operatorId) || [];
  }

  getAvailableSlotsForUser(operatorId: string): AvailableSlotPosition[] {
    return this.availableSlotPositions.get(operatorId) || [];
  }

  /**
   * Calcola le percentuali di indisponibilità parziale per una cella.
   * Usato quando la disponibilità dell'operatore non coincide con i bordi della cella.
   */
  getUnavailablePercents(operatorId: string, slotTime: string): { top: number; bottom: number } {
    const cacheKey = `${operatorId}-${slotTime}`;
    const cached = this.unavailablePercentsCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const result = this.computeUnavailablePercents(operatorId, slotTime);
    this.unavailablePercentsCache.set(cacheKey, result);
    return result;
  }

  private computeUnavailablePercents(operatorId: string, slotTime: string): { top: number; bottom: number } {
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

    const dateAvailabilities = operatorAvailabilities.get(this.date) || [];

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

  getUserByOperatorId(operatorId: string): User | undefined {
    return this.users.find(u => u.operatorId === operatorId);
  }

  isCellInDragSelection(operatorId: string, date: string, time: string): boolean {
    if (!this.isDragging || !this.dragStartCell || !this.dragCurrentCell) {
      return false;
    }

    // Check if this cell is in the same column (user) and date as the drag
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

  private adjustHeaderForScrollbar(): void {
    if (!this.gridBodyRef?.nativeElement) {
      return;
    }

    const gridBody = this.gridBodyRef.nativeElement;
    const gridHeader = gridBody.closest('.grid-content')?.querySelector('.grid-header') as HTMLElement;

    if (gridHeader) {
      // Calculate scrollbar width
      const scrollbarWidth = gridBody.offsetWidth - gridBody.clientWidth;

      // Apply padding to header to compensate for scrollbar
      if (scrollbarWidth > 0) {
        gridHeader.style.paddingRight = `${scrollbarWidth}px`;
      } else {
        gridHeader.style.paddingRight = '0';
      }
    }
  }

  // ==================== CURRENT TIME INDICATOR ====================

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

    // Verifica se è oggi
    const today = new Date().toISOString().split('T')[0];
    const isToday = this.date === today;

    // Mostra l'indicatore solo se l'ora corrente è nell'intervallo visualizzato e se è oggi
    if (isToday && currentMinutes >= startMinutes && currentMinutes < endMinutes) {
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
