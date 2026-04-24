import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { OperatorMacroCategory } from './operator-macro-category.enum';

/**
 * Prefisso testuale usato per generare automaticamente la descrizione
 * della riga fattura per una certa categoria di operatore.
 *
 * Esempio: macroCategory=PHYSIOTHERAPIST, prefix="Seduta fisioterapica del"
 * → "Seduta fisioterapica del 22/04/2026 — Massoterapia — Dr. Rossi"
 *
 * Un solo record per macroCategory (UQ). Editabile dalla segreteria nelle
 * impostazioni, scheda Servizi.
 */
@ObjectType('ServiceInvoicePrefix')
@Entity('service_invoice_prefixes')
export class ServiceInvoicePrefix {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => OperatorMacroCategory)
  @Column({
    type: 'enum',
    enum: OperatorMacroCategory,
    unique: true,
  })
  @Index('UQ_service_invoice_prefixes_macroCategory', { unique: true })
  macroCategory: OperatorMacroCategory;

  @Field()
  @Column('text')
  prefix: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
