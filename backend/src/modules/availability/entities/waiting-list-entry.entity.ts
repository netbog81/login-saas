import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { Operator } from './operator.entity';

export enum WaitingListStatus {
  WAITING = 'waiting',
  CONTACTED = 'contacted',
  SCHEDULED = 'scheduled',
  REMOVED = 'removed',
}

registerEnumType(WaitingListStatus, {
  name: 'WaitingListStatus',
  description: 'Status of a waiting list entry',
});

@ObjectType('WaitingListEntry')
@Entity('waiting_list_entries')
@Index('IDX_waiting_list_status', ['status'])
@Index('IDX_waiting_list_priority_position', ['priority', 'position'])
export class WaitingListEntry {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  patientId: string | null;

  @Field()
  @Column({ length: 255 })
  patientName: string;

  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  phone: string | null;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  operatorId: string | null;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Field(() => Int)
  @Column({ type: 'int', default: 1 })
  priority: number;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  position: number;

  @Field(() => WaitingListStatus)
  @Column({
    type: 'enum',
    enum: WaitingListStatus,
    default: WaitingListStatus.WAITING,
  })
  status: WaitingListStatus;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // patientId è il subjectId del registry (FK logica, niente FK fisica
  // né relazione TypeORM). Field GraphQL esposto via WaitingListResolver.

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operatorId' })
  operator?: Operator;
}
