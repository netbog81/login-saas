import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import { GridConfig, DaySchedule, TimeSlot, DAY_COLORS, DAY_NAMES } from '../../../graphql/ui-types';

interface Cell {
  day: number;
  timeIndex: number;
  time: string;
  selected: boolean;
  inSlot: boolean;
  slotId?: string;
}

@Component({
  selector: 'app-week-grid',
  imports: [CommonModule, DragDropModule],
  templateUrl: './week-grid.html',
  styleUrl: './week-grid.scss',
})
export class WeekGrid implements OnInit, OnChanges {
  @Input() config!: GridConfig;
  @Input() weekNumber: number = 1;
  @Input() schedule: DaySchedule[] = [];
  @Output() scheduleChange = new EventEmitter<DaySchedule[]>();

  dayNames = DAY_NAMES;
  dayColors = DAY_COLORS;

  timeSlots: string[] = [];
  cells: Cell[][] = []; // cells[day][timeIndex]

  // Creation state
  isDragging = false;
  dragStartCell: { day: number; timeIndex: number } | null = null;
  dragEndCell: { day: number; timeIndex: number } | null = null;

  // CDK drag state
  isDraggingSlot = false;
  currentDraggedSlot: { day: number; slotIndex: number } | null = null;

  // Resize state
  isResizing = false;
  resizingSlot: { day: number; slotIndex: number } | null = null;
  resizeStartY = 0;
  resizeInitialEndTime = '';

  hoveredSlot: { day: number; slotIndex: number } | null = null;

  ngOnInit() {
    this.initializeGrid();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Re-initialize grid when config or schedule changes
    if (changes['config']) {
      this.initializeGrid();
    }
    if (changes['schedule']) {
      this.applySlotsToGrid();
    }
  }

  private initializeGrid() {
    this.generateTimeSlots();
    this.initializeCells();
    this.applySlotsToGrid();
  }

