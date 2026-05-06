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
 * Prodotto vendibile dalla segreteria (vendita rapida).
 * Modello minimo: niente inventory tracking, fornitori o scorte (roadmap).
 *
 * Sync verso accounting via `product.upserted` / `product.deleted` events.
 * UNIQUE su `productCode` (lo schema isola già il tenant, no organizationId).
 */
@ObjectType('Product')
@Entity('products')
@Index('IDX_products_code', ['productCode'], { unique: true })
@Index('IDX_products_is_active', ['isActive'])
export class Product {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 30 })
  productCode: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  description?: string;

  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  defaultPrice: number;

  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  category?: string;

  @Field()
  @Column({ default: true })
  isActive: boolean;

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
