import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, registerEnumType, GraphQLISODateTime } from '@nestjs/graphql';
import { GymRoom } from './gym-room.entity';
import { Operator } from './operator.entity';

/**
 * GymExceptionType - Tipo di eccezione per la palestra
 */
export enum GymExceptionType {
  CLOSED = 'closed',                    // Palestra chiusa (tutto il giorno o fascia oraria)
  OPERATOR_ABSENT = 'operator_absent',  // Operatore assente
  MODIFIED_HOURS = 'modified_hours'     // Orari modificati
}

registerEnumType(GymExceptionType, {
  name: 'GymExceptionType',
  description: 'Tipo di eccezione per la palestra',
});

/**
 * GymException - Eccezioni specifiche per la palestra
 * Gestisce chiusure, assenze operatori e modifiche orari
 */
@ObjectType()
@Entity('gym_exceptions')
@Index(['gymRoomId', 'exceptionDate'])
@Index(['operatorId', 'exceptionDate'])
export class GymException {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  gymRoomId: string;

  /**
   * Operatore specifico (opzionale - se null, l'eccezione vale per tutta la palestra)
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  operatorId?: string;

  /**
   * Data dell'eccezione
   * Formato: YYYY-MM-DD
   */
  @Field(() => String)
  @Column('date')
  exceptionDate: Date;

  /**
   * Orario inizio eccezione (se null = tutto il giorno)
   */
  @Field({ nullable: true })
  @Column('time', { nullable: true })
  startTime?: string;

  /**
   * Orario fine eccezione (se null = tutto il giorno)
   */
  @Field({ nullable: true })
  @Column('time', { nullable: true })
  endTime?: string;

  /**
   * Tipo di eccezione
   */
  @Field(() => GymExceptionType)
  @Column({
    type: 'enum',
    enum: GymExceptionType
  })
  exceptionType: GymExceptionType;

  /**
   * Operatore sostituto (se c'è una sostituzione)
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  substituteOperatorId?: string;

  /**
   * Motivo dell'eccezione
   */
  @Field({ nullable: true })
  @Column('text', { nullable: true })
  reason?: string;

  /**
   * Chi ha creato l'eccezione
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  createdBy?: string;

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

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operatorId' })
  operator?: Operator;

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'substituteOperatorId' })
  substituteOperator?: Operator;
}
