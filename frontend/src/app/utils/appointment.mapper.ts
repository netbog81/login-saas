import { AvailabilityAppointment, AppointmentInstrument as GqlAppointmentInstrument } from '../graphql/generated/types';
import { Appointment, AppointmentInstrument, BookingStatus, TreatmentStatus, ConflictReason } from '../models/appointment.model';

/**
 * Converte un AvailabilityAppointment (GraphQL) in Appointment (frontend model)
 */
export function mapAvailabilityAppointmentToAppointment(aa: AvailabilityAppointment): Appointment {
  return {
    id: aa.id,
    title: aa.clientName,
    date: formatDate(aa.appointmentDate),
    startTime: formatTime(aa.startTime),
    endTime: formatTime(aa.endTime),
    operatorId: aa.operatorId || '',
    operator: aa.operator || undefined,
    patientId: aa.patientId || undefined,
    notes: aa.notes || undefined,

    // Status
    bookingStatus: aa.bookingStatus?.toLowerCase() as BookingStatus,
    treatmentStatus: aa.treatmentStatus?.toLowerCase() as TreatmentStatus | undefined,
    hasConflict: aa.hasConflict || false,
    conflictReason: aa.conflictReason?.toLowerCase() as ConflictReason | undefined,

    // Strumenti
    instruments: mapInstruments(aa.instruments),
    instrumentOrderMatters: aa.instrumentOrderMatters || false,

    // Timestamps
    createdAt: aa.createdAt ? new Date(aa.createdAt) : undefined,
    updatedAt: aa.updatedAt ? new Date(aa.updatedAt) : undefined,
  };
}

/**
 * Converte una lista di AvailabilityAppointment in Appointment[]
 */
export function mapAvailabilityAppointmentsToAppointments(
  appointments: AvailabilityAppointment[]
): Appointment[] {
  return appointments.map(mapAvailabilityAppointmentToAppointment);
}

/**
 * Mappa gli strumenti da GraphQL al formato frontend
 */
function mapInstruments(
  instruments?: GqlAppointmentInstrument[] | null
): AppointmentInstrument[] | undefined {
  if (!instruments || instruments.length === 0) {
    return undefined;
  }

  return instruments.map(inst => ({
    id: inst.id,
    instrumentId: inst.instrumentId,
    instrumentCategoryId: inst.instrument?.category?.id,
    instrumentName: inst.instrument?.name,
    categoryName: inst.instrument?.category?.name,
    startOffsetMinutes: inst.startOffsetMinutes,
    endOffsetMinutes: inst.endOffsetMinutes,
    orderPosition: inst.orderPosition || undefined,
  }));
}

/**
 * Formatta una data in stringa YYYY-MM-DD
 */
function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    // Se è già una stringa, estraiamo solo la parte data
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    return date;
  }
  return date.toISOString().split('T')[0];
}

/**
 * Formatta un orario rimuovendo i secondi se presenti (HH:MM:SS -> HH:MM)
 */
function formatTime(time: string): string {
  if (time && time.length > 5) {
    return time.substring(0, 5);
  }
  return time;
}

/**
 * Crea un input per AvailabilityAppointment da un Appointment frontend
 */
export function mapAppointmentToCreateInput(appointment: Appointment): {
  operatorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  clientName: string;
  patientId?: number;
  notes?: string;
} {
  return {
    operatorId: appointment.operatorId,
    appointmentDate: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    clientName: appointment.title,
    patientId: appointment.patientId,
    notes: appointment.notes,
  };
}
