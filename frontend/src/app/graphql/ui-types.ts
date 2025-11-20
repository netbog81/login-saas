// UI-specific types for Template Builder and Grid components

import { Operator as GeneratedOperator, OperatorType } from './generated/types';

// Extended Operator type with 'type' alias for backward compatibility
export interface Operator extends GeneratedOperator {
  type: OperatorType; // Alias for operatorType
}

// Re-export OperatorType for convenience
export { OperatorType } from './generated/types';

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

export interface GridConfig {
  cellDuration: 30 | 60; // minuti
  workingHours: {
    start: string; // "07:00"
    end: string;   // "20:00"
  };
  patternWeeks: number; // 1-4
}

// UI Template Pattern (used in template builder)
// This is different from the backend TemplatePattern in generated/types.ts
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
