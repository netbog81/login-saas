import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsInt, Min, IsOptional, IsString } from 'class-validator';

/**
 * Input per creare un Pattern Template generico (non assegnato a un operatore specifico)
 * Il pattern definisce solo la struttura oraria, senza validità o assegnazione
 */
@InputType()
export class CreateTemplatePatternInput {
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

  @Field(() => Int)
  @IsInt()
  @Min(1)
  patternDuration: number; // Durata del pattern in giorni (7 = 1 settimana, 14 = 2 settimane, etc.)

  @Field()
  @IsNotEmpty()
  startTime: string; // Formato HH:MM

  @Field()
  @IsNotEmpty()
  endTime: string; // Formato HH:MM
}
