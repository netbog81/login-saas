import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { RolePermission } from '../entities/role-permission.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermRepo: Repository<RolePermission>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roleRepo.find({
      relations: ['rolePermissions', 'rolePermissions.permission'],
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async findByName(name: string): Promise<Role | null> {
    return this.roleRepo.findOne({ where: { name } });
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({ order: { resourceType: 'ASC', action: 'ASC' } });
  }

  async assignRoleToUser(appUserId: string, roleId: string): Promise<UserRole> {
    const existing = await this.userRoleRepo.findOne({
      where: { appUserId, roleId },
    });
    if (existing) return existing;
    const userRole = this.userRoleRepo.create({ appUserId, roleId });
    return this.userRoleRepo.save(userRole);
  }

  async revokeRoleFromUser(appUserId: string, roleId: string): Promise<boolean> {
    const result = await this.userRoleRepo.delete({ appUserId, roleId });
    return (result.affected ?? 0) > 0;
  }

  async getUserRoles(appUserId: string): Promise<Role[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { appUserId },
      relations: ['role', 'role.rolePermissions', 'role.rolePermissions.permission'],
    });
    return userRoles.map((ur) => ur.role);
  }

  async createRole(name: string, description?: string): Promise<Role> {
    const existing = await this.roleRepo.findOne({ where: { name } });
    if (existing) throw new BadRequestException(`Role "${name}" already exists`);
    const role = this.roleRepo.create({ name, description, isSystem: false });
    return this.roleRepo.save(role);
  }

  async deleteRole(id: string): Promise<boolean> {
    const role = await this.findById(id);
    if (role.isSystem) throw new BadRequestException('Cannot delete system role');
    const result = await this.roleRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission> {
    const existing = await this.rolePermRepo.findOne({
      where: { roleId, permissionId },
    });
    if (existing) return existing;
    const rp = this.rolePermRepo.create({ roleId, permissionId });
    return this.rolePermRepo.save(rp);
  }

  async revokePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    const result = await this.rolePermRepo.delete({ roleId, permissionId });
    return (result.affected ?? 0) > 0;
  }
}
