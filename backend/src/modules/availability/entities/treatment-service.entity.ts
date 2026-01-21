import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { Treatment } from './treatment.entity';
import { Service } from './service.entity';

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
}
