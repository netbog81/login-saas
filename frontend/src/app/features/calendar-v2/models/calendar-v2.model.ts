/**
 * Modelli per Calendario V2
 * Strutture dati ottimizzate per rendering ad alte performance.
 */

import { Appointment } from '../../../models/appointment.model';

// ==================== CONFIG ====================

export type CalendarV2ViewType = 'daily' | 'weekly';
export type CalendarV2ViewMode = 'operators' | 'gyms' | 'rooms';

export interface CalendarV2Config {
  viewType: CalendarV2ViewType;
  viewMode: CalendarV2ViewMode;
  slotDuration: number;        // minuti (5, 10, 15, 20, 30, 45, 60)
  zoom: number;                // 0.5, 1, 1.5, 2
  showWeekend: boolean;
  showWorkingHoursOnly: boolean;
  compactMode: boolean;        // true = colonne adattive, false = colonne fisse con scroll
  startHour: number;           // 0-23
  endHour: number;             // 1-24
  workingHoursStart: number;   // 8
  workingHoursEnd: number;     // 20
}

export const DEFAULT_CALENDAR_V2_CONFIG: CalendarV2Config = {
  viewType: 'daily',
  viewMode: 'operators',
  slotDuration: 45,
  zoom: 1,
  showWeekend: true,
  showWorkingHoursOnly: false,
  compactMode: true,
  startHour: 0,
  endHour: 24,
  workingHoursStart: 8,
  workingHoursEnd: 20,
};

// ==================== TIME SLOTS ====================

export interface TimeSlot {
  time: string;   // HH:MM
  index: number;
}

// ==================== GRID DATA (pre-calcolato) ====================

/**
 * Stato pre-calcolato di una singola cella della griglia.
 * Calcolato una volta in ngOnChanges, mai ricalcolato dal template.
 */
export interface CellState {
  available: boolean;
  occupied: boolean;
  unavailableTopPct: number;
  unavailableBottomPct: number;
  cssClass: string;           // pre-calcolata: 'available', 'occupied', 'unavailable', etc.
}

/**
 * Evento posizionato nella griglia.
 * Top/height in pixel, pre-calcolati per rendering assoluto.
 * Supporta drag & drop via CDK DragDrop.
 */
export interface PositionedEvent {
  appointment: Appointment;
  operatorId: string;
  date: string;
  topPx: number;
  heightPx: number;
  leftPct: number;            // 0-100 per eventi sovrapposti
  widthPct: number;           // 0-100
  color: string;
  title: string;
  timeLabel: string;          // "09:00 - 10:00"
  isRecurring: boolean;
  // Per drag & drop
  originalStartTime: string;
  originalEndTime: string;
}

/**
 * Dati pre-calcolati per una colonna operatore (1 giorno).
 */
export interface OperatorColumnData {
  operatorId: string;
  operatorName: string;
  operatorColor: string;
  date: string;
  cells: CellState[];         // indicizzato per slotIndex
  events: PositionedEvent[];
}

/**
 * Dati completi della griglia, pre-calcolati e pronti per il rendering.
 */
export interface OperatorGridData {
  columns: OperatorColumnData[];
  timeSlots: TimeSlot[];
  slotHeightPx: number;
  dates: string[];            // date visibili (1 per daily, 5-7 per weekly)
}

// ==================== GYM GRID DATA ====================

export interface GymSlotData {
  startTime: string;
  endTime: string;
  currentCount: number;
  maxCapacity: number;
  isAvailable: boolean;
  isClosed: boolean;
  operatorName?: string;
  operatorColor?: string;
  appointments: Appointment[];
}

export interface GymRoomColumnData {
  gymRoomId: string;
  gymRoomName: string;
  gymRoomColor: string;
  date: string;
  slots: GymSlotData[];
}

export interface GymGridData {
  columns: GymRoomColumnData[];
  timeSlots: TimeSlot[];
  slotHeightPx: number;
  dates: string[];
}

// ==================== USER ====================

export interface CalendarOperator {
  id: string;
  operatorId: string;
  name: string;
  color: string;
  active: boolean;
  selected: boolean;
  hasTemplate: boolean;
  macroCategory?: string;
}

// ==================== AVAILABILITY ====================

export interface OperatorAvailability {
  operatorId: string;
  date: string;
  startTime: string;
  endTime: string;
}

// ==================== DRAG & DROP ====================

export interface DragMoveEvent {
  appointmentId: string;
  operatorId: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
}

export interface ResizeEvent {
  appointmentId: string;
  newEndTime: string;
}

// ==================== ACTIONS ====================

export interface CellClickEvent {
  operatorId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface EventClickEvent {
  appointment: Appointment;
  mouseEvent: MouseEvent;
}

// ==================== SEARCH ====================

export interface SearchFilters {
  duration: number;
  withInstrument: boolean;
  instrumentCount: 1 | 2;
  instrumentPosition: 'first' | 'second';
  instrumentOrderMatters: boolean;
  instrumentCategoryId: string | null;
  instrument2CategoryId: string | null;
}

export interface AvailableSlotPosition {
  operatorId: string;
  date: string;
  startTime: string;
  endTime: string;
  topPx: number;
  heightPx: number;
  color: string;
  availableInstruments?: any[];
}
