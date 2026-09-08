import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Come si è chiusa una sottoscrizione. Serve a distinguere chi si è tolto da
 * solo — che è un segnale sul messaggio, non un problema tecnico — da chi è
 * stato tolto dallo studio o da una pulizia periodica.
 */
export enum PatientCalendarFeedRevokedBy {
  /** Il paziente stesso, dal link in fondo alla mail. */
  PATIENT = 'patient',
  /** La segreteria, dalla scheda del paziente. */
  STAFF = 'staff',
  /** Una revoca in blocco dall'amministrazione. */
  SYSTEM = 'system',
}

/**
 * Sottoscrizione di un paziente al calendario dei propri appuntamenti.
 *
 * Il paziente riceve una volta sola un link e da lì in poi il suo calendario
 * si aggiorna da sé: niente mail a ogni spostamento. È il motivo per cui si è
 * scelta la sottoscrizione invece degli inviti iMIP, che avrebbero significato
 * una mail per appuntamento e una a ogni modifica.
 *
 * IL TOKEN È UNA CREDENZIALE: chi ce l'ha legge quando quella persona va dal
 * medico. Per questo il feed non espone mai nomi né prestazioni (solo la sede),
 * il token sparisce dalla tabella alla revoca invece di restare disattivato, e
 * ogni riga tiene le date che servono a rispondere a "chi ce l'ha ancora?".
 *
 * Una riga per paziente: la sottoscrizione è del paziente, non del singolo
 * appuntamento.
 */
@ObjectType('PatientCalendarFeed')
@Entity('patient_calendar_feeds')
export class PatientCalendarFeed {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Subject id nel registry: il clinico non conserva le anagrafiche. */
  @Field(() => ID)
  @Index({ unique: true })
  @Column('uuid')
  patientId: string;

  /**
   * Segreto del feed, 64 caratteri esadecimali. NON esposto via GraphQL:
   * esce solo dentro l'URL che si manda al paziente, e da nessun'altra parte.
   */
  @Column({ length: 64, nullable: true })
  token?: string;

  /**
   * Segreto separato per il link di disiscrizione.
   *
   * Distinto da `token` di proposito: così la pagina "annulla iscrizione" si
   * può aprire, inoltrare o lasciare aperta in un browser senza portarsi
   * dietro la credenziale che dà accesso al calendario.
   */
  @Column({ length: 64, nullable: true })
  unsubscribeToken?: string;

  @Field()
  @Column({ default: true })
  enabled: boolean;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /** Quando è partita la mail con il link. Null = non ancora inviata. */
  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  emailSentAt?: Date;

  /** Indirizzo a cui è stata mandata: serve a capire un mancato recapito. */
  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  emailSentTo?: string;

  /**
   * Prima lettura del feed da parte di un'app di calendario, cioè la
   * sottoscrizione VERA. È l'unico dato che distingue "gli abbiamo mandato il
   * link" da "ce l'ha davvero nel telefono": la mail può essere finita nello
   * spam, o il paziente può non aver mai completato i passaggi.
   */
  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  firstAccessAt?: Date;

  /** Ultima lettura: dice se il calendario si sta ancora aggiornando. */
  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  lastAccessAt?: Date;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  revokedAt?: Date;

  @Field(() => String, { nullable: true })
  @Column({ length: 20, nullable: true })
  revokedBy?: PatientCalendarFeedRevokedBy;
}
