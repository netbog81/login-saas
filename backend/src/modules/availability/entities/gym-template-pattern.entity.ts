import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { GymPatternGroup } from './gym-pattern-group.entity';
import { Operator } from './operator.entity';

/**
 * GymTemplatePattern - Singola fascia oraria nel template palestra
 * Rappresenta l'assegnazione di un operatore a una fascia oraria
 * in un determinato giorno del ciclo settimanale
 */
@ObjectType()
@Entity('gym_template_patterns')
@Index(['gymPatternGroupId'])
@Index(['gymPatternGroupId', 'dayInPattern'])
@Index(['operatorId'])
export class GymTemplatePattern {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  gymPatternGroupId: string;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  /**
   * Giorno nel ciclo del pattern (0-6 per settimanale)
   * 0 = primo giorno del ciclo (tipicamente Lunedì)
   */
  @Field(() => Int)
  @Column()
  dayInPattern: number;

  /**
   * Orario di inizio della fascia
   */
  @Field()
  @Column('time')
  startTime: string;

  /**
   * Orario di fine della fascia
   */
  @Field()
  @Column('time')
  endTime: string;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @Field(() => GymPatternGroup)
  @ManyToOne(() => GymPatternGroup, group => group.patterns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gymPatternGroupId' })
  patternGroup: GymPatternGroup;

  @Field(() => Operator)
  @ManyToOne(() => Operator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;
}
