/**
 * Sottoscrizione del paziente al calendario dei propri appuntamenti.
 *
 * Il paziente riceve una volta sola un link e da lì in poi il suo calendario
 * si aggiorna da sé, senza altra posta a ogni spostamento o disdetta.
 */

/** Chi ha chiuso la sottoscrizione. */
export type PatientCalendarFeedRevokedBy = 'patient' | 'staff' | 'system';

export interface PatientCalendarFeedStatus {
  patientId: string;
  /** Falso se al paziente non è mai stata creata una sottoscrizione. */
  exists: boolean;
  active: boolean;
  /** Quando è partita la mail col link. */
  emailSentAt?: string | null;
  emailSentTo?: string | null;
  /**
   * Quando un'app di calendario ha scaricato il feed per la PRIMA volta: è
   * l'unico dato che dice che il paziente ce l'ha davvero nel telefono.
   * Valorizzato `emailSentAt` ma non questo = link mandato e mai usato.
   */
  subscribedAt?: string | null;
  lastAccessAt?: string | null;
  revokedAt?: string | null;
  revokedBy?: PatientCalendarFeedRevokedBy | null;
}

/** Riga del prospetto in amministrazione: lo stato più il nome del paziente. */
export interface PatientCalendarFeedRow extends PatientCalendarFeedStatus {
  patientName?: string | null;
  createdAt: string;
}

/**
 * In che stato è una sottoscrizione, per come conta a chi la guarda.
 * Sono i quattro casi che la segreteria distingue davvero.
 */
export type PatientCalendarFeedState =
  /** Mai creata. */
  | 'none'
  /** Link mandato, ma nessuna app di calendario l'ha ancora scaricato. */
  | 'sent'
  /** Attiva e in uso: il calendario si sta aggiornando. */
  | 'subscribed'
  | 'revoked';

export function feedState(status: PatientCalendarFeedStatus): PatientCalendarFeedState {
  if (!status.exists) return 'none';
  if (!status.active) return 'revoked';
  return status.subscribedAt ? 'subscribed' : 'sent';
}

export const FEED_STATE_LABELS: Record<PatientCalendarFeedState, string> = {
  none: 'Mai inviato',
  sent: 'Inviato, non ancora attivo',
  subscribed: 'Attivo sul telefono',
  revoked: 'Revocato',
};

export const FEED_STATE_ICONS: Record<PatientCalendarFeedState, string> = {
  none: 'mail_outline',
  sent: 'schedule_send',
  subscribed: 'event_available',
  revoked: 'block',
};

export const REVOKED_BY_LABELS: Record<PatientCalendarFeedRevokedBy, string> = {
  patient: 'dal paziente',
  staff: 'dalla segreteria',
  system: 'da una revoca in blocco',
};
