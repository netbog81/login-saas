import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { TimeSlot } from '../services/calendar-state.service';
import { GymRoom, GymSlotInfo, GymAppointment } from '../../../services/gym-room.service';

// Re-export interfaces from service for convenience
export { GymRoom, GymSlotInfo, GymAppointment } from '../../../services/gym-room.service';

export interface GymSlotClickEvent {
  gymRoom: GymRoom;
  date: string;
  startTime: string;
  endTime: string;
  slotInfo: GymSlotInfo;
  mouseEvent?: MouseEvent;
}

@Component({
  selector: 'app-gym-calendar-grid',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  templateUrl: './gym-calendar-grid.component.html',
  styleUrls: ['./gym-calendar-grid.component.scss']
})
export class GymCalendarGridComponent implements OnInit, OnChanges, AfterViewInit {
  @ViewChild('gridBody') gridBodyRef!: ElementRef<HTMLDivElement>;

  @Input() timeSlots: TimeSlot[] = [];
  @Input() gymRooms: GymRoom[] = [];
  @Input() date: string = ''; // YYYY-MM-DD
  @Input() slotsInfo: Map<string, GymSlotInfo[]> = new Map(); // gymRoomId -> slots
  @Input() appointments: Map<string, GymAppointment[]> = new Map(); // gymRoomId -> appointments
  @Input() slotDuration: number = 15;
  @Input() slotHeight: number = 60;
  @Input() startHour: number = 0;
  @Input() showWorkingHoursOnly: boolean = false;

  @Output() slotClick = new EventEmitter<GymSlotClickEvent>();
  @Output() slotDblClick = new EventEmitter<GymSlotClickEvent>();
  @Output() appointmentClick = new EventEmitter<{ appointment: GymAppointment; mouseEvent?: MouseEvent }>();

  gridHeight: number = 0;
  scrollbarWidth: number = 0;

  ngOnInit(): void {
    console.log('[GymCalendarGrid] ngOnInit - gymRooms:', this.gymRooms?.length, 'timeSlots:', this.timeSlots?.length);
    this.calculateGridHeight();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.adjustHeaderForScrollbar(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('[GymCalendarGrid] ngOnChanges - changes:', Object.keys(changes));
    if (changes['timeSlots'] || changes['slotHeight']) {
      this.calculateGridHeight();
    }
    setTimeout(() => this.adjustHeaderForScrollbar(), 0);
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
   * Ottiene le informazioni sullo slot per una GymRoom e un orario
   */
  getSlotInfo(gymRoomId: string, time: string): GymSlotInfo | null {
    const slots = this.slotsInfo.get(gymRoomId);
    if (!slots) return null;
    const normalizedTime = this.normalizeTime(time);
    return slots.find(s => this.normalizeTime(s.startTime) === normalizedTime) || null;
  }

  /**
   * Ottiene gli appuntamenti per uno slot specifico
   */
  getSlotAppointments(gymRoomId: string, time: string): GymAppointment[] {
    const appointments = this.appointments.get(gymRoomId) || [];
    return appointments.filter(apt => apt.startTime === time);
  }

  /**
   * Calcola la classe CSS per lo slot in base al suo stato
   */
  getSlotClass(gymRoomId: string, time: string): string {
    const slotInfo = this.getSlotInfo(gymRoomId, time);
    if (!slotInfo) return 'slot-no-template';
    if (slotInfo.isClosed) return 'slot-closed';
    if (!slotInfo.isAvailable) return 'slot-full';
    if (slotInfo.currentCount > 0) return 'slot-partial';
    return 'slot-available';
  }

  /**
   * Ottiene il testo di capacità (es. "3/5")
   */
  getCapacityText(gymRoomId: string, time: string): string {
    const slotInfo = this.getSlotInfo(gymRoomId, time);
    if (!slotInfo) return '';
    if (slotInfo.isClosed) return 'Chiuso';
    return `${slotInfo.currentCount}/${slotInfo.maxCapacity}`;
  }

  /**
   * Ottiene il nome dell'operatore per lo slot
   */
  getOperatorName(gymRoomId: string, time: string): string {
    const slotInfo = this.getSlotInfo(gymRoomId, time);
    if (!slotInfo?.operator) return '';
    const op = slotInfo.operator;
    return op.surname ? `${op.name} ${op.surname}` : op.name;
  }

  /**
   * Controlla se lo slot ha un template (operatore assegnato)
   */
  hasTemplate(gymRoomId: string, time: string): boolean {
    const slotInfo = this.getSlotInfo(gymRoomId, time);
    return slotInfo !== null;
  }

  /**
   * Calcola la posizione verticale per un orario
   */
  getSlotTop(time: string): number {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins;
    const startMinutes = this.startHour * 60;
    const offsetMinutes = totalMinutes - startMinutes;
    return (offsetMinutes / this.slotDuration) * this.slotHeight;
  }

  /**
   * Gestisce il click su uno slot
   */
  onSlotClick(gymRoom: GymRoom, time: string, event: MouseEvent): void {
    const slotInfo = this.getSlotInfo(gymRoom.id, time);
    if (!slotInfo) return;

    this.slotClick.emit({
      gymRoom,
      date: this.date,
      startTime: time,
      endTime: slotInfo.endTime,
      slotInfo,
      mouseEvent: event
    });
  }

  /**
   * Gestisce il doppio click su uno slot
   */
  onSlotDblClick(gymRoom: GymRoom, time: string, event: MouseEvent): void {
    const slotInfo = this.getSlotInfo(gymRoom.id, time);
    if (!slotInfo || slotInfo.isClosed || !slotInfo.isAvailable) return;

    this.slotDblClick.emit({
      gymRoom,
      date: this.date,
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
}
