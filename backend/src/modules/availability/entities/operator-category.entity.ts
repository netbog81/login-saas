import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { OperatorMacroCategory } from './operator-macro-category.enum';
import { Operator } from './operator.entity';

@ObjectType()
@Entity('operator_categories')
export class OperatorCategory {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => OperatorMacroCategory)
  @Column({
    type: 'enum',
    enum: OperatorMacroCategory
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

  // Relations
  @Field(() => [Operator], { nullable: true })
  @OneToMany(() => Operator, operator => operator.category)
  operators?: Operator[];
}
