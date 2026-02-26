import {
  Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@ObjectType()
@Entity('role_permissions')
export class RolePermission {
  @Field(() => ID)
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @Field(() => ID)
  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @Field(() => Role)
  @ManyToOne(() => Role, (role) => role.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Field(() => Permission)
  @ManyToOne(() => Permission, (perm) => perm.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;

  @Field()
  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt: Date;
}
