import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

/**
 * GeneralSettings - Impostazioni generali del sistema
 *
 * Tabella key-value per configurazioni dinamiche:
 * - waitingRoom.enabled: boolean - Abilita conferma arrivo in sala d'attesa
 * - waitingRoom.method: string - Metodo: 'manual' o 'qrcode'
 * - whatsapp.enabled: boolean - Abilita notifiche WhatsApp
 * - whatsapp.reminderHours: number - Ore prima per reminder
 */
@ObjectType()
@Entity('general_settings')
export class GeneralSettings {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Chiave univoca dell'impostazione
   * Es: 'waitingRoom.enabled', 'whatsapp.reminderHours'
   */
  @Field()
  @Column({ length: 100, unique: true })
  key: string;

  /**
   * Valore dell'impostazione (JSON per flessibilità)
   */
  @Field(() => GraphQLJSONObject)
  @Column('jsonb')
  value: any;

  /**
   * Descrizione dell'impostazione
   */
  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  description?: string;

  /**
   * Tipo del valore per validazione frontend
   * 'string' | 'boolean' | 'number' | 'json'
   */
  @Field()
  @Column({ length: 50, default: 'string' })
  valueType: string;

  /**
   * Categoria/gruppo dell'impostazione per raggruppamento UI
   * Es: 'waitingRoom', 'whatsapp', 'notifications'
   */
  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  category?: string;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
