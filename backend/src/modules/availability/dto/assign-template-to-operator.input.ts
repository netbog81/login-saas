import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsDateString, IsUUID, IsBoolean, IsInt, Min, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Override di studio/poltrona per un giorno (ed eventualmente una fascia
 * oraria) del pattern. startTime/endTime null = tutto il giorno.
 */
@InputType()
export class AssignmentRoomOverrideInput {
  @Field(() => Int)
  @IsInt()
  @Min(0)
  dayInPattern: number;

  @Field({ nullable: true })
  @IsOptional()
  startTime?: string; // HH:MM

  @Field({ nullable: true })
  @IsOptional()
  endTime?: string; // HH:MM

  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  roomId: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  chairId?: string;
}

/**
 * Input per assegnare un Pattern Template a un operatore specifico
 * Include le date di validità dell'assegnazione
 */
@InputType()
export class AssignTemplateToOperatorInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  operatorId: string;

  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  patternGroupId: string; // ID del PatternGroup da assegnare

  @Field()
  @IsNotEmpty()
  @IsDateString()
  validFrom: string; // Data di inizio validità (YYYY-MM-DD)

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  validUntil?: string; // Data di fine validità (YYYY-MM-DD) - opzionale

  @Field()
  @IsNotEmpty()
  @IsDateString()
  patternStartDate: string; // Data di inizio del pattern (per calcoli ciclici)

  /**
   * Se true, le assegnazioni già in corso che si sovrappongono al nuovo
   * periodo vengono chiuse automaticamente al giorno precedente validFrom
   * invece di produrre un errore di sovrapposizione.
   */
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  truncatePrevious?: boolean;

  /** Studio di default per tutte le fasce dell'assegnazione */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  /** Poltrona di default (deve appartenere allo studio indicato) */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  chairId?: string;

  /** Override studio/poltrona per giorno/fascia del pattern */
  @Field(() => [AssignmentRoomOverrideInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentRoomOverrideInput)
  overrides?: AssignmentRoomOverrideInput[];
}
