import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('RegistrySubjectRole')
export class RegistrySubjectRoleModel {
  @Field(() => ID)
  id: string;

  @Field()
  roleType: string;

  @Field()
  isActive: boolean;
}
