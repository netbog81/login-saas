import { ObjectType, Field, Int, ID } from '@nestjs/graphql';

@ObjectType()
export class GymSlotOperatorInfo {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  surname?: string;

  @Field({ nullable: true })
  color?: string;
}

@ObjectType()
export class GymSlotInfo {
  @Field()
  startTime: string;

  @Field()
  endTime: string;

  @Field(() => GymSlotOperatorInfo, { nullable: true })
  operator?: GymSlotOperatorInfo;

  @Field(() => Int)
  currentCount: number;

  @Field(() => Int)
  maxCapacity: number;

  @Field()
  isAvailable: boolean;

  @Field()
  isClosed: boolean;
}
