import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Operator } from '../modules/availability/entities/operator.entity';
import { Patient } from './patient.entity';

@Entity('appointments')
export class Appointment {
  @PrimaryColumn({ type: 'uuid', default: () => "public.uuid_generate_v4()" })
  id: string;

  @Column()
  title: string;

  @Column({ type: 'date' })
  date: string;

  @Column()
  startTime: string; // Formato HH:mm

  @Column()
  endTime: string; // Formato HH:mm

  @ManyToOne(() => Operator, { nullable: true })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  @Column({ type: 'uuid' })
  operatorId: string;

  @ManyToOne(() => Patient, patient => patient.appointments, { nullable: true })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  patientId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  repeat: {
    enabled: boolean;
    type: string; // 'daily', 'weekly', 'monthly', 'custom'
    interval: number;
    selectedDays: number[];
    endType: string; // 'never', 'after', 'until'
    occurrences: number;
    untilDate: string;
  };

  @Column({ nullable: true })
  recurringGroupId: string; // ID per raggruppare appuntamenti ricorrenti

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
