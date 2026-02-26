import {
  Entity, Column, PrimaryGeneratedColumn, OneToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { AppUser } from './app-user.entity';

@ObjectType()
@Entity('it_managers')
export class ItManager {
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

  @Field()
  @Column({ name: 'can_manage_tenant', default: true })
  canManageTenant: boolean;

  @Field()
  @Column({ name: 'can_manage_integrations', default: true })
  canManageIntegrations: boolean;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
