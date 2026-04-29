/**
 * Modelli del dominio "I miei appuntamenti" — vista operatore in dashboard.
 *
 * APPROACH FK: GraphQL Fragments (default) — la query carica direttamente
 * paziente/operatore/servizio/room nei resolver.
 * REASON: relazioni 1:1 e 1:many semplici, single round-trip.
 */

/**
 * Status dell'appuntamento allineato al BookingStatus del backend.
 * Duplicato qui come literal type per non importare l'enum (così evitiamo
 * dipendenza dal modulo trattamenti dal modulo my-appointments).
 */
export type MyAppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'cancelled'
  | 'cancelled_early'
  | 'cancelled_late'
  | 'no_show'
  | 'attended';

export interface MyAppointmentService {
  id: string;
  name: string;
  defaultDuration?: number | null;
}

/**
 * Riga della lista appuntamenti operatore.
 *
 * Per il paziente usiamo i campi denormalizzati `clientName` /
 * `clientPhone` esposti dall'entità GraphQL (la relazione patient
 * non è esposta come @Field). `patientId` resta disponibile per
 * eventuali lookup successive.
 */
export interface MyAppointment {
  id: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string;       // HH:MM
  endTime: string;         // HH:MM
  bookingStatus: MyAppointmentStatus;
  notes?: string | null;
  patientId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  service?: MyAppointmentService | null;
}
