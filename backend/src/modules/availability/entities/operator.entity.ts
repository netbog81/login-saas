import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { AvailabilityTemplate } from './availability-template.entity';
import { AvailabilityException } from './availability-exception.entity';
import { AvailabilityAppointment } from './availability-appointment.entity';
import { OperatorService } from './operator-service.entity';
import { OperatorMacroCategory } from './operator-macro-category.enum';
import { OperatorCategory } from './operator-category.entity';
import { GymSchedule } from './gym-schedule.entity';
import { TemplateAssignment } from './template-assignment.entity';

@ObjectType()
@Entity('operators')
export class Operator {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  surname?: string;

  @Field({ nullable: true })
  @Column({ length: 255, unique: true, nullable: true })
  email?: string;

  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  phone?: string;

  @Field({ nullable: true })
  @Column({ length: 7, nullable: true })
  color?: string;

  @Field(() => OperatorMacroCategory)
  @Column({
    type: 'enum',
    enum: OperatorMacroCategory,
    default: OperatorMacroCategory.PHYSIOTHERAPIST
  })
  macroCategory: OperatorMacroCategory;

  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  categoryId?: string;

  @Field(() => OperatorCategory, { nullable: true })
  @ManyToOne(() => OperatorCategory, category => category.operators)
  @JoinColumn({ name: 'categoryId' })
  category?: OperatorCategory;

  @Field(() => [Int], { nullable: true })
  @Column({ type: 'int', array: true, nullable: true })
  preferredDurations?: number[];

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  legacyUserId?: number;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  userId?: number;

  @Field(() => Int)
  @Column({ default: 1 })
  maxConcurrentAppointments: number;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @Field(() => [AvailabilityTemplate], { nullable: true })
  @OneToMany(() => AvailabilityTemplate, template => template.operator)
  availabilityTemplates?: AvailabilityTemplate[];

  @Field(() => [AvailabilityException], { nullable: true })
  @OneToMany(() => AvailabilityException, exception => exception.operator)
  availabilityExceptions?: AvailabilityException[];

  @Field(() => [AvailabilityAppointment], { nullable: true })
  @OneToMany(() => AvailabilityAppointment, appointment => appointment.operator)
  appointments?: AvailabilityAppointment[];

  @Field(() => [OperatorService], { nullable: true })
  @OneToMany(() => OperatorService, operatorService => operatorService.operator)
  services?: OperatorService[];

  @Field(() => [GymSchedule], { nullable: true })
  @OneToMany(() => GymSchedule, gymSchedule => gymSchedule.operator)
  gymSchedules?: GymSchedule[];

  @Field(() => [TemplateAssignment], { nullable: true })
  @OneToMany(() => TemplateAssignment, assignment => assignment.operator)
  templateAssignments?: TemplateAssignment[];
}
