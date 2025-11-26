import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Service } from './service.entity';
import { InstrumentCategory } from './instrument-category.entity';

@ObjectType()
@Entity('service_instruments')
@Index('UQ_service_instruments_service_category', ['serviceId', 'instrumentCategoryId'], { unique: true })
export class ServiceInstrument {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'uuid' })
  serviceId: string;

  @Field(() => Service)
  @ManyToOne(() => Service, service => service.requiredInstruments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Field()
  @Column({ type: 'uuid' })
  instrumentCategoryId: string;

  @Field(() => InstrumentCategory)
  @ManyToOne(() => InstrumentCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instrumentCategoryId' })
  instrumentCategory: InstrumentCategory;

  @Field()
  @Column({ default: true })
  isRequired: boolean;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  orderPosition?: number; // 1, 2 for instrument order

  @Field(() => Int)
  @Column({ type: 'int', default: 1 })
  quantity: number; // how many instruments of this category are needed

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
