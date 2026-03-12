import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { WhatsappTemplateType } from '../../enums/whatsapp-enums';

@ObjectType('WhatsappMessageTemplate')
@Entity('whatsapp_message_templates')
export class WhatsappMessageTemplate {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => WhatsappTemplateType)
  @Column({
    type: 'enum',
    enum: WhatsappTemplateType,
    unique: true,
  })
  templateType: WhatsappTemplateType;

  @Field()
  @Column('text')
  bodyTemplate: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  footerTemplate?: string;

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
