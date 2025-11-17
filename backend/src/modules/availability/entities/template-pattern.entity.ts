import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

/**
 * TemplatePattern - Generic reusable availability patterns
 * These are template definitions that can be assigned to multiple operators
 */
@ObjectType()
@Entity('template_patterns')
@Index(['name'])
export class TemplatePattern {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
}
