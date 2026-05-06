import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { OperatorService } from './operator-service.entity';
import { AvailabilityAppointment } from './availability-appointment.entity';
import { OperatorMacroCategory } from './operator-macro-category.enum';
import { ServiceInstrument } from './service-instrument.entity';
import { ServiceSubcategory } from './service-subcategory.entity';

@ObjectType()
@Entity('services')
export class Service {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Codice business univoco del servizio (es. "FIS-001", "VAL-MED").
   * Usato come chiave di mapping verso il catalogo accounting
   * (ClinicalServiceMappingEntity.serviceCode). Migration popola gli
   * esistenti con `TMP-<id8>`; l'operatore corregge poi via UI.
   */
  @Field()
  @Column({ length: 30, unique: true })
  serviceCode: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field(() => Int)
  @Column()
  defaultDuration: number; // in minutes

  @Field()
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  defaultPrice: number;

  @Field(() => Int)
  @Column({ default: 0 })
  bufferTimeBefore: number; // buffer time before appointment

  @Field(() => Int)
  @Column({ default: 0 })
  bufferTimeAfter: number; // buffer time after appointment

  @Field({ nullable: true })
  @Column({ length: 7, nullable: true })
  color?: string;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field(() => OperatorMacroCategory, { nullable: true })
  @Column({
    type: 'enum',
    enum: OperatorMacroCategory,
    nullable: true
  })
  macroCategory?: OperatorMacroCategory;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  preferredDuration?: number;

  @Field()
  @Column({ default: false })
  instrumentOrderMatters: boolean;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true, default: 0 })
  defaultInstrumentSlotOffset?: number; // For single instrument: 0=first 30min, 15=second 30min (45min), 30=second 30min (60min)

  @Field({ nullable: true })
  @Column({ default: false })
  reverseInstrumentOrder?: boolean; // For 2 instruments in 45min when orderMatters=false: reverse the order

  @Field({ nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountFE?: number; // Prezzo alternativo "Sconto FE"

  @Field(() => ServiceSubcategory, { nullable: true })
  @ManyToOne(() => ServiceSubcategory, { nullable: true })
  @JoinColumn({ name: 'subcategoryId' })
  subcategory?: ServiceSubcategory;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  subcategoryId?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @Field(() => [OperatorService], { nullable: true })
  @OneToMany(() => OperatorService, operatorService => operatorService.service)
  operators?: OperatorService[];

  @Field(() => [AvailabilityAppointment], { nullable: true })
  @OneToMany(() => AvailabilityAppointment, appointment => appointment.service)
  appointments?: AvailabilityAppointment[];

  @Field(() => [ServiceInstrument], { nullable: true })
  @OneToMany(() => ServiceInstrument, serviceInstrument => serviceInstrument.service)
  requiredInstruments?: ServiceInstrument[];
}