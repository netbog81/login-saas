import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Operator } from './operator.entity';
import { TemplatePattern } from './template-pattern.entity';

/**
 * TemplateAssignment - Assigns a template pattern to an operator with validity dates
 * Represents the actual assignment of a pattern to a specific operator
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
  patternId: string;

  // Pattern start date for cyclic calculations
  @Field()
  @Column('date')
  patternStartDate: Date;

  // Validity period
  @Field()
  @Column('date')
  validFrom: Date;

  @Field({ nullable: true })
  @Column('date', { nullable: true })
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

  @Field(() => TemplatePattern)
  @ManyToOne(() => TemplatePattern, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patternId' })
  pattern: TemplatePattern;
}
