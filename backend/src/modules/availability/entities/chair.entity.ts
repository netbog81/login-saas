import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Room } from './room.entity';

/**
 * Poltrona (o riunito) all'interno di uno studio. La capacità effettiva di
 * uno studio ai fini dei conflitti di assegnazione è il numero delle sue
 * poltrone attive; se non ne ha, vale il campo capacity dello studio.
 */
@ObjectType()
@Entity('chairs')
@Index(['roomId'])
export class Chair {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  roomId: string;

  @Field()
  @Column({ length: 255 })
  name: string;

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

  @Field(() => Room, { nullable: true })
  @ManyToOne(() => Room, (room) => room.chairs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room?: Room;
}
