import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { GymRoom } from './gym-room.entity';
import { Operator } from './operator.entity';

@ObjectType()
@Entity('gym_schedules')
@Index('IDX_gym_schedules_room_day', ['gymRoomId', 'dayOfWeek'])
@Index('IDX_gym_schedules_operator_day', ['operatorId', 'dayOfWeek'])
export class GymSchedule {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'uuid' })
  gymRoomId: string;

  @Field(() => GymRoom)
  @ManyToOne(() => GymRoom, gymRoom => gymRoom.schedules)
  @JoinColumn({ name: 'gymRoomId' })
  gymRoom: GymRoom;

  @Field()
  @Column({ type: 'uuid' })
  operatorId: string;

  @Field(() => Operator)
  @ManyToOne(() => Operator, operator => operator.gymSchedules)
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  @Field(() => Int)
  @Column({ type: 'int' })
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (or 0 = Monday based on your preference)

  @Field()
  @Column({ type: 'time' })
  startTime: string;

  @Field()
  @Column({ type: 'time' })
  endTime: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({
    type: 'date',
    nullable: true,
    transformer: {
      to: (value: Date | string | null) => value,
      from: (value: string | null) => value ? new Date(value + 'T00:00:00.000Z') : null,
    },
  })
  validFrom?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({
    type: 'date',
    nullable: true,
    transformer: {
      to: (value: Date | string | null) => value,
      from: (value: string | null) => value ? new Date(value + 'T00:00:00.000Z') : null,
    },
  })
  validUntil?: Date;

  @Field()
  @Column({ default: true })
  isCurrent: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
