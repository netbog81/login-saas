import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { Operator } from './operator.entity';
import { PatternGroup } from './pattern-group.entity';
import { Room } from './room.entity';
import { Chair } from './chair.entity';
import { TemplateAssignmentRoomOverride } from './template-assignment-room-override.entity';

/**
 * TemplateAssignment - Assigns a pattern group to an operator with validity dates
 * Represents the actual assignment of a complete pattern group to a specific operator
 */
@ObjectType()
@Entity('template_assignments')
@Index(['operatorId', 'isCurrent'])
@Index(['validFrom', 'validUntil'])
export class TemplateAssignment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  @Field(() => ID)
  @Column('uuid')
  patternGroupId: string;

  // Pattern start date for cyclic calculations
  @Field(() => GraphQLISODateTime)
  @Column('timestamp')
  patternStartDate: Date;

  // Validity period
  @Field(() => GraphQLISODateTime)
  @Column('timestamp')
  validFrom: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column('timestamp', { nullable: true })
  validUntil?: Date;

  // Versioning
  @Field(() => Int)
  @Column({ default: 1 })
  version: number;

  @Field()
  @Column({ default: true })
  isCurrent: boolean;

  // Studio/poltrona di default per tutte le fasce dell'assegnazione;
  // gli override per giorno/fascia stanno in roomOverrides.
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  roomId?: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  chairId?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  // Nullable a livello GraphQL: con operatore soft-deleted (archiviato) il
  // join TypeORM ritorna null e un campo non-nullable farebbe fallire
  // l'INTERA query templateAssignments (stesso pattern di Treatment.operator).
  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  @Field(() => PatternGroup)
  @ManyToOne(() => PatternGroup, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patternGroupId' })
  patternGroup: PatternGroup;

  @Field(() => Room, { nullable: true })
  @ManyToOne(() => Room, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roomId' })
  room?: Room;

  @Field(() => Chair, { nullable: true })
  @ManyToOne(() => Chair, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'chairId' })
  chair?: Chair;

  @Field(() => [TemplateAssignmentRoomOverride], { nullable: true })
  @OneToMany(() => TemplateAssignmentRoomOverride, (o) => o.assignment, {
    cascade: true,
  })
  roomOverrides?: TemplateAssignmentRoomOverride[];
}
