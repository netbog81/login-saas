import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GymException } from './gym-exception.entity';
import { Operator } from './operator.entity';
import { GymRoom } from './gym-room.entity';

/**
 * GymExceptionSubstitute - Sostituzione per singolo slot all'interno di una
 * GymException di tipo OPERATOR_ABSENT.
 *
 * Ogni riga rappresenta uno degli slot originali dell'operatore assente
 * (derivato dai GymTemplatePattern), e può avere:
 * - substituteOperatorId valorizzato → slot coperto da un sostituto specifico
 * - substituteOperatorId NULL → slot scoperto (gli appuntamenti in quella
 *   fascia verranno marcati come conflitti nella pagina /conflicts)
 *
 * Nota: il campo startTime/endTime/gymRoomId replica lo slot originale del
 * pattern al momento della creazione dell'eccezione. È una fotografia, non un
 * riferimento dinamico: se il pattern cambia successivamente, la riga qui non
 * si aggiorna automaticamente.
 */
@ObjectType()
@Entity('gym_exception_substitutes')
@Index(['gymExceptionId'])
export class GymExceptionSubstitute {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  gymExceptionId: string;

  /**
   * Palestra in cui lo slot era originariamente schedulato (derivato dal
   * GymTemplatePattern dell'operatore assente).
   */
  @Field(() => ID)
  @Column('uuid')
  gymRoomId: string;

  @Field()
  @Column('time')
  startTime: string;

  @Field()
  @Column('time')
  endTime: string;

  /**
   * Sostituto scelto (NULL = slot scoperto o chiuso esplicito).
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  substituteOperatorId?: string;

  /**
   * Marker esplicito di "palestra chiusa" per questo slot.
   * - false (default): slot scoperto/dimenticato. Se ci sono appuntamenti
   *   esistenti, vengono marcati come conflitto OPERATOR_UNAVAILABLE.
   * - true: l'utente ha scelto esplicitamente di non assegnare nessun
   *   sostituto (palestra chiusa per quella fascia). Stessa semantica di
   *   indisponibilità a livello di nuove prenotazioni, ma conflictReason
   *   diverso (OPERATOR_UNAVAILABLE comunque, ma testo dedicato).
   * Nota: ha senso solo quando substituteOperatorId è NULL.
   */
  @Field()
  @Column({ default: false })
  isClosed: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => GymException, (ex) => ex.substitutes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gymExceptionId' })
  gymException: GymException;

  @Field(() => GymRoom)
  @ManyToOne(() => GymRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gymRoomId' })
  gymRoom: GymRoom;

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'substituteOperatorId' })
  substituteOperator?: Operator;
}
