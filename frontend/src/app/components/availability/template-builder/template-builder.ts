import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeekGrid } from '../week-grid/week-grid';
import { TemplatePattern, GridConfig, WeekSchedule, DaySchedule } from '../../../graphql/types';

@Component({
  selector: 'app-template-builder',
  imports: [CommonModule, FormsModule, WeekGrid],
  templateUrl: './template-builder.html',
  styleUrl: './template-builder.scss',
})
export class TemplateBuilder implements OnInit {
  @Input() pattern: TemplatePattern | null = null;
  @Output() patternChange = new EventEmitter<TemplatePattern>();
  @Output() save = new EventEmitter<TemplatePattern>();
  @Output() cancel = new EventEmitter<void>();

  config: GridConfig = {
    cellDuration: 30,
    workingHours: {
      start: '07:00',
      end: '20:00',
    },
    patternWeeks: 1,
  };

  templateName: string = '';
  validFrom: string = '';
  validUntil: string = '';

  weeks: WeekSchedule[] = [];
  expandedWeeks: Set<number> = new Set();

  ngOnInit() {
    if (this.pattern) {
      // Load existing pattern
      this.templateName = this.pattern.name;
      this.validFrom = this.pattern.validFrom || '';
      this.validUntil = this.pattern.validUntil || '';
      this.config.patternWeeks = this.pattern.patternWeeks;
      this.weeks = JSON.parse(JSON.stringify(this.pattern.weeks)); // Deep copy
    } else {
      // Initialize new pattern
      this.validFrom = this.getTodayString();
      this.initializeWeeks();
    }

    // Expand all weeks initially
    for (let i = 1; i <= this.config.patternWeeks; i++) {
      this.expandedWeeks.add(i);
    }
  }

  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  private initializeWeeks() {
    this.weeks = [];
    for (let i = 1; i <= this.config.patternWeeks; i++) {
      this.weeks.push({
        weekNumber: i,
        days: [],
      });
    }
  }

  onCellDurationChange() {
    // Convert to number if it becomes a string from select dropdown
    this.config.cellDuration = Number(this.config.cellDuration) as 30 | 60;
    // Create new config object to trigger change detection
    // Slots will be recalculated automatically using mathematical positioning
    this.config = { ...this.config };
    this.notifyPatternChange();
  }

  onWorkingHoursChange() {
    // Only validate if both times are complete (HH:MM format)
    const startValid = /^\d{2}:\d{2}$/.test(this.config.workingHours.start);
    const endValid = /^\d{2}:\d{2}$/.test(this.config.workingHours.end);

    if (startValid && endValid) {
      // Validate and trigger grid regeneration only when both times are complete
      if (this.config.workingHours.start >= this.config.workingHours.end) {
        alert('L\'ora di inizio deve essere precedente all\'ora di fine');
        // Revert to previous valid value or default
        this.config.workingHours.end = '20:00';
        return;
      }

      // Create new config object to trigger change detection
      // Slots will be recalculated automatically using mathematical positioning
      this.config = {
        ...this.config,
        workingHours: { ...this.config.workingHours }
      };
      this.notifyPatternChange();
    }
  }

  onPatternWeeksChange() {
    const oldWeeks = this.weeks.length;
    const newWeeks = this.config.patternWeeks;

    if (newWeeks > oldWeeks) {
      // Add new weeks
      for (let i = oldWeeks + 1; i <= newWeeks; i++) {
        this.weeks.push({
          weekNumber: i,
          days: [],
        });
        this.expandedWeeks.add(i);
      }
    } else if (newWeeks < oldWeeks) {
      // Remove weeks
      this.weeks = this.weeks.slice(0, newWeeks);
      // Remove expansion state for removed weeks
      for (let i = newWeeks + 1; i <= oldWeeks; i++) {
        this.expandedWeeks.delete(i);
      }
    }

    // Create new config object to trigger change detection
    this.config = { ...this.config };
    this.notifyPatternChange();
  }

  toggleWeekExpansion(weekNumber: number) {
    if (this.expandedWeeks.has(weekNumber)) {
      this.expandedWeeks.delete(weekNumber);
    } else {
      this.expandedWeeks.add(weekNumber);
    }
  }

  isWeekExpanded(weekNumber: number): boolean {
    return this.expandedWeeks.has(weekNumber);
  }

  onWeekScheduleChange(weekNumber: number, schedule: DaySchedule[]) {
    const week = this.weeks.find(w => w.weekNumber === weekNumber);
    if (week) {
      week.days = schedule;
      this.notifyPatternChange();
    }
  }

  notifyPatternChange() {
    const pattern: TemplatePattern = {
      id: this.pattern?.id,
      name: this.templateName,
      operatorId: this.pattern?.operatorId,
      patternWeeks: this.config.patternWeeks,
      weeks: this.weeks,
      validFrom: this.validFrom,
      validUntil: this.validUntil || undefined,
    };
    this.patternChange.emit(pattern);
  }

  onSave() {
    if (!this.templateName.trim()) {
      alert('Inserisci un nome per il template');
      return;
    }

    if (!this.validFrom) {
      alert('Inserisci una data di inizio validità');
      return;
    }

    // Check if at least one slot is defined
    const hasSlots = this.weeks.some(week =>
      week.days.some(day => day.slots.length > 0)
    );

    if (!hasSlots) {
      alert('Aggiungi almeno una fascia oraria prima di salvare');
      return;
    }

    const pattern: TemplatePattern = {
      id: this.pattern?.id,
      name: this.templateName,
      operatorId: this.pattern?.operatorId,
      patternWeeks: this.config.patternWeeks,
      weeks: this.weeks,
      validFrom: this.validFrom,
      validUntil: this.validUntil || undefined,
    };

    this.save.emit(pattern);
  }

  onCancel() {
    this.cancel.emit();
  }

  getWeekSlotCount(weekNumber: number): number {
    const week = this.weeks.find(w => w.weekNumber === weekNumber);
    if (!week) return 0;

    return week.days.reduce((count, day) => count + day.slots.length, 0);
  }

  copyWeek(sourceWeekNumber: number) {
    const sourceWeek = this.weeks.find(w => w.weekNumber === sourceWeekNumber);
    if (!sourceWeek) return;

    const targetWeekNumbers = Array.from({ length: this.config.patternWeeks }, (_, i) => i + 1)
      .filter(num => num !== sourceWeekNumber);

    if (targetWeekNumbers.length === 0) return;

    const targetWeek = prompt(
      `Copia Settimana ${sourceWeekNumber} in quale settimana? (${targetWeekNumbers.join(', ')})`
    );

    if (!targetWeek) return;

    const targetWeekNum = parseInt(targetWeek);
    if (isNaN(targetWeekNum) || !targetWeekNumbers.includes(targetWeekNum)) {
      alert('Numero settimana non valido');
      return;
    }

    const target = this.weeks.find(w => w.weekNumber === targetWeekNum);
    if (target) {
      target.days = JSON.parse(JSON.stringify(sourceWeek.days)); // Deep copy
      this.notifyPatternChange();
    }
  }

  clearWeek(weekNumber: number) {
    if (!confirm(`Vuoi cancellare tutte le fasce orarie della Settimana ${weekNumber}?`)) {
      return;
    }

    const week = this.weeks.find(w => w.weekNumber === weekNumber);
    if (week) {
      week.days = [];
      this.notifyPatternChange();
    }
  }

  trackByWeekNumber(index: number, week: WeekSchedule): number {
    return week.weekNumber;
  }
}
