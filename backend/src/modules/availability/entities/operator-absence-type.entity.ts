import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * OperatorAbsenceType - Tassonomia configurabile dei tipi di assenza operatore
 * (es. Ferie, Malattia, Permesso, ...). Usata nelle GymException di tipo
 * OPERATOR_ABSENT come "motivo categorizzato".
 *
 * Nota: quando un OperatorAbsenceType viene cancellato, le GymException che lo
 * referenziavano mantengono uno snapshot (name + description) nella colonna
 * GymException.absenceTypeSnapshot. Per questo motivo il delete è hard delete.
 */
@ObjectType()
@Entity('operator_absence_types')
export class OperatorAbsenceType {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
