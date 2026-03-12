import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { WhatsappMessageStatus, WhatsappMessageType } from '../../enums/whatsapp-enums';

@ObjectType('WhatsappMessageLog')
@Entity('whatsapp_message_logs')
@Index('IDX_whatsapp_message_logs_status', ['status'])
@Index('IDX_whatsapp_message_logs_appointment', ['appointmentId'])
@Index('IDX_whatsapp_message_logs_correlation', ['correlationId'])
@Index('IDX_whatsapp_message_logs_patient', ['patientId'])
@Index('IDX_whatsapp_message_logs_created', ['createdAt'])
@Index('IDX_wa_logs_anonymized', ['isAnonymized'])
export class WhatsappMessageLog {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  appointmentId?: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  patientId?: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  patientName?: string;

  @Field()
  @Column({ length: 50 })
  phoneNumber: string;

  @Field(() => WhatsappMessageType)
  @Column({
    type: 'enum',
    enum: WhatsappMessageType,
  })
  messageType: WhatsappMessageType;

  @Field(() => WhatsappMessageStatus)
  @Column({
    type: 'enum',
    enum: WhatsappMessageStatus,
    default: WhatsappMessageStatus.PENDING,
  })
  status: WhatsappMessageStatus;

  @Field()
  @Column('uuid')
  correlationId: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  evolutionMessageId?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  messageBody?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  errorMessage?: string;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  sentAt?: Date;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  deliveredAt?: Date;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  readAt?: Date;

  @Field()
  @Column({ default: false })
  isAnonymized: boolean;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  anonymizedAt?: Date;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
