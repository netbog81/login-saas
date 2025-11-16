import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarConfig } from '../services/calendar-state.service';

@Component({
  selector: 'app-calendar-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-toolbar.component.html',
  styleUrls: ['./calendar-toolbar.component.scss']
})
export class CalendarToolbarComponent {
  @Input() config!: CalendarConfig;

  @Output() configChange = new EventEmitter<Partial<CalendarConfig>>();

  slotDurations = [5, 10, 15, 20, 30];
  zoomLevels = [
    { value: 0.5, label: '50%' },
    { value: 1, label: '100%' },
    { value: 1.5, label: '150%' },
    { value: 2, label: '200%' }
  ];

  onSlotDurationChange(duration: number): void {
    this.configChange.emit({ slotDuration: duration });
  }

  onZoomChange(zoom: number): void {
    this.configChange.emit({ zoom });
  }

  onWorkingHoursToggle(): void {
    this.configChange.emit({ showWorkingHoursOnly: !this.config.showWorkingHoursOnly });
  }

  onWeekendToggle(): void {
    this.configChange.emit({ showWeekend: !this.config.showWeekend });
  }

  onOperatorsToggle(): void {
    this.configChange.emit({ showOperatorsLegend: !this.config.showOperatorsLegend });
  }

  get slotHeightPx(): number {
    return Math.round(60 * this.config.zoom);
  }
}
