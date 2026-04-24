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

  private static STORAGE_KEY = 'calendar-v2-state';

  // ==================== STATE ====================

  private configSubject = new BehaviorSubject<CalendarV2Config>(DEFAULT_CALENDAR_V2_CONFIG);
  private currentDateSubject = new BehaviorSubject<Date>(new Date());
  private operatorsSubject = new BehaviorSubject<CalendarOperator[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  constructor() {
    // Ripristina stato da sessionStorage
    const saved = this.loadFromStorage();
    this.configSubject.next(saved.config);
    this.currentDateSubject.next(saved.date);
  }

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
    this.saveToStorage();
  }

  setCurrentDate(date: Date): void {
    this.currentDateSubject.next(date);
    this.saveToStorage();
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

  setOperatorSelection(operatorIds: string[], selected: boolean): void {
    const idSet = new Set(operatorIds);
    const operators = this.operators.map(o =>
      idSet.has(o.operatorId) ? { ...o, selected } : o
    );
    this.operatorsSubject.next(operators);
  }

  deselectAllOperators(): void {
    this.operatorsSubject.next(this.operators.map(o => ({ ...o, selected: false })));
  }

  setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  // ==================== COMPUTATIONS ====================

  computeTimeSlotsPublic(config: CalendarV2Config): TimeSlot[] {
    return this.computeTimeSlots(config);
  }

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

    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60;
    let currentMinutes = startMinutes;
    let index = 0;

    while (currentMinutes < endMinutes) {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;
      slots.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        index: index++,
      });
      currentMinutes += config.slotDuration;
    }
    return slots;
  }

  formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ==================== PERSISTENCE ====================

  private saveToStorage(): void {
    try {
      const state = {
        config: {
          viewType: this.configSubject.value.viewType,
          viewMode: this.configSubject.value.viewMode,
          showWeekend: this.configSubject.value.showWeekend,
          showWorkingHoursOnly: this.configSubject.value.showWorkingHoursOnly,
          compactMode: this.configSubject.value.compactMode,
          zoom: this.configSubject.value.zoom,
          slotDuration: this.configSubject.value.slotDuration,
        },
        date: this.formatDate(this.currentDateSubject.value),
        ts: Date.now(),
      };
      sessionStorage.setItem(CalendarV2StateService.STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  private loadFromStorage(): { config: CalendarV2Config; date: Date } {
    try {
      const raw = sessionStorage.getItem(CalendarV2StateService.STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Scarta se più vecchio di 8 ore
        if (saved.ts && Date.now() - saved.ts < 8 * 60 * 60 * 1000) {
          const config: CalendarV2Config = {
            ...DEFAULT_CALENDAR_V2_CONFIG,
            ...saved.config,
          };
          const date = saved.date ? new Date(saved.date + 'T00:00:00') : new Date();
          return { config, date };
        }
      }
    } catch { /* ignore */ }
    return { config: DEFAULT_CALENDAR_V2_CONFIG, date: new Date() };
  }
}
