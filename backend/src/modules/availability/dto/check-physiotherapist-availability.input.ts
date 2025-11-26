import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { InstrumentSlotInput } from './instrument-slot.input';

@InputType()
export class CheckPhysiotherapistAvailabilityInput {
  @Field(() => ID)
  operatorId: string;

  @Field()
  date: string; // ISO date string (YYYY-MM-DD)

  // Option 1: Use pre-configured service
  @Field(() => ID, { nullable: true })
  serviceId?: string;

  // Option 2: Custom parameters (override serviceId if present)
  @Field(() => Int, { nullable: true })
  durationMinutes?: number;

  @Field(() => [InstrumentSlotInput], { nullable: true })
  customInstrumentSlots?: InstrumentSlotInput[];
}
