import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsInt, Min, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Input per un singolo pattern all'interno di un PatternGroup
 */
@InputType()
export class PatternInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  dayInPattern: number; // 0-6 per settimanale, 0-13 per bi-settimanale, etc.

  @Field()
  @IsNotEmpty()
  startTime: string; // Formato HH:MM

  @Field()
  @IsNotEmpty()
  endTime: string; // Formato HH:MM
}

/**
 * Input per creare un PatternGroup con tutti i suoi pattern
 */
@InputType()
export class CreatePatternGroupInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  patternDuration: number; // Durata del pattern in giorni (7 = 1 settimana, 14 = 2 settimane, etc.)

  @Field(() => [PatternInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatternInput)
  patterns: PatternInput[];
}
