import {
  Entity, Column, PrimaryGeneratedColumn, OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { RolePermission } from './role-permission.entity';
import { UserRole } from './user-role.entity';

@ObjectType()
@Entity('roles')
export class Role {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 100, unique: true })
  name: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field()
  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field(() => [RolePermission], { nullable: true })
  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions?: RolePermission[];

  @Field(() => [UserRole], { nullable: true })
  @OneToMany(() => UserRole, (ur) => ur.role)
  userRoles?: UserRole[];
}
