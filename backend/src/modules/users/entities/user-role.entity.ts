import {
  Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, PrimaryColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { AppUser } from './app-user.entity';
import { Role } from './role.entity';

@ObjectType()
@Entity('user_roles')
export class UserRole {
  @Field(() => ID)
  @PrimaryColumn({ name: 'app_user_id', type: 'uuid' })
  appUserId: string;

  @Field(() => ID)
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @Field(() => AppUser)
  @ManyToOne(() => AppUser, (user) => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_user_id' })
  appUser: AppUser;

  @Field(() => Role)
  @ManyToOne(() => Role, (role) => role.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Field()
  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt: Date;
}
