import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  Matches,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GymExceptionType } from '../entities/gym-exception.entity';

/**
 * Slot di sostituzione all'interno di un'eccezione OPERATOR_ABSENT.
 * Ogni entry rappresenta uno slot originale del pattern dell'assente;
 * substituteOperatorId può essere NULL per indicare "slot scoperto".
 */
@InputType()
export class GymExceptionSubstituteInput {
  @Field(() => ID)
  @IsUUID()
  gymRoomId: string;

  @Field()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'startTime deve essere nel formato HH:mm',
  })
  startTime: string;

  @Field()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'endTime deve essere nel formato HH:mm',
  })
  endTime: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  substituteOperatorId?: string;

  /**
   * Marker esplicito di "palestra chiusa" per questo slot.
   * Va usato solo quando substituteOperatorId è null/undefined.
   */
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

@InputType()
export class CreateGymExceptionInput {
  /**
   * Palestra impattata. Se omesso/null, l'eccezione è operator-wide e copre
   * tutte le palestre in cui l'operatore ha pattern quel giorno (valido solo
   * per OPERATOR_ABSENT).
   */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  gymRoomId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @Field()
  @IsDateString()
  exceptionDate: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'startTime deve essere nel formato HH:mm'
  })
  startTime?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'endTime deve essere nel formato HH:mm'
  })
  endTime?: string;

  @Field(() => GymExceptionType)
  @IsEnum(GymExceptionType)
  exceptionType: GymExceptionType;

  /**
   * Sostituto "modalità semplice": se `substitutes` è vuoto, il backend
   * espande automaticamente questo sostituto su TUTTI gli slot originali
   * dell'operatore assente quel giorno.
   */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  substituteOperatorId?: string;

  /**
   * Sostituzioni per singolo slot (modalità "mostra operatori disponibili").
   * Se passato, `substituteOperatorId` viene ignorato.
   */
  @Field(() => [GymExceptionSubstituteInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GymExceptionSubstituteInput)
  substitutes?: GymExceptionSubstituteInput[];

  /**
   * ID del tipo di assenza selezionato (OperatorAbsenceType). Il backend
   * carica il record e salva lo snapshot in gym_exceptions.absenceTypeSnapshot.
   */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  absenceTypeId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class UpdateGymExceptionInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  gymRoomId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  exceptionDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'startTime deve essere nel formato HH:mm'
  })
  startTime?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'endTime deve essere nel formato HH:mm'
  })
  endTime?: string;

  @Field(() => GymExceptionType, { nullable: true })
  @IsOptional()
  @IsEnum(GymExceptionType)
  exceptionType?: GymExceptionType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  substituteOperatorId?: string;

  @Field(() => [GymExceptionSubstituteInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GymExceptionSubstituteInput)
  substitutes?: GymExceptionSubstituteInput[];

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  absenceTypeId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}
