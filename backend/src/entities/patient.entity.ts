import { Entity, PrimaryGeneratedColumn, Column, OneToMany, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Appointment } from './appointment.entity';
import { GraphQLJSONObject } from 'graphql-type-json';

@ObjectType()
@Entity('patients')
export class Patient {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column()
  surname: string;

  @Field()
  @Column()
  phone: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  email: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string;

  /**
   * Contatore disdette per anno solare
   * Formato: { "2025": 3, "2024": 1 }
   */
  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column('jsonb', { default: {} })
  cancellationsByYear: Record<string, number>;

  /**
   * Contatore no-show per anno solare
   * Formato: { "2025": 2, "2024": 0 }
   */
  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column('jsonb', { default: {} })
  noShowsByYear: Record<string, number>;

  @OneToMany(() => Appointment, appointment => appointment.patient)
  appointments: Appointment[];

  @Field()
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Field({ nullable: true })
  @UpdateDateColumn()
  updatedAt: Date;
}
