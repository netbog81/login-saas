import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { Operator } from './operator.entity';
import { PatternGroup } from './pattern-group.entity';

/**
 * TemplateAssignment - Assigns a pattern group to an operator with validity dates
 * Represents the actual assignment of a complete pattern group to a specific operator
 */
@ObjectType()
@Entity('template_assignments')
@Index(['operatorId', 'isCurrent'])
@Index(['validFrom', 'validUntil'])
export class TemplateAssignment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  @Field(() => ID)
  @Column('uuid')
  patternGroupId: string;

  // Pattern start date for cyclic calculations
  @Field(() => GraphQLISODateTime)
  @Column('timestamp')
  patternStartDate: Date;

  // Validity period
  @Field(() => GraphQLISODateTime)
  @Column('timestamp')
  validFrom: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column('timestamp', { nullable: true })
  validUntil?: Date;

  // Versioning
  @Field(() => Int)
  @Column({ default: 1 })
  version: number;

  @Field()
  @Column({ default: true })
  isCurrent: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @Field(() => Operator)
  @ManyToOne(() => Operator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  @Field(() => PatternGroup)
  @ManyToOne(() => PatternGroup, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patternGroupId' })
  patternGroup: PatternGroup;
}
