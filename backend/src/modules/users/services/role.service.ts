import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class RoleService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get roleRepo() { return this.dataSource.getRepository(Role); }

  private get permissionRepo() { return this.dataSource.getRepository(Permission); }

  private get userRoleRepo() { return this.dataSource.getRepository(UserRole); }

  private get rolePermRepo() { return this.dataSource.getRepository(RolePermission); }

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
    await this.assertNotLastAdmin(appUserId, roleId);
    const result = await this.userRoleRepo.delete({ appUserId, roleId });
    return (result.affected ?? 0) > 0;
  }

  /**
   * L'altra strada per chiudersi fuori: togliere il ruolo all'ultima persona
   * che, tramite quel ruolo, poteva amministrare i permessi. Stesso fermo
   * della revoca di un permesso, applicato dal lato utente.
   */
  private async assertNotLastAdmin(appUserId: string, roleId: string): Promise<void> {
    const [{ remaining }] = await this.userRoleRepo.query(`
      SELECT COUNT(DISTINCT ur.app_user_id)::int AS remaining
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.name = ANY($1)
        AND NOT (ur.app_user_id = $2 AND ur.role_id = $3)
    `, [RoleService.LOCKOUT_PERMISSIONS, appUserId, roleId]);

    if (remaining === 0) {
      throw new BadRequestException(
        'Non si può togliere questo ruolo: è l\'ultima persona che può gestire '
        + 'utenti e permessi. Dai prima il ruolo a qualcun altro.',
      );
    }
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

  /**
   * Permessi senza i quali non si torna indietro.
   *
   * `user_manage` apre la schermata da cui si gestiscono ruoli e permessi:
   * toglierlo all'ultimo che ce l'ha è l'unica mossa di questa pagina che non
   * si può annullare dalla pagina stessa. Servirebbe una migration a mano sul
   * DB del tenant per rimetterlo.
   */
  private static readonly LOCKOUT_PERMISSIONS = ['user_manage'];

  async revokePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    await this.assertNoLockout(roleId, permissionId);
    const result = await this.rolePermRepo.delete({ roleId, permissionId });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Rifiuta la revoca se lascerebbe lo studio senza NESSUN utente in grado di
   * amministrare i permessi.
   *
   * Il controllo è sugli utenti, non sui ruoli: lasciare il permesso a un ruolo
   * che nessuno ricopre chiude fuori esattamente come toglierlo a tutti.
   */
  private async assertNoLockout(roleId: string, permissionId: string): Promise<void> {
    const permission = await this.permissionRepo.findOne({ where: { id: permissionId } });
    if (!permission) return;
    if (!RoleService.LOCKOUT_PERMISSIONS.includes(permission.name)) return;

    const [{ remaining }] = await this.rolePermRepo.query(`
      SELECT COUNT(DISTINCT ur.app_user_id)::int AS remaining
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.id = $1 AND rp.role_id <> $2
    `, [permissionId, roleId]);

    if (remaining === 0) {
      throw new BadRequestException(
        `Non si può togliere "${permission.name}": resterebbe senza nessun utente `
        + 'in grado di gestire i permessi, e questa schermata diventerebbe '
        + 'irraggiungibile per tutti. Assegna prima il permesso a un altro ruolo '
        + 'che qualcuno ricopre.',
      );
    }
  }
}
