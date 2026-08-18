// Enums
export enum OperatorMacroCategory {
  Doctor = 'DOCTOR',
  Physiotherapist = 'PHYSIOTHERAPIST',
  GymInstructor = 'GYM_INSTRUCTOR',
  Other = 'OTHER',
}

export enum ExceptionType {
  Unavailable = 'UNAVAILABLE',
  Extra = 'EXTRA',
  Modified = 'MODIFIED',
  Holiday = 'HOLIDAY',
  Sick = 'SICK',
  Vacation = 'VACATION',
  PersonalLeave = 'PERSONAL_LEAVE',
}

// Entity Types
export interface OperatorCategory {
  id: string;
  macroCategory: OperatorMacroCategory;
  name: string;
  description?: string;
  isActive: boolean;
  operators?: Operator[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Operator {
  id: string;
  name: string;
  surname?: string;
  email?: string;
  phone?: string;
  color?: string;
  macroCategory: OperatorMacroCategory;
  categoryId?: string;
  category?: OperatorCategory;
  preferredDurations?: number[];
  userId?: string;
  legacyUserId?: string;
  maxConcurrentAppointments: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  availabilityTemplates?: AvailabilityTemplate[];
  availabilityExceptions?: AvailabilityException[];
  operatorServices?: OperatorService[];
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  defaultDuration: number; // in minutes
  defaultPrice: number;
  bufferTimeBefore: number; // in minutes
  bufferTimeAfter: number; // in minutes
  color?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  operatorServices?: OperatorService[];
}

export interface OperatorService {
  operatorId: string;
  serviceId: string;
  operator?: Operator;
  service?: Service;
  customDuration?: number;
  customBufferTime?: number;
}

export interface AvailabilityTemplate {
  id: string;
  operatorId: string;
  operator?: Operator;
  name?: string;
  description?: string;
  dayInPattern: number;
  patternDuration: number;
  patternStartDate: Date;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  version: number;
  isCurrent: boolean;
  validFrom: Date;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AvailabilityException {
  id: string;
  operatorId: string;
  operator?: Operator;
  exceptionDate: Date;
  exceptionType: ExceptionType;
  startTime?: string; // HH:mm format for modified type
  endTime?: string;   // HH:mm format for modified type
  groupExceptionId?: string;
  groupException?: GroupException;
  reason?: string;
  createdAt: Date;
}

export interface GroupException {
  id: string;
  name: string;
  exceptionDate: Date;
  exceptionType: string;
  appliesToAll: boolean;
  reason?: string;
  exceptions?: AvailabilityException[];
  operators?: Operator[];
  createdAt: Date;
}

export interface AvailabilityCache {
  id: string;
  operatorId: string;
  operator?: Operator;
  availableDate: Date;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  totalCapacity: number;
  bookedCapacity: number;
  source?: string;
  sourceId?: string;
  lastUpdated: Date;
}

export interface AvailabilityAppointment {
  id: string;
  operatorId: string;
  operator?: Operator;
  serviceId?: string;
  service?: Service;
  appointmentDate: Date;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  status: string;
  participantCount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// DTOs
export interface AvailabilitySlot {
  operatorId: string;
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  totalCapacity: number;
  bookedCapacity: number;
  availableCapacity: number;
  isAvailable: boolean;
  source: string;
  sourceId?: string;
}

export interface DailyAvailability {
  date: string; // YYYY-MM-DD format
  hasAvailability: boolean;
  slots: AvailabilitySlot[];
}

// Input Types
export interface CreateOperatorInput {
  name: string;
  surname?: string;
  email?: string;
  phone?: string;
  color?: string;
  macroCategory: OperatorMacroCategory;
  categoryId?: string;
  preferredDurations?: number[];
  maxConcurrentAppointments?: number;
  userId?: string;
  legacyUserId?: string;
  isActive?: boolean;
}

export interface UpdateOperatorInput {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  color?: string;
  macroCategory?: OperatorMacroCategory;
  categoryId?: string;
  preferredDurations?: number[];
  maxConcurrentAppointments?: number;
  isActive?: boolean;
  userId?: string;
}

export interface CreateOperatorCategoryInput {
  macroCategory: OperatorMacroCategory;
  name: string;
  description?: string;
  /** Descrizione che sarà inserita nelle righe fattura. */
  invoiceLineDescription?: string;
}

export interface UpdateOperatorCategoryInput {
  name?: string;
  description?: string;
  /** Descrizione che sarà inserita nelle righe fattura. */
  invoiceLineDescription?: string;
  macroCategory?: OperatorMacroCategory;
  isActive?: boolean;
}

export interface CreateServiceInput {
  name: string;
  description?: string;
  defaultDuration: number;
  defaultPrice?: number;
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
  color?: string;
  isActive?: boolean;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string;
  defaultDuration?: number;
  defaultPrice?: number;
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
  color?: string;
  isActive?: boolean;
}

export interface AssignServiceToOperatorInput {
  operatorId: string;
  serviceId: string;
  customDuration?: number;
}

export interface UpdateOperatorServiceInput {
  operatorId: string;
  serviceId: string;
  customDuration?: number;
}

export interface CreateAvailabilityTemplateInput {
  operatorId: string;
  name?: string;
  description?: string;
  dayInPattern: number;
  patternDuration: number;
  patternStartDate: string; // YYYY-MM-DD format
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  validFrom: string; // YYYY-MM-DD format
  validUntil?: string; // YYYY-MM-DD format
}

export interface UpdateAvailabilityTemplateInput extends CreateAvailabilityTemplateInput {
}

export interface CreateAvailabilityExceptionInput {
  operatorId: string;
  date: string; // YYYY-MM-DD format
  type: string;
  startTime?: string; // HH:mm format
  endTime?: string;   // HH:mm format
  reason?: string;
}

export interface CreateGroupExceptionInput {
  name: string;
  exceptionDate: string; // YYYY-MM-DD format
  exceptionType: string;
  appliesToAll?: boolean;
  operatorIds?: string[];
  reason?: string;
}

export interface AssignServiceToOperatorInput {
  operatorId: string;
  serviceId: string;
  customDuration?: number;
  customBufferTime?: number;
}

export interface UpdateOperatorServiceInput {
  operatorId: string;
  serviceId: string;
  customDuration?: number;
  customBufferTime?: number;
}

// New pattern/assignment input types
export interface CreateTemplatePatternInput {
  name: string;
  description?: string;
  dayInPattern: number;
  patternDuration: number;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
}

export interface AssignmentRoomOverrideInput {
  dayInPattern: number;
  startTime?: string; // HH:MM, null = tutto il giorno
  endTime?: string;
  roomId: string;
  chairId?: string;
}

export interface AssignTemplateToOperatorInput {
  operatorId: string;
  patternGroupId: string;
  patternStartDate: string; // YYYY-MM-DD format
  validFrom: string; // YYYY-MM-DD format
  validUntil?: string; // YYYY-MM-DD format
  /** Chiude automaticamente al giorno prima le assegnazioni già in corso che si sovrappongono */
  truncatePrevious?: boolean;
  /** Studio di default per tutte le fasce dell'assegnazione */
  roomId?: string;
  /** Poltrona di default (deve appartenere allo studio) */
  chairId?: string;
  /** Override studio/poltrona per giorno/fascia */
  overrides?: AssignmentRoomOverrideInput[];
}

export interface AssignmentRoomOverride {
  id: string;
  assignmentId: string;
  dayInPattern: number;
  startTime?: string;
  endTime?: string;
  roomId: string;
  chairId?: string;
  room?: { id: string; name: string };
  chair?: { id: string; name: string };
}

export interface RoomConflictCheckResult {
  blocking: string[];
  warnings: string[];
}

// Disponibilità studi/poltrone rispetto a un template candidato
export interface RoomBandBusyInfo {
  dayInPattern: number;
  startTime: string;
  endTime: string;
  freeSeats: number;
  occupantNames: string[];
  busyChairIds: string[];
}

export interface ChairAvailabilityInfo {
  chairId: string;
  name: string;
  fullyFree: boolean;
  firstConflict?: string;
}

export interface RoomAvailabilityInfo {
  roomId: string;
  roomName: string;
  capacity: number;
  fullyFree: boolean;
  sharing: boolean;
  full: boolean;
  unavailableReason?: string;
  busy: RoomBandBusyInfo[];
  chairs: ChairAvailabilityInfo[];
}

// New entity types for separated pattern/assignment structure

/**
 * TemplatePattern - Individual day pattern within a PatternGroup
 */
export interface BackendTemplatePattern {
  id: string;
  name: string;
  description?: string;
  dayInPattern: number;
  patternDuration: number;
  startTime: string;
  endTime: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PatternGroup - Collection of patterns forming a repeating schedule
 */
export interface PatternGroup {
  id: string;
  name: string;
  description?: string;
  patternDuration: number; // e.g., 7 for weekly, 14 for biweekly
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  patterns: BackendTemplatePattern[];
}

/**
 * TemplateAssignment - Assignment of a PatternGroup to an Operator
 */
export interface TemplateAssignment {
  id: string;
  operatorId: string;
  patternGroupId: string;
  patternStartDate: Date;
  validFrom: Date;
  validUntil?: Date;
  version: number;
  isCurrent: boolean;
  roomId?: string;
  chairId?: string;
  createdAt: Date;
  updatedAt: Date;
  operator?: Operator;
  patternGroup?: PatternGroup;
  room?: { id: string; name: string };
  chair?: { id: string; name: string };
  roomOverrides?: AssignmentRoomOverride[];
}

/**
 * @deprecated Use TemplateAssignment instead
 */
export interface BackendTemplateAssignment extends TemplateAssignment {}

// UI-specific types for Template Builder

export interface TimeSlot {
  startTime: string; // "09:00"
  endTime: string;   // "12:30"
}

export interface DaySchedule {
  dayOfWeek: number; // 0=Lun, 1=Mar, ..., 6=Dom
  slots: TimeSlot[];
}

export interface WeekSchedule {
  weekNumber: number; // 1-4
  days: DaySchedule[];
}

export interface TemplatePattern {
  id?: string;
  name: string;
  operatorId?: string;
  patternWeeks: number; // 1-4
  weeks: WeekSchedule[];
  validFrom?: string;
  validUntil?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GridConfig {
  cellDuration: 5 | 10 | 15 | 20 | 30 | 45 | 60; // minuti
  workingHours: {
    start: string; // "07:00"
    end: string;   // "20:00"
  };
  patternWeeks: number; // 1-4
}

export interface OperatorTemplateAssignment {
  id: string;
  operator: Operator;
  template: AvailabilityTemplate;
  templateName: string;
  validFrom: Date;
  validUntil?: Date;
  status: 'active' | 'expiring' | 'expired' | 'none';
  daysUntilExpiration?: number;
}

// Colori fissi per i giorni della settimana
export const DAY_COLORS = {
  0: '#4A90E2', // Lunedì - blu
  1: '#50C878', // Martedì - verde
  2: '#F5A623', // Mercoledì - arancione
  3: '#BD10E0', // Giovedì - viola
  4: '#E94B3C', // Venerdì - rosso
  5: '#7ED321', // Sabato - lime
  6: '#9013FE', // Domenica - magenta
};

export const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

// Utility function to get readable macro category name
export function getMacroCategoryLabel(macroCategory: OperatorMacroCategory | string): string {
  switch (macroCategory) {
    case OperatorMacroCategory.Doctor:
    case 'DOCTOR':
      return 'Medico';
    case OperatorMacroCategory.Physiotherapist:
    case 'PHYSIOTHERAPIST':
      return 'Fisioterapista';
    case OperatorMacroCategory.GymInstructor:
    case 'GYM_INSTRUCTOR':
      return 'Istruttore Palestra';
    case OperatorMacroCategory.Other:
    case 'OTHER':
      return 'Altro';
    default:
      return String(macroCategory);
  }
}
