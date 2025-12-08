import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { GymRoom } from './gym-room.entity';
import { GymTemplatePattern } from './gym-template-pattern.entity';

/**
 * GymPatternGroup - Template settimanale per una palestra
 * Rappresenta un ciclo completo di orari (es: "Template Settimanale Palestra 1")
 * con le fasce orarie e gli operatori assegnati
 */
@ObjectType()
@Entity('gym_pattern_groups')
@Index(['gymRoomId'])
@Index(['gymRoomId', 'isCurrent'], { where: '"isCurrent" = true' })
export class GymPatternGroup {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  gymRoomId: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  description?: string;

  /**
   * Durata del ciclo in giorni (default 7 = settimanale)
   */
  @Field(() => Int)
  @Column({ default: 7 })
  patternDuration: number;

  /**
   * Data di inizio del pattern (per calcolare dayInPattern)
   * Formato: YYYY-MM-DD
   */
  @Field(() => String)
  @Column('date')
  patternStartDate: Date;

  /**
   * Se il template è attivo (può essere usato)
   */
  @Field()
  @Column({ default: true })
  isActive: boolean;

  /**
   * Se questo è il template corrente per la palestra
   */
  @Field()
  @Column({ default: true })
  isCurrent: boolean;

  /**
   * Versione del template (per tracciare modifiche)
   */
  @Field(() => Int)
  @Column({ default: 1 })
  version: number;

  /**
   * Data inizio validità del template
   * Formato: YYYY-MM-DD
   */
  @Field(() => String)
  @Column('date')
  validFrom: Date;

  /**
   * Data fine validità del template (null = infinita)
   * Formato: YYYY-MM-DD
   */
  @Field(() => String, { nullable: true })
  @Column('date', { nullable: true })
  validUntil?: Date;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @Field(() => GymRoom)
  @ManyToOne(() => GymRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gymRoomId' })
  gymRoom: GymRoom;

  @Field(() => [GymTemplatePattern], { nullable: true })
  @OneToMany(() => GymTemplatePattern, pattern => pattern.patternGroup)
  patterns?: GymTemplatePattern[];
}
