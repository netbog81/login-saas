export interface WhatsappConfig {
  id: string;
  gatewayUrl: string;
  tenantApiId: string;
  maskedApiKey: string;
  isActive: boolean;
  sendCancelNotification: boolean;
  retentionDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappConfigInput {
  gatewayUrl: string;
  tenantApiId: string;
  apiKey?: string;
  webhookSecret?: string;
  isActive?: boolean;
  sendCancelNotification?: boolean;
  retentionDays?: number;
}

export type WhatsappTemplateType = 'RECAP_SINGLE' | 'RECAP_MULTI' | 'REMINDER_24H' | 'CANCELLATION';

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

export type WhatsappMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type WhatsappMessageType = 'recap_single' | 'recap_multi' | 'reminder_24h' | 'cancellation';

export interface WhatsappMessageLog {
  id: string;
  appointmentId?: string;
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
  pending: 'In attesa',
  sent: 'Inviato',
  delivered: 'Consegnato',
  read: 'Letto',
  failed: 'Errore',
};

export const MESSAGE_STATUS_ICONS: Record<WhatsappMessageStatus, string> = {
  pending: 'schedule',
  sent: 'send',
  delivered: 'done',
  read: 'done_all',
  failed: 'error',
};

export const MESSAGE_TYPE_LABELS: Record<WhatsappMessageType, string> = {
  recap_single: 'Recap singolo',
  recap_multi: 'Recap multiplo',
  reminder_24h: 'Promemoria 24h',
  cancellation: 'Cancellazione',
};

export const TEMPLATE_TYPE_LABELS: Record<WhatsappTemplateType, string> = {
  RECAP_SINGLE: 'Recap Singolo',
  RECAP_MULTI: 'Recap Multiplo',
  REMINDER_24H: 'Promemoria 24h',
  CANCELLATION: 'Cancellazione',
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
};
