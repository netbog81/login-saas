import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { IsEnum } from 'class-validator';

@InputType()
export class UpsertServiceInvoicePrefixInput {
  @Field(() => OperatorMacroCategory)
  @IsEnum(OperatorMacroCategory, { message: 'Macro categoria non valida' })
  macroCategory: OperatorMacroCategory;

  @Field()
  @IsString()
  @MaxLength(500, { message: 'Il prefisso non può superare 500 caratteri' })
  prefix: string;

  /** Template descrizione riga fattura (vuoto/assente → composizione legacy). */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Il template non può superare 1000 caratteri' })
  template?: string;
}
