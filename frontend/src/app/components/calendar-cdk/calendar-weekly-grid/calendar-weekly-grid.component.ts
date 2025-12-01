import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CalendarCellComponent, CellEvent } from '../calendar-cell/calendar-cell.component';
import { CalendarEventComponent, EventAction } from '../calendar-event/calendar-event.component';
import { TimeSlot } from '../services/calendar-state.service';
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

interface DayColumn {
  date: string;
  dayName: string;
  dayNumber: number;
}

@Component({
  selector: 'app-calendar-weekly-grid',
  standalone: true,
  imports: [CommonModule, ScrollingModule, CalendarCellComponent, CalendarEventComponent],
  templateUrl: './calendar-weekly-grid.component.html',
  styleUrl: './calendar-weekly-grid.component.scss'
})
export class CalendarWeeklyGridComponent implements OnInit, OnChanges, AfterViewInit {
  @ViewChild('gridBody') gridBodyRef!: ElementRef<HTMLDivElement>;

  @Input() timeSlots: TimeSlot[] = [];
  @Input() users: User[] = [];
  @Input() dates: string[] = [];
  @Input() appointments: Map<number, Map<string, Appointment[]>> = new Map();
  @Input() availabilities: Map<number, Map<string, Availability[]>> = new Map();
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

  dayColumns: DayColumn[] = [];
  eventPositions: Map<string, Map<number, EventPosition[]>> = new Map();
  gridHeight: number = 0;
  showUserNames: boolean = true;

  ngOnInit(): void {
    this.buildDayColumns();
    this.calculateEventPositions();
    this.calculateGridHeight();
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
    // Adjust header for scrollbar whenever content changes
    setTimeout(() => this.adjustHeaderForScrollbar(), 0);
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
      const dateMap = new Map<number, EventPosition[]>();

      for (const user of this.users) {
        const userAppointments = this.appointments.get(user.id);
        if (!userAppointments) continue;

        const dateAppointments = userAppointments.get(day.date);
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

        dateMap.set(user.id, positions);
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

  isCellAvailable(userId: number, date: string, timeSlot: string): boolean {
    // Trova l'utente per verificare se ha template
    const user = this.users.find(u => u.id === userId);

    // Se l'utente non ha template assegnato, tutte le celle sono disponibili
    if (!user?.hasTemplate) {
      return true;
    }

    // L'utente ha un template, verifichiamo la disponibilità
    const userAvailabilities = this.availabilities.get(userId);
    if (!userAvailabilities) {
      // Nessuna disponibilità caricata - non disponibile
      return false;
    }

    const dateAvailabilities = userAvailabilities.get(date);
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

  isCellOccupied(userId: number, date: string, timeSlot: string): boolean {
    const userAppointments = this.appointments.get(userId);
    if (!userAppointments) return false;

    const dateAppointments = userAppointments.get(date);
    if (!dateAppointments) return false;

    const slotMinutes = this.timeToMinutes(timeSlot);

    return dateAppointments.some(apt => {
      const startMinutes = this.timeToMinutes(apt.startTime);
      const endMinutes = this.timeToMinutes(apt.endTime);
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });
  }

  getEventsForDayAndUser(date: string, userId: number): EventPosition[] {
    const dateMap = this.eventPositions.get(date);
    if (!dateMap) return [];
    return dateMap.get(userId) || [];
  }

  isCellInDragSelection(userId: number, date: string, time: string): boolean {
    if (!this.isDragging || !this.dragStartCell || !this.dragCurrentCell) {
      return false;
    }

    // Check if this cell is in the same column (user and date) as the drag
    if (this.dragStartCell.userId !== userId || this.dragStartCell.date !== date) {
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

  getUserColorForDrag(userId: number): string {
    const user = this.users.find(u => u.id === userId);
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
}
