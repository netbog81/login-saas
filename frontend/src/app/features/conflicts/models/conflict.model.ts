/**
 * Modelli della gestione conflitti (Layer models).
 *
 * Un "conflitto" è un appuntamento che il backend ha marcato con
 * `hasConflict=true` perché la disponibilità sotto di lui è cambiata DOPO la
 * prenotazione: l'operatore si è messo in ferie, il template degli orari è
 * cambiato, la palestra ha chiuso quella fascia. L'appuntamento resta dov'è —
 * nessuno lo sposta d'ufficio — ma va segnalato e poi risolto a mano.
 *
 * Questi tipi sono condivisi da tre punti di consumo: la pagina /conflicts,
 * il calendario operatori e il calendario palestra. Le due viste calendario
 * non hanno bisogno del `ConflictedAppointment` completo: gli basta il
 * sottoinsieme `ConflictInfo`, che è tutto ciò che serve a disegnare il
 * triangolo e a spiegare il motivo.
 */

import { ConflictReason, ConflictResolutionAction } from '../../../graphql/generated/types';

export { ConflictReason, ConflictResolutionAction };

/**
 * Il minimo indispensabile per segnalare un conflitto in una vista calendario.
 *
 * PERCHÉ NON L'APPUNTAMENTO INTERO: il badge vive dentro chip larghi 40px
 * ridisegnati a ogni scroll. Passargli l'appuntamento completo legherebbe un
 * dumb component di Layer 1 a un modello che cambia per ragioni che non lo
 * riguardano.
 */
export interface ConflictInfo {
  hasConflict: boolean;
  reason?: ConflictReason | string | null;
  detectedAt?: string | Date | null;
}

/**
 * Da dove arriva la richiesta di risoluzione. Cambia le azioni offerte:
 * nella vista operatori "sposta" cerca slot liberi per operatore, in palestra
 * per sala e orario, e nella pagina conflitti si passa dal dialog Appuntamenti.
 */
export type ConflictOrigin = 'operators' | 'gym' | 'dashboard';

/** Appuntamento in conflitto, nella forma che serve al dialog di risoluzione. */
export interface ConflictedAppointment {
  id: string;
  appointmentDate: string | Date;
  startTime: string;
  endTime: string;
  clientName?: string | null;
  clientPhone?: string | null;
  patientId?: string | null;
  operatorId?: string | null;
  operatorName?: string | null;
  operatorColor?: string | null;
  gymRoomId?: string | null;
  gymRoomName?: string | null;
  serviceName?: string | null;
  conflictReason?: ConflictReason | string | null;
  conflictDetectedAt?: string | Date | null;
  isRecurring?: boolean;
  recurringGroupId?: string | null;
}

/**
 * Esito del dialog di risoluzione, per il container che l'ha aperto.
 *
 * `move` non è un'azione risolta: è una richiesta di passare il testimone al
 * pannello di spostamento della vista chiamante, che sa dove cercare gli slot
 * liberi (per operatore o per sala). Il dialog non ha modo di saperlo, e non
 * deve: è la sola differenza di comportamento fra le due viste.
 */
export interface ConflictResolutionResult {
  outcome: 'resolved' | 'move' | 'cancelled';
  action?: ConflictResolutionAction;
  appointmentId: string;
}

/** Etichette in italiano dei motivi di conflitto. */
const REASON_LABELS: Record<string, string> = {
  [ConflictReason.TemplateChange]: 'Cambio orari template',
  [ConflictReason.OperatorSick]: 'Malattia operatore',
  [ConflictReason.OperatorVacation]: 'Ferie operatore',
  [ConflictReason.OperatorUnavailable]: 'Operatore non disponibile',
  [ConflictReason.RecurringAppointment]: 'Occorrenza serie ricorrente',
  [ConflictReason.AvailabilityRemoved]: 'Disponibilità straordinaria rimossa',
};

/**
 * Etichetta leggibile di un motivo di conflitto.
 *
 * Accetta anche la forma minuscola: il mapper degli appuntamenti fa
 * `toLowerCase()` sull'enum GraphQL, quindi la stessa causa arriva come
 * `OPERATOR_SICK` dalla pagina conflitti e come `operator_sick` dal
 * calendario. Normalizzare qui evita di doverlo ricordare in tre template.
 */
export function conflictReasonLabel(
  reason: ConflictReason | string | null | undefined,
): string {
  if (!reason) return 'Conflitto di disponibilità';
  const key = String(reason).toUpperCase();
  const match = Object.entries(REASON_LABELS).find(
    ([enumValue]) => String(enumValue).toUpperCase() === key,
  );
  return match ? match[1] : String(reason);
}

/**
 * Spiegazione estesa: cosa è successo e cosa ci si aspetta dall'utente.
 * Serve nel banner del dialog di modifica, dove c'è spazio per una frase
 * intera e l'etichetta secca non basterebbe a far capire cosa fare.
 */
export function conflictReasonDescription(
  reason: ConflictReason | string | null | undefined,
): string {
  const key = String(reason ?? '').toUpperCase();
  switch (key) {
    case String(ConflictReason.TemplateChange).toUpperCase():
      return "Gli orari dell'operatore sono cambiati dopo la prenotazione: l'appuntamento è fuori dalle sue fasce di disponibilità attuali.";
    case String(ConflictReason.OperatorSick).toUpperCase():
      return "L'operatore risulta assente per malattia in questo orario.";
    case String(ConflictReason.OperatorVacation).toUpperCase():
      return "L'operatore risulta in ferie in questo orario.";
    case String(ConflictReason.OperatorUnavailable).toUpperCase():
      return "L'operatore risulta assente in questo orario.";
    case String(ConflictReason.RecurringAppointment).toUpperCase():
      return "Questa occorrenza della serie ricorrente è finita in uno slot non più disponibile.";
    case String(ConflictReason.AvailabilityRemoved).toUpperCase():
      return "La disponibilità straordinaria su cui era stato prenotato è stata rimossa.";
    default:
      return 'La disponibilità è cambiata dopo la prenotazione: verificare e decidere come procedere.';
  }
}
