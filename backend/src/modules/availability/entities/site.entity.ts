import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Sede operativa dello studio. Multi-tenant per schema (nessuna colonna
 * organization_id: lo schema isola il tenant). Viene popolata dalla migration
 * con un singolo "Studio principale" per tenant; multi-sede reale è
 * abilitata appena la UI espone il campo.
 *
 * Usato come `siteId` nei payload `treatment.closed` / `treatment.amended` /
 * `sale.completed` verso accounting (numerazione fattura per sede).
 */
@ObjectType('Site')
@Entity('sites')
export class Site {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  address?: string;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
