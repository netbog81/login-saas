import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { TimeSlot } from '../services/calendar-state.service';
import { GymRoom, GymSlotInfo, GymAppointment } from '../../../services/gym-room.service';

export interface GymSlotClickEvent {
  gymRoom: GymRoom;
  date: string;
  startTime: string;
  endTime: string;
  slotInfo: GymSlotInfo;
  mouseEvent?: MouseEvent;
}

interface DayColumn {
  date: string;
  dayName: string;
  dayNumber: number;
}

@Component({
  selector: 'app-gym-weekly-grid',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  templateUrl: './gym-weekly-grid.component.html',
  styleUrls: ['./gym-weekly-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GymWeeklyGridComponent implements OnInit, OnChanges, AfterViewInit {
  @ViewChild('gridBody') gridBodyRef!: ElementRef<HTMLDivElement>;

  constructor(private cdr: ChangeDetectorRef) {}

  @Input() timeSlots: TimeSlot[] = [];
  @Input() gymRooms: GymRoom[] = [];
  @Input() dates: string[] = [];
  @Input() slotsInfo: Map<string, Map<string, GymSlotInfo[]>> = new Map(); // date -> gymRoomId -> slots
  @Input() appointments: Map<string, Map<string, GymAppointment[]>> = new Map(); // date -> gymRoomId -> appointments
  @Input() slotDuration: number = 15;
  @Input() slotHeight: number = 60;
  @Input() startHour: number = 0;
  @Input() showWorkingHoursOnly: boolean = false;
  @Input() showWeekend: boolean = true;

  @Output() slotClick = new EventEmitter<GymSlotClickEvent>();
  @Output() slotDblClick = new EventEmitter<GymSlotClickEvent>();
  @Output() appointmentClick = new EventEmitter<{ appointment: GymAppointment; mouseEvent?: MouseEvent }>();

  dayColumns: DayColumn[] = [];
  gridHeight: number = 0;
  scrollbarWidth: number = 0;

  ngOnInit(): void {
    this.buildDayColumns();
    this.calculateGridHeight();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.adjustHeaderForScrollbar(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('[GymWeeklyGrid] ngOnChanges:', Object.keys(changes));
    if (changes['slotsInfo']) {
      console.log('[GymWeeklyGrid] slotsInfo received, size:', this.slotsInfo?.size);
      // Debug: mostra il contenuto delle prime date
      if (this.slotsInfo?.size > 0) {
        const firstDate = Array.from(this.slotsInfo.keys())[0];
        const dateMap = this.slotsInfo.get(firstDate);
        console.log('[GymWeeklyGrid] First date:', firstDate, 'rooms:', dateMap?.size);
        // Debug: mostra gli slot della prima room
        if (dateMap && dateMap.size > 0) {
          const firstRoomId = Array.from(dateMap.keys())[0];
          const firstRoomSlots = dateMap.get(firstRoomId);
          console.log('[GymWeeklyGrid] First room:', firstRoomId, 'slots:', firstRoomSlots?.length);
          if (firstRoomSlots && firstRoomSlots.length > 0) {
            console.log('[GymWeeklyGrid] Sample slot times:', firstRoomSlots.slice(0, 3).map(s => s.startTime));
          }
        }
      }
    }
    if (changes['timeSlots']) {
      console.log('[GymWeeklyGrid] timeSlots changed:', this.timeSlots?.length, 'slots');
      if (this.timeSlots?.length > 0) {
        console.log('[GymWeeklyGrid] Sample time slot times:', this.timeSlots.slice(0, 3).map(s => s.time));
      }
    }
    if (changes['dates'] || changes['showWeekend']) {
      this.buildDayColumns();
    }
    if (changes['timeSlots'] || changes['slotHeight']) {
      this.calculateGridHeight();
    }
    setTimeout(() => this.adjustHeaderForScrollbar(), 0);
  }

  private buildDayColumns(): void {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    this.dayColumns = this.dates.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      return {
        date: dateStr,
        dayName: dayNames[date.getDay()],
        dayNumber: date.getDate()
      };
    });
  }

  private calculateGridHeight(): void {
    this.gridHeight = this.timeSlots.length * this.slotHeight;
  }

  private adjustHeaderForScrollbar(): void {
    if (!this.gridBodyRef?.nativeElement) return;
    const el = this.gridBodyRef.nativeElement;
    this.scrollbarWidth = el.offsetWidth - el.clientWidth;
  }

  /**
   * Normalizza il formato dell'orario a HH:MM (rimuove i secondi se presenti)
   */
  private normalizeTime(time: string): string {
    if (!time) return time;
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
  }

  /**
   * Ottiene le informazioni sullo slot per una data, GymRoom e orario
   */
  getSlotInfo(date: string, gymRoomId: string, time: string): GymSlotInfo | null {
    const dateSlots = this.slotsInfo.get(date);
    if (!dateSlots) return null;
    const roomSlots = dateSlots.get(gymRoomId);
    if (!roomSlots) return null;
    const normalizedTime = this.normalizeTime(time);
    return roomSlots.find(s => this.normalizeTime(s.startTime) === normalizedTime) || null;
  }

  /**
   * Ottiene gli appuntamenti per uno slot specifico
   */
  getSlotAppointments(date: string, gymRoomId: string, time: string): GymAppointment[] {
    const dateAppts = this.appointments.get(date);
    if (!dateAppts) return [];
    const roomAppts = dateAppts.get(gymRoomId) || [];
    return roomAppts.filter(apt => apt.startTime === time);
  }

  /**
   * Calcola la classe CSS per lo slot in base al suo stato
   */
  getSlotClass(date: string, gymRoomId: string, time: string): string {
    const slotInfo = this.getSlotInfo(date, gymRoomId, time);
    if (!slotInfo) return 'slot-no-template';
    if (slotInfo.isClosed) return 'slot-closed';
    if (!slotInfo.isAvailable) return 'slot-full';
    if (slotInfo.currentCount > 0) return 'slot-partial';
    return 'slot-available';
  }

  /**
   * Ottiene il testo di capacità (es. "3/5")
   */
  getCapacityText(date: string, gymRoomId: string, time: string): string {
    const slotInfo = this.getSlotInfo(date, gymRoomId, time);
    if (!slotInfo) return '';
    if (slotInfo.isClosed) return 'X';
    return `${slotInfo.currentCount}/${slotInfo.maxCapacity}`;
  }

  /**
   * Controlla se lo slot ha un template (operatore assegnato)
   */
  hasTemplate(date: string, gymRoomId: string, time: string): boolean {
    const slotInfo = this.getSlotInfo(date, gymRoomId, time);
    return slotInfo !== null;
  }

  /**
   * Gestisce il click su uno slot
   */
  onSlotClick(gymRoom: GymRoom, date: string, time: string, event: MouseEvent): void {
    const slotInfo = this.getSlotInfo(date, gymRoom.id, time);
    if (!slotInfo) return;

    this.slotClick.emit({
      gymRoom,
      date,
      startTime: time,
      endTime: slotInfo.endTime,
      slotInfo,
      mouseEvent: event
    });
  }

  /**
   * Gestisce il doppio click su uno slot
   */
  onSlotDblClick(gymRoom: GymRoom, date: string, time: string, event: MouseEvent): void {
    const slotInfo = this.getSlotInfo(date, gymRoom.id, time);
    if (!slotInfo || slotInfo.isClosed || !slotInfo.isAvailable) return;

    this.slotDblClick.emit({
      gymRoom,
      date,
      startTime: time,
      endTime: slotInfo.endTime,
      slotInfo,
      mouseEvent: event
    });
  }

  /**
   * Gestisce il click su un appuntamento
   */
  onAppointmentClick(appointment: GymAppointment, event: MouseEvent): void {
    event.stopPropagation();
    this.appointmentClick.emit({ appointment, mouseEvent: event });
  }

  /**
   * Tracciamento per ngFor
   */
  trackByGymRoom(index: number, gymRoom: GymRoom): string {
    return gymRoom.id;
  }

  trackByDay(index: number, day: DayColumn): string {
    return day.date;
  }

  trackByTimeSlot(index: number, slot: TimeSlot): string {
    return slot.time;
  }

  trackByAppointment(index: number, apt: GymAppointment): string {
    return apt.id;
  }

  /**
   * Ottiene il colore di sfondo per una GymRoom
   */
  getGymRoomColor(gymRoom: GymRoom): string {
    return gymRoom.color || '#10b981';
  }

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
}
