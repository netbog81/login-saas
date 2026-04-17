import { ObjectType, Field, Int, ID } from '@nestjs/graphql';

@ObjectType()
export class AvailabilitySlot {
  @Field(() => ID)
  operatorId: string;

  @Field()
  date: string; // ISO date string

  @Field()
  startTime: string; // HH:mm format

  @Field()
  endTime: string; // HH:mm format

  @Field(() => Int)
  totalCapacity: number;

  @Field(() => Int)
  bookedCapacity: number;

  @Field(() => Int)
  availableCapacity: number;

  @Field()
  isAvailable: boolean;

  @Field({ nullable: true })
  source?: string; // 'template', 'exception', 'override'

  @Field(() => ID, { nullable: true })
  sourceId?: string;
}

@ObjectType()
export class DailyAvailability {
  @Field()
  date: string;

  @Field(() => [AvailabilitySlot])
  slots: AvailabilitySlot[];

  @Field()
  hasAvailability: boolean;
}

@ObjectType()
export class OperatorAvailabilityResult {
  @Field(() => ID)
  operatorId: string;

  @Field(() => [DailyAvailability])
  availability: DailyAvailability[];
}