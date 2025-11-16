import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToMany, JoinTable, CreateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { AvailabilityException } from './availability-exception.entity';
import { Operator } from './operator.entity';

@ObjectType()
@Entity('group_exceptions')
export class GroupException {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field()
  @Column('date')
  exceptionDate: Date;

  @Field()
  @Column({ length: 50 })
  exceptionType: string;

  @Field()
  @Column({ default: false })
  appliesToAll: boolean;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  reason?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @Field(() => [AvailabilityException], { nullable: true })
  @OneToMany(() => AvailabilityException, exception => exception.groupException)
  exceptions?: AvailabilityException[];

  @Field(() => [Operator], { nullable: true })
  @ManyToMany(() => Operator)
  @JoinTable({
    name: 'group_exception_operators',
    joinColumn: { name: 'groupExceptionId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'operatorId', referencedColumnName: 'id' }
  })
  operators?: Operator[];
}