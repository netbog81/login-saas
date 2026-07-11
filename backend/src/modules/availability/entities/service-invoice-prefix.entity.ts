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

  /**
   * Template componibile della descrizione riga fattura per la categoria.
   * Segnaposto supportati: {prefisso} {data} {codice_servizio} {nome_servizio}
   * {descrizione_servizio} {descrizione_fattura_sottocategoria} {operatore}
   * {albo} {descrizione_fattura_categoria} {strumenti}.
   * NULL/vuoto → si usa la composizione legacy basata sul solo prefisso.
   */
  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  template?: string | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
