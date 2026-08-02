export enum TaskMessageStatus {
  SCHEDULED = 'SCHEDULED',
  AVAILABLE = 'AVAILABLE',
  READ = 'READ',
  COMPLETED = 'COMPLETED',
  DELETED = 'DELETED',
}

/** Gruppi destinatario (valori = enum GraphQL TaskMessageRecipientGroup) */
export type TaskMessageRecipientGroup = 'SECRETARY';

export const RECIPIENT_GROUP_LABELS: Record<TaskMessageRecipientGroup, string> = {
  SECRETARY: 'Segreteria',
};

export interface TaskMessageUser {
  id: string;
  name: string;
  surname?: string;
}

export interface TaskMessage {
  id: string;
  gatewayMessageId: string;
  tenantId: string;
  senderUserId: string;
  recipientUserId?: string | null;
  recipientGroup?: TaskMessageRecipientGroup | null;
  senderUser?: TaskMessageUser;
  recipientUser?: TaskMessageUser;
  readByUser?: TaskMessageUser | null;
  completedByUser?: TaskMessageUser | null;
  content: string;
  status: TaskMessageStatus;
  availableFrom?: string;
  readAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskMessagePage {
  items: TaskMessage[];
  total: number;
}

export interface TaskMessageResult {
  messageId: string;
  status: TaskMessageStatus;
}

export interface CreateTaskMessageInput {
  recipientUserId?: string;
  recipientGroup?: TaskMessageRecipientGroup;
  content: string;
  availableFrom?: string;
}

export interface UpdateTaskMessageInput {
  content?: string;
  availableFrom?: string;
}

export const STATUS_LABELS: Record<TaskMessageStatus, string> = {
  [TaskMessageStatus.SCHEDULED]: 'Schedulato',
  [TaskMessageStatus.AVAILABLE]: 'Disponibile',
  [TaskMessageStatus.READ]: 'Letto',
  [TaskMessageStatus.COMPLETED]: 'Completato',
  [TaskMessageStatus.DELETED]: 'Cancellato',
};

export const STATUS_ICONS: Record<TaskMessageStatus, string> = {
  [TaskMessageStatus.SCHEDULED]: 'schedule',
  [TaskMessageStatus.AVAILABLE]: 'mail',
  [TaskMessageStatus.READ]: 'visibility',
  [TaskMessageStatus.COMPLETED]: 'check_circle',
  [TaskMessageStatus.DELETED]: 'delete',
};

export const STATUS_COLORS: Record<TaskMessageStatus, string> = {
  [TaskMessageStatus.SCHEDULED]: '#ff9800',
  [TaskMessageStatus.AVAILABLE]: '#2196f3',
  [TaskMessageStatus.READ]: '#607d8b',
  [TaskMessageStatus.COMPLETED]: '#4caf50',
  [TaskMessageStatus.DELETED]: '#f44336',
};
