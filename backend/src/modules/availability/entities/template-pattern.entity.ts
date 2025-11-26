import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { PatternGroup } from './pattern-group.entity';

/**
 * TemplatePattern - Individual time slot within a pattern group
 * Each pattern represents a single time slot on a specific day in the cycle
 */
@ObjectType()
@Entity('template_patterns')
@Index(['patternGroupId'])
@Index(['name'])
export class TemplatePattern {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  patternGroupId: string;

  @Field()
  @Column({ length: 255 })
  name: string;

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

  // Time slots
  @Field()
  @Column('time')
  startTime: string;

  @Field()
  @Column('time')
  endTime: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @Field(() => PatternGroup)
  @ManyToOne(() => PatternGroup, group => group.patterns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patternGroupId' })
  patternGroup: PatternGroup;
}
