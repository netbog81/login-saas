import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { TaskMessageStatus } from '../enums/task-message-status.enum';
import { AppUser } from '../../users/entities/app-user.entity';

@ObjectType('TaskMessage')
@Entity('task_message')
@Index('IDX_task_msg_tenant_recipient_status', ['tenantId', 'recipientUserId', 'status'])
@Index('IDX_task_msg_tenant_sender_status', ['tenantId', 'senderUserId', 'status'])
@Index('IDX_task_msg_gateway_id', ['gatewayMessageId'], { unique: true })
@Index('IDX_task_msg_correlation', ['correlationId'])
export class TaskMessage {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ name: 'gateway_message_id', type: 'uuid' })
  gatewayMessageId: string;

  @Field()
  @Column({ name: 'tenant_id', length: 100 })
  tenantId: string;

  @Field()
  @Column({ name: 'sender_user_id', type: 'uuid' })
  senderUserId: string;

  @Field()
  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId: string;

  @Field()
  @Column('text')
  content: string;

  @Field(() => TaskMessageStatus)
  @Column({
    type: 'varchar',
    length: 20,
    default: TaskMessageStatus.SCHEDULED,
  })
  status: TaskMessageStatus;

  @Field({ nullable: true })
  @Column({ name: 'available_from', type: 'timestamptz', nullable: true })
  availableFrom?: Date;

  @Field({ nullable: true })
  @Column({ name: 'correlation_id', type: 'uuid', nullable: true })
  correlationId?: string;

  @Field({ nullable: true })
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;

  @Field({ nullable: true })
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relazioni (risolte via @ResolveField nel resolver)
  @Field(() => AppUser, { nullable: true })
  @ManyToOne(() => AppUser, { nullable: true, eager: false })
  @JoinColumn({ name: 'sender_user_id' })
  senderUser?: AppUser;

  @Field(() => AppUser, { nullable: true })
  @ManyToOne(() => AppUser, { nullable: true, eager: false })
  @JoinColumn({ name: 'recipient_user_id' })
  recipientUser?: AppUser;
}
