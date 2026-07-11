import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

/**
 * Voucher FE — voucher prepagato gestito INTERAMENTE nel clinico (PARTE 4.3).
 *
 * Usato come metodo di pagamento SOLO per i trattamenti con sconto FE attivo,
 * che non passano da accounting. Emesso per paziente in una sezione dedicata
 * del clinico. Nessun evento verso accounting, nessuna prima nota nel motore
 * contabile: è una scrittura puramente clinica/operativa.
 *
 * `patientId` = subjectId del registry (FK logica, niente FK fisica, come su
 * Treatment).
 */
@ObjectType('VoucherFe')
@Entity('voucher_fe')
@Index('IDX_voucher_fe_patient', ['patientId'])
export class VoucherFe {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Codice leggibile, es. "VFE-2026-0001". Univoco per tenant (schema). */
  @Field()
  @Column({ length: 50 })
  @Index('UQ_voucher_fe_code', { unique: true })
  code: string;

  /** subjectId del paziente intestatario. */
  @Field(() => ID)
  @Column('uuid')
  patientId: string;

  /** Importo prepagato iniziale (immutabile). */
  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  initialAmount: number;

  /** Residuo corrente. Cala a ogni consumo, risale su storno. */
  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  residualAmount: number;

  /** active | inactive (sospeso, reversibile) | depleted | expired | cancelled */
  @Field()
  @Column({ length: 20, default: 'active' })
  status: string;

  @Field({ nullable: true })
  @Column({ type: 'date', nullable: true })
  expiryDate?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes?: string;

  /** AppUser che ha emesso il voucher. */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  createdByUserId?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
