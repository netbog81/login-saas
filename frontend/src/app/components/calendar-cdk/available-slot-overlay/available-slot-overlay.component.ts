import { Component, Input, Output, EventEmitter, HostBinding, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface AvailableSlotClickEvent {
  operatorId: string;
  date: string;
  startTime: string;
  endTime: string;
  availableInstruments?: {
    id: string;
    name: string;
    categoryId: string;
  }[];
}

@Component({
  selector: 'app-available-slot-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="slot-content">
      <span class="slot-time">{{ startTime }} - {{ endTime }}</span>
      <span class="slot-label">Disponibile</span>
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      left: 2px;
      right: 2px;
      border-radius: 4px;
      cursor: pointer;
      pointer-events: auto;
      z-index: 5;
      transition: all 0.15s ease;

      /* Bordo colorato con sfondo semi-trasparente */
      border: 2px dashed var(--slot-color, #3b82f6);
      background-color: rgba(59, 130, 246, 0.08);

      &:hover {
        background-color: rgba(59, 130, 246, 0.15);
        transform: scale(1.01);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
    }

    .slot-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 4px;
      color: var(--slot-color, #3b82f6);
      font-size: 11px;
      text-align: center;
      overflow: hidden;
    }

    .slot-time {
      font-weight: 600;
      white-space: nowrap;
    }

    .slot-label {
      font-size: 10px;
      opacity: 0.8;
      white-space: nowrap;
    }

    /* Nasconde il label se lo slot è troppo piccolo */
    :host(.compact) .slot-label {
      display: none;
    }

    :host(.compact) .slot-content {
      flex-direction: row;
      gap: 4px;
    }
  `]
})
export class AvailableSlotOverlayComponent {
  @Input() operatorId: string = '';
  @Input() date: string = '';
  @Input() startTime: string = '';
  @Input() endTime: string = '';
  @Input() top: number = 0;
  @Input() height: number = 60;
  @Input() color: string = '#3b82f6';
  @Input() availableInstruments?: { id: string; name: string; categoryId: string; }[];

  @Output() slotClick = new EventEmitter<AvailableSlotClickEvent>();
  @Output() slotDblClick = new EventEmitter<AvailableSlotClickEvent>();

  @HostBinding('style.top.px') get topPosition() { return this.top; }
  @HostBinding('style.height.px') get slotHeight() { return this.height; }
  @HostBinding('style.--slot-color') get slotColor() { return this.color; }
  @HostBinding('class.compact') get isCompact() { return this.height < 50; }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.slotClick.emit(this.createEvent());
  }

  @HostListener('dblclick', ['$event'])
  onDblClick(event: MouseEvent): void {
    event.stopPropagation();
    this.slotDblClick.emit(this.createEvent());
  }

  private createEvent(): AvailableSlotClickEvent {
    return {
      operatorId: this.operatorId,
      date: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
      availableInstruments: this.availableInstruments
    };
  }
}
