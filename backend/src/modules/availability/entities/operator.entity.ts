import { Entity, Column, PrimaryGeneratedColumn, OneToMany, OneToOne, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { AvailabilityTemplate } from './availability-template.entity';
import { AvailabilityException } from './availability-exception.entity';
import { AvailabilityAppointment } from './availability-appointment.entity';
import { OperatorService } from './operator-service.entity';
import { OperatorMacroCategory } from './operator-macro-category.enum';
import { OperatorCategory } from './operator-category.entity';
import { GymSchedule } from './gym-schedule.entity';
import { TemplateAssignment } from './template-assignment.entity';
import { AppUser } from '../../users/entities/app-user.entity';

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

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  legacyUserId?: string;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Field(() => Int)
  @Column({ default: 1 })
  maxConcurrentAppointments: number;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  /**
   * Percentuale royalty che l'operatore riceve per ogni trattamento
   * Es: 30.00 = 30%
   */
  @Field(() => Float)
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  royaltyPercentage: number;

  /**
   * Iscrizione all'albo professionale
   * Es: "Albo FT n. 12345"
   */
  @Field({ nullable: true })
  @Column({ name: 'professional_registration', length: 255, nullable: true })
  professionalRegistration?: string;

  /**
   * Titolo/qualifica professionale mostrato nei documenti generati
   * (es. "Fisioterapista", "Psicologo", "Medico Chirurgo").
   */
  @Field({ nullable: true })
  @Column({ name: 'professional_title', length: 255, nullable: true })
  professionalTitle?: string;

  /** Codice fiscale del professionista (per documenti/attestati). */
  @Field({ nullable: true })
  @Column({ name: 'tax_code', length: 16, nullable: true })
  taxCode?: string;

  /** Partita IVA del professionista (per documenti/attestati). */
  @Field({ nullable: true })
  @Column({ name: 'vat_number', length: 11, nullable: true })
  vatNumber?: string;

  /**
   * Permesso di registrare pagamenti sui trattamenti.
   * Default per categoria: false per GYM_INSTRUCTOR, true per le altre.
   * Editabile dall'admin dalla UI operatori.
   */
  @Field()
  @Column({ default: true })
  canCollectPayment: boolean;

  @Field({ nullable: true })
  @Column({ name: 'app_user_id', type: 'uuid', nullable: true })
  appUserId?: string;

  @Field(() => AppUser, { nullable: true })
  @OneToOne(() => AppUser, { nullable: true, eager: false })
  @JoinColumn({ name: 'app_user_id' })
  appUser?: AppUser;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Timestamp di archiviazione (soft-delete). Quando valorizzato:
   *  - l'operatore è "archiviato": preserva lo storico ma non è più
   *    selezionabile per nuovi trattamenti/appuntamenti
   *  - `isActive` viene messo a false in transazione
   *  - l'AppUser collegato (se presente) viene disattivato
   *  - i suoi availability_templates vengono disattivati
   * Le query `find()` standard di TypeORM escludono automaticamente i
   * record soft-deleted; per visualizzare gli archiviati usare
   * `withDeleted: true`.
   */
  @Field({ nullable: true })
  @DeleteDateColumn()
  deletedAt?: Date;

  /** AppUser admin che ha archiviato l'operatore (per audit). */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  deletedByUserId?: string;

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
