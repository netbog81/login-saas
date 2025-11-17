import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsDateString, IsUUID } from 'class-validator';

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

  @Field()
  @IsNotEmpty()
  templateName: string; // Nome del pattern template da assegnare

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
}
