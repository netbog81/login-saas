import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { WhatsappTemplateType } from '../../enums/whatsapp-enums';
import { NotificationChannel } from '../../notifications/entities/notification-channel-setting.entity';

@ObjectType('WhatsappMessageTemplate')
@Entity('whatsapp_message_templates')
@Unique('uq_template_type_channel', ['templateType', 'channel'])
export class WhatsappMessageTemplate {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => WhatsappTemplateType)
  @Column({
    type: 'enum',
    enum: WhatsappTemplateType,
  })
  templateType: WhatsappTemplateType;

  /**
   * Su quale canale vale questo testo.
   *
   * Lo stesso messaggio si scrive diverso a seconda di dove arriva: l'SMS
   * paga ogni carattere e non regge le righe multiple, l'email ha un oggetto
   * e puo' essere disteso, WhatsApp sta nel mezzo. Un testo unico avrebbe
   * costretto a scrivere per il canale piu' stretto e a sprecare gli altri.
   *
   * I template esistenti sono nati per WhatsApp e restano tali. Gli altri
   * canali si configurano solo se si usano: senza un testo proprio si ricade
   * su quello di WhatsApp, che e' sempre presente.
   */
  @Field(() => NotificationChannel)
  @Column({ length: 20, default: NotificationChannel.WHATSAPP })
  channel: NotificationChannel;

  @Field()
  @Column('text')
  bodyTemplate: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  footerTemplate?: string;

  /**
   * Oggetto del messaggio. Valorizzato solo per i template che viaggiano per
   * posta: WhatsApp non ha un oggetto, e mostrarne il campo su quei template
   * confonderebbe e basta.
   */
  @Field({ nullable: true })
  @Column('text', { nullable: true })
  subjectTemplate?: string;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
