import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { OperatorService } from './operator-service.entity';
import { AvailabilityAppointment } from './availability-appointment.entity';

@ObjectType()
@Entity('services')
export class Service {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field(() => Int)
  @Column()
  defaultDuration: number; // in minutes

  @Field()
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  defaultPrice: number;

  @Field(() => Int)
  @Column({ default: 0 })
  bufferTimeBefore: number; // buffer time before appointment

  @Field(() => Int)
  @Column({ default: 0 })
  bufferTimeAfter: number; // buffer time after appointment

  @Field({ nullable: true })
  @Column({ length: 7, nullable: true })
  color?: string;

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
  @Field(() => [OperatorService], { nullable: true })
  @OneToMany(() => OperatorService, operatorService => operatorService.service)
  operators?: OperatorService[];

  @Field(() => [AvailabilityAppointment], { nullable: true })
  @OneToMany(() => AvailabilityAppointment, appointment => appointment.service)
  appointments?: AvailabilityAppointment[];
}