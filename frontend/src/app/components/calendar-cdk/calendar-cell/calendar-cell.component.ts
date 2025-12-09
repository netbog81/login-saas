import { Component, Input, Output, EventEmitter, HostBinding, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeSlot } from '../services/calendar-state.service';
import { User } from '../../../models/user.model';

export interface CellEvent {
  userId: number;  // Legacy ID for backward compatibility
  operatorId: string;  // UUID for API calls
  date: string;
  timeSlot: TimeSlot;
  type: 'mousedown' | 'mouseenter' | 'mouseup' | 'dblclick';
}

@Component({
  selector: 'app-calendar-cell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-cell.component.html',
  styleUrls: ['./calendar-cell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarCellComponent {
  @Input() timeSlot!: TimeSlot;
  @Input() date!: string;
  @Input() user!: User;
  @Input() slotHeight: number = 60;
  @Input() isAvailable: boolean = true;
  @Input() isOccupied: boolean = false;
  @Input() isDragTarget: boolean = false;
  @Input() isWorkingHour: boolean = true;
  @Input() showTimeLabel: boolean = false;
  @Input() isDragSelected: boolean = false;
  @Input() dragSelectionColor: string = '#3b82f6';

  @Output() cellMouseDown = new EventEmitter<CellEvent>();
  @Output() cellMouseEnter = new EventEmitter<CellEvent>();
  @Output() cellMouseUp = new EventEmitter<CellEvent>();
  @Output() cellDblClick = new EventEmitter<CellEvent>();

  @HostBinding('style.height.px') get cellHeight() { return this.slotHeight; }
  @HostBinding('class.available') get availableClass() { return this.isAvailable; }
  @HostBinding('class.occupied') get occupiedClass() { return this.isOccupied; }
  @HostBinding('class.drag-target') get dragTargetClass() { return this.isDragTarget; }
  @HostBinding('class.non-working') get nonWorkingClass() { return !this.isWorkingHour; }
  @HostBinding('class.drag-selected') get dragSelectedClass() { return this.isDragSelected; }
  @HostBinding('style.--drag-selection-color') get dragColor() {
    return this.isDragSelected ? this.dragSelectionColor : '';
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.cellMouseDown.emit(this.createCellEvent('mousedown'));
  }

  @HostListener('mouseenter', ['$event'])
  onMouseEnter(event: MouseEvent): void {
    this.cellMouseEnter.emit(this.createCellEvent('mouseenter'));
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    this.cellMouseUp.emit(this.createCellEvent('mouseup'));
  }

  @HostListener('dblclick', ['$event'])
  onDblClick(event: MouseEvent): void {
    event.preventDefault();
    this.cellDblClick.emit(this.createCellEvent('dblclick'));
  }

  private createCellEvent(type: CellEvent['type']): CellEvent {
    return {
      userId: this.user.id,
      operatorId: this.user.operatorId || '',
      date: this.date,
      timeSlot: this.timeSlot,
      type
    };
  }
}
