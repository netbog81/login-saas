import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Operator } from './operator.entity';
import { Service } from './service.entity';

@ObjectType()
@Entity('operator_services')
export class OperatorService {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  operatorId: string;

  @Field(() => ID)
  @PrimaryColumn('uuid')
  serviceId: string;

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  customDuration?: number; // Override default service duration

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  customBufferTime?: number; // Override default buffer time

  // Relations
  @Field(() => Operator)
  @ManyToOne(() => Operator, operator => operator.services, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  @Field(() => Service)
  @ManyToOne(() => Service, service => service.operators, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service: Service;
}