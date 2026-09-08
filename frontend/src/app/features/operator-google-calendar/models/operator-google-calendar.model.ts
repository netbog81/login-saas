/**
 * Collegamento a Google Calendar di un operatore.
 *
 * Affianca il feed ICS, non lo sostituisce: l'ICS copre iOS e Outlook e regge
 * da solo se l'autorizzazione Google salta, il push OAuth dà l'aggiornamento
 * immediato su Google.
 */

export type GoogleCalendarConnectionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR';

export interface OperatorGoogleCalendarStatus {
  operatorId: string;
  /** Falso se l'operatore non ha un utente collegato: senza account non può autorizzare. */
  canConnect: boolean;
  connected: boolean;
  /** Indirizzo Google dichiarato per questa persona. */
  declaredEmail?: string | null;
  /** Indirizzo che ha davvero autorizzato, come lo riporta Google. */
  googleEmail?: string | null;
  calendarName?: string | null;
  /** Nome proposto per il calendario, modificabile prima di collegare. */
  suggestedCalendarName: string;
  status?: GoogleCalendarConnectionStatus | null;
  connectedAt?: string | null;
  lastSyncAt?: string | null;
  lastErrorMessage?: string | null;
  /** Vero quando l'autorizzazione è scaduta e serve ricollegare. */
  needsReconnect: boolean;

  /**
   * L'app Curandis è ancora in "Testing" presso Google: i permessi scadono a
   * scadenza fissa e ha senso il conto alla rovescia. A verifica ottenuta
   * diventa falso e l'interfaccia smette di parlarne.
   */
  testingMode: boolean;

  /** Scadenza ATTESA. È una previsione: Google non la comunica. */
  expiresAt?: string | null;

  /** Giorni interi rimasti; negativo se la scadenza attesa è passata. */
  daysLeft?: number | null;

  /** Conviene rinnovare adesso, senza aspettare che si rompa. */
  expiringSoon: boolean;

  alertWhatsapp: boolean;
  alertEmail: boolean;
  operatorPhone?: string | null;
  operatorEmail?: string | null;
}

/**
 * Come lo studio vuole che il calendario esterno rispecchi il gestionale.
 *
 * ATTENZIONE: riguarda SOLO Google Calendar e il feed ICS. Gli appuntamenti
 * nel gestionale restano sempre tutti — passati e futuri — perché sono lo
 * storico dello studio.
 */
export interface CalendarSyncSettings {
  id: string;
  keepPastAppointments: boolean;
  keepCalendarOnDisconnect: boolean;
}

/** Stato di sincronizzazione compatto, per l'elenco degli operatori. */
export interface OperatorSyncSummary {
  operatorId: string;
  feedEnabled: boolean;
  googleConnected: boolean;
  googleEmail?: string | null;
  declaredEmail?: string | null;
  googleNeedsReconnect: boolean;
  googleDaysLeft?: number | null;
}
