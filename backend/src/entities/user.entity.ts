import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Availability } from './availability.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  type: string; // 'medico', 'fisioterapista', etc.

  @Column()
  color: string; // Colore esadecimale per identificare l'operatore nel calendario

  @Column({ default: true })
  active: boolean;

  // Legacy: la relazione appointments è stata spostata su Operator
  @OneToMany(() => Availability, availability => availability.user)
  availabilities: Availability[];
}
