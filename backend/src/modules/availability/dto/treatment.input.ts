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
 * Input per un singolo servizio nel trattamento.
 * Permette di specificare prezzo personalizzato per ogni servizio.
 */
@InputType()
export class TreatmentServiceInputItem {
  @Field(() => ID)
  @IsUUID('4', { message: 'ID servizio non valido' })
  serviceId: string;

  @Field(() => Float, { nullable: true, description: 'Prezzo personalizzato per questo servizio' })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Il prezzo non può essere negativo' })
  price?: number;

  @Field(() => Int, { nullable: true, description: 'Durata personalizzata in minuti' })
  @IsOptional()
  @IsNumber()
  @Min(5, { message: 'La durata minima è 5 minuti' })
  duration?: number;

  @Field(() => Int, { nullable: true, description: 'Posizione ordinamento' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderPosition?: number;

  @Field(() => Boolean, { nullable: true, description: 'True se il prezzo è stato personalizzato manualmente' })
  @IsOptional()
  @IsBoolean()
  isCustomPrice?: boolean;
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

  /**
   * @deprecated Usa treatmentServices invece. Mantenuto per retrocompatibilità.
   */
  @Field(() => ID, { nullable: true, deprecationReason: 'Usa treatmentServices invece' })
  @IsOptional()
  @IsUUID('4', { message: 'ID servizio non valido' })
  serviceId?: string;

  /**
   * Lista dei servizi eseguiti nel trattamento.
   * Se fornito, sostituisce tutti i servizi esistenti.
   * Ogni servizio può avere un prezzo personalizzato.
   */
  @Field(() => [TreatmentServiceInputItem], { nullable: true, description: 'Servizi eseguiti nel trattamento' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentServiceInputItem)
  treatmentServices?: TreatmentServiceInputItem[];

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

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reschedulingType?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  suggestInDays?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  suggestDateRangeStart?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  suggestDateRangeEnd?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note di riprogrammazione non possono superare 2000 caratteri' })
  reschedulingNotes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note per il paziente non possono superare 2000 caratteri' })
  patientNotes?: string;

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

/**
 * Input per la segreteria: modifica campi economici/contabili di un
 * trattamento già OPERATOR_COMPLETED o CLOSED.
 *
 * La segreteria NON può toccare campi clinici (clinicalNotes, painLevel,
 * painBefore, painAfter, operatorNotes, patientNotes) né note paziente.
 * Se necessario può sempre riaprire il trattamento con reopenTreatment
 * così l'operatore rimette mano ai dati clinici.
 */
@InputType()
export class UpdateTreatmentBySecretaryInput {
  @Field(() => ID)
  @IsUUID('4', { message: 'ID trattamento non valido' })
  id: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Il prezzo non può essere negativo' })
  price?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  scontoFE?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note segreteria non possono superare 2000 caratteri' })
  secretaryNotes?: string;

  @Field(() => [TreatmentServiceInputItem], { nullable: true, description: 'Sostituisce i servizi eseguiti' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentServiceInputItem)
  treatmentServices?: TreatmentServiceInputItem[];

  /**
   * Motivo dell'amend (es. "aggiunta riga prodotto"). Obbligatorio quando
   * il trattamento è già pubblicato (billingStatus IN SENT/PENDING) e
   * la modifica genera un evento `treatment.amended.<tenant>` verso accounting.
   * Per altri stati può essere omesso.
   */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'amendmentReason non può superare 500 caratteri' })
  amendmentReason?: string;
}

/**
 * Input per aggiornare la descrizione della riga fattura di un servizio.
 * Usato sia dall'operatore (durante completeTreatment) che dalla segreteria.
 */
@InputType()
export class UpdateTreatmentServiceInvoiceDescriptionInput {
  @Field(() => ID)
  @IsUUID('4', { message: 'ID treatment service non valido' })
  treatmentServiceId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'La descrizione non può superare 2000 caratteri' })
  description?: string;
}

/**
 * Input per creare una riga fattura custom (segreteria).
 */
@InputType()
export class CreateTreatmentInvoiceLineInput {
  @Field(() => ID)
  @IsUUID('4', { message: 'ID trattamento non valido' })
  treatmentId: string;

  @Field()
  @IsString()
  @MaxLength(2000, { message: 'La descrizione non può superare 2000 caratteri' })
  description: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0, { message: "L'importo non può essere negativo" })
  amount: number;
}

/**
 * Input per aggiornare una riga fattura custom (segreteria).
 */
@InputType()
export class UpdateTreatmentInvoiceLineInput {
  @Field(() => ID)
  @IsUUID('4', { message: 'ID riga non valido' })
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'La descrizione non può superare 2000 caratteri' })
  description?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: "L'importo non può essere negativo" })
  amount?: number;
}
