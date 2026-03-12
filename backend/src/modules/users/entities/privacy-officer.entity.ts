import {
  Entity, Column, PrimaryGeneratedColumn, OneToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { AppUser } from './app-user.entity';

@ObjectType()
@Entity('privacy_officers')
export class PrivacyOfficer {
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
  @Column({ length: 255, nullable: true })
  certification?: string;

  @Field({ nullable: true })
  @Column({
    name: 'certification_expiry',
    type: 'date',
    nullable: true,
    transformer: {
      to: (value: Date | string | null) => value,
      from: (value: string | null) => value ? new Date(value + 'T00:00:00.000Z') : null,
    },
  })
  certificationExpiry?: Date;

  @Field({ nullable: true })
  @Column({ name: 'dpo_registration_number', length: 100, nullable: true })
  dpoRegistrationNumber?: string;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
