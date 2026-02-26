import {
  Entity, Column, PrimaryGeneratedColumn, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { AppUserType } from '../enums/app-user-type.enum';
import { UserRole } from './user-role.entity';
import { GraphQLJSONObject } from 'graphql-type-json';

@ObjectType()
@Entity('app_users')
@Index('IDX_app_users_keycloak_id', ['keycloakId'], { unique: true, where: '"keycloak_id" IS NOT NULL' })
@Index('IDX_app_users_email', ['email'])
@Index('IDX_app_users_user_type', ['userType'])
export class AppUser {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field({ nullable: true })
  @Column({ name: 'keycloak_id', type: 'varchar', length: 255, nullable: true })
  keycloakId?: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  surname?: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  email?: string;

  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  phone?: string;

  @Field(() => AppUserType)
  @Column({
    name: 'user_type',
    type: 'enum',
    enum: AppUserType,
  })
  userType: AppUserType;

  @Field()
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Field({ nullable: true })
  @Column({ name: 'linked_at', type: 'timestamp', nullable: true })
  linkedAt?: Date;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column({ type: 'jsonb', default: '{}' })
  attributes: Record<string, any>;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Field(() => [UserRole], { nullable: true })
  @OneToMany(() => UserRole, (userRole) => userRole.appUser)
  userRoles?: UserRole[];
}
