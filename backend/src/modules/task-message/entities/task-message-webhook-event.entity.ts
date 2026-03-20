import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType('TaskMessageWebhookEvent')
@Entity('task_message_webhook_event')
@Index('IDX_task_webhook_tenant', ['tenantId'])
@Index('IDX_task_webhook_type', ['eventType'])
export class TaskMessageWebhookEvent {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ name: 'tenant_id', length: 100 })
  tenantId: string;

  @Field({ nullable: true })
  @Column({ name: 'correlation_id', type: 'uuid', nullable: true })
  correlationId?: string;

  @Field()
  @Column({ name: 'event_type', length: 100 })
  eventType: string;

  @Field(() => GraphQLJSON)
  @Column({ name: 'raw_event', type: 'jsonb' })
  rawEvent: any;

  @Field()
  @Column({ default: false })
  processed: boolean;

  @Field({ nullable: true })
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
