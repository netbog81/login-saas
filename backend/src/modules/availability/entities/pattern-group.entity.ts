import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { TemplatePattern } from './template-pattern.entity';

/**
 * PatternGroup - Logical grouping of related template patterns
 * Represents a complete schedule pattern (e.g., "Weekly Mon-Fri 9-18")
 * that consists of multiple individual time slots
 */
@ObjectType()
@Entity('pattern_groups')
@Index(['name'])
export class PatternGroup {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  description?: string;

  @Field(() => Int)
  @Column()
  patternDuration: number; // Total days in cycle (e.g., 7 for weekly, 14 for biweekly)

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @Field(() => [TemplatePattern], { nullable: true })
  @OneToMany(() => TemplatePattern, (pattern) => pattern.patternGroup)
  patterns?: TemplatePattern[];
}
