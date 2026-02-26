import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { AppUser } from '../entities/app-user.entity';
import { AppUserType } from '../enums/app-user-type.enum';
import { AppUserService } from '../services/app-user.service';
import { UserLinkingService } from '../services/user-linking.service';
import { CreateAppUserInput } from '../dto/create-app-user.input';
import { UpdateAppUserInput } from '../dto/update-app-user.input';
import { LinkKeycloakUserInput, ProvisionUserInput } from '../dto/link-keycloak-user.input';

@Resolver(() => AppUser)
export class AppUserResolver {
  constructor(
    private readonly appUserService: AppUserService,
    private readonly userLinkingService: UserLinkingService,
  ) {}

  @Query(() => [AppUser], { name: 'appUsers' })
  async findAll(
    @Args('userType', { type: () => AppUserType, nullable: true }) userType?: AppUserType,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<AppUser[]> {
    return this.appUserService.findAll({ userType, isActive });
  }

  @Query(() => AppUser, { name: 'appUser', nullable: true })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<AppUser> {
    return this.appUserService.findById(id);
  }

  @Query(() => AppUser, { name: 'appUserByKeycloakId', nullable: true })
  async findByKeycloakId(@Args('keycloakId') keycloakId: string): Promise<AppUser | null> {
    return this.appUserService.findByKeycloakId(keycloakId);
  }

  @Query(() => [AppUser], { name: 'unlinkedAppUsers' })
  async findUnlinked(
    @Args('userType', { type: () => AppUserType, nullable: true }) userType?: AppUserType,
  ): Promise<AppUser[]> {
    return this.appUserService.findUnlinked(userType);
  }

  @Query(() => [String], { name: 'appUserPermissions' })
  async getUserPermissions(
    @Args('appUserId', { type: () => ID }) appUserId: string,
  ): Promise<string[]> {
    return this.appUserService.getUserPermissions(appUserId);
  }

  @Mutation(() => AppUser)
  async createAppUser(@Args('input') input: CreateAppUserInput): Promise<AppUser> {
    return this.appUserService.create(input);
  }

  @Mutation(() => AppUser)
  async updateAppUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAppUserInput,
  ): Promise<AppUser> {
    return this.appUserService.update(id, input);
  }

  @Mutation(() => AppUser)
  async linkKeycloakUser(
    @Args('input') input: LinkKeycloakUserInput,
    @Context() context: any,
  ): Promise<AppUser> {
    const cookie = context.req?.cookies?.curandis_auth_token;
    return this.userLinkingService.linkToKeycloak(
      input.appUserId,
      input.keycloakUserId,
      input.userMappingId,
      cookie,
    );
  }

  @Mutation(() => AppUser)
  async provisionKeycloakUser(
    @Args('input') input: ProvisionUserInput,
    @Context() context: any,
  ): Promise<AppUser> {
    const cookie = context.req?.cookies?.curandis_auth_token;
    return this.userLinkingService.provisionAndLink(
      input.appUserId,
      input.temporaryPassword,
      input.keycloakRoles,
      cookie,
    );
  }
}
