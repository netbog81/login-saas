import { Injectable, Injector } from '@angular/core';
import { gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  OpenWhatsappConversationInput,
  SendWhatsappChatMessageInput,
  WhatsappChatMessage,
  WhatsappChatMessagePage,
  WhatsappConversation,
  WhatsappConversationFilters,
  WhatsappConversationStatus,
} from '../models/whatsapp-chat.model';

const CONVERSATION_FIELDS = gql`
  fragment WhatsappConversationFields on WhatsappConversation {
    id
    phoneNumber
    patientId
    patientName
    contactName
    status
    lastMessageAt
    lastMessagePreview
    lastMessageDirection
    unreadCount
    createdAt
    updatedAt
  }
`;

const CHAT_MESSAGE_FIELDS = gql`
  fragment WhatsappChatMessageFields on WhatsappChatMessage {
    id
    conversationId
    direction
    body
    mediaType
    status
    senderName
    errorMessage
    sentAt
    deliveredAt
    readAt
    createdAt
  }
`;

const GET_CONVERSATIONS = gql`
  ${CONVERSATION_FIELDS}
  query GetWhatsappConversations($filters: WhatsappConversationFilterInput) {
    whatsappConversations(filters: $filters) {
      ...WhatsappConversationFields
    }
  }
`;

const GET_CONVERSATION = gql`
  ${CONVERSATION_FIELDS}
  query GetWhatsappConversation($id: ID!) {
    whatsappConversation(id: $id) {
      ...WhatsappConversationFields
    }
  }
`;

const GET_CHAT_MESSAGES = gql`
  ${CHAT_MESSAGE_FIELDS}
  query GetWhatsappChatMessages($conversationId: ID!, $page: Int!, $limit: Int!) {
    whatsappChatMessages(conversationId: $conversationId, page: $page, limit: $limit) {
      items {
        ...WhatsappChatMessageFields
      }
      total
      page
      limit
    }
  }
`;

const GET_UNREAD_COUNT = gql`
  query GetWhatsappChatUnreadCount {
    whatsappChatUnreadCount
  }
`;

const GET_APPOINTMENTS_RECAP = gql`
  query GetWhatsappChatAppointmentsRecap($conversationId: ID!) {
    whatsappChatAppointmentsRecap(conversationId: $conversationId)
  }
`;

const OPEN_CONVERSATION = gql`
  ${CONVERSATION_FIELDS}
  mutation OpenWhatsappConversation($input: OpenWhatsappConversationInput!) {
    openWhatsappConversation(input: $input) {
      ...WhatsappConversationFields
    }
  }
`;

const SEND_MESSAGE = gql`
  ${CHAT_MESSAGE_FIELDS}
  mutation SendWhatsappChatMessage($input: SendWhatsappChatMessageInput!) {
    sendWhatsappChatMessage(input: $input) {
      ...WhatsappChatMessageFields
    }
  }
`;

const RETRY_MESSAGE = gql`
  ${CHAT_MESSAGE_FIELDS}
  mutation RetryWhatsappChatMessage($messageId: ID!) {
    retryWhatsappChatMessage(messageId: $messageId) {
      ...WhatsappChatMessageFields
    }
  }
`;

const MARK_READ = gql`
  ${CONVERSATION_FIELDS}
  mutation MarkWhatsappConversationRead($conversationId: ID!) {
    markWhatsappConversationRead(conversationId: $conversationId) {
      ...WhatsappConversationFields
    }
  }
`;

const SET_STATUS = gql`
  ${CONVERSATION_FIELDS}
  mutation SetWhatsappConversationStatus(
    $conversationId: ID!
    $status: WhatsappConversationStatus!
  ) {
    setWhatsappConversationStatus(conversationId: $conversationId, status: $status) {
      ...WhatsappConversationFields
    }
  }
`;

const LINK_PATIENT = gql`
  ${CONVERSATION_FIELDS}
  mutation LinkWhatsappConversationPatient($input: LinkWhatsappConversationPatientInput!) {
    linkWhatsappConversationPatient(input: $input) {
      ...WhatsappConversationFields
    }
  }
`;

