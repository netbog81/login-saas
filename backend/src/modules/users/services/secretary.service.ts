import { Injectable, NotFoundException } from '@nestjs/common';
import { Secretary } from '../entities/secretary.entity';
import { AppUser } from '../entities/app-user.entity';
import { AppUserType } from '../enums/app-user-type.enum';
import { CreateSecretaryInput } from '../dto/create-secretary.input';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class SecretaryService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get secretaryRepo() { return this.dataSource.getRepository(Secretary); }

  private get appUserRepo() { return this.dataSource.getRepository(AppUser); }

  async findAll(): Promise<Secretary[]> {
    return this.secretaryRepo.find({ relations: ['appUser'] });
  }

  async findById(id: string): Promise<Secretary> {
    const secretary = await this.secretaryRepo.findOne({
      where: { id },
      relations: ['appUser'],
    });
    if (!secretary) throw new NotFoundException(`Secretary ${id} not found`);
    return secretary;
  }

  async create(input: CreateSecretaryInput): Promise<Secretary> {
    const appUser = this.appUserRepo.create({
      name: input.name,
      surname: input.surname,
      email: input.email,
      phone: input.phone,
      userType: AppUserType.SECRETARY,
      attributes: {},
    });
    const savedAppUser = await this.appUserRepo.save(appUser);

    const secretary = this.secretaryRepo.create({
      appUserId: savedAppUser.id,
      department: input.department,
      canManageAppointments: input.canManageAppointments ?? false,
      canManageBilling: input.canManageBilling ?? false,
    });
    const savedSecretary = await this.secretaryRepo.save(secretary);
    savedSecretary.appUser = savedAppUser;
    return savedSecretary;
  }

  async delete(id: string): Promise<boolean> {
    const secretary = await this.findById(id);
    await this.secretaryRepo.delete(id);
    await this.appUserRepo.delete(secretary.appUserId);
    return true;
  }
}
