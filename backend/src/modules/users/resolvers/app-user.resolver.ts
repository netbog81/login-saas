import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { AppUser } from '../entities/app-user.entity';
import { AppUserType } from '../enums/app-user-type.enum';
import { AppUserService } from '../services/app-user.service';
import { UserLinkingService } from '../services/user-linking.service';
import { KeycloakAdminService } from '../services/keycloak-admin.service';
import { CreateAppUserInput } from '../dto/create-app-user.input';
import { UpdateAppUserInput } from '../dto/update-app-user.input';
import { LinkKeycloakUserInput } from '../dto/link-keycloak-user.input';
import { CreateKeycloakUserInput } from '../dto/create-keycloak-user.input';
import { UpdateKeycloakUserInput } from '../dto/update-keycloak-user.input';
import { ResetKeycloakPasswordInput } from '../dto/reset-keycloak-password.input';
import { KeycloakOrgMember, KeycloakRealmRoleType } from '../dto/keycloak-types';

@Resolver(() => AppUser)
export class AppUserResolver {
  constructor(
    private readonly appUserService: AppUserService,
    private readonly userLinkingService: UserLinkingService,
    private readonly keycloakAdminService: KeycloakAdminService,
  ) {}

  // ─── Existing Queries ──────────────────────────────────────────

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

  // ─── Keycloak Queries ──────────────────────────────────────────

  @Query(() => [KeycloakOrgMember], { name: 'keycloakOrgMembers' })
  async getKeycloakOrgMembers(@Context() context: any): Promise<KeycloakOrgMember[]> {
    const orgId = context.req?.tenantContext?.orgId;
    if (!orgId) throw new Error('Missing orgId in tenant context');

    const kcMembers = await this.keycloakAdminService.getOrganizationMembers(orgId);

    // Cross-reference con AppUser locali
    const allAppUsers = await this.appUserService.findAll();
    const keycloakIdMap = new Map<string, AppUser>();
    for (const u of allAppUsers) {
      if (u.keycloakId) keycloakIdMap.set(u.keycloakId, u);
    }

    // Popola i ruoli KC per ogni membro in parallelo
    const membersWithRoles = await Promise.all(
      kcMembers.map(async m => {
        const linked = keycloakIdMap.get(m.id);
        let realmRoles: { id: string; name: string; description?: string }[] = [];
        try {
          const roles = await this.keycloakAdminService.getUserRealmRoles(m.id);
          realmRoles = roles.map(r => ({ id: r.id, name: r.name, description: r.description }));
        } catch { /* ignora errori singolo utente */ }
        return {
          id: m.id,
          username: m.username,
          email: m.email,
          firstName: m.firstName,
          lastName: m.lastName,
          enabled: m.enabled,
          emailVerified: m.emailVerified,
          isLinked: !!linked,
          linkedAppUserId: linked?.id,
          linkedAppUserName: linked
            ? `${linked.name} ${linked.surname || ''}`.trim()
            : undefined,
          realmRoles,
        };
      }),
    );

    return membersWithRoles;
  }

  @Query(() => [KeycloakRealmRoleType], { name: 'keycloakRealmRoles' })
  async getKeycloakRealmRoles(): Promise<KeycloakRealmRoleType[]> {
    const roles = await this.keycloakAdminService.getRealmRoles();
    return roles.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
    }));
  }

  // ─── Existing Mutations ────────────────────────────────────────

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
  async linkKeycloakUser(@Args('input') input: LinkKeycloakUserInput): Promise<AppUser> {
    return this.userLinkingService.linkToKeycloak(
      input.appUserId,
      input.keycloakUserId,
    );
  }

  // ─── Keycloak Mutations ────────────────────────────────────────

  @Mutation(() => KeycloakOrgMember)
  async createKeycloakUser(
    @Args('input') input: CreateKeycloakUserInput,
    @Context() context: any,
  ): Promise<KeycloakOrgMember> {
    const orgId = context.req?.tenantContext?.orgId;
    if (!orgId) throw new Error('Missing orgId in tenant context');

    // 1. Crea utente in Keycloak
    const newUserId = await this.keycloakAdminService.createUser({
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    // 2. Aggiungi all'organizzazione
    await this.keycloakAdminService.addMemberToOrganization(orgId, newUserId);

    // 3. Assegna ruolo realm se specificato
    if (input.realmRole) {
      await this.keycloakAdminService.assignRealmRoles(newUserId, [input.realmRole]);
    }

    return {
      id: newUserId,
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: true,
      emailVerified: false,
      isLinked: false,
    };
  }

  @Mutation(() => Boolean)
  async assignKeycloakRealmRole(
    @Args('keycloakUserId', { type: () => ID }) keycloakUserId: string,
    @Args('roleName') roleName: string,
  ): Promise<boolean> {
    await this.keycloakAdminService.assignRealmRoles(keycloakUserId, [roleName]);
    return true;
  }

  @Mutation(() => Boolean)
  async revokeKeycloakRealmRole(
    @Args('keycloakUserId', { type: () => ID }) keycloakUserId: string,
    @Args('roleName') roleName: string,
  ): Promise<boolean> {
    await this.keycloakAdminService.revokeRealmRoles(keycloakUserId, [roleName]);
    return true;
  }

  // ─── Update Keycloak User ───────────────────────────────────────

  @Mutation(() => Boolean)
  async updateKeycloakUser(
    @Args('input') input: UpdateKeycloakUserInput,
  ): Promise<boolean> {
    const { keycloakUserId, ...data } = input;
    // Rimuovi campi undefined per non sovrascrivere con null
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined && v !== null),
    );
    if (Object.keys(cleanData).length === 0) {
      throw new Error('Nessun campo da aggiornare');
    }
    await this.keycloakAdminService.updateUser(keycloakUserId, cleanData);
    return true;
  }

  // ─── Reset Keycloak Password ──────────────────────────────────

  @Mutation(() => Boolean)
  async resetKeycloakPassword(
    @Args('input') input: ResetKeycloakPasswordInput,
  ): Promise<boolean> {
    await this.keycloakAdminService.resetPassword(
      input.keycloakUserId,
      input.newPassword,
      input.temporary,
    );
    return true;
  }

  // ─── Verify Email ──────────────────────────────────────────────

  @Mutation(() => Boolean)
  async verifyKeycloakEmail(
    @Args('keycloakUserId', { type: () => ID }) keycloakUserId: string,
  ): Promise<boolean> {
    await this.keycloakAdminService.updateUser(keycloakUserId, { emailVerified: true });
    return true;
  }

  // ─── Delete & Unlink Mutations ──────────────────────────────────

  @Mutation(() => Boolean)
  async deleteAppUser(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.appUserService.delete(id);
  }

  @Mutation(() => AppUser)
  async unlinkKeycloakUser(
    @Args('appUserId', { type: () => ID }) appUserId: string,
  ): Promise<AppUser> {
    return this.appUserService.unlinkKeycloak(appUserId);
  }

  @Mutation(() => Boolean)
  async deleteKeycloakUser(
    @Args('keycloakUserId', { type: () => ID }) keycloakUserId: string,
  ): Promise<boolean> {
    // 1. Scollega l'app user se collegato
    const appUser = await this.appUserService.findByKeycloakId(keycloakUserId);
    if (appUser) {
      await this.appUserService.unlinkKeycloak(appUser.id);
    }
    // 2. Elimina da Keycloak
    await this.keycloakAdminService.deleteUser(keycloakUserId);
    return true;
  }
}
