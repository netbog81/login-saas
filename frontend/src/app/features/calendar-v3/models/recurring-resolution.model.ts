/**
 * Modelli della risoluzione conflitti su serie ricorrente.
 *
 * Il flusso è a due tempi: prima il backend propone il piano (che date
 * genererebbe la regola, e quali sono in conflitto), poi l'utente decide
 * occorrenza per occorrenza e il piano risolto torna al backend.
 *
 * È il motivo per cui non esiste più un flag "forza" per le serie: una
 * risposta sì/no non può descrivere N date che hanno storie diverse — una
 * fuori orario perché il template è cambiato a settembre, un'altra occupata
 * da un altro paziente, le altre perfettamente a posto.
 */

/** Tipo di conflitto rilevato dal backend su una singola occorrenza. */
export type OccurrenceConflictType = 'unavailable' | 'overlap';

export interface OccurrenceConflict {
  type: OccurrenceConflictType;
  reason: string;
  conflictingStartTime?: string;
  conflictingEndTime?: string;
}

/** Una occorrenza del piano, come la restituisce l'anteprima. */
export interface RecurringOccurrencePreview {
  /** Popolato solo per le serie già esistenti (modifica). */
  appointmentId?: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  conflict?: OccurrenceConflict;
}

/**
 * Cosa fare di una occorrenza.
 * - `keep`: nessun conflitto, si crea così com'è.
 * - `confirm`: fuori disponibilità ma la si vuole comunque.
 * - `move`: spostata altrove (data, orario o operatore diversi).
 * - `skip`: non creare / non modificare questa occorrenza.
 */
export type OccurrenceDecision = 'keep' | 'confirm' | 'move' | 'skip';

/** Destinazione scelta quando la decisione è `move`. */
export interface OccurrenceDestination {
  date: string;
  startTime: string;
  endTime: string;
  /** Valorizzato solo se lo spostamento cambia anche operatore. */
  operatorId?: string;
  operatorName?: string;
}

/** Riga del riquadro: l'occorrenza proposta più la decisione dell'utente. */
export interface OccurrenceResolution {
  preview: RecurringOccurrencePreview;
  decision: OccurrenceDecision;
  destination?: OccurrenceDestination;
}

/** Occorrenza risolta, nella forma che il backend si aspetta. */
export interface ResolvedOccurrenceInput {
  appointmentId?: string;
  date: string;
  startTime: string;
  endTime: string;
  operatorId?: string;
}

/** Slot libero proposto per uno spostamento. */
export interface MoveSlotOption {
  date: string;
  startTime: string;
  endTime: string;
  operatorId: string;
  operatorName: string;
  /** Vero se è l'operatore originale dell'occorrenza. */
  isOriginalOperator: boolean;
}

/**
 * Di quanti giorni allargare la ricerca slot attorno alla data originale.
 * Serve quando quel giorno è pieno: il cliente vuole poter guardare il giorno
 * prima e quello dopo senza uscire dal riquadro.
 */
export type MoveSearchSpan = 0 | 1 | 3 | 7;
