import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class InstrumentSlotOutput {
  @Field(() => ID)
  instrumentCategoryId: string;

  @Field()
  categoryName: string;

  @Field(() => ID, { nullable: true })
  instrumentId?: string;

  @Field(() => Int)
  startOffsetMinutes: number;

  @Field(() => Int)
  endOffsetMinutes: number;
}
