import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { Treatment } from './treatment.entity';

/**
 * Riga di fatturazione custom inserita dalla segreteria su un trattamento.
 *
 * Le righe derivate dai servizi eseguiti vivono su TreatmentService
 * (campo `invoiceLineDescription`). Questa entità rappresenta invece
 * righe aggiuntive che la segreteria crea ad-hoc (es. maggiorazioni,
 * materiali di consumo, prestazioni fuori listino) prima di inviare
 * il trattamento al sistema di fatturazione.
 *
 * Entrambe le tipologie concorrono al totale della fattura ma sono
 * mostrate in UI in una sezione dedicata "Righe aggiuntive".
 */
@ObjectType('TreatmentInvoiceLine')
@Entity('treatment_invoice_lines')
@Index('IDX_treatment_invoice_lines_treatment', ['treatmentId'])
export class TreatmentInvoiceLine {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  treatmentId: string;

  @Field()
  @Column('text')
  description: string;

  @Field(() => Float)
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amount: number;

  /**
   * UUID di AppUser della segreteria che ha creato la riga.
   * Tracciato per audit ma nullable per tollerare eventuali import/script.
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  createdBy?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Treatment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treatmentId' })
  treatment: Treatment;
}
