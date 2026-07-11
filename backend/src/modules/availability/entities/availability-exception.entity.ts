import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { Operator } from './operator.entity';
import { GroupException } from './group-exception.entity';
import { AbsenceTypeSnapshot } from './gym-exception.entity';

export enum ExceptionType {
  UNAVAILABLE = 'unavailable',
  MODIFIED = 'modified',
  HOLIDAY = 'holiday',
  SICK = 'sick',
  VACATION = 'vacation',
  PERSONAL_LEAVE = 'personal_leave'
}

registerEnumType(ExceptionType, {
  name: 'ExceptionType',
  description: 'Type of availability exception',
});

/**
 * Eccezione di disponibilità per operatore/medico.
 *
 * NB: fino alla migration 1802 esisteva UNIQUE(operatorId, exceptionDate) —
 * una sola eccezione al giorno. Rimosso per supportare la granularità a
 * fascia oraria/slot (più eccezioni con finestre diverse nello stesso
 * giorno). L'anti-sovrapposizione è garantita a livello di service.
 */
@ObjectType()
@Entity('availability_exceptions')
@Index(['operatorId', 'exceptionDate'])
export class AvailabilityException {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  /**
   * Esposta come String (YYYY-MM-DD), NON DateTime: TypeORM idrata le
   * colonne Postgres `date` come stringhe e GraphQLISODateTime.serialize
   * restituisce null per tutto ciò che non è instanceof Date → il campo
   * non-nullable faceva collassare l'intera query (stesso pattern di
   * AvailabilityAppointment.appointmentDate e delle entità palestra).
   */
  @Field(() => String, { description: 'Data eccezione in formato YYYY-MM-DD' })
  @Column('date')
  exceptionDate: Date;

  @Field(() => ExceptionType)
  @Column({
    type: 'enum',
    enum: ExceptionType
  })
  exceptionType: ExceptionType;

  // For modified availability (NULL if completely unavailable)
  @Field({ nullable: true })
  @Column('time', { nullable: true })
  startTime?: string;

  @Field({ nullable: true })
  @Column('time', { nullable: true })
  endTime?: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  groupExceptionId?: string;

  /**
   * Reference soft al tipo di assenza configurabile (OperatorAbsenceType).
   * Non FK: la cancellazione del tipo non deve toccare le eccezioni storiche
   * — lo snapshot sotto preserva l'informazione (stesso pattern palestra).
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  absenceTypeId?: string;

  @Field(() => AbsenceTypeSnapshot, { nullable: true })
  @Column('jsonb', { nullable: true })
  absenceTypeSnapshot?: AbsenceTypeSnapshot;

  /**
   * Lega le eccezioni create in un colpo solo (range dal…al e/o più
   * operatori) per la cancellazione di gruppo. Diverso da groupExceptionId
   * (GroupException legacy, singola data).
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  sourceGroupId?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  reason?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  // Relations
  /**
   * Nullable in GraphQL: le mutation possono restituire l'entity appena
   * salvata senza la relazione caricata — con il campo non-nullable Apollo
   * esplodeva con "Cannot return null for non-nullable field".
   */
  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, operator => operator.availabilityExceptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  @Field(() => GroupException, { nullable: true })
  @ManyToOne(() => GroupException, groupException => groupException.exceptions, { nullable: true })
  @JoinColumn({ name: 'groupExceptionId' })
  groupException?: GroupException;
}