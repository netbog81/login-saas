import { InputType, Field, ID, Int, Float } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, IsNumber, IsBoolean, IsEnum, MaxLength, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/treatment.entity';

/**
 * Input per completare un trattamento (operatore)
 */
@InputType()
export class CompleteTreatmentInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Le note cliniche non possono superare 5000 caratteri' })
  clinicalNotes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note per segreteria non possono superare 2000 caratteri' })
  secretaryNotes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note operatore non possono superare 2000 caratteri' })
  operatorNotes?: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0, { message: 'Il prezzo non può essere negativo' })
  price: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;
}

/**
 * Input per chiudere un trattamento (segreteria)
 */
@InputType()
export class CloseTreatmentInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note per segreteria non possono superare 2000 caratteri' })
  secretaryNotes?: string;
}

/**
 * Input per registrare un pagamento
 */
@InputType()
export class RecordPaymentInput {
  @Field(() => PaymentMethod)
  @IsEnum(PaymentMethod, { message: 'Metodo di pagamento non valido' })
  paymentMethod: PaymentMethod;

  @Field(() => ID)
  @IsUUID('4', { message: 'ID utente non valido' })
  collectedBy: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'L\'importo non può essere negativo' })
  amount?: number;
}

/**
 * Input per aggiornare uno strumento del trattamento
 */
@InputType()
export class TreatmentInstrumentInput {
  @Field(() => ID)
  @IsUUID('4', { message: 'ID strumento non valido' })
  instrumentId: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID categoria non valido' })
  instrumentCategoryId?: string;

  @Field()
  @IsBoolean()
  wasUsed: boolean;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  startOffsetMinutes: number;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  endOffsetMinutes: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  orderPosition?: number;
}

/**
 * Input per cancellare un appuntamento
 */
@InputType()
export class CancelAppointmentInput {
  @Field()
  @IsString()
  @MaxLength(1000, { message: 'Il motivo cancellazione non può superare 1000 caratteri' })
  reason: string;
}

/**
 * Input per strumento in aggiornamento trattamento
 */
@InputType()
export class UpdateTreatmentInstrumentInput {
  @Field(() => ID)
  @IsUUID('4', { message: 'ID strumento non valido' })
  instrumentId: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID categoria non valido' })
  instrumentCategoryId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  wasUsed?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  startOffsetMinutes?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  endOffsetMinutes?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/**
 * Input per aggiornare un trattamento in corso
 */
@InputType()
export class UpdateTreatmentInput {
  @Field(() => ID)
  @IsUUID('4', { message: 'ID trattamento non valido' })
  id: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID percorso terapeutico non valido' })
  therapeuticPathId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID servizio non valido' })
  serviceId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Le note cliniche non possono superare 5000 caratteri' })
  clinicalNotes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note per segreteria non possono superare 2000 caratteri' })
  secretaryNotes?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Il prezzo non può essere negativo' })
  price?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  scontoFE?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Il livello di dolore deve essere almeno 1' })
  painLevel?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Il livello di dolore prima deve essere almeno 0' })
  painBefore?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Il livello di dolore dopo deve essere almeno 0' })
  painAfter?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  rescheduleRequested?: boolean;

  @Field(() => [UpdateTreatmentInstrumentInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateTreatmentInstrumentInput)
  instruments?: UpdateTreatmentInstrumentInput[];

  @Field({ nullable: true, description: 'Se false, resetta lo stato di pagamento (paymentMethod, paidAt, collectedBy)' })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}
