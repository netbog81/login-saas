import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType('WhatsappWebhookEvent')
@Entity('whatsapp_webhook_events')
@Index('IDX_whatsapp_webhook_events_created', ['createdAt'])
@Index('IDX_whatsapp_webhook_events_type', ['eventType'])
export class WhatsappWebhookEvent {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 100 })
  eventType: string;

  @Field(() => GraphQLJSON)
  @Column('jsonb')
  rawPayload: any;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  correlationId?: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  tenantId?: string;

  @Field()
  @Column({ default: false })
  processed: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
