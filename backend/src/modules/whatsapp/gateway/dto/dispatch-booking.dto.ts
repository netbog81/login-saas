import { WhatsappReminderEarlyPolicy } from '../../enums/whatsapp-enums';

/**
 * Fascia oraria in cui il gateway deve far partire il promemoria del giorno
 * prima, distribuendo gli invii al suo interno. Se i campi sono assenti il
 * gateway torna al comportamento storico (24h esatte prima dell'appuntamento),
 * quindi tenere la fascia spenta non richiede nessun accordo fra le due parti.
 */
export interface ReminderWindowFields {
  /** HH:mm, ora locale. */
  reminderWindowStart?: string;
  /** HH:mm, ora locale. */
  reminderWindowEnd?: string;
  /** Che fare per gli appuntamenti che iniziano prima della fine della fascia. */
  reminderEarlyPolicy?: WhatsappReminderEarlyPolicy;
}

/**
 * Payload verso il WhatsApp gateway.
 *
 * I testi dei messaggi vengono composti QUI: il gateway non conosce i template
 * del tenant e, se non li riceve, ricade su testi hardcoded.
 */
export interface DispatchBookingPayload {
  type: 'APPOINTMENT_BOOKING';
  data: {
    appointmentId: string;
    pazienteId: string;
    phone: string;
    date: string;
    name: string;
    /** RECAP_SINGLE già renderizzato. */
    recapMessage?: string;
    /** REMINDER_24H già renderizzato. */
    reminderMessage?: string;
    /**
     * REMINDER_48H già renderizzato. Il gateway lo usa al posto di
     * `reminderMessage` quando il promemoria parte due giorni prima
     * dell'appuntamento; se assente ricade su `reminderMessage`.
     */
    reminderMessageEarly?: string;
    /** RECAP_MULTI grezzo: il gateway sostituisce {name} e {appointments}. */
    recapMultiTemplate?: string;
    /** Riga di questo appuntamento nell'elenco del recap multiplo. */
    recapLine?: string;
    /** Finestra di raggruppamento recap in secondi (30-600), da config tenant. */
    recapDelaySeconds?: number;
    /**
     * Salta la finestra di raggruppamento e invia il recap subito. Vale per il
     * reinvio chiesto a mano dalla segreteria, non per le prenotazioni.
     */
    recapImmediate?: boolean;
  } & ReminderWindowFields;
  correlationId: string;
}

export interface DispatchBookingResponse {
  correlationId: string;
  status: string;
}

export interface DispatchUpdatePayload {
  type: 'APPOINTMENT_UPDATE';
  data: {
    appointmentId: string;
    pazienteId: string;
    phone: string;
    /** Nuova data/ora: il gateway ci riprogramma sopra il reminder 24h. */
    date: string;
    name: string;
    /** UPDATE già renderizzato. */
    updateMessage?: string;
    /** REMINDER_24H già renderizzato sul nuovo orario. */
    reminderMessage?: string;
    /** REMINDER_48H già renderizzato: usato se il promemoria parte 2 giorni prima. */
    reminderMessageEarly?: string;
    sendUpdateNotification?: boolean;
    /** UPDATE_MULTI grezzo: il gateway sostituisce {name} e {appointments}. */
    updateMultiTemplate?: string;
    /** Riga di questo spostamento nell'elenco multiplo: da dove a dove. */
    updateLine?: string;
    /** Data/ora di partenza, per la riga di ripiego del gateway. */
    previousDate?: string;
    /** Finestra di raggruppamento in secondi (30-600): la stessa dei recap. */
    recapDelaySeconds?: number;
    /**
     * RECAP_SINGLE e riga di elenco già renderizzati sul NUOVO orario.
     *
     * Servono al caso in cui l'appuntamento venga spostato mentre la conferma
     * è ancora nel buffer del gateway: lì non parte nessun "spostato", si
     * corregge la conferma. Senza questi campi il paziente riceverebbe la
     * conferma con l'orario vecchio.
     */
    recapMessage?: string;
    recapLine?: string;
    recapMultiTemplate?: string;
  } & ReminderWindowFields;
  correlationId: string;
}

/** Esito di un APPOINTMENT_UPDATE, per la parte che interessa i log. */
export interface DispatchUpdateResponse {
  /**
   * true quando il gateway ha corretto la conferma ancora in buffer invece di
   * mandare un messaggio di spostamento: il log di UPDATE appena creato non
   * corrisponde a nulla che il paziente riceverà.
   */
  bookingRewritten?: boolean;
}

export interface DispatchCancelPayload {
  type: 'APPOINTMENT_CANCEL';
  data: {
    appointmentId: string;
    phone: string;
    sendCancelNotification: boolean;
    cancelNotificationMessage?: string;
    name: string;
    date: string;
    /** CANCELLATION_MULTI grezzo: il gateway sostituisce {name} e {appointments}. */
    cancelMultiTemplate?: string;
    /** Riga di questa disdetta nell'elenco multiplo. */
    cancelLine?: string;
    /** Finestra di raggruppamento in secondi (30-600): la stessa dei recap. */
    recapDelaySeconds?: number;
  };
  correlationId: string;
}
