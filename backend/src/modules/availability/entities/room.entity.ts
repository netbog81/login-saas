import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
@Entity('rooms')
export class Room {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field(() => Int)
  @Column({ default: 1 })
  capacity: number;

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
}
