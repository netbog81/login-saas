import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppUser } from '../entities/app-user.entity';
import { AppUserType } from '../enums/app-user-type.enum';
import { CreateAppUserInput } from '../dto/create-app-user.input';
import { UpdateAppUserInput } from '../dto/update-app-user.input';

@Injectable()
export class AppUserService {
  constructor(
    @InjectRepository(AppUser)
    private readonly appUserRepo: Repository<AppUser>,
  ) {}

  async findAll(filters?: {
    userType?: AppUserType;
    isActive?: boolean;
  }): Promise<AppUser[]> {
    const where: any = {};
    if (filters?.userType) where.userType = filters.userType;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    return this.appUserRepo.find({ where, order: { name: 'ASC' } });
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
    return this.appUserRepo.save(user);
  }

  async update(id: string, input: UpdateAppUserInput): Promise<AppUser> {
    const user = await this.findById(id);
    Object.assign(user, input);
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