/**
 * Layer 3 — accesso ai dati della chat WhatsApp.
 *
 * Nessuno stato di UI qui dentro: le finestre aperte, quelle parcheggiate e i
 * badge vivono in `WhatsappChatStateService`.
 */
@Injectable({ providedIn: 'root' })
export class WhatsappChatService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  listConversations(filters?: WhatsappConversationFilters): Observable<WhatsappConversation[]> {
    return this.query<{ whatsappConversations: WhatsappConversation[] }>(
      GET_CONVERSATIONS,
      { filters: filters ?? null },
    ).pipe(map((r) => r.whatsappConversations ?? []));
  }

  getConversation(id: string): Observable<WhatsappConversation> {
    return this.query<{ whatsappConversation: WhatsappConversation }>(
      GET_CONVERSATION,
      { id },
    ).pipe(map((r) => r.whatsappConversation));
  }

  listMessages(
    conversationId: string,
    page = 1,
    limit = 50,
  ): Observable<WhatsappChatMessagePage> {
    return this.query<{ whatsappChatMessages: WhatsappChatMessagePage }>(
      GET_CHAT_MESSAGES,
      { conversationId, page, limit },
    ).pipe(map((r) => r.whatsappChatMessages));
  }

  getUnreadCount(): Observable<number> {
    return this.query<{ whatsappChatUnreadCount: number }>(GET_UNREAD_COUNT)
      .pipe(map((r) => r.whatsappChatUnreadCount ?? 0));
  }

  /**
   * Testo di riepilogo dei prossimi appuntamenti del paziente. Non invia
   * niente: il testo va nella casella di scrittura, così l'operatore lo
   * rilegge (ed eventualmente lo integra) prima di mandarlo.
   */
  getAppointmentsRecap(conversationId: string): Observable<string> {
    return this.query<{ whatsappChatAppointmentsRecap: string }>(
      GET_APPOINTMENTS_RECAP,
      { conversationId },
    ).pipe(map((r) => r.whatsappChatAppointmentsRecap));
  }

  openConversation(input: OpenWhatsappConversationInput): Observable<WhatsappConversation> {
    return this.mutate<{ openWhatsappConversation: WhatsappConversation }>(
      OPEN_CONVERSATION,
      { input },
    ).pipe(map((r) => r.openWhatsappConversation));
  }

  sendMessage(input: SendWhatsappChatMessageInput): Observable<WhatsappChatMessage> {
    return this.mutate<{ sendWhatsappChatMessage: WhatsappChatMessage }>(
      SEND_MESSAGE,
      { input },
    ).pipe(map((r) => r.sendWhatsappChatMessage));
  }

  /** Ritenta un messaggio rimasto in errore, riusando la stessa riga. */
  retryMessage(messageId: string): Observable<WhatsappChatMessage> {
    return this.mutate<{ retryWhatsappChatMessage: WhatsappChatMessage }>(
      RETRY_MESSAGE,
      { messageId },
    ).pipe(map((r) => r.retryWhatsappChatMessage));
  }

  markAsRead(conversationId: string): Observable<WhatsappConversation> {
    return this.mutate<{ markWhatsappConversationRead: WhatsappConversation }>(
      MARK_READ,
      { conversationId },
    ).pipe(map((r) => r.markWhatsappConversationRead));
  }

  setStatus(
    conversationId: string,
    status: WhatsappConversationStatus,
  ): Observable<WhatsappConversation> {
    return this.mutate<{ setWhatsappConversationStatus: WhatsappConversation }>(
      SET_STATUS,
      { conversationId, status },
    ).pipe(map((r) => r.setWhatsappConversationStatus));
  }

  linkPatient(
    conversationId: string,
    patientId: string | null,
    patientName?: string,
  ): Observable<WhatsappConversation> {
    return this.mutate<{ linkWhatsappConversationPatient: WhatsappConversation }>(
      LINK_PATIENT,
      { input: { conversationId, patientId, patientName } },
    ).pipe(map((r) => r.linkWhatsappConversationPatient));
  }
}
