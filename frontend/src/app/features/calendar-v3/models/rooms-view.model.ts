/**
 * Modelli della vista calendario "Studi" (Layer models).
 * Interfacce condivise tra service, container e dumb components.
 */

/** Fascia di occupazione pianificata (da assegnazioni template). */
export interface RoomOccupancyBand {
  startTime: string; // HH:MM
  endTime: string;
  operatorId: string;
  operatorName: string;
  /** Colore configurato sull'operatore (coerente con gli appuntamenti). */
  operatorColor?: string;
  chairId?: string;
  chairName?: string;
}

/** Fascia liberata da un'eccezione (ferie, malattia...): studio libero "per assenza". */
export interface RoomAbsenceBand {
  startTime: string;
  endTime: string;
  operatorId: string;
  operatorName: string;
  reason: string;
}

export interface RoomDayOccupancy {
  roomId: string;
  date: string; // YYYY-MM-DD
  bands: RoomOccupancyBand[];
  absences: RoomAbsenceBand[];
}

/** Appuntamento minimale per la vista studi (snapshot roomId). */
export interface RoomViewAppointment {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  roomId?: string;
  chairId?: string;
  operatorId?: string;
  operator?: { id: string; name: string; surname?: string; color?: string };
}

/** Periodo mostrato: automatico (ciclo max dei template) o settimane forzate. */
export type RoomsViewPeriod = number | 'auto';

/** Voce della legenda colori operatori nel pannello laterale. */
export interface LegendOperator {
  id: string;
  name: string;
  color: string;
}

/** Palette per gli operatori (hash stabile su operatorId). */
const OPERATOR_FALLBACK_COLORS = [
  '#4A90E2', '#50C878', '#F5A623', '#BD10E0', '#E94B3C', '#7ED321',
  '#9013FE', '#00B8D9', '#FF8B00', '#36B37E',
];

/**
 * Colore stabile per un operatore nelle fasce di occupazione e nella legenda.
 * Deve essere la STESSA funzione ovunque (griglia + legenda) perché i colori
 * coincidano.
 */
export function operatorColorFor(operatorId: string): string {
  let hash = 0;
  for (let i = 0; i < operatorId.length; i++) {
    hash = (hash * 31 + operatorId.charCodeAt(i)) | 0;
  }
  return OPERATOR_FALLBACK_COLORS[Math.abs(hash) % OPERATOR_FALLBACK_COLORS.length];
}
