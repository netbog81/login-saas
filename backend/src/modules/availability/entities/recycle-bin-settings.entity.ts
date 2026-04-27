import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

/**
 * Configurazione del cestino, una riga per schema tenant.
 *
 * `retentionDays`:
 *  - null → conservazione indefinita (svuotamento solo manuale da admin)
 *  - >= 30 → gli elementi nel cestino più vecchi di N giorni sono eliminati
 *    definitivamente da un cron job giornaliero.
 *
 * Il vincolo di minimo 30 giorni è applicato a livello DB (CHECK) e non
 * può essere abbassato neanche da admin.
 */
@ObjectType('RecycleBinSettings')
@Entity('recycle_bin_settings')
export class RecycleBinSettings {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => Int, {
    nullable: true,
    description:
      'Giorni di retention nel cestino prima dell\'eliminazione definitiva. ' +
      'null = conservazione indefinita. Minimo 30 se impostato.',
  })
  @Column('int', { nullable: true })
  retentionDays?: number;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  updatedByUserId?: string;
}
