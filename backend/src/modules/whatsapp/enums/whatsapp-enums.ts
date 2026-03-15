import { registerEnumType } from '@nestjs/graphql';

export enum WhatsappMessageStatus {
  DISPATCHED = 'dispatched',
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum WhatsappMessageType {
  RECAP_SINGLE = 'recap_single',
  RECAP_MULTI = 'recap_multi',
  REMINDER_24H = 'reminder_24h',
  CANCELLATION = 'cancellation',
}

export enum WhatsappTemplateType {
  RECAP_SINGLE = 'RECAP_SINGLE',
  RECAP_MULTI = 'RECAP_MULTI',
  REMINDER_24H = 'REMINDER_24H',
  CANCELLATION = 'CANCELLATION',
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
