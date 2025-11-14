import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { Appointment } from '../../../models/appointment.model';
import { User } from '../../../models/user.model';
import { Availability } from '../../../models/availability.model';

export interface TimeSlot {
  time: string; // HH:MM
  date: string; // YYYY-MM-DD
  index: number;
}

export interface CalendarConfig {
  slotDuration: number; // minuti (5, 10, 15, 20, 30)
  startHour: number; // 0-23
  endHour: number; // 0-23
  zoom: number; // 1-3
  viewType: 'daily' | 'weekly';
  showWorkingHoursOnly: boolean;
  workingHoursStart: number; // 0-23
  workingHoursEnd: number; // 0-23
  showWeekend: boolean;
}

export interface CalendarView {
  currentDate: Date;
  selectedOperators: User[];
  visibleDates: string[]; // YYYY-MM-DD
  timeSlots: TimeSlot[];
}

export interface DragOperation {
  type: 'create' | 'move' | 'resize' | null;
  appointmentId?: number;
  startSlot?: TimeSlot;
  endSlot?: TimeSlot;
  userId?: number;
  previewPosition?: { top: number; height: number };
}

@Injectable({
  providedIn: 'root'
})
export class CalendarStateService {
  // State streams
  private configSubject = new BehaviorSubject<CalendarConfig>({
    slotDuration: 15,
    startHour: 0,
    endHour: 24,
    zoom: 1,
    viewType: 'daily',
    showWorkingHoursOnly: false,
    workingHoursStart: 8,
    workingHoursEnd: 20,
    showWeekend: true
  });

  private currentDateSubject = new BehaviorSubject<Date>(new Date());
  private selectedOperatorsSubject = new BehaviorSubject<User[]>([]);
  private appointmentsSubject = new BehaviorSubject<Map<number, Map<string, Appointment[]>>>(new Map());
  private availabilitiesSubject = new BehaviorSubject<Map<number, Map<string, Availability[]>>>(new Map());
  private dragOperationSubject = new BehaviorSubject<DragOperation>({ type: null });
  private sidebarCollapsedSubject = new BehaviorSubject<boolean>(false);

  // Public observables
  config$: Observable<CalendarConfig> = this.configSubject.asObservable();
  currentDate$: Observable<Date> = this.currentDateSubject.asObservable();
  selectedOperators$: Observable<User[]> = this.selectedOperatorsSubject.asObservable();
  appointments$: Observable<Map<number, Map<string, Appointment[]>>> = this.appointmentsSubject.asObservable();
  availabilities$: Observable<Map<number, Map<string, Availability[]>>> = this.availabilitiesSubject.asObservable();
  dragOperation$: Observable<DragOperation> = this.dragOperationSubject.asObservable();
  sidebarCollapsed$: Observable<boolean> = this.sidebarCollapsedSubject.asObservable();

  // Computed observables
  view$: Observable<CalendarView> = combineLatest([
    this.config$,
    this.currentDate$,
    this.selectedOperators$
  ]).pipe(
    map(([config, currentDate, selectedOperators]) => {
      return {
        currentDate,
        selectedOperators,
        visibleDates: this.calculateVisibleDates(currentDate, config.viewType, config.showWeekend),
        timeSlots: this.generateTimeSlots(config)
      };
    })
  );

  constructor() {}

  // Config methods
  updateConfig(config: Partial<CalendarConfig>): void {
    this.configSubject.next({ ...this.configSubject.value, ...config });
  }

  getConfig(): CalendarConfig {
    return this.configSubject.value;
  }

  // Date navigation
  setCurrentDate(date: Date): void {
    this.currentDateSubject.next(date);
  }

  navigateToToday(): void {
    this.currentDateSubject.next(new Date());
  }

  navigateNext(): void {
    const config = this.configSubject.value;
    const currentDate = this.currentDateSubject.value;
    const newDate = new Date(currentDate);

    if (config.viewType === 'daily') {
      newDate.setDate(newDate.getDate() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }

    this.currentDateSubject.next(newDate);
  }

  navigatePrevious(): void {
    const config = this.configSubject.value;
    const currentDate = this.currentDateSubject.value;
    const newDate = new Date(currentDate);

    if (config.viewType === 'daily') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }

    this.currentDateSubject.next(newDate);
  }

  // Operator selection
  setSelectedOperators(operators: User[]): void {
    this.selectedOperatorsSubject.next(operators);
  }

  toggleOperator(operator: User): void {
    const current = this.selectedOperatorsSubject.value;
    const index = current.findIndex(u => u.id === operator.id);

    if (index >= 0) {
      this.selectedOperatorsSubject.next(current.filter(u => u.id !== operator.id));
    } else {
      this.selectedOperatorsSubject.next([...current, operator]);
    }
  }

  // Appointments
  setAppointments(appointments: Map<number, Map<string, Appointment[]>>): void {
    this.appointmentsSubject.next(appointments);
  }

