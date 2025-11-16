import { InputType, Field, Int, ID } from '@nestjs/graphql';
import { IsUUID, IsNotEmpty, IsInt, Min, Max, IsDateString, IsOptional, Matches } from 'class-validator';

@InputType()
export class CreateAvailabilityTemplateInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  operatorId: string;

  @Field({ nullable: true })
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  description?: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  dayInPattern: number;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(365)
  patternDuration: number;

  @Field()
  @IsDateString()
  patternStartDate: string;

  @Field()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format'
  })
  startTime: string;

  @Field()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format'
  })
  endTime: string;

  @Field()
  @IsDateString()
  validFrom: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}