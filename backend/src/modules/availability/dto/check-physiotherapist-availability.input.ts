import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsUUID, IsDateString, IsOptional, IsInt, ValidateNested, Matches, IsBoolean } from 'class-validator';
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

  // Optional: filter to a specific time slot (HH:mm format)
  // Used for real-time validation in booking modal
  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be in HH:mm format' })
  startTime?: string;

  // Whether the order of instruments matters
  // If false, backend can try reversed order when checking availability
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  instrumentOrderMatters?: boolean;
}
