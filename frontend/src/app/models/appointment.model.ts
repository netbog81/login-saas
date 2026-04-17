import { User } from './user.model';
import { Patient } from './patient.model';
import { Operator } from '../graphql/generated/types';

// ==================== ENUMS ====================

export type BookingStatus =
  | 'scheduled'        // Prenotato
  | 'confirmed'        // Confermato (reminder inviato)
  | 'cancelled'        // Cancellato (legacy)
  | 'cancelled_early'  // Disdetto con >24h preavviso
  | 'cancelled_late'   // Disdetto con <24h preavviso (penalità)
  | 'no_show'          // Non presentato
  | 'attended';        // Paziente presentato → può iniziare trattamento
export type TreatmentStatus = 'waiting' | 'in_progress' | 'operator_completed' | 'closed';
export type ConflictReason = 'template_change' | 'operator_sick' | 'operator_vacation' | 'operator_unavailable';

// ==================== INTERFACES ====================

export type RecurringType = 'daily' | 'weekly' | 'monthly';
export type RecurringEndType = 'never' | 'after' | 'until';

export interface RepeatConfig {
  enabled?: boolean;  // Solo per UI, non salvato
  type: RecurringType;
  interval: number;
  selectedDays?: number[];  // 0=Dom, 1=Lun, ..., 6=Sab
  endType: RecurringEndType;
  occurrences?: number;
  untilDate?: string;
}

/**
 * Strumento associato a un appuntamento
 */
export interface AppointmentInstrument {
  id?: string;
  instrumentId: string;
  instrumentCategoryId?: string;
  instrumentName?: string;
  categoryName?: string;
  startOffsetMinutes: number;  // 0, 15, 30, etc.
  endOffsetMinutes: number;    // 30, 45, 60, etc.
  orderPosition?: number;      // 1, 2 per ordine strumenti
}

/**
 * Input per creare/aggiornare uno strumento nell'appuntamento
 */
export interface AppointmentInstrumentInput {
  instrumentCategoryId: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  orderPosition?: number;
}

/**
 * Servizio associato a un appuntamento (tabella di collegamento)
 */
export interface AppointmentServiceItem {
  id?: string;
  serviceId: string;
  service?: {
    id: string;
    name: string;
    defaultPrice?: number;
    discountFE?: number;
    duration?: number;
  };
  customDuration?: number;
  customPrice?: number;
  orderPosition?: number;
}

/**
 * Input per creare/aggiornare un servizio nell'appuntamento
 */
export interface ServiceInputItem {
  serviceId: string;
  customDuration?: number;
  customPrice?: number;
  orderPosition?: number;
}

/**
 * Appuntamento unificato - usato in tutto il frontend
 * Compatibile sia con il sistema legacy che con AvailabilityAppointment
 */
export interface Appointment {
  id: string | number;  // string (UUID) per nuovo sistema, number per legacy
  title: string;        // Mappato da clientName
  date: string;         // YYYY-MM-DD
  startTime: string;
  endTime: string;
  operatorId: string;
  operator?: Operator;
  /** @deprecated Usa appointmentServices invece */
  serviceId?: string;   // ID del servizio associato (legacy)
  /** @deprecated Usa appointmentServices invece */
  service?: { id: string; name: string };  // Oggetto servizio per visualizzazione (legacy)
  /** Servizi associati all'appuntamento (nuovo sistema ManyToMany) */
  appointmentServices?: AppointmentServiceItem[];
  patientId?: string;
  patient?: Patient;
  notes?: string;

  // Campi dal nuovo sistema AvailabilityAppointment
  bookingStatus?: BookingStatus;
  treatmentStatus?: TreatmentStatus;
  hasConflict?: boolean;
  conflictReason?: ConflictReason;

  // Strumenti
  instruments?: AppointmentInstrument[];
  instrumentOrderMatters?: boolean;

  // Non retribuito (pausa pranzo, rappresentante, etc.)
  nonRetribuito?: boolean;

  // Ricorrenza
  repeat?: RepeatConfig;
  recurringGroupId?: string;
  isRecurring?: boolean;
  isMaster?: boolean;
  masterAppointmentId?: string;
  repeatConfig?: RepeatConfig;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}
