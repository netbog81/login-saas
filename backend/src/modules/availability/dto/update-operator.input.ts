import { InputType, Field, Int, Float, ID } from '@nestjs/graphql';
import { IsString, IsEmail, IsOptional, MaxLength, IsInt, IsUUID, Min, Max, IsBoolean, IsArray, IsEnum, IsNumber } from 'class-validator';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';

@InputType()
export class UpdateOperatorInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Il nome non può superare 255 caratteri' })
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Il cognome non può superare 255 caratteri' })
  surname?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'Email non valida' })
  @MaxLength(255, { message: 'Email troppo lunga' })
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Numero di telefono troppo lungo' })
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(7, { message: 'Colore deve essere in formato hex (#RRGGBB)' })
  color?: string;

  @Field(() => OperatorMacroCategory, { nullable: true })
  @IsOptional()
  @IsEnum(OperatorMacroCategory, { message: 'Macro categoria non valida' })
  macroCategory?: OperatorMacroCategory;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field(() => [Int], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true, message: 'Le durate preferite devono essere numeri interi' })
  @Min(1, { each: true, message: 'Le durate devono essere maggiori di 0' })
  preferredDurations?: number[];

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Numero massimo appuntamenti deve essere almeno 1' })
  maxConcurrentAppointments?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID utente non valido' })
  userId?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'La percentuale deve essere almeno 0' })
  @Max(100, { message: 'La percentuale non può superare 100' })
  royaltyPercentage?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Iscrizione albo non può superare 255 caratteri' })
  professionalRegistration?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  canCollectPayment?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Il titolo professionale non può superare 255 caratteri' })
  professionalTitle?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(16, { message: 'Il codice fiscale non può superare 16 caratteri' })
  taxCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(11, { message: 'La partita IVA non può superare 11 caratteri' })
  vatNumber?: string;
}
