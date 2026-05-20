import { Field, ID, InputType, ObjectType, Float } from '@nestjs/graphql';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { PaymentMethod } from '../availability/entities/treatment-enums';

/**
 * Input GraphQL per registrare la vendita rapida di prodotti standalone.
 *
 * Caso d'uso (spec §26): paziente acquista crema/integratore in cassa.
 * Niente trattamento, niente operatore esecutore. Genera evento
 * `sale.completed.<tenant>` verso accounting.
 *
 * NOTA MVP: solo `itemType: 'PRODUCT'`. VOUCHER/PACKAGE roadmap futura.
 */

@InputType()
export class SaleProductLineInput {
  @Field(() => ID)
  @IsUUID('4')
  productId!: string;

  @Field(() => Float)
  @IsNumber()
  @Min(1, { message: 'Quantità minima 1' })
  quantity!: number;

  /**
   * Prezzo unitario applicato (può differire da `Product.defaultPrice`
   * per sconti manuali in cassa). Se omesso, il service usa
   * `Product.defaultPrice` corrente.
   */
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPriceOverride?: number;
}

@InputType()
export class RecordProductSaleInput {
  /**
   * Sede in cui avviene la vendita. Se omessa, il service usa la prima
   * sede attiva (default "Studio principale").
   */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  siteId?: string;

  /**
   * Subject del registry che PAGA (può differire da chi riceve, es.
   * regalo). Per MVP UI lo coincide col beneficiary.
   */
  @Field(() => ID)
  @IsUUID('4')
  purchaserSubjectId!: string;

  /**
   * Subject che RICEVE il prodotto. Tipicamente == purchaser.
   */
  @Field(() => ID)
  @IsUUID('4')
  beneficiarySubjectId!: string;

  @Field(() => [SaleProductLineInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleProductLineInput)
  lines!: SaleProductLineInput[];

  // Payment (sempre obbligatorio per "vendita rapida": fatturazione + incasso
  // contestuali). Il resolver costruisce un TreatmentPayment dal flag isPaid + metodo.
  @Field()
  @IsBoolean()
  isPaid!: boolean;

  @Field(() => PaymentMethod, { nullable: true })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  /**
   * Se true, accounting auto-emette fattura + payment record in stato
   * "incassato". Tipico flusso "Vendita rapida": true (default UI).
   */
  @Field(() => Boolean, { defaultValue: true })
  @IsOptional()
  @IsBoolean()
  requestImmediateInvoice?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@ObjectType('SaleCompletedResult')
export class SaleCompletedResult {
  @Field(() => ID)
  saleId!: string;

  @Field()
  publishedAt!: Date;

  @Field(() => Float)
  totalAmount!: number;
}
