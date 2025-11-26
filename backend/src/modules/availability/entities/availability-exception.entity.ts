import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Unique, Index } from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { Operator } from './operator.entity';
import { GroupException } from './group-exception.entity';

export enum ExceptionType {
  UNAVAILABLE = 'unavailable',
  MODIFIED = 'modified',
  HOLIDAY = 'holiday',
  SICK = 'sick',
  VACATION = 'vacation',
  PERSONAL_LEAVE = 'personal_leave'
}

registerEnumType(ExceptionType, {
  name: 'ExceptionType',
  description: 'Type of availability exception',
});

@ObjectType()
@Entity('availability_exceptions')
@Unique(['operatorId', 'exceptionDate'])
@Index(['operatorId', 'exceptionDate'])
export class AvailabilityException {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  @Field()
  @Column('date')
  exceptionDate: Date;

  @Field(() => ExceptionType)
  @Column({
    type: 'enum',
    enum: ExceptionType
  })
  exceptionType: ExceptionType;

  // For modified availability (NULL if completely unavailable)
  @Field({ nullable: true })
  @Column('time', { nullable: true })
  startTime?: string;

  @Field({ nullable: true })
  @Column('time', { nullable: true })
  endTime?: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  groupExceptionId?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  reason?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @Field(() => Operator)
  @ManyToOne(() => Operator, operator => operator.availabilityExceptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  @Field(() => GroupException, { nullable: true })
  @ManyToOne(() => GroupException, groupException => groupException.exceptions, { nullable: true })
  @JoinColumn({ name: 'groupExceptionId' })
  groupException?: GroupException;
}