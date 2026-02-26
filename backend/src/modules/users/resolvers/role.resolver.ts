import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { RoleService } from '../services/role.service';
import { AssignRoleInput } from '../dto/link-keycloak-user.input';

@Resolver(() => Role)
export class RoleResolver {
  constructor(private readonly roleService: RoleService) {}

  @Query(() => [Role], { name: 'roles' })
  async findAllRoles(): Promise<Role[]> {
    return this.roleService.findAll();
  }

  @Query(() => Role, { name: 'role', nullable: true })
  async findRole(@Args('id', { type: () => ID }) id: string): Promise<Role> {
    return this.roleService.findById(id);
  }

  @Query(() => [Permission], { name: 'permissions' })
  async findAllPermissions(): Promise<Permission[]> {
    return this.roleService.findAllPermissions();
  }

  @Query(() => [Role], { name: 'userRoles' })
  async getUserRoles(
    @Args('appUserId', { type: () => ID }) appUserId: string,
  ): Promise<Role[]> {
    return this.roleService.getUserRoles(appUserId);
  }

  @Mutation(() => Role)
  async createRole(
    @Args('name') name: string,
    @Args('description', { nullable: true }) description?: string,
  ): Promise<Role> {
    return this.roleService.createRole(name, description);
  }

  @Mutation(() => Boolean)
  async deleteRole(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.roleService.deleteRole(id);
  }

  @Mutation(() => UserRole)
  async assignRole(@Args('input') input: AssignRoleInput): Promise<UserRole> {
    return this.roleService.assignRoleToUser(input.appUserId, input.roleId);
  }

  @Mutation(() => Boolean)
  async revokeRole(@Args('input') input: AssignRoleInput): Promise<boolean> {
    return this.roleService.revokeRoleFromUser(input.appUserId, input.roleId);
  }

  @Mutation(() => RolePermission)
  async assignPermissionToRole(
    @Args('roleId', { type: () => ID }) roleId: string,
    @Args('permissionId', { type: () => ID }) permissionId: string,
  ): Promise<RolePermission> {
    return this.roleService.assignPermissionToRole(roleId, permissionId);
  }

  @Mutation(() => Boolean)
  async revokePermissionFromRole(
    @Args('roleId', { type: () => ID }) roleId: string,
    @Args('permissionId', { type: () => ID }) permissionId: string,
  ): Promise<boolean> {
    return this.roleService.revokePermissionFromRole(roleId, permissionId);
  }
}
