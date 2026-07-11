import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, UpdateDateColumn, Unique, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Operator } from './operator.entity';

@ObjectType()
@Entity('availability_cache')
@Unique(['operatorId', 'availableDate', 'startTime'])
@Index(['operatorId', 'availableDate'])
@Index(['availableDate', 'startTime'])
export class AvailabilityCache {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  // String, non DateTime: TypeORM idrata le colonne `date` come stringhe e
  // GraphQLISODateTime.serialize le rifiuta (vedi utils/date-string.util.ts).
  @Field(() => String, { description: 'Data disponibilità in formato YYYY-MM-DD' })
  @Column('date')
  availableDate: Date;

  @Field()
  @Column('time')
  startTime: string;

  @Field()
  @Column('time')
  endTime: string;

  @Field(() => Int)
  @Column({ default: 1 })
  totalCapacity: number;

  @Field(() => Int)
  @Column({ default: 0 })
  bookedCapacity: number;

  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  source?: string; // 'template', 'exception', 'override'

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  sourceId?: string;

  @Field()
  @UpdateDateColumn()
  lastUpdated: Date;

  // Relations
  @Field(() => Operator)
  @ManyToOne(() => Operator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  // Computed field
  @Field(() => Int)
  get availableCapacity(): number {
    return this.totalCapacity - this.bookedCapacity;
  }

  @Field()
  get isAvailable(): boolean {
    return this.availableCapacity > 0;
  }
}