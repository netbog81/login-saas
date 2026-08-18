import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { TemplateAssignment } from './template-assignment.entity';
import { Room } from './room.entity';
import { Chair } from './chair.entity';

/**
 * Override di studio/poltrona per un giorno (ed eventualmente una fascia
 * oraria) del pattern di un'assegnazione template.
 *
 * Risoluzione dello studio effettivo per una fascia del template:
 *   1. override con dayInPattern corrispondente e finestra oraria che
 *      interseca la fascia (il più specifico vince);
 *   2. override con dayInPattern corrispondente senza finestra oraria
 *      (vale l'intera giornata);
 *   3. roomId/chairId di default dell'assegnazione.
 * startTime/endTime null = tutto il giorno.
 */
@ObjectType()
@Entity('template_assignment_room_overrides')
@Index(['assignmentId'])
export class TemplateAssignmentRoomOverride {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  assignmentId: string;

  @Field(() => Int)
  @Column('int')
  dayInPattern: number;

  @Field({ nullable: true })
  @Column('time', { nullable: true })
  startTime?: string;

  @Field({ nullable: true })
  @Column('time', { nullable: true })
  endTime?: string;

  @Field(() => ID)
  @Column('uuid')
  roomId: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  chairId?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => TemplateAssignment, (assignment) => assignment.roomOverrides, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assignmentId' })
  assignment?: TemplateAssignment;

  @Field(() => Room, { nullable: true })
  @ManyToOne(() => Room, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roomId' })
  room?: Room;

  @Field(() => Chair, { nullable: true })
  @ManyToOne(() => Chair, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'chairId' })
  chair?: Chair;
}
