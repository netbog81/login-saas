import { ObjectType, Field, ID } from '@nestjs/graphql';
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

@ObjectType()
export class PhysiotherapistSlotBatchOutput {
  @Field(() => ID)
  operatorId: string;

  @Field()
  date: string;

  @Field()
  startTime: string;

  @Field()
  endTime: string;

  @Field()
  available: boolean;
}
