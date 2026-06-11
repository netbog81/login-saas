import { Injectable, NotFoundException } from '@nestjs/common';
import { ItManager } from '../entities/it-manager.entity';
import { AppUser } from '../entities/app-user.entity';
import { AppUserType } from '../enums/app-user-type.enum';
import { CreateItManagerInput } from '../dto/create-it-manager.input';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class ItManagerService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get itManagerRepo() { return this.dataSource.getRepository(ItManager); }

  private get appUserRepo() { return this.dataSource.getRepository(AppUser); }

  async findAll(): Promise<ItManager[]> {
    return this.itManagerRepo.find({ relations: ['appUser'] });
  }

  async findById(id: string): Promise<ItManager> {
    const im = await this.itManagerRepo.findOne({
      where: { id },
      relations: ['appUser'],
    });
    if (!im) throw new NotFoundException(`ItManager ${id} not found`);
    return im;
  }

  async create(input: CreateItManagerInput): Promise<ItManager> {
    const appUser = this.appUserRepo.create({
      name: input.name,
      surname: input.surname,
      email: input.email,
      phone: input.phone,
      userType: AppUserType.IT_MANAGER,
      attributes: {},
    });
    const savedAppUser = await this.appUserRepo.save(appUser);

    const im = this.itManagerRepo.create({
      appUserId: savedAppUser.id,
      canManageTenant: input.canManageTenant ?? true,
      canManageIntegrations: input.canManageIntegrations ?? true,
      notes: input.notes,
    });
    const savedIm = await this.itManagerRepo.save(im);
    savedIm.appUser = savedAppUser;
    return savedIm;
  }

  async delete(id: string): Promise<boolean> {
    const im = await this.findById(id);
    await this.itManagerRepo.delete(id);
    await this.appUserRepo.delete(im.appUserId);
    return true;
  }
}
