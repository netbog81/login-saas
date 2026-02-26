import {
  Entity, Column, PrimaryGeneratedColumn, OneToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { AppUser } from './app-user.entity';

@ObjectType()
@Entity('secretaries')
export class Secretary {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column({ name: 'app_user_id', type: 'uuid' })
  appUserId: string;

  @Field(() => AppUser)
  @OneToOne(() => AppUser, { eager: false })
  @JoinColumn({ name: 'app_user_id' })
  appUser: AppUser;

  @Field({ nullable: true })
  @Column({ length: 100, nullable: true })
  department?: string;

  @Field()
  @Column({ name: 'can_manage_appointments', default: false })
  canManageAppointments: boolean;

  @Field()
  @Column({ name: 'can_manage_billing', default: false })
  canManageBilling: boolean;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
