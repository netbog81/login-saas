import { ObjectType, InputType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class WhatsappRetentionStats {
  @Field(() => Int)
  totalLogs: number;

  @Field(() => Int)
  expiredLogs: number;

  @Field(() => Int)
  anonymizedLogs: number;

  @Field(() => Int)
  retentionDays: number;

  @Field()
  retentionCutoffDate: Date;
}

@InputType()
export class WhatsappBulkLogIdsInput {
  @Field(() => [String])
  logIds: string[];
}

@ObjectType()
export class WhatsappLogManagementResult {
  @Field()
  success: boolean;

  @Field(() => Int)
  affectedCount: number;

  @Field({ nullable: true })
  message?: string;
}
