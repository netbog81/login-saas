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
import { TaskMessageRecipientGroup } from '../enums/task-message-recipient-group.enum';
import { AppUser } from '../../users/entities/app-user.entity';

@ObjectType('TaskMessage')
@Entity('task_message')
@Index('IDX_task_msg_tenant_recipient_status', ['tenantId', 'recipientUserId', 'status'])
@Index('IDX_task_msg_tenant_sender_status', ['tenantId', 'senderUserId', 'status'])
@Index('IDX_task_msg_tenant_group_status', ['tenantId', 'recipientGroup', 'status'])
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

  // Destinatario: esattamente uno tra recipientUserId (singolo) e
  // recipientGroup (tutti gli utenti attivi con quel user_type).
  @Field({ nullable: true })
  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId?: string | null;

  @Field(() => TaskMessageRecipientGroup, { nullable: true })
  @Column({ name: 'recipient_group', type: 'varchar', length: 50, nullable: true })
  recipientGroup?: TaskMessageRecipientGroup | null;

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
  @Column({ name: 'read_by_user_id', type: 'uuid', nullable: true })
  readByUserId?: string | null;

  @Field({ nullable: true })
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  @Column({ name: 'completed_by_user_id', type: 'uuid', nullable: true })
  completedByUserId?: string | null;

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

  @Field(() => AppUser, { nullable: true })
  @ManyToOne(() => AppUser, { nullable: true, eager: false })
  @JoinColumn({ name: 'read_by_user_id' })
  readByUser?: AppUser;

  @Field(() => AppUser, { nullable: true })
  @ManyToOne(() => AppUser, { nullable: true, eager: false })
  @JoinColumn({ name: 'completed_by_user_id' })
  completedByUser?: AppUser;
}
