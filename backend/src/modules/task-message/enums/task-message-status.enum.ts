import { registerEnumType } from '@nestjs/graphql';

export enum TaskMessageStatus {
  SCHEDULED = 'SCHEDULED',
  AVAILABLE = 'AVAILABLE',
  READ = 'READ',
  COMPLETED = 'COMPLETED',
  DELETED = 'DELETED',
}

registerEnumType(TaskMessageStatus, {
  name: 'TaskMessageStatus',
  description: 'Stato del task message',
});
