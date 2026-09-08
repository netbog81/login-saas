/**
 * Modelli dello spostamento e della ricorrenza in palestra (Layer models).
 *
 * L'ASSE ALTERNATIVO È LA SALA, NON L'OPERATORE. È la differenza che rende
 * questi modelli distinti da quelli di `calendar-v3/models/recurring-resolution`:
 * lì, quando uno slot non va bene, si cerca un altro operatore che possa
 * prendere il paziente; qui l'istruttore non si sceglie — lo assegna il
 * template della palestra fascia per fascia — e quello che si cerca è un
 * altro orario o un'altra sala con un posto libero.
 *
 * Ne consegue che uno slot palestra porta con sé cose che uno slot operatore
 * non ha: capienza residua e sala di appartenenza. Sono i due dati su cui si
 * decide.
 */

/** Slot palestra proposto come destinazione di uno spostamento. */
export interface GymMoveSlot {
  gymRoomId: string;
  gymRoomName: string;
  gymRoomColor?: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  /** Istruttore che il template assegna a quella fascia. */
  operatorName?: string;
  operatorColor?: string;
  currentCount: number;
  maxCapacity: number;
  /** Posti ancora liberi: `maxCapacity - currentCount`, mai negativo. */
  freeSpots: number;
  /** Vero se è la sala di partenza dell'appuntamento da spostare. */
  isOriginalRoom: boolean;
}

/** Slot raggruppati per giorno, per il rendering a colonne. */
export interface GymMoveSlotsByDay {
  date: string;
  slots: GymMoveSlot[];
}

/**
 * Di quanti giorni allargare la ricerca attorno alla data originale.
 * Serve quando quel giorno è pieno: si guarda il giorno prima e quello dopo
 * senza uscire dal pannello.
 */
export type GymMoveSearchSpan = 0 | 1 | 3 | 7;

/** Input della mutation di spostamento (solo ID per le foreign key). */
export interface GymMoveInput {
  appointmentId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  /** Nuova sala. Omessa se lo spostamento resta nella sala di partenza. */
  gymRoomId?: string;
}

/** Appuntamento palestra da spostare, nella forma che serve al pannello. */
export interface GymMoveTarget {
  id: string;
  gymRoomId: string;
  gymRoomName?: string;
  patientId?: string | null;
  clientName?: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  isRecurring?: boolean;
  recurringGroupId?: string | null;
}

/** Sala selezionabile come destinazione. */
export interface GymRoomOption {
  id: string;
  name: string;
  color?: string;
  /** Inclusa nella ricerca slot. */
  selected: boolean;
  /** Vero per la sala di partenza dell'appuntamento. */
  isOriginal: boolean;
}

/**
 * Occorrenza di una serie palestra dopo la risoluzione, nella forma che il
 * backend si aspetta. `gymRoomId` è valorizzato solo se lo spostamento
 * cambia anche sala — l'equivalente palestra di `operatorId` nelle serie
 * standard.
 */
export interface GymResolvedOccurrence {
  appointmentId?: string;
  date: string;
  startTime: string;
  endTime: string;
  gymRoomId?: string;
}
