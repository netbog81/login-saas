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

  /**
   * Descrizione che sarà inserita nelle righe fattura per le prestazioni
   * degli operatori di questa categoria (distinta dalla description libera).
   */
  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  invoiceLineDescription?: string;

  /**
   * Prefisso della descrizione riga fattura per questa categoria, usato al
   * posto del prefisso di macro-categoria quando il toggle
   * `InvoiceLineSettings.useOperatorCategories` è attivo. NULL → si eredita
   * il prefisso della macro-categoria.
   */
  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  invoicePrefix?: string | null;

  /**
   * Template componibile della descrizione riga fattura per questa categoria
   * (stessi segnaposto di ServiceInvoicePrefix.template). Usato solo con
   * toggle `useOperatorCategories` attivo. NULL/vuoto insieme a
   * invoicePrefix NULL → fallback completo alla config di macro-categoria.
   */
  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  invoiceTemplate?: string | null;

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
