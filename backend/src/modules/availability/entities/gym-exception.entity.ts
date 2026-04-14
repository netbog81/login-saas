import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import {
  ObjectType,
  Field,
  ID,
  registerEnumType,
  GraphQLISODateTime,
} from '@nestjs/graphql';
import { GymRoom } from './gym-room.entity';
import { Operator } from './operator.entity';
import { GymExceptionSubstitute } from './gym-exception-substitute.entity';

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
 * AbsenceTypeSnapshot - snapshot del tipo di assenza salvato al momento
 * della creazione dell'eccezione, per preservare le informazioni anche
 * se il record OperatorAbsenceType sorgente viene cancellato.
 */
@ObjectType()
export class AbsenceTypeSnapshot {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;
}

/**
 * GymException - Eccezioni specifiche per la palestra
 * Gestisce chiusure, assenze operatori e modifiche orari.
 *
 * Due modalità:
 * - **Palestra-scoped**: gymRoomId valorizzato, l'eccezione vale per quella
 *   singola palestra.
 * - **Operator-wide**: gymRoomId NULL + operatorId valorizzato, l'eccezione
 *   vale per tutte le palestre in cui l'operatore ha GymTemplatePattern quel
 *   giorno. Richiesto solo per OPERATOR_ABSENT. Le sostituzioni a slot vivono
 *   nella tabella figlia gym_exception_substitutes.
 */
@ObjectType()
@Entity('gym_exceptions')
@Index(['gymRoomId', 'exceptionDate'])
@Index(['operatorId', 'exceptionDate'])
export class GymException {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Palestra impattata. NULL = eccezione operator-wide che si applica a
   * tutte le palestre in cui l'operatore ha pattern quel giorno.
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  gymRoomId?: string;

  /**
   * Operatore specifico (opzionale - se null, l'eccezione vale per tutta la palestra).
   * Obbligatorio se gymRoomId è NULL (eccezione operator-wide).
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
   * Sostituto "modalità semplice" — retrocompatibilità con le eccezioni
   * create prima del refactor a sostituzioni per slot. Per le eccezioni
   * nuove, preferire la collezione `substitutes`.
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  substituteOperatorId?: string;

  /**
   * Reference soft al tipo di assenza. Non è una FK con ON DELETE CASCADE
   * perché vogliamo che la cancellazione del tipo NON cancelli le eccezioni
   * storiche — lo snapshot sotto preserva l'informazione.
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  absenceTypeId?: string;

  /**
   * Snapshot del tipo di assenza salvato al momento della creazione.
   * Sopravvive alla cancellazione del record OperatorAbsenceType.
   */
  @Field(() => AbsenceTypeSnapshot, { nullable: true })
  @Column('jsonb', { nullable: true })
  absenceTypeSnapshot?: AbsenceTypeSnapshot;

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
  @Field(() => GymRoom, { nullable: true })
  @ManyToOne(() => GymRoom, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gymRoomId' })
  gymRoom?: GymRoom;

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operatorId' })
  operator?: Operator;

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'substituteOperatorId' })
  substituteOperator?: Operator;

  /**
   * Sostituzioni per singolo slot (una riga per ogni slot originale
   * dell'operatore assente). Valorizzate solo per OPERATOR_ABSENT.
   */
  @Field(() => [GymExceptionSubstitute], { nullable: true })
  @OneToMany(() => GymExceptionSubstitute, (s) => s.gymException, {
    cascade: true,
  })
  substitutes?: GymExceptionSubstitute[];
}