  addAppointment(appointment: Appointment): void {
    const current = new Map(this.appointmentsSubject.value);

    if (!current.has(appointment.userId)) {
      current.set(appointment.userId, new Map());
    }

    const userAppointments = current.get(appointment.userId)!;
    if (!userAppointments.has(appointment.date)) {
      userAppointments.set(appointment.date, []);
    }

    userAppointments.get(appointment.date)!.push(appointment);
    this.appointmentsSubject.next(current);
  }

  updateAppointment(appointment: Appointment): void {
    const current = new Map(this.appointmentsSubject.value);

    // Remove old appointment
    for (const [userId, dateMap] of current.entries()) {
      for (const [date, appointments] of dateMap.entries()) {
        const index = appointments.findIndex(a => a.id === appointment.id);
        if (index >= 0) {
          appointments.splice(index, 1);
          break;
        }
      }
    }

    // Add updated appointment
    if (!current.has(appointment.userId)) {
      current.set(appointment.userId, new Map());
    }

    const userAppointments = current.get(appointment.userId)!;
    if (!userAppointments.has(appointment.date)) {
      userAppointments.set(appointment.date, []);
    }

    userAppointments.get(appointment.date)!.push(appointment);
    this.appointmentsSubject.next(current);
  }

  removeAppointment(appointmentId: number): void {
    const current = new Map(this.appointmentsSubject.value);

    for (const [userId, dateMap] of current.entries()) {
      for (const [date, appointments] of dateMap.entries()) {
        const index = appointments.findIndex(a => a.id === appointmentId);
        if (index >= 0) {
          appointments.splice(index, 1);
          this.appointmentsSubject.next(current);
          return;
        }
      }
    }
  }

  getAppointmentForSlot(userId: number, date: string, timeSlot: string): Appointment | null {
    const userAppointments = this.appointmentsSubject.value.get(userId);
    if (!userAppointments) return null;

    const dateAppointments = userAppointments.get(date);
    if (!dateAppointments) return null;

    const slotMinutes = this.timeToMinutes(timeSlot);

    return dateAppointments.find(apt => {
      const startMinutes = this.timeToMinutes(apt.startTime);
      const endMinutes = this.timeToMinutes(apt.endTime);
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    }) || null;
  }

  // Availabilities
  setAvailabilities(availabilities: Map<number, Map<string, Availability[]>>): void {
    this.availabilitiesSubject.next(availabilities);
  }

  // Drag operations
  startDrag(operation: DragOperation): void {
    this.dragOperationSubject.next(operation);
  }

  updateDrag(updates: Partial<DragOperation>): void {
    this.dragOperationSubject.next({
      ...this.dragOperationSubject.value,
      ...updates
    });
  }

  endDrag(): void {
    this.dragOperationSubject.next({ type: null });
  }

  getDragOperation(): DragOperation {
    return this.dragOperationSubject.value;
  }

  // Sidebar
  toggleSidebar(): void {
    this.sidebarCollapsedSubject.next(!this.sidebarCollapsedSubject.value);
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsedSubject.next(collapsed);
  }

  // Utility methods
  private calculateVisibleDates(currentDate: Date, viewType: 'daily' | 'weekly', showWeekend: boolean): string[] {
    const dates: string[] = [];

    if (viewType === 'daily') {
      dates.push(this.formatDate(currentDate));
    } else {
      // Weekly view - get week starting from Monday
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
      startOfWeek.setDate(startOfWeek.getDate() + diff);

      const daysToShow = showWeekend ? 7 : 5;

      for (let i = 0; i < daysToShow; i++) {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        dates.push(this.formatDate(date));
      }
    }

    return dates;
  }

  private generateTimeSlots(config: CalendarConfig): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const { slotDuration, startHour, endHour, showWorkingHoursOnly, workingHoursStart, workingHoursEnd } = config;

    const effectiveStartHour = showWorkingHoursOnly ? workingHoursStart : startHour;
    const effectiveEndHour = showWorkingHoursOnly ? workingHoursEnd : endHour;

    const startMinutes = effectiveStartHour * 60;
    const endMinutes = effectiveEndHour * 60;

    let index = 0;
    for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

      slots.push({ time, date: '', index });
      index++;
    }

    return slots;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Helper method to calculate event position and height
  calculateEventDimensions(appointment: Appointment, slotDuration: number, startHour: number): { top: number; height: number } {
    const startMinutes = this.timeToMinutes(appointment.startTime);
    const endMinutes = this.timeToMinutes(appointment.endTime);
    const duration = endMinutes - startMinutes;

    const startOfDayMinutes = startHour * 60;
    const pixelsPerMinute = 60 / slotDuration; // Assuming each slot is 60px height

    const top = (startMinutes - startOfDayMinutes) * pixelsPerMinute;
    const height = duration * pixelsPerMinute;

    return { top, height };
  }
}
