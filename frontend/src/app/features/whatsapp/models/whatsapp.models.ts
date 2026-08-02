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
  retentionDays?: number;
}

export type WhatsappTemplateType = 'RECAP_SINGLE' | 'RECAP_MULTI' | 'REMINDER_24H' | 'CANCELLATION' | 'UPDATE';

export interface WhatsappTemplate {
  id: string;
  templateType: WhatsappTemplateType;
  bodyTemplate: string;
  footerTemplate?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappTemplateInput {
  templateType: WhatsappTemplateType;
  bodyTemplate: string;
  footerTemplate?: string;
  isActive?: boolean;
}

export type WhatsappMessageStatus = 'dispatched' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled';
export type WhatsappMessageType = 'recap_single' | 'recap_multi' | 'reminder_24h' | 'cancellation' | 'update';

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
  | 'recap';

export const SCHEDULED_TYPE_LABELS: Record<WhatsappScheduledType, string> = {
  reminder: 'Promemoria 24h',
  update_notification: 'Spostamento',
  cancel_notification: 'Cancellazione',
  recap: 'Recap (in composizione)',
};

export const SCHEDULED_TYPE_ICONS: Record<WhatsappScheduledType, string> = {
  reminder: 'alarm',
  update_notification: 'event_repeat',
  cancel_notification: 'event_busy',
  recap: 'playlist_add_check',
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
};

export const TEMPLATE_TYPE_LABELS: Record<WhatsappTemplateType, string> = {
  RECAP_SINGLE: 'Recap Singolo',
  RECAP_MULTI: 'Recap Multiplo',
  REMINDER_24H: 'Promemoria 24h',
  CANCELLATION: 'Cancellazione',
  UPDATE: 'Modifica appuntamento',
};

export interface WhatsappTestResult {
  success: boolean;
  message?: string;
  data?: any;
}

export const TEMPLATE_VARIABLES: Record<WhatsappTemplateType, string[]> = {
  RECAP_SINGLE: ['{name}', '{date}', '{time}'],
  RECAP_MULTI: ['{name}', '{appointments}'],
  REMINDER_24H: ['{name}', '{time}'],
  CANCELLATION: ['{name}', '{date}', '{time}'],
  UPDATE: ['{name}', '{date}', '{time}'],
};
