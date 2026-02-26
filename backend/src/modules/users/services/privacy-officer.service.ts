import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivacyOfficer } from '../entities/privacy-officer.entity';
import { AppUser } from '../entities/app-user.entity';
import { AppUserType } from '../enums/app-user-type.enum';
import { CreatePrivacyOfficerInput } from '../dto/create-privacy-officer.input';

@Injectable()
export class PrivacyOfficerService {
  constructor(
    @InjectRepository(PrivacyOfficer)
    private readonly poRepo: Repository<PrivacyOfficer>,
    @InjectRepository(AppUser)
    private readonly appUserRepo: Repository<AppUser>,
  ) {}

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
