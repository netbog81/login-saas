import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class KeycloakOrgMember {
  @Field(() => ID)
  id: string;

  @Field()
  username: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field()
  enabled: boolean;

  @Field()
  emailVerified: boolean;

  /** True se questo membro KC è già collegato a un AppUser locale */
  @Field()
  isLinked: boolean;

  @Field({ nullable: true })
  linkedAppUserId?: string;

  @Field({ nullable: true })
  linkedAppUserName?: string;

  @Field(() => [KeycloakRealmRoleType], { nullable: true })
  realmRoles?: KeycloakRealmRoleType[];
}

@ObjectType()
export class KeycloakRealmRoleType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;
}
