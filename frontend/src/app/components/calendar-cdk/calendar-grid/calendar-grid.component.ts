import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
  styleUrls: ['./calendar-grid.component.scss']
})
export class CalendarGridComponent implements OnInit, OnChanges, AfterViewInit {
  @ViewChild('gridBody') gridBodyRef!: ElementRef<HTMLDivElement>;
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

  ngOnInit(): void {
    this.calculateEventPositions();
    this.calculateGridHeight();
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

    const slotMinutes = this.timeToMinutes(timeSlot);

    // Verifica se lo slot è dentro uno degli intervalli disponibili
    for (const availability of dateAvailabilities) {
      const startMinutes = this.timeToMinutes(availability.startTime);
      const endMinutes = this.timeToMinutes(availability.endTime);

      if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
        return availability.available;
      }
    }

    // Lo slot non è dentro nessun intervallo disponibile - non disponibile
    return false;
  }

  isCellOccupied(operatorId: string, date: string, timeSlot: string): boolean {
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
    const user = this.users.find(u => u.operatorId === operatorId);
    return user?.color || '#3b82f6';
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
}
