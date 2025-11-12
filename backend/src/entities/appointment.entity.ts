import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Patient } from './patient.entity';

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'date' })
  date: string;

  @Column()
  startTime: string; // Formato HH:mm

  @Column()
  endTime: string; // Formato HH:mm

  @ManyToOne(() => User, user => user.appointments)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => Patient, patient => patient.appointments, { nullable: true })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ nullable: true })
  patientId: number;

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
