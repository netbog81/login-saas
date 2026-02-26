import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class TenantSchemaStatus {
  @Field()
  schemaName: string;

  @Field()
  existsInMainDb: boolean;

  /** Stato nel Auth DB: active | pending_schema | suspended | deleted */
  @Field()
  tenantStatus: string;

  /** true se existsInMainDb === true && tenantStatus === 'active' */
  @Field()
  isAligned: boolean;

  @Field({ nullable: true })
  message?: string;
}
