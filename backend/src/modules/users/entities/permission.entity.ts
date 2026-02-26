import {
  Entity, Column, PrimaryGeneratedColumn, OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { RolePermission } from './role-permission.entity';

@ObjectType()
@Entity('permissions')
export class Permission {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 100, unique: true })
  name: string;

  @Field({ nullable: true })
  @Column({ name: 'resource_type', length: 50, nullable: true })
  resourceType?: string;

  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  action?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field(() => [RolePermission], { nullable: true })
  @OneToMany(() => RolePermission, (rp) => rp.permission)
  rolePermissions?: RolePermission[];
}
