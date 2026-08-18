/**
 * Modelli della chat WhatsApp bidirezionale.
 *
 * L'identita' della conversazione e' il NUMERO di telefono, non il paziente:
 * la segreteria riceve messaggi anche da numeri non ancora in anagrafica e
 * quelle chat devono comunque esistere. `patientId` e' quindi opzionale.
 */

/**
 * ATTENZIONE ai valori: GraphQL serializza gli enum col NOME del membro in
 * maiuscolo, non col valore dell'enum TypeScript lato server. Sul filo arriva
 * quindi `OUTBOUND`, non `outbound` — confrontare con la minuscola dà sempre
 * falso (e in input il server rifiuta il valore).
 */
export type WhatsappChatDirection = 'INBOUND' | 'OUTBOUND';

export type WhatsappConversationStatus = 'OPEN' | 'ARCHIVED' | 'BLOCKED';

export type WhatsappChatMessageStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'RECEIVED'
  | 'DISPATCHED'
  | 'CANCELLED';

export interface WhatsappConversation {
  id: string;
  /** Numero normalizzato a sole cifre con prefisso (es. 393471234567). */
  phoneNumber: string;
  patientId?: string;
  patientName?: string;
  /** Nome profilo WhatsApp: unica etichetta per i numeri non riconosciuti. */
  contactName?: string;
  status: WhatsappConversationStatus;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageDirection?: WhatsappChatDirection;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappChatMessage {
  id: string;
  conversationId: string;
  direction: WhatsappChatDirection;
  body?: string;
  /** Valorizzato sugli allegati non testuali (image, audio, document, ...). */
  mediaType?: string;
  status: WhatsappChatMessageStatus;
  senderName?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface WhatsappChatMessagePage {
  items: WhatsappChatMessage[];
  total: number;
  page: number;
  limit: number;
}

export interface WhatsappConversationFilters {
  status?: WhatsappConversationStatus;
  search?: string;
  limit?: number;
  /** Solo conversazioni con messaggi in arrivo non letti. */
  unreadOnly?: boolean;
}

/** Input di apertura conversazione: si parte sempre da un numero. */
export interface OpenWhatsappConversationInput {
  phone: string;
  patientId?: string;
  patientName?: string;
}

export interface SendWhatsappChatMessageInput {
  conversationId: string;
  text: string;
}

/**
 * Etichetta da mostrare per una conversazione: il paziente se collegato,
 * altrimenti il nome profilo WhatsApp, altrimenti il numero.
 */
export function conversationLabel(c: WhatsappConversation): string {
  return c.patientName || c.contactName || formatPhone(c.phoneNumber);
}

/** Numero in forma leggibile: +39 347 1234567. */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  if (phone.startsWith('39') && phone.length >= 11) {
    return `+39 ${phone.slice(2, 5)} ${phone.slice(5)}`;
  }
  return `+${phone}`;
}
