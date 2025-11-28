import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PatternInput } from './create-pattern-group.input';

/**
 * Input for updating a PatternGroup
 * Updates metadata and replaces all patterns
 */
@InputType()
export class UpdatePatternGroupInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  patternDuration?: number;

  @Field(() => [PatternInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatternInput)
  patterns?: PatternInput[];
}
