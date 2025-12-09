import { Component, Input, Output, EventEmitter, HostBinding, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragEnd, CdkDragStart, CdkDragMove } from '@angular/cdk/drag-drop';
import { Appointment } from '../../../models/appointment.model';
import { User } from '../../../models/user.model';

export interface EventAction {
  type: 'click' | 'dblclick' | 'resize' | 'drag' | 'delete';
  appointment: Appointment;
  newStartTime?: string;
  newEndTime?: string;
  mouseEvent?: MouseEvent;
}

@Component({
  selector: 'app-calendar-event',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './calendar-event.component.html',
  styleUrls: ['./calendar-event.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarEventComponent {
  @Input() appointment!: Appointment;
  @Input() user!: User;
  @Input() top: number = 0; // Position in pixels from top of grid
  @Input() height: number = 60; // Height in pixels
  @Input() width: number = 100; // Width percentage
  @Input() left: number = 0; // Left position in percentage (for overlapping events)
  @Input() slotDuration: number = 15; // Duration of each slot in minutes
  @Input() isDragging: boolean = false;
  @Input() totalSelectedUsers: number = 1; // Number of selected users

  @Output() eventClick = new EventEmitter<EventAction>();
  @Output() eventDblClick = new EventEmitter<EventAction>();
  @Output() eventDragStart = new EventEmitter<Appointment>();
  @Output() eventDragEnd = new EventEmitter<EventAction>();
  @Output() eventResize = new EventEmitter<EventAction>();
  @Output() eventDelete = new EventEmitter<EventAction>();

  @HostBinding('style.top.px') get topPosition() { return this.top; }
  @HostBinding('style.height.px') get heightValue() { return this.height; }
  @HostBinding('style.width.%') get widthValue() { return this.width; }
  @HostBinding('style.left.%') get leftPosition() { return this.left; }
  @HostBinding('class.dragging') get draggingClass() { return this.isDragging; }

  get showTitle(): boolean {
    return this.totalSelectedUsers === 1;
  }

  isResizing: boolean = false;
  resizeStartY: number = 0;
  resizeStartHeight: number = 0;
  wasDragged: boolean = false;
  wasResized: boolean = false;

  constructor(private elementRef: ElementRef) {}

  onClick(event: MouseEvent): void {
    event.stopPropagation();

    // Don't emit click if we just finished dragging or resizing
    if (this.wasDragged || this.wasResized) {
      return;
    }

    this.eventClick.emit({
      type: 'click',
      appointment: this.appointment,
      mouseEvent: event
    });
  }

  onDblClick(event: MouseEvent): void {
    event.stopPropagation();
    this.eventDblClick.emit({
      type: 'dblclick',
      appointment: this.appointment
    });
  }

  onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.eventDelete.emit({
      type: 'delete',
      appointment: this.appointment
    });
  }

  onDragStarted(event: CdkDragStart): void {
    this.isDragging = true;
    this.eventDragStart.emit(this.appointment);
  }

  onDragEnded(event: CdkDragEnd): void {
    this.isDragging = false;

    // Calculate new time based on drag position
    const pixelsPerMinute = this.height / this.getDurationInMinutes();
    const movedPixels = event.distance.y;
    const movedMinutes = Math.round(movedPixels / pixelsPerMinute / this.slotDuration) * this.slotDuration;

    if (movedMinutes !== 0) {
      const newStartTime = this.addMinutesToTime(this.appointment.startTime, movedMinutes);
      const newEndTime = this.addMinutesToTime(this.appointment.endTime, movedMinutes);

      this.eventDragEnd.emit({
        type: 'drag',
        appointment: this.appointment,
        newStartTime,
        newEndTime
      });
    }

    // Mark that we dragged so the click event doesn't fire
    // Set this even if no actual movement, because drag was initiated
    if (event.distance.y !== 0 || event.distance.x !== 0) {
      this.wasDragged = true;
      // Reset the flag after a short delay to handle the click event timing
      setTimeout(() => {
        this.wasDragged = false;
      }, 100);
    }

    // Reset position
    event.source.element.nativeElement.style.transform = 'none';
    event.source._dragRef.reset();
  }

  onResizeStart(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.isResizing = true;
    this.resizeStartY = event.clientY;
    this.resizeStartHeight = this.height;

    const mouseMoveHandler = (e: MouseEvent) => {
      if (this.isResizing) {
        const deltaY = e.clientY - this.resizeStartY;
        const newHeight = Math.max(30, this.resizeStartHeight + deltaY); // Minimum 30px
        this.height = newHeight;
      }
    };

    const mouseUpHandler = (e: MouseEvent) => {
      if (this.isResizing) {
        this.isResizing = false;
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);

        // Calculate new end time based on new height
        const pixelsPerMinute = this.resizeStartHeight / this.getDurationInMinutes();
        const heightChange = this.height - this.resizeStartHeight;
        const minutesChange = Math.round(heightChange / pixelsPerMinute / this.slotDuration) * this.slotDuration;

        if (minutesChange !== 0) {
          const newEndTime = this.addMinutesToTime(this.appointment.endTime, minutesChange);

          this.eventResize.emit({
            type: 'resize',
            appointment: this.appointment,
            newEndTime
          });
        }

        // Mark that we resized so the click event doesn't fire
        // Set this even if no actual resize, because resize was initiated
        this.wasResized = true;
        // Reset the flag after a short delay to handle the click event timing
        setTimeout(() => {
          this.wasResized = false;
        }, 100);
      }
    };

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  }

  private getDurationInMinutes(): number {
    const start = this.timeToMinutes(this.appointment.startTime);
    const end = this.timeToMinutes(this.appointment.endTime);
    return end - start;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private addMinutesToTime(time: string, minutesToAdd: number): string {
    const totalMinutes = this.timeToMinutes(time) + minutesToAdd;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  get displayTitle(): string {
    return this.appointment.patient
      ? `${this.appointment.patient.name} ${this.appointment.patient.surname}`
      : this.appointment.title;
  }

  get displayTime(): string {
    return `${this.appointment.startTime} - ${this.appointment.endTime}`;
  }

  get backgroundColor(): string {
    return this.user.color || '#3b82f6';
  }

  get hasInstruments(): boolean {
    return !!(this.appointment.instruments && this.appointment.instruments.length > 0);
  }

  get instrumentsCount(): number {
    return this.appointment.instruments?.length || 0;
  }
}
