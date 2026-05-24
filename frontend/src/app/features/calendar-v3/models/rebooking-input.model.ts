/**
 * Input per la mutation di riprenotazione (Calendario V3).
 *
 * Contiene SOLO ID per le foreign keys (vedi regola "UPDATE CON FOREIGN
 * KEYS" dell'architettura): l'operatore e' un ID, mai un oggetto.
 * Servizi/strumenti/note non sono presenti: la riprenotazione li
 * preserva non inviandoli al backend.
 */
export interface RebookingInput {
  /** Appuntamento da riprenotare. */
  appointmentId: string;
  /** Nuova data (YYYY-MM-DD). */
  appointmentDate: string;
  /** Nuovo orario inizio (HH:mm). */
  startTime: string;
  /** Nuovo orario fine (HH:mm). */
  endTime: string;
  /** Nuovo operatore (solo ID). Omesso se invariato. */
  operatorId?: string;
  /** Forza la riprenotazione anche fuori disponibilita'. */
  forceOutsideAvailability?: boolean;
}
