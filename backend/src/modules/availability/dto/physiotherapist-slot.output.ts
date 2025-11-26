import { ObjectType, Field } from '@nestjs/graphql';
import { InstrumentSlotOutput } from './instrument-slot.output';

@ObjectType()
export class PhysiotherapistSlotOutput {
  @Field()
  startTime: string; // HH:mm format

  @Field()
  endTime: string; // HH:mm format

  @Field()
  available: boolean;

  @Field({ nullable: true })
  reason?: string;

  @Field(() => [InstrumentSlotOutput], { nullable: true })
  suggestedInstruments?: InstrumentSlotOutput[];
}
