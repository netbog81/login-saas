import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppUser } from '../entities/app-user.entity';

@Injectable()
export class UserLinkingService {
  private readonly logger = new Logger(UserLinkingService.name);

  constructor(
    @InjectRepository(AppUser)
    private readonly appUserRepo: Repository<AppUser>,
  ) {}

  async linkToKeycloak(
    appUserId: string,
    keycloakUserId: string,
  ): Promise<AppUser> {
    const appUser = await this.appUserRepo.findOne({ where: { id: appUserId } });
    if (!appUser) throw new NotFoundException(`AppUser ${appUserId} not found`);

    appUser.keycloakId = keycloakUserId;
    appUser.linkedAt = new Date();
    await this.appUserRepo.save(appUser);

    this.logger.log(`Linked appUser ${appUserId} to Keycloak ${keycloakUserId}`);
    return appUser;
  }
}
