import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateItManagerInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  surname?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true, defaultValue: true })
  canManageTenant?: boolean;

  @Field({ nullable: true, defaultValue: true })
  canManageIntegrations?: boolean;

  @Field({ nullable: true })
  notes?: string;
}
