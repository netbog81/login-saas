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
  } & ReminderWindowFields;
  correlationId: string;
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
  };
  correlationId: string;
}
