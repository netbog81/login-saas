import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsUUID, IsDateString, IsOptional, IsInt, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InstrumentSlotInput } from './instrument-slot.input';

@InputType()
export class CheckPhysiotherapistAvailabilityInput {
  @Field(() => ID)
  @IsUUID()
  operatorId: string;

  @Field()
  @IsDateString()
  date: string; // ISO date string (YYYY-MM-DD)

  // Option 1: Use pre-configured service
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  // Option 2: Custom parameters (override serviceId if present)
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @Field(() => [InstrumentSlotInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InstrumentSlotInput)
  customInstrumentSlots?: InstrumentSlotInput[];

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  instrumentOrderMatters?: boolean;
}
