import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Operator } from './operator.entity';

@ObjectType()
@Entity('availability_templates')
@Index(['operatorId', 'isCurrent'])
@Index(['validFrom', 'validUntil'])
export class AvailabilityTemplate {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  name?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  description?: string;

  // Pattern configuration
  @Field(() => Int)
  @Column()
  dayInPattern: number;

  @Field(() => Int)
  @Column()
  patternDuration: number;

  @Field()
  @Column('date')
  patternStartDate: Date;

  // Time slots
  @Field()
  @Column('time')
  startTime: string;

  @Field()
  @Column('time')
  endTime: string;

  // Versioning
  @Field(() => Int)
  @Column({ default: 1 })
  version: number;

  @Field()
  @Column({ default: true })
  isCurrent: boolean;

  @Field()
  @Column('date')
  validFrom: Date;

  @Field({ nullable: true })
  @Column('date', { nullable: true })
  validUntil?: Date;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @Field(() => Operator)
  @ManyToOne(() => Operator, operator => operator.availabilityTemplates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;
}