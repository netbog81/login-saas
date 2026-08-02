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
    /** RECAP_MULTI grezzo: il gateway sostituisce {name} e {appointments}. */
    recapMultiTemplate?: string;
    /** Riga di questo appuntamento nell'elenco del recap multiplo. */
    recapLine?: string;
    /** Finestra di raggruppamento recap in secondi (30-600), da config tenant. */
    recapDelaySeconds?: number;
  };
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
    sendUpdateNotification?: boolean;
  };
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
