import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GymSchedule } from './gym-schedule.entity';

@ObjectType()
@Entity('gym_rooms')
export class GymRoom {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field(() => Int)
  @Column({ default: 4 })
  maxCapacity: number;

  @Field(() => Int)
  @Column({ default: 60 })
  slotDuration: number; // in minutes

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
  @Field(() => [GymSchedule], { nullable: true })
  @OneToMany(() => GymSchedule, schedule => schedule.gymRoom)
  schedules?: GymSchedule[];
}
