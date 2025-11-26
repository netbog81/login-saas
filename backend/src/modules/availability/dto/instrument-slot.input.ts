import { InputType, Field, ID, Int } from '@nestjs/graphql';

@InputType()
export class InstrumentSlotInput {
  @Field(() => ID)
  instrumentCategoryId: string;

  @Field(() => Int)
  startOffsetMinutes: number;

  @Field(() => Int)
  endOffsetMinutes: number;
}
