import { Component, Input, Output, EventEmitter, ElementRef, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GymRoom, GymSlotInfo, GymAppointment } from '../../../services/gym-room.service';

export interface GymSlotSummaryAction {
  type: 'edit' | 'delete' | 'add' | 'close';
  appointment?: GymAppointment;
  slotInfo?: GymSlotInfo;
  gymRoom?: GymRoom;
  date?: string;
}

@Component({
  selector: 'app-gym-slot-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gym-slot-summary.component.html',
  styleUrls: ['./gym-slot-summary.component.scss']
})
export class GymSlotSummaryComponent implements OnInit, OnDestroy {
  @Input() gymRoom!: GymRoom;
  @Input() slotInfo!: GymSlotInfo;
  @Input() appointments: GymAppointment[] = [];
  @Input() date!: string;
  @Output() action = new EventEmitter<GymSlotSummaryAction>();
  @Output() clickOutside = new EventEmitter<void>();

  private isInitialized = false;
  private clickListener: ((event: MouseEvent) => void) | null = null;

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    // Delay adding the click listener to ignore the initial click that opened the overlay
    setTimeout(() => {
      this.isInitialized = true;
      this.clickListener = (event: MouseEvent) => this.handleDocumentClick(event);
      document.addEventListener('click', this.clickListener);
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener);
    }
  }

  private handleDocumentClick(event: MouseEvent): void {
    if (this.isInitialized && !this.elementRef.nativeElement.contains(event.target)) {
      this.clickOutside.emit();
    }
  }

  onEditAppointment(appointment: GymAppointment): void {
    this.action.emit({
      type: 'edit',
      appointment,
      slotInfo: this.slotInfo,
      gymRoom: this.gymRoom,
      date: this.date
    });
  }

  onDeleteAppointment(appointment: GymAppointment): void {
    this.action.emit({
      type: 'delete',
      appointment,
      slotInfo: this.slotInfo,
      gymRoom: this.gymRoom,
      date: this.date
    });
  }

  onAddAppointment(): void {
    this.action.emit({
      type: 'add',
      slotInfo: this.slotInfo,
      gymRoom: this.gymRoom,
      date: this.date
    });
  }

  onClose(): void {
    this.action.emit({
      type: 'close'
    });
  }

  get formattedTime(): string {
    return `${this.slotInfo.startTime} - ${this.slotInfo.endTime}`;
  }

  get availableSpots(): number {
    return this.slotInfo.maxCapacity - this.slotInfo.currentCount;
  }

  get canAddMore(): boolean {
    return this.slotInfo.isAvailable && this.availableSpots > 0;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('it-IT', options);
  }

  getPatientName(appointment: GymAppointment): string {
    return appointment.clientName || 'Paziente senza nome';
  }

  getOperatorName(): string {
    if (!this.slotInfo?.operator) return '';
    const op = this.slotInfo.operator;
    return op.surname ? `${op.name} ${op.surname}` : op.name;
  }

  trackByAppointment(index: number, apt: GymAppointment): string {
    return apt.id;
  }
}
