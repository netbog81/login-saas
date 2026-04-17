/**
 * Calendar V2 State Service
 * Layer 3: Business Logic
 *
 * Gestisce lo stato del calendario V2 tramite BehaviorSubject.
 * Non chiama mai API direttamente - il DataService lo fa.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import {
  CalendarV2Config,
  CalendarOperator,
  DEFAULT_CALENDAR_V2_CONFIG,
  TimeSlot,
} from '../models/calendar-v2.model';

@Injectable({ providedIn: 'root' })
export class CalendarV2StateService {

  // ==================== STATE ====================

  private configSubject = new BehaviorSubject<CalendarV2Config>(DEFAULT_CALENDAR_V2_CONFIG);
  private currentDateSubject = new BehaviorSubject<Date>(new Date());
  private operatorsSubject = new BehaviorSubject<CalendarOperator[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  // ==================== OBSERVABLES ====================

  readonly config$ = this.configSubject.asObservable();
  readonly currentDate$ = this.currentDateSubject.asObservable();
  readonly operators$ = this.operatorsSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  readonly selectedOperators$ = this.operatorsSubject.pipe(
    map(ops => ops.filter(o => o.selected)),
    distinctUntilChanged((a, b) => a.length === b.length && a.every((v, i) => v.operatorId === b[i].operatorId)),
  );

  readonly visibleDates$: Observable<string[]> = combineLatest([
    this.config$,
    this.currentDate$,
  ]).pipe(
    map(([config, date]) => this.computeVisibleDates(config, date)),
    distinctUntilChanged((a, b) => a.join(',') === b.join(',')),
  );

  readonly timeSlots$: Observable<TimeSlot[]> = this.config$.pipe(
    map(config => this.computeTimeSlots(config)),
    distinctUntilChanged((a, b) => a.length === b.length),
  );

  // ==================== GETTERS ====================

  get config(): CalendarV2Config { return this.configSubject.value; }
  get currentDate(): Date { return this.currentDateSubject.value; }
  get operators(): CalendarOperator[] { return this.operatorsSubject.value; }
  get selectedOperators(): CalendarOperator[] { return this.operators.filter(o => o.selected); }
  get selectedOperatorIds(): string[] { return this.selectedOperators.map(o => o.operatorId); }

  // ==================== MUTATIONS ====================

  updateConfig(partial: Partial<CalendarV2Config>): void {
    this.configSubject.next({ ...this.configSubject.value, ...partial });
  }

  setCurrentDate(date: Date): void {
    this.currentDateSubject.next(date);
  }

  navigateToday(): void {
    this.setCurrentDate(new Date());
  }

  navigatePrev(): void {
    const date = new Date(this.currentDate);
    const step = this.config.viewType === 'weekly' ? 7 : 1;
    date.setDate(date.getDate() - step);
    this.setCurrentDate(date);
  }

  navigateNext(): void {
    const date = new Date(this.currentDate);
    const step = this.config.viewType === 'weekly' ? 7 : 1;
    date.setDate(date.getDate() + step);
    this.setCurrentDate(date);
  }

  setOperators(operators: CalendarOperator[]): void {
    this.operatorsSubject.next(operators);
  }

  toggleOperator(operatorId: string): void {
    const operators = this.operators.map(o =>
      o.operatorId === operatorId ? { ...o, selected: !o.selected } : o
    );
    this.operatorsSubject.next(operators);
  }

  selectAllOperators(): void {
    this.operatorsSubject.next(this.operators.map(o => ({ ...o, selected: true })));
  }

  deselectAllOperators(): void {
    this.operatorsSubject.next(this.operators.map(o => ({ ...o, selected: false })));
  }

  setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  // ==================== COMPUTATIONS ====================

  private computeVisibleDates(config: CalendarV2Config, date: Date): string[] {
    if (config.viewType === 'daily') {
      return [this.formatDate(date)];
    }

    // Weekly: calcola lunedì della settimana
    const monday = new Date(date);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);

    const days = config.showWeekend ? 7 : 5;
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      dates.push(this.formatDate(d));
    }
    return dates;
  }

  private computeTimeSlots(config: CalendarV2Config): TimeSlot[] {
    const startHour = config.showWorkingHoursOnly ? config.workingHoursStart : config.startHour;
    const endHour = config.showWorkingHoursOnly ? config.workingHoursEnd : config.endHour;
    const slots: TimeSlot[] = [];
    let index = 0;

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += config.slotDuration) {
        if (h * 60 + m >= endHour * 60) break;
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        slots.push({ time, index: index++ });
      }
    }
    return slots;
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
