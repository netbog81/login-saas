import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsUUID, IsString, IsOptional, IsInt, Min, Max, IsArray, ValidateNested, IsDateString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class CreateGymTemplatePatternInput {
  @Field(() => ID)
  @IsUUID()
  operatorId: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(6)
  dayInPattern: number;

  @Field()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime deve essere nel formato HH:mm'
  })
  startTime: string;

  @Field()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime deve essere nel formato HH:mm'
  })
  endTime: string;
}

@InputType()
export class CreateGymPatternGroupInput {
  @Field(() => ID)
  @IsUUID()
  gymRoomId: string;

  @Field()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int, { nullable: true, defaultValue: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  patternDuration?: number;

  @Field()
  @IsDateString()
  patternStartDate: string;

  @Field()
  @IsDateString()
  validFrom: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @Field(() => [CreateGymTemplatePatternInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGymTemplatePatternInput)
  patterns: CreateGymTemplatePatternInput[];
}

@InputType()
export class UpdateGymPatternGroupInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  patternDuration?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  patternStartDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @Field({ nullable: true })
  @IsOptional()
  isActive?: boolean;

  @Field(() => [CreateGymTemplatePatternInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGymTemplatePatternInput)
  patterns?: CreateGymTemplatePatternInput[];
}
