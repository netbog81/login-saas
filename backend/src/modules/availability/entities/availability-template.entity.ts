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

  // Le tre date qui sotto sono String, non DateTime: TypeORM idrata le
  // colonne `date` come stringhe e GraphQLISODateTime.serialize le rifiuta
  // (vedi utils/date-string.util.ts).
  @Field(() => String, { description: 'Data inizio pattern in formato YYYY-MM-DD' })
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

  @Field(() => String, { description: 'Data inizio validità in formato YYYY-MM-DD' })
  @Column('date')
  validFrom: Date;

  @Field(() => String, { nullable: true, description: 'Data fine validità in formato YYYY-MM-DD' })
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