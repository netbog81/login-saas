import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateSecretaryInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  surname?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  department?: string;

  @Field({ nullable: true, defaultValue: false })
  canManageAppointments?: boolean;

  @Field({ nullable: true, defaultValue: false })
  canManageBilling?: boolean;
}
