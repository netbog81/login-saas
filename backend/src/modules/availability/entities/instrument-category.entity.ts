import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { OperatorMacroCategory } from './operator-macro-category.enum';
import { Instrument } from './instrument.entity';

@ObjectType()
@Entity('instrument_categories')
export class InstrumentCategory {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => OperatorMacroCategory)
  @Column({
    type: 'enum',
    enum: OperatorMacroCategory,
    default: OperatorMacroCategory.PHYSIOTHERAPIST
  })
  macroCategory: OperatorMacroCategory;

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

  @Field({ nullable: true })
  @DeleteDateColumn()
  deletedAt?: Date;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  deletedByUserId?: string;

  // Relations
  @Field(() => [Instrument], { nullable: true })
  @OneToMany(() => Instrument, instrument => instrument.category)
  instruments?: Instrument[];
}