  private generateTimeSlots() {
    this.timeSlots = [];
    const [startHour, startMinute] = this.config.workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = this.config.workingHours.end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    for (let minutes = startMinutes; minutes < endMinutes; minutes += this.config.cellDuration) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      this.timeSlots.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
    }
  }

  private initializeCells() {
    this.cells = [];
    for (let day = 0; day < 7; day++) {
      this.cells[day] = [];
      for (let timeIndex = 0; timeIndex < this.timeSlots.length; timeIndex++) {
        this.cells[day][timeIndex] = {
          day,
          timeIndex,
          time: this.timeSlots[timeIndex],
          selected: false,
          inSlot: false,
        };
      }
    }
  }

  private applySlotsToGrid() {
    // Slots are now positioned using mathematical calculations (overlay)
    // No need to map slots to cells - cells are only for drawing new slots
    // Just reset cell states
    this.cells.forEach(dayCells => {
      dayCells.forEach(cell => {
        cell.inSlot = false;
        cell.slotId = undefined;
      });
    });

    // Mark cells that are covered by slots (to prevent drawing over existing slots)
    this.schedule.forEach(daySchedule => {
      const day = daySchedule.dayOfWeek;
      daySchedule.slots.forEach((slot, slotIndex) => {
        const slotId = `${day}-${slotIndex}`;
        const startMinutes = this.timeToMinutes(slot.startTime);
        const endMinutes = this.timeToMinutes(slot.endTime);

        // Mark all cells covered by this slot
        this.cells[day]?.forEach(cell => {
          const cellMinutes = this.timeToMinutes(cell.time);
          if (cellMinutes >= startMinutes && cellMinutes < endMinutes) {
            cell.inSlot = true;
            cell.slotId = slotId;
          }
        });
      });
    });
  }

  /**
   * Normalize time format to HH:MM (remove seconds if present)
   */
  private normalizeTimeFormat(time: string): string {
    // If time includes seconds (HH:MM:SS), remove them
    if (time.length > 5 && time.charAt(5) === ':') {
      return time.substring(0, 5);
    }
    return time;
  }

  getDayColor(day: number): string {
    return this.dayColors[day as keyof typeof this.dayColors];
  }

  onMouseDown(day: number, timeIndex: number, event: MouseEvent) {
    // Prevent if clicking on existing slot (to allow hover delete)
    const cell = this.cells[day][timeIndex];
    if (cell.inSlot) {
      return;
    }

    event.preventDefault();
    this.isDragging = true;
    this.dragStartCell = { day, timeIndex };
    this.dragEndCell = { day, timeIndex };
    this.cells[day][timeIndex].selected = true;
  }

  onMouseEnter(day: number, timeIndex: number) {
    if (this.isDragging && this.dragStartCell && this.dragStartCell.day === day) {
      this.dragEndCell = { day, timeIndex };
      this.updateSelection();
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (this.isDragging && this.dragStartCell && this.dragEndCell) {
      this.createSlotFromSelection();
    }
    this.isDragging = false;
    this.dragStartCell = null;
    this.dragEndCell = null;
    this.clearSelection();
  }

  private updateSelection() {
    if (!this.dragStartCell || !this.dragEndCell) return;

    const day = this.dragStartCell.day;
    const startIndex = Math.min(this.dragStartCell.timeIndex, this.dragEndCell.timeIndex);
    const endIndex = Math.max(this.dragStartCell.timeIndex, this.dragEndCell.timeIndex);

    // Clear all selections
    this.cells.forEach(dayCells => dayCells.forEach(cell => cell.selected = false));

    // Select range
    for (let i = startIndex; i <= endIndex; i++) {
      if (this.cells[day][i] && !this.cells[day][i].inSlot) {
        this.cells[day][i].selected = true;
      }
    }
  }

  private clearSelection() {
    this.cells.forEach(dayCells => dayCells.forEach(cell => cell.selected = false));
  }

  private createSlotFromSelection() {
    if (!this.dragStartCell || !this.dragEndCell) return;

    const day = this.dragStartCell.day;
    const startIndex = Math.min(this.dragStartCell.timeIndex, this.dragEndCell.timeIndex);
    const endIndex = Math.max(this.dragStartCell.timeIndex, this.dragEndCell.timeIndex);

    const startTime = this.timeSlots[startIndex];
    const endTime = this.calculateEndTime(endIndex);

    // Add to schedule
    const daySchedule = this.schedule.find(d => d.dayOfWeek === day);
    if (daySchedule) {
      daySchedule.slots.push({ startTime, endTime });
    } else {
      this.schedule.push({
        dayOfWeek: day,
        slots: [{ startTime, endTime }],
      });
    }

    this.applySlotsToGrid();
    this.scheduleChange.emit(this.schedule);
  }

  private calculateEndTime(timeIndex: number): string {
    const endIndex = timeIndex + 1;
    if (endIndex < this.timeSlots.length) {
      return this.timeSlots[endIndex];
    } else {
      // Calculate the time after the last slot
      const lastTime = this.timeSlots[timeIndex];
      const [hours, minutes] = lastTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + this.config.cellDuration;
      const endHours = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    }
  }

  onSlotClick(day: number, slotId: string, event: MouseEvent) {
    event.stopPropagation();
    // TODO: Open edit modal
    console.log('Edit slot:', day, slotId);
  }

  onSlotHover(day: number, slotIndex: number, isEnter: boolean) {
    if (isEnter) {
      this.hoveredSlot = { day, slotIndex };
    } else {
      this.hoveredSlot = null;
    }
  }

  onDeleteSlot(day: number, slotIndex: number, event: MouseEvent) {
    event.stopPropagation();

    const daySchedule = this.schedule.find(d => d.dayOfWeek === day);
    if (daySchedule) {
      daySchedule.slots.splice(slotIndex, 1);

      // Remove day if no slots left
      if (daySchedule.slots.length === 0) {
        const dayIndex = this.schedule.indexOf(daySchedule);
        this.schedule.splice(dayIndex, 1);
      }
    }

    this.applySlotsToGrid();
    this.scheduleChange.emit(this.schedule);
    this.hoveredSlot = null;
  }

  getSlotsByDay(day: number): TimeSlot[] {
    const daySchedule = this.schedule.find(d => d.dayOfWeek === day);
    return daySchedule ? daySchedule.slots : [];
  }

  getSlotStyle(day: number, slot: TimeSlot): any {
    // Use mathematical calculation like the calendar does, instead of indexOf
    // This works with any cell duration without needing to search in timeSlots array
    const top = this.calculateTopPosition(slot.startTime);
    const height = this.calculateHeight(slot.startTime, slot.endTime);

    return {
      top: `${top}px`,
      height: `${height}px`,
      backgroundColor: this.getDayColor(day),
    };
  }

  private calculateTopPosition(time: string): number {
    const minutes = this.timeToMinutes(time);
    const [startHour, startMinute] = this.config.workingHours.start.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const minutesFromStart = minutes - startMinutes;
    const cellHeight = 40; // 40px per cell
    const pixelsPerMinute = cellHeight / this.config.cellDuration;
    return minutesFromStart * pixelsPerMinute;
  }

  private calculateHeight(startTime: string, endTime: string): number {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    const duration = endMinutes - startMinutes;
    const cellHeight = 40; // 40px per cell
    const pixelsPerMinute = cellHeight / this.config.cellDuration;
    return duration * pixelsPerMinute;
  }

  private timeToMinutes(time: string): number {
    // Normalize time format (remove seconds if present)
    const normalized = this.normalizeTimeFormat(time);
    const [hours, minutes] = normalized.split(':').map(Number);
    return hours * 60 + minutes;
  }

  isSlotHovered(day: number, slotIndex: number): boolean {
    return this.hoveredSlot?.day === day && this.hoveredSlot?.slotIndex === slotIndex;
  }

  trackByDay(index: number): number {
    return index;
  }

  trackByTime(index: number): number {
    return index;
  }

  // CDK Drag handlers
  onSlotDragStarted(event: CdkDragStart, day: number, slotIndex: number) {
    this.isDraggingSlot = true;
    this.currentDraggedSlot = { day, slotIndex };
  }

  onSlotDragMoved(event: any, day: number, slotIndex: number) {
    // Apply snap during drag for visual feedback
    const cellHeight = 40;
    const snapSize = cellHeight;

    // Get current position from the drag event
    const currentY = event.distance.y;

    // Snap to nearest grid position
    const snappedY = Math.round(currentY / snapSize) * snapSize;

    // Apply the snapped position to the element
    const element = event.source.element.nativeElement;
    element.style.transform = `translate3d(0px, ${snappedY}px, 0px)`;
  }

  onSlotDragEnded(event: CdkDragEnd, day: number, slotIndex: number) {
    this.isDraggingSlot = false;
    this.currentDraggedSlot = null;

    const daySchedule = this.schedule.find(d => d.dayOfWeek === day);
    if (!daySchedule || !daySchedule.slots[slotIndex]) return;

    const slot = daySchedule.slots[slotIndex];
    const cellHeight = 40; // 40px per cell

    // Calculate minutes moved using pixels and cell duration
    const movedPixels = event.distance.y;
    const pixelsPerMinute = cellHeight / this.config.cellDuration;
    const movedMinutes = Math.round(movedPixels / pixelsPerMinute);

    if (movedMinutes === 0) {
      // Reset position if no actual movement
      event.source.element.nativeElement.style.transform = 'none';
      return;
    }

    // Parse current times
    const [startHours, startMinutes] = slot.startTime.split(':').map(Number);
    const [endHours, endMinutes] = slot.endTime.split(':').map(Number);

    // Calculate new times in total minutes
    let newStartMinutes = startHours * 60 + startMinutes + movedMinutes;
    const slotDuration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);

    // SNAP to cell duration grid (30 or 60 min intervals)
    newStartMinutes = Math.round(newStartMinutes / this.config.cellDuration) * this.config.cellDuration;
    const newEndMinutes = newStartMinutes + slotDuration;

    // Validate times are within working hours
    const [workStartHours, workStartMinutes] = this.config.workingHours.start.split(':').map(Number);
    const [workEndHours, workEndMinutes] = this.config.workingHours.end.split(':').map(Number);
    const workStartMinutesTotal = workStartHours * 60 + workStartMinutes;
    const workEndMinutesTotal = workEndHours * 60 + workEndMinutes;

    if (newStartMinutes < workStartMinutesTotal || newEndMinutes > workEndMinutesTotal) {
      // Reset if out of bounds
      event.source.element.nativeElement.style.transform = 'none';
      return;
    }

    // Format new times
    const formatTime = (totalMinutes: number): string => {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    slot.startTime = formatTime(newStartMinutes);
    slot.endTime = formatTime(newEndMinutes);

    // Reset transform and update grid
    event.source.element.nativeElement.style.transform = 'none';
    this.applySlotsToGrid();
    this.scheduleChange.emit(this.schedule);
  }

  // Resize handlers
  onResizeStart(event: MouseEvent, day: number, slotIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    this.isResizing = true;
    this.resizingSlot = { day, slotIndex };
    this.resizeStartY = event.clientY;

    const daySchedule = this.schedule.find(d => d.dayOfWeek === day);
    if (daySchedule && daySchedule.slots[slotIndex]) {
      this.resizeInitialEndTime = daySchedule.slots[slotIndex].endTime;
    }

    document.addEventListener('mousemove', this.handleResize);
    document.addEventListener('mouseup', this.handleResizeEnd);
  }

  private handleResize = (event: MouseEvent) => {
    if (!this.isResizing || !this.resizingSlot) return;

    const { day, slotIndex } = this.resizingSlot;
    const daySchedule = this.schedule.find(d => d.dayOfWeek === day);
    if (!daySchedule || !daySchedule.slots[slotIndex]) return;

    const slot = daySchedule.slots[slotIndex];
    const cellHeight = 40;
    const movedPixels = event.clientY - this.resizeStartY;

    // Always snap to 30-minute intervals for flexible slot durations
    const pixelsPerMinute = cellHeight / this.config.cellDuration;
    const movedMinutes = Math.round((movedPixels / pixelsPerMinute) / 30) * 30;

    // Parse initial end time
    const [endHours, endMinutes] = this.resizeInitialEndTime.split(':').map(Number);
    const newEndMinutes = endHours * 60 + endMinutes + movedMinutes;

    // Parse start time for minimum duration check
    const [startHours, startMinutes] = slot.startTime.split(':').map(Number);
    const startMinutesTotal = startHours * 60 + startMinutes;

    // Validate minimum duration (at least one cell)
    if (newEndMinutes <= startMinutesTotal + this.config.cellDuration) {
      return;
    }

    // Validate within working hours
    const [workEndHours, workEndMinutes] = this.config.workingHours.end.split(':').map(Number);
    const workEndMinutesTotal = workEndHours * 60 + workEndMinutes;

    if (newEndMinutes > workEndMinutesTotal) {
      return;
    }

    // Update end time
    const hours = Math.floor(newEndMinutes / 60);
    const mins = newEndMinutes % 60;
    slot.endTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    this.applySlotsToGrid();
  }

  private handleResizeEnd = (event: MouseEvent) => {
    this.isResizing = false;
    this.resizingSlot = null;

    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.handleResizeEnd);

    this.scheduleChange.emit(this.schedule);
  }

  getCdkDragBoundary(): string {
    return '.days-container';
  }

  constrainDragPosition = (point: any, dragRef: any) => {
    // point.y is the drag offset from the original position
    // We need to snap the total position (original + offset) to the grid

    const cellHeight = 40;
    const snapSize = cellHeight; // Always 40px per cell

    // Get the original position from the element
    const element = dragRef.element.nativeElement;
    const originalTop = parseInt(element.style.top) || 0;

    // Calculate the new absolute position
    const newAbsoluteY = originalTop + point.y;

    // Snap to nearest cell
    const snappedAbsoluteY = Math.round(newAbsoluteY / snapSize) * snapSize;

    // Return the constrained offset
    return {
      x: 0, // Lock X axis
      y: snappedAbsoluteY - originalTop
    };
  }
}
