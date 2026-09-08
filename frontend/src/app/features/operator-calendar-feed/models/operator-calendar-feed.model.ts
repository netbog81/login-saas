/**
 * Feed ICS dell'agenda operatore.
 *
 * L'operatore sottoscrive un URL segreto dal proprio calendario (iOS, Google,
 * Outlook) e ci ritrova i suoi appuntamenti, in sola lettura.
 */

export interface OperatorCalendarFeedStatus {
  operatorId: string;
  enabled: boolean;
  /** Se vero il feed riporta il nome del paziente, non solo il servizio. */
  showPatientName: boolean;
  /** Se vero il feed riporta anche il telefono, per chiamare dall'agenda. */
  showPatientPhone: boolean;
  /** Null quando il feed non è attivo. */
  feedUrl?: string | null;
  createdAt?: string | null;
  revokedAt?: string | null;
  /** Ultimo scaricamento: dice se il calendario si sta aggiornando davvero. */
  lastAccessAt?: string | null;
}
