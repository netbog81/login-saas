import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, Int } from '@nestjs/graphql';

/**
 * CONTI FE — impostazioni dei periodi standard (una riga per tenant,
 * DB-per-tenant quindi al più una riga in tabella).
 *
 *  - CALENDAR_MONTH: dal 1° all'ultimo giorno del mese.
 *  - CUTOFF: dal giorno (cutoffDay+1) del mese precedente al cutoffDay del
 *    mese corrente (es. cutoffDay=25 → 26/05→25/06, 26/06→25/07, …).
 *
 * Il backend NON deriva le date dal periodMode: analisi e generazione
 * ricevono sempre from/to espliciti; i periodi standard sono calcolati dal
 * frontend (stessa scelta dell'accounting).
 */
@ObjectType('OperatorFeAccountSettings')
@Entity('operator_fe_account_settings')
export class OperatorFeAccountSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'varchar', length: 20, default: 'CALENDAR_MONTH' })
  periodMode: 'CALENDAR_MONTH' | 'CUTOFF';

  @Field(() => Int)
  @Column({ type: 'int', default: 25 })
  cutoffDay: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
