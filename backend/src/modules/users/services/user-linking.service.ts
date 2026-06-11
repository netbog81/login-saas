import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppUser } from '../entities/app-user.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class UserLinkingService {
  private readonly logger = new Logger(UserLinkingService.name);

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
