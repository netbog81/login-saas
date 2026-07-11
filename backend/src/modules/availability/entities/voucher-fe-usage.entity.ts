import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

/**
 * Storico movimenti di un VoucherFe (PARTE 4.3). Append-only.
 *
 * - issue       : emissione (credito iniziale)
 * - consumption : utilizzo su un trattamento sconto FE (scala residuo)
 * - reversal    : storno di un consumo (ripristina residuo)
 * - adjustment  : modifica manuale dell'importo (iniziale o residuo)
 */
@ObjectType('VoucherFeUsage')
@Entity('voucher_fe_usages')
@Index('IDX_voucher_fe_usages_voucher', ['voucherFeId'])
export class VoucherFeUsage {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  voucherFeId: string;

  /** issue | consumption | reversal */
  @Field()
  @Column({ length: 20 })
  type: string;

  /** Importo del movimento (sempre positivo; il segno è dato dal type). */
  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  /** Residuo dopo questo movimento (snapshot). */
  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  residualAfter: number;

  /** Trattamento collegato (per consumption/reversal). */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  treatmentId?: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  createdByUserId?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
