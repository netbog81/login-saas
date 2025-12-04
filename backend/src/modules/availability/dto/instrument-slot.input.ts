import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsUUID, IsInt, Min } from 'class-validator';

@InputType()
export class InstrumentSlotInput {
  @Field(() => ID)
  @IsUUID()
  instrumentCategoryId: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  startOffsetMinutes: number;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  endOffsetMinutes: number;
}
