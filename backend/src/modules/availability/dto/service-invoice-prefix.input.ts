import { InputType, Field } from '@nestjs/graphql';
import { IsString, MaxLength } from 'class-validator';
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
}
