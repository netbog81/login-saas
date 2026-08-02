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

  /**
   * Notifica al paziente lo spostamento di un appuntamento. A differenza della
   * cancellazione è attiva di default: uno spostamento riguarda sempre il
   * paziente. Quando è off il gateway riprogramma comunque il reminder 24h.
   */
  @Field()
  @Column({ default: true })
  sendUpdateNotification: boolean;

  /**
   * Finestra entro cui gli appuntamenti presi per lo stesso numero vengono
   * accorpati in un unico messaggio di recap (30-600s). Il conteggio riparte a
   * ogni nuovo appuntamento; il gateway non lo rinvia oltre 5 volte la finestra
   * (max 15 minuti).
   */
  @Field(() => Int)
  @Column({ type: 'int', default: 60 })
  recapBufferSeconds: number;

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
