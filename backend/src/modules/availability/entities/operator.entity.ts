import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { AvailabilityTemplate } from './availability-template.entity';
import { AvailabilityException } from './availability-exception.entity';
import { Appointment } from './appointment.entity';
import { OperatorService } from './operator-service.entity';

export enum OperatorType {
  STANDARD = 'standard',
  GYM = 'gym',
  RESOURCE = 'resource'
}

registerEnumType(OperatorType, {
  name: 'OperatorType',
  description: 'Type of operator defining booking behavior',
});

@ObjectType()
@Entity('operators')
export class Operator {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  surname?: string;

  @Field({ nullable: true })
  @Column({ length: 255, unique: true, nullable: true })
  email?: string;

  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  phone?: string;

  @Field({ nullable: true })
  @Column({ length: 7, nullable: true })
  color?: string;

  @Field(() => OperatorType)
  @Column({
    type: 'enum',
    enum: OperatorType,
    default: OperatorType.STANDARD
  })
  operatorType: OperatorType;

  @Field(() => Int)
  @Column({ default: 1 })
  maxConcurrentAppointments: number;

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
  @Field(() => [AvailabilityTemplate], { nullable: true })
  @OneToMany(() => AvailabilityTemplate, template => template.operator)
  availabilityTemplates?: AvailabilityTemplate[];

  @Field(() => [AvailabilityException], { nullable: true })
  @OneToMany(() => AvailabilityException, exception => exception.operator)
  availabilityExceptions?: AvailabilityException[];

  @Field(() => [Appointment], { nullable: true })
  @OneToMany(() => Appointment, appointment => appointment.operator)
  appointments?: Appointment[];

  @Field(() => [OperatorService], { nullable: true })
  @OneToMany(() => OperatorService, operatorService => operatorService.operator)
  services?: OperatorService[];
}