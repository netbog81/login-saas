import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AppUser } from '../entities/app-user.entity';
import { AppUserType } from '../enums/app-user-type.enum';
import { CreateAppUserInput } from '../dto/create-app-user.input';
import { UpdateAppUserInput } from '../dto/update-app-user.input';
import { Operator } from '../../availability/entities/operator.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class AppUserService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get appUserRepo() { return this.dataSource.getRepository(AppUser); }

  private get operatorRepo() { return this.dataSource.getRepository(Operator); }

  async findAll(filters?: {
    userType?: AppUserType;
    isActive?: boolean;
  }): Promise<AppUser[]> {
    const where: any = {};
    if (filters?.userType) where.userType = filters.userType;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    return this.appUserRepo.find({
      where,
      relations: ['userRoles', 'userRoles.role'],
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<AppUser> {
    const user = await this.appUserRepo.findOne({
      where: { id },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) throw new NotFoundException(`AppUser ${id} not found`);
    return user;
  }

  async findByKeycloakId(keycloakId: string): Promise<AppUser | null> {
    return this.appUserRepo.findOne({
      where: { keycloakId },
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  async findByEmail(email: string): Promise<AppUser | null> {
    return this.appUserRepo.findOne({ where: { email } });
  }

  async findUnlinked(userType?: AppUserType): Promise<AppUser[]> {
    const qb = this.appUserRepo.createQueryBuilder('u')
      .where('u.keycloakId IS NULL')
      .andWhere('u.isActive = true');
    if (userType) qb.andWhere('u.userType = :userType', { userType });
    return qb.orderBy('u.name', 'ASC').getMany();
  }

  async create(input: CreateAppUserInput): Promise<AppUser> {
    const user = this.appUserRepo.create({
      ...input,
      attributes: input.attributes || {},
    });
    const savedUser = await this.appUserRepo.save(user);

    // Se il tipo è OPERATOR, crea anche il record nella tabella operators
    if (input.userType === AppUserType.OPERATOR) {
      const operator = this.operatorRepo.create({
        name: input.name,
        surname: input.surname,
        email: input.email,
        phone: input.phone,
        appUserId: savedUser.id,
        isActive: true,
        maxConcurrentAppointments: 1,
      });
      await this.operatorRepo.save(operator);
    }

    return savedUser;
  }

  async update(id: string, input: UpdateAppUserInput): Promise<AppUser> {
    const user = await this.findById(id);
    Object.assign(user, input);
    return this.appUserRepo.save(user);
  }

  async delete(id: string): Promise<boolean> {
    const user = await this.findById(id);

    // Se è un OPERATOR collegato a un record operatore, bloccare la
    // cancellazione: prima va archiviato/eliminato l'operatore (con la
    // logica delete/archive che preserva lo storico clinico). Non possiamo
    // hard-deletare cascade qui perché perderemmo trattamenti, percorsi,
    // valutazioni. L'admin riceve un messaggio esplicito.
    if (user.userType === AppUserType.OPERATOR) {
      const operator = await this.operatorRepo.findOne({
        where: { appUserId: id },
        withDeleted: true,
      });
      if (operator && !operator.deletedAt) {
        throw new BadRequestException(
          `Questo utente è collegato all'operatore "${operator.name} ${operator.surname ?? ''}". ` +
            `Prima archivialo o eliminalo dalla pagina Operatori, poi torna qui per eliminare l'utente.`,
        );
      }
      // Operatore già archiviato: scollego il riferimento prima di eliminare l'AppUser,
      // così il record archiviato resta consultabile senza FK al user cancellato.
      if (operator?.deletedAt) {
        await this.operatorRepo.update(operator.id, { appUserId: null as any });
      }
    }

    await this.appUserRepo.remove(user);
    return true;
  }

  async unlinkKeycloak(id: string): Promise<AppUser> {
    const user = await this.findById(id);
    user.keycloakId = null as any;
    user.linkedAt = null as any;
    return this.appUserRepo.save(user);
  }

  async getUserRoleNames(id: string): Promise<string[]> {
    const user = await this.appUserRepo.findOne({
      where: { id },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user?.userRoles) return [];
    return user.userRoles.map((ur) => ur.role.name);
  }

  async getUserPermissions(id: string): Promise<string[]> {
    const result = await this.appUserRepo.query(`
      SELECT DISTINCT p.name
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.app_user_id = $1
      ORDER BY p.name
    `, [id]);
    return result.map((r: any) => r.name);
  }
}
