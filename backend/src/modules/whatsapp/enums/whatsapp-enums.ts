import { registerEnumType } from '@nestjs/graphql';

export enum WhatsappMessageStatus {
  DISPATCHED = 'dispatched',
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  /**
   * Messaggio ARRIVATO dal paziente. Usato solo dalla chat: i messaggi in
   * arrivo non hanno uno stato di consegna nostro, e riusare 'sent' avrebbe
   * confuso il verso.
   */
  RECEIVED = 'received',
}

export enum WhatsappMessageType {
  RECAP_SINGLE = 'recap_single',
  RECAP_MULTI = 'recap_multi',
  REMINDER_24H = 'reminder_24h',
  CANCELLATION = 'cancellation',
  UPDATE = 'update',
}

/** Verso di un messaggio di chat rispetto allo studio. */
export enum WhatsappChatDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

/**
 * Stato di una conversazione nella inbox.
 * - OPEN     → visibile nell'elenco chat
 * - ARCHIVED → nascosta ma consultabile (nessun nuovo messaggio la riapre da sola)
 * - BLOCKED  → numero indesiderato: i messaggi in arrivo vengono scartati
 */
export enum WhatsappConversationStatus {
  OPEN = 'open',
  ARCHIVED = 'archived',
  BLOCKED = 'blocked',
}

/**
 * Come collocare il promemoria degli appuntamenti che iniziano PRIMA della fine
 * della fascia di invio (con la fascia di default 08:30-09:00: quelli prima
 * delle 09:00). Per loro la fascia del giorno prima cadrebbe a meno di 24h
 * dall'appuntamento, cioè sotto la soglia per cui la fascia è stata introdotta.
 */
export enum WhatsappReminderEarlyPolicy {
  /** Arretra alla fascia del giorno ancora precedente: le 24h restano garantite. */
  SHIFT_PREVIOUS_DAY = 'SHIFT_PREVIOUS_DAY',
  /** Invia all'ora esatta -24h, fuori fascia e fuori dalla distribuzione. */
  EXACT_24H = 'EXACT_24H',
  /** Invia comunque in fascia, accettando un preavviso inferiore alle 24h. */
  FORCE_WINDOW = 'FORCE_WINDOW',
}

export enum WhatsappTemplateType {
  RECAP_SINGLE = 'RECAP_SINGLE',
  RECAP_MULTI = 'RECAP_MULTI',
  REMINDER_24H = 'REMINDER_24H',
  /**
   * Promemoria per gli invii che partono DUE giorni prima (politica
   * SHIFT_PREVIOUS_DAY della fascia oraria): lì "domani" sarebbe sbagliato.
   * Se manca o è disattivato il gateway ricade su REMINDER_24H.
   */
  REMINDER_48H = 'REMINDER_48H',
  CANCELLATION = 'CANCELLATION',
  UPDATE = 'UPDATE',
}

registerEnumType(WhatsappMessageStatus, {
  name: 'WhatsappMessageStatus',
  description: 'Status del messaggio WhatsApp',
});

registerEnumType(WhatsappMessageType, {
  name: 'WhatsappMessageType',
  description: 'Tipo di messaggio WhatsApp',
});

registerEnumType(WhatsappTemplateType, {
  name: 'WhatsappTemplateType',
  description: 'Tipo di template messaggio WhatsApp',
});

registerEnumType(WhatsappChatDirection, {
  name: 'WhatsappChatDirection',
  description: 'Verso del messaggio di chat: in arrivo dal paziente o in uscita dallo studio',
});

registerEnumType(WhatsappConversationStatus, {
  name: 'WhatsappConversationStatus',
  description: 'Stato della conversazione: aperta, archiviata o bloccata',
});

registerEnumType(WhatsappReminderEarlyPolicy, {
  name: 'WhatsappReminderEarlyPolicy',
  description:
    'Collocazione del promemoria per gli appuntamenti che iniziano prima della fine della fascia di invio',
});
