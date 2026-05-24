/**
 * Modelli dominio per la feature di riprenotazione appuntamenti (Calendario V3).
 *
 * APPROACH: GraphQL Fragments per le foreign keys.
 * REASON: il backend espone resolver per operator/service/instruments;
 *         AvailabilityAppointment arriva gia' con le relazioni popolate.
 * ALTERNATIVE: service composition se il backend perdesse i resolver.
 */

/** Slot disponibile per riprenotazione, gia' filtrato per strumenti. */
export interface RebookingSlot {
  operatorId: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
}

/** Operatore selezionabile come destinazione di riprenotazione. */
export interface RebookingOperatorOption {
  operatorId: string;
  name: string;
  /** Macro-categoria (es. PHYSIOTHERAPIST), per il filtro per categoria. */
  macroCategory: string;
  /** true se e' l'operatore originale dell'appuntamento. */
  isOriginal: boolean;
  /** true se incluso nella ricerca slot. */
  selected: boolean;
}

/** Operatore grezzo passato al dialog Appuntamenti. */
export interface RebookingOperatorInput {
  id: string;
  name: string;
  macroCategory: string;
}

/** Slot raggruppati per data, per il rendering a colonne-giorno. */
export interface RebookingSlotsByDay {
  date: string;
  slots: RebookingSlot[];
}
