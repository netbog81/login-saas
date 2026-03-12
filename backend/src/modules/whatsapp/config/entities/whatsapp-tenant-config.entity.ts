import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType('WhatsappTenantConfig')
@Entity('whatsapp_tenant_config')
export class WhatsappTenantConfig {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 500 })
  gatewayUrl: string;

  // Encrypted API key - NOT exposed via GraphQL
  @Column('text')
  apiKeyEncrypted: string;

  // Encrypted webhook secret - NOT exposed via GraphQL
  @Column('text', { nullable: true })
  webhookSecretEncrypted: string;

  @Field()
  @Column({ length: 255 })
  tenantApiId: string;

  @Field()
  @Column({ default: false })
  isActive: boolean;

  @Field()
  @Column({ default: false })
  sendCancelNotification: boolean;

  @Field(() => Int)
  @Column({ type: 'int', default: 730 })
  retentionDays: number;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual field populated by resolver (masked API key)
  @Field({ nullable: true })
  maskedApiKey?: string;
}
