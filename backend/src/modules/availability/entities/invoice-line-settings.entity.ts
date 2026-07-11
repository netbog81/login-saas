import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Impostazioni globali (una riga per tenant) della composizione descrizione
 * righe fattura — sezione impostazioni "Descrizione righe servizi".
 *
 * `useOperatorCategories`:
 *  - false (default) → la descrizione si compone con prefisso/template della
 *    MACRO-categoria dell'operatore (comportamento storico);
 *  - true → si usa prefisso/template della CATEGORIA OPERATORE
 *    (`operator_categories.invoicePrefix/invoiceTemplate`) dell'operatore che
 *    esegue il trattamento, con fallback alla macro-categoria se l'operatore
 *    non ha categoria o la categoria non è configurata.
 */
@ObjectType('InvoiceLineSettings')
@Entity('invoice_line_settings')
export class InvoiceLineSettings {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ default: false })
  useOperatorCategories: boolean;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
