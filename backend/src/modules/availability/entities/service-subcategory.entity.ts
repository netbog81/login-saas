import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { OperatorMacroCategory } from './operator-macro-category.enum';

@ObjectType()
@Entity('service_subcategories')
export class ServiceSubcategory {
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

  /**
   * Descrizione che sarà inserita nelle righe fattura per i servizi di
   * questa sottocategoria (distinta dalla description libera).
   */
  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  invoiceLineDescription?: string;

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
