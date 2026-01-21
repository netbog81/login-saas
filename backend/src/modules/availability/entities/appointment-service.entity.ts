import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { AvailabilityAppointment } from './availability-appointment.entity';
import { Service } from './service.entity';

/**
 * AppointmentService - Tabella di collegamento per relazione ManyToMany
 * tra AvailabilityAppointment e Service.
 *
 * Permette di associare più servizi a un singolo appuntamento,
 * con possibilità di override di durata e prezzo per singolo servizio.
 */
@ObjectType('AppointmentService')
@Entity('appointment_services')
@Index('IDX_appointment_services_appointment', ['appointmentId'])
@Index('IDX_appointment_services_service', ['serviceId'])
export class AppointmentService {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== FOREIGN KEYS ====================

  @Field(() => ID)
  @Column('uuid')
  appointmentId: string;

  @Field(() => ID)
  @Column('uuid')
  serviceId: string;

  // ==================== OPTIONAL OVERRIDES ====================

  /**
   * Durata personalizzata per questo servizio in questo appuntamento.
   * Se null, usa la durata default del servizio.
   */
  @Field(() => Int, { nullable: true })
  @Column('int', { nullable: true })
  customDuration?: number;

  /**
   * Prezzo personalizzato per questo servizio in questo appuntamento.
   * Se null, usa il prezzo default del servizio.
   */
  @Field(() => Float, { nullable: true })
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  customPrice?: number;

  /**
   * Posizione ordinamento servizi nell'appuntamento.
   * Usato per drag & drop riordinamento.
   */
  @Field(() => Int)
  @Column('int', { default: 0 })
  orderPosition: number;

  // ==================== TIMESTAMPS ====================

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  // ==================== RELATIONS ====================

  @ManyToOne(() => AvailabilityAppointment, appointment => appointment.appointmentServices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: AvailabilityAppointment;

  @Field(() => Service)
  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service: Service;
}
