import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { Treatment } from './treatment.entity';
import { Service } from './service.entity';
import { Operator } from './operator.entity';
import { AppUser } from '../../users/entities/app-user.entity';

/**
 * TreatmentService - Tabella di collegamento per relazione ManyToMany
 * tra Treatment e Service.
 *
 * Permette di associare più servizi a un singolo trattamento,
 * con prezzo e durata specifici per ogni servizio eseguito.
 *
 * NOTA: I servizi del trattamento possono essere DIVERSI da quelli
 * dell'appuntamento originale. L'operatore può modificarli quando
 * arriva il paziente.
 */
@ObjectType('TreatmentService')
@Entity('treatment_services')
@Index('IDX_treatment_services_treatment', ['treatmentId'])
@Index('IDX_treatment_services_service', ['serviceId'])
export class TreatmentService {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== FOREIGN KEYS ====================

  @Field(() => ID)
  @Column('uuid')
  treatmentId: string;

  @Field(() => ID)
  @Column('uuid')
  serviceId: string;

  /**
   * @deprecated 2026-07-15 — NON usare per l'attribuzione dei compensi.
   * FK app_users.id, storicamente valorizzata da addTreatmentServiceLine con
   * l'utente LOGGATO (segreteria inclusa), quindi inquinata: le righe
   * aggiunte a mano risultavano "eseguite" da chi le inseriva. Sostituita
   * da `executorOperatorId` (FK operators.id). Mantenuta solo per lo
   * storico; non viene più scritta né letta.
   */
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  executedByOperatorId?: string;

  /**
   * 2026-07-15 — Operatore (operators.id) che ha materialmente eseguito
   * QUESTA riga quando diverso dall'operatore del trattamento. Scelto
   * esplicitamente in UI ("Eseguito da") all'aggiunta/modifica riga.
   * NULL = la riga è dell'operatore del trattamento (fallback).
   * Nel payload `treatment.closed.lines[]` diventa `executedByOperatorId`
   * (id clinico) + `executedByUserId` (sub Keycloak dell'operatore, se
   * collegato) per i conteggi accounting.
   */
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  executorOperatorId?: string;

  // ==================== SERVICE DATA ====================

  /**
   * Prezzo applicato per questo servizio in questo trattamento.
   * Può essere:
   * - service.defaultPrice (prezzo normale)
   * - service.discountFE (se scontoFE è attivo sul trattamento)
   * - Valore personalizzato inserito dall'operatore
   */
  @Field(() => Float, { nullable: true })
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price?: number;

  /**
   * Durata effettiva del servizio in questo trattamento.
   * Se null, usa la durata default del servizio.
   */
  @Field(() => Int, { nullable: true })
  @Column('int', { nullable: true })
  duration?: number;

  /**
   * Posizione ordinamento servizi nel trattamento.
   * Usato per drag & drop riordinamento.
   */
  @Field(() => Int)
  @Column('int', { default: 0 })
  orderPosition: number;

  /**
   * Indica se il prezzo è stato personalizzato manualmente dall'operatore.
   * - false (default): il prezzo segue la logica scontoFE/defaultPrice
   * - true: il prezzo è stato modificato a mano e non cambia col toggle scontoFE
   */
  @Field(() => Boolean)
  @Column('boolean', { default: false })
  isCustomPrice: boolean;

  /**
   * Descrizione della riga fattura personalizzata dall'utente.
   * Medici: compilata durante la chiusura (opzionale).
   * Segreteria: sempre editabile.
   *
   * Se null, il frontend userà `invoiceLineDescriptionAuto` (campo virtuale
   * ritornato dal resolver) come fallback.
   */
  @Field({ nullable: true })
  @Column('text', { nullable: true })
  invoiceLineDescription?: string;

  /**
   * Campo VIRTUALE (non persistito): descrizione auto-generata al volo
   * dal resolver combinando prefisso categoria + data + servizio + strumenti
   * + operatore + albo. Il frontend lo usa come placeholder/ripristino.
   */
  @Field({ nullable: true })
  invoiceLineDescriptionAuto?: string;

  // ==================== TIMESTAMPS ====================

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  // ==================== RELATIONS ====================

  @ManyToOne(() => Treatment, treatment => treatment.treatmentServices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treatmentId' })
  treatment: Treatment;

  @Field(() => Service)
  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Field(() => AppUser, { nullable: true })
  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'executedByOperatorId' })
  executedByOperator?: AppUser;

  /** Operatore esecutore esplicito della riga (vedi executorOperatorId). */
  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'executorOperatorId' })
  executorOperator?: Operator;
}
