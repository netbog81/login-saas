import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calendar-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-header.component.html',
  styleUrls: ['./calendar-header.component.scss']
})
export class CalendarHeaderComponent {
  @Input() currentDate!: Date;
  @Input() viewType: 'daily' | 'weekly' = 'daily';
  @Input() viewMode: 'operators' | 'gyms' = 'operators';
  @Input() visibleDates: string[] = [];

  @Output() navigateToday = new EventEmitter<void>();
  @Output() navigatePrevious = new EventEmitter<void>();
  @Output() navigateNext = new EventEmitter<void>();
  @Output() viewTypeChange = new EventEmitter<'daily' | 'weekly'>();
  @Output() dateSelect = new EventEmitter<Date>();

  get displayTitle(): string {
    if (this.viewType === 'daily') {
      return this.formatDate(this.currentDate);
    } else {
      // Weekly view - show range
      if (this.visibleDates.length > 0) {
        const firstDate = new Date(this.visibleDates[0]);
        const lastDate = new Date(this.visibleDates[this.visibleDates.length - 1]);
        return `${this.formatDateShort(firstDate)} - ${this.formatDateShort(lastDate)}`;
      }
      return this.formatDate(this.currentDate);
    }
  }

  get isToday(): boolean {
    const today = new Date();
    return this.isSameDay(this.currentDate, today);
  }

  onPreviousClick(): void {
    this.navigatePrevious.emit();
  }

  onNextClick(): void {
    this.navigateNext.emit();
  }

  onTodayClick(): void {
    this.navigateToday.emit();
  }

  onViewTypeChange(type: 'daily' | 'weekly'): void {
    this.viewTypeChange.emit(type);
  }

  private formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('it-IT', options);
  }

  private formatDateShort(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short'
    };
    return date.toLocaleDateString('it-IT', options);
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
}
