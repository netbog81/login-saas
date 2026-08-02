import { Field, Int, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType('AttendanceStats')
export class AttendanceStatsModel {
  @Field(() => GraphQLJSON, {
    description: 'No-show per anno solare. Formato: { "2026": 2, "2025": 0 }',
  })
  noShowsByYear: Record<string, number>;

  @Field(() => GraphQLJSON, {
    description: 'Cancellazioni per anno solare. Formato: { "2026": 3, "2025": 1 }',
  })
  cancellationsByYear: Record<string, number>;

  @Field(() => GraphQLJSON, {
    description:
      'Ritardi per anno solare (era no-show, poi presentato). Formato: { "2026": 1 }',
  })
  lateArrivalsByYear: Record<string, number>;

  @Field(() => Int)
  totalNoShows: number;

  @Field(() => Int)
  totalCancellations: number;

  @Field(() => Int)
  totalLateArrivals: number;
}
