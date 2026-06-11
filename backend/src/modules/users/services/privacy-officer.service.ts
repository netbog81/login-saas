import { Injectable, NotFoundException } from '@nestjs/common';
import { PrivacyOfficer } from '../entities/privacy-officer.entity';
import { AppUser } from '../entities/app-user.entity';
import { AppUserType } from '../enums/app-user-type.enum';
import { CreatePrivacyOfficerInput } from '../dto/create-privacy-officer.input';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class PrivacyOfficerService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get poRepo() { return this.dataSource.getRepository(PrivacyOfficer); }

  private get appUserRepo() { return this.dataSource.getRepository(AppUser); }

  async findAll(): Promise<PrivacyOfficer[]> {
    return this.poRepo.find({ relations: ['appUser'] });
  }

  async findById(id: string): Promise<PrivacyOfficer> {
    const po = await this.poRepo.findOne({
      where: { id },
      relations: ['appUser'],
    });
    if (!po) throw new NotFoundException(`PrivacyOfficer ${id} not found`);
    return po;
  }

  async create(input: CreatePrivacyOfficerInput): Promise<PrivacyOfficer> {
    const appUser = this.appUserRepo.create({
      name: input.name,
      surname: input.surname,
      email: input.email,
      phone: input.phone,
      userType: AppUserType.PRIVACY_OFFICER,
      attributes: {},
    });
    const savedAppUser = await this.appUserRepo.save(appUser);

    const po = this.poRepo.create({
      appUserId: savedAppUser.id,
      certification: input.certification,
      certificationExpiry: input.certificationExpiry,
      dpoRegistrationNumber: input.dpoRegistrationNumber,
    });
    const savedPo = await this.poRepo.save(po);
    savedPo.appUser = savedAppUser;
    return savedPo;
  }

  async delete(id: string): Promise<boolean> {
    const po = await this.findById(id);
    await this.poRepo.delete(id);
    await this.appUserRepo.delete(po.appUserId);
    return true;
  }
}
