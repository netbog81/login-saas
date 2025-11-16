import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { OperatorService } from './operator-service.entity';
import { Appointment } from './appointment.entity';

@ObjectType()
@Entity('services')
export class Service {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field(() => Int)
  @Column()
  duration: number; // in minutes

  @Field(() => Int)
  @Column({ default: 0 })
  bufferTime: number; // cleanup time between appointments

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

  @Field(() => [Appointment], { nullable: true })
  @OneToMany(() => Appointment, appointment => appointment.service)
  appointments?: Appointment[];
}