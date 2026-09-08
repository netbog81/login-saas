/**
 * Come collocare il promemoria degli appuntamenti che iniziano prima della fine
 * della fascia di invio: per loro la fascia del giorno prima cadrebbe a meno di
 * 24h dall'appuntamento.
 */
export type WhatsappReminderEarlyPolicy = 'SHIFT_PREVIOUS_DAY' | 'EXACT_24H' | 'FORCE_WINDOW';

export interface WhatsappConfig {
  id: string;
  gatewayUrl: string;
  tenantApiId: string;
  maskedApiKey: string;
  isActive: boolean;
  sendCancelNotification: boolean;
  sendUpdateNotification: boolean;
  /** Finestra di raggruppamento del recap in secondi (30-600). */
  recapBufferSeconds: number;
  /** Manda al paziente, col recap, il link del calendario da sottoscrivere. */
  patientCalendarFeedEnabled: boolean;
  /** Promemoria in fascia oraria il giorno prima invece che alle 24h esatte. */
  reminderWindowEnabled: boolean;
  /** Inizio fascia, HH:mm. */
  reminderWindowStart: string;
  /** Fine fascia, HH:mm. */
  reminderWindowEnd: string;
  reminderEarlyPolicy: WhatsappReminderEarlyPolicy;
  retentionDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappConfigInput {
  gatewayUrl: string;
  tenantApiId: string;
  apiKey?: string;
  webhookSecret?: string;
  /** Chiave istanza Evolution: se valorizzata viene scritta in OpenBao via gateway (non salvata nel DB clinico) */
  evolutionApiKey?: string;
  isActive?: boolean;
  sendCancelNotification?: boolean;
  sendUpdateNotification?: boolean;
  recapBufferSeconds?: number;
  patientCalendarFeedEnabled?: boolean;
  reminderWindowEnabled?: boolean;
  reminderWindowStart?: string;
  reminderWindowEnd?: string;
  reminderEarlyPolicy?: WhatsappReminderEarlyPolicy;
  retentionDays?: number;
}

export type WhatsappTemplateType =
  | 'RECAP_SINGLE'
  | 'RECAP_MULTI'
  | 'REMINDER_24H'
  /** Usato quando il promemoria parte due giorni prima (politica "anticipa alla fascia precedente"). */
  | 'REMINDER_48H'
  | 'CANCELLATION'
  | 'UPDATE'
  /** Elenco degli appuntamenti spostati insieme per lo stesso numero. */
  | 'UPDATE_MULTI'
  /** Elenco degli appuntamenti disdetti insieme per lo stesso numero. */
  | 'CANCELLATION_MULTI'
  /** Email col link per aggiungere i propri appuntamenti al calendario. */
  | 'CALENDAR_INVITE_EMAIL';

/**
 * Canale a cui appartiene un testo.
 *
 * MAIUSCOLO: GraphQL espone le enum con le chiavi, non con i valori salvati a
 * database. Con i valori in minuscolo i testi non venivano trovati e l'editor
 * mostrava campi vuoti.
 */
export type TemplateChannel = 'WHATSAPP' | 'EMAIL' | 'SMS';

export interface WhatsappTemplate {
  /** Su quale canale vale questo testo. */
  channel: TemplateChannel;
  id: string;
  templateType: WhatsappTemplateType;
  bodyTemplate: string;
  footerTemplate?: string;
  /** Oggetto: valorizzato solo per i template che viaggiano per posta. */
  subjectTemplate?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappTemplateInput {
  /** Omesso = WhatsApp. */
  channel?: TemplateChannel;
  templateType: WhatsappTemplateType;
  bodyTemplate: string;
  footerTemplate?: string;
  subjectTemplate?: string;
  isActive?: boolean;
}

export type WhatsappMessageStatus = 'dispatched' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled';
export type WhatsappMessageType =
  | 'recap_single'
  | 'recap_multi'
  | 'reminder_24h'
  | 'cancellation'
  | 'update'
  | 'update_multi'
  | 'cancellation_multi';

export interface WhatsappMessageLog {
  id: string;
  appointmentId?: string;
  appointmentIds?: string[];
  patientId?: string;
  patientName?: string;
  phoneNumber: string;
  messageType: WhatsappMessageType;
  status: WhatsappMessageStatus;
  correlationId: string;
  evolutionMessageId?: string;
  messageBody?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  isAnonymized: boolean;
  anonymizedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Messaggio ancora in coda sul gateway, non ancora inviato. */
export interface WhatsappScheduledMessage {
  jobId: string;
  type: WhatsappScheduledType;
  phone: string;
  patientName?: string;
  appointmentIds: string[];
  /** Assente per i recap: il testo si compone alla chiusura della finestra. */
  content?: string;
  /** Solo per i recap: appuntamenti già accumulati. */
  bufferedCount?: number;
  scheduledFor: string;
  state: 'delayed' | 'waiting';
}

export type WhatsappScheduledType =
  | 'reminder'
  | 'update_notification'
  | 'cancel_notification'
  | 'recap'
  /** Spostamenti in attesa di essere raggruppati in un unico messaggio. */
  | 'update_recap'
  /** Disdette in attesa di essere raggruppate in un unico messaggio. */
  | 'cancel_recap';

export const SCHEDULED_TYPE_LABELS: Record<WhatsappScheduledType, string> = {
  reminder: 'Promemoria 24h',
  update_notification: 'Spostamento',
  cancel_notification: 'Cancellazione',
  recap: 'Recap (in composizione)',
  update_recap: 'Spostamenti (in composizione)',
  cancel_recap: 'Disdette (in composizione)',
};

export const SCHEDULED_TYPE_ICONS: Record<WhatsappScheduledType, string> = {
  reminder: 'alarm',
  update_notification: 'event_repeat',
  cancel_notification: 'event_busy',
  recap: 'playlist_add_check',
  update_recap: 'event_repeat',
  cancel_recap: 'event_busy',
};

export interface WhatsappRetentionStats {
  totalLogs: number;
  expiredLogs: number;
  anonymizedLogs: number;
  retentionDays: number;
  retentionCutoffDate: string;
}

export interface WhatsappLogManagementResult {
  success: boolean;
  affectedCount: number;
  message?: string;
}

export interface WhatsappLogFilter {
  patientName?: string;
  status?: WhatsappMessageStatus;
  messageType?: WhatsappMessageType;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

export interface WhatsappMessageLogPage {
  items: WhatsappMessageLog[];
  total: number;
}

export const MESSAGE_STATUS_LABELS: Record<WhatsappMessageStatus, string> = {
  dispatched: 'Inviato al gateway',
  pending: 'In attesa',
  sent: 'Inviato',
  delivered: 'Consegnato',
  read: 'Letto',
  failed: 'Errore',
  cancelled: 'Cancellato',
};

export const MESSAGE_STATUS_ICONS: Record<WhatsappMessageStatus, string> = {
  dispatched: 'cloud_upload',
  pending: 'schedule',
  sent: 'send',
  delivered: 'done',
  read: 'done_all',
  failed: 'error',
  cancelled: 'cancel',
};

export const MESSAGE_TYPE_LABELS: Record<WhatsappMessageType, string> = {
  recap_single: 'Recap singolo',
  recap_multi: 'Recap multiplo',
  reminder_24h: 'Promemoria 24h',
  cancellation: 'Cancellazione',
  update: 'Modifica appuntamento',
  update_multi: 'Spostamenti multipli',
  cancellation_multi: 'Cancellazioni multiple',
};

export const TEMPLATE_TYPE_LABELS: Record<WhatsappTemplateType, string> = {
  RECAP_SINGLE: 'Recap Singolo',
  RECAP_MULTI: 'Recap Multiplo',
  REMINDER_24H: 'Promemoria 24h',
  REMINDER_48H: 'Promemoria 48h',
  CANCELLATION: 'Cancellazione',
  UPDATE: 'Modifica appuntamento',
  UPDATE_MULTI: 'Spostamenti Multipli',
  CANCELLATION_MULTI: 'Cancellazioni Multiple',
  CALENDAR_INVITE_EMAIL: 'Email Calendario',
};

export interface WhatsappTestResult {
  success: boolean;
  message?: string;
  data?: any;
}

export const TEMPLATE_VARIABLES: Record<WhatsappTemplateType, string[]> = {
  RECAP_SINGLE: ['{name}', '{date}', '{time}'],
  RECAP_MULTI: ['{name}', '{appointments}'],
  REMINDER_24H: ['{name}', '{date}', '{time}'],
  REMINDER_48H: ['{name}', '{date}', '{time}'],
  CANCELLATION: ['{name}', '{date}', '{time}'],
  // {oldDate}/{oldTime} = da dove l'appuntamento si e' mosso.
  UPDATE: ['{name}', '{date}', '{time}', '{oldDate}', '{oldTime}'],
  UPDATE_MULTI: ['{name}', '{appointments}'],
  CANCELLATION_MULTI: ['{name}', '{appointments}'],
  // {link} = pagina di sottoscrizione, {unsubscribe} = annulla iscrizione,
  // {appointments} = elenco dei prossimi appuntamenti (l'email vale anche da
  // recap scritto). Chi non lo vuole toglie la variabile dal testo.
  CALENDAR_INVITE_EMAIL: ['{name}', '{appointments}', '{link}', '{unsubscribe}'],
};
