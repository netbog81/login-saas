import { AvailabilityAppointment, AppointmentInstrument as GqlAppointmentInstrument } from '../graphql/generated/types';
import { Appointment, AppointmentInstrument, AppointmentServiceItem, BookingStatus, TreatmentStatus, ConflictReason } from '../models/appointment.model';

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
    serviceId: aa.serviceId || undefined,
    service: aa.service ? { id: aa.service.id, name: aa.service.name } : undefined,
    // Servizi multipli (nuovo sistema ManyToMany)
    appointmentServices: mapAppointmentServices(aa.appointmentServices),
    patientId: aa.patientId?.toString() || undefined,
    notes: aa.notes || undefined,

    // Status
    bookingStatus: aa.bookingStatus?.toLowerCase() as BookingStatus,
    treatmentStatus: aa.treatmentStatus?.toLowerCase() as TreatmentStatus | undefined,
    hasConflict: aa.hasConflict || false,
    conflictReason: aa.conflictReason?.toLowerCase() as ConflictReason | undefined,

    // Strumenti
    instruments: mapInstruments(aa.instruments),
    instrumentOrderMatters: aa.instrumentOrderMatters || false,

    // Non retribuito
    nonRetribuito: aa.nonRetribuito || false,

    // Ricorrenza
    isRecurring: aa.isRecurring ?? undefined,
    recurringGroupId: aa.recurringGroupId ?? undefined,
    isMaster: aa.isMaster ?? undefined,
    masterAppointmentId: aa.masterAppointmentId ?? undefined,
    repeatConfig: (aa.repeatConfig ?? undefined) as Appointment['repeatConfig'],

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
 * Mappa i servizi multipli da GraphQL al formato frontend
 */
function mapAppointmentServices(
  appointmentServices?: {
    id: string;
    serviceId: string;
    customDuration?: number | null;
    customPrice?: number | null;
    orderPosition: number;
    service?: {
      id: string;
      name: string;
      defaultPrice?: number | null;
      discountFE?: number | null;
      defaultDuration?: number | null;
    } | null;
  }[] | null
): AppointmentServiceItem[] | undefined {
  if (!appointmentServices || appointmentServices.length === 0) {
    return undefined;
  }

  return appointmentServices.map(as => ({
    id: as.id,
    serviceId: as.serviceId,
    customDuration: as.customDuration ?? undefined,
    customPrice: as.customPrice ?? undefined,
    orderPosition: as.orderPosition,
    service: as.service ? {
      id: as.service.id,
      name: as.service.name,
      defaultPrice: as.service.defaultPrice ?? undefined,
      discountFE: as.service.discountFE ?? undefined,
      duration: as.service.defaultDuration ?? undefined,
    } : undefined,
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
  patientId?: string;
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
