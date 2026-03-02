import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('availabilities')
export class Availability {
  @PrimaryColumn({ type: 'uuid', default: () => "public.uuid_generate_v4()" })
  id: string;

  @ManyToOne(() => User, user => user.availabilities)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'date' })
  date: string;

  @Column()
  startTime: string; // Formato HH:mm

  @Column()
  endTime: string; // Formato HH:mm

  @Column({ default: true })
  available: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
