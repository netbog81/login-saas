import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class GymSlotOutput {
  @Field()
  startTime: string; // HH:mm format

  @Field()
  endTime: string; // HH:mm format

  @Field(() => Int)
  availableCapacity: number;

  @Field(() => Int)
  totalCapacity: number;

  @Field({ nullable: true })
  operatorName?: string;
}
