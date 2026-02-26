import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppUser } from '../entities/app-user.entity';

export interface PendingUser {
  id: string;
  keycloakUserId: string;
  tenantId: string;
  status: string;
  createdAt: string;
}

@Injectable()
export class UserLinkingService {
  private readonly logger = new Logger(UserLinkingService.name);
  private readonly AUTH_API = process.env.AUTH_API_URL || 'https://api.curandis.cloud';

  constructor(
    @InjectRepository(AppUser)
    private readonly appUserRepo: Repository<AppUser>,
    private readonly httpService: HttpService,
  ) {}

  async linkToKeycloak(
    appUserId: string,
    keycloakUserId: string,
    userMappingId: string,
    authCookie: string,
  ): Promise<AppUser> {
    const appUser = await this.appUserRepo.findOne({ where: { id: appUserId } });
    if (!appUser) throw new NotFoundException(`AppUser ${appUserId} not found`);

    // 1. Aggiorna DB locale
    appUser.keycloakId = keycloakUserId;
    appUser.linkedAt = new Date();
    await this.appUserRepo.save(appUser);

    // 2. Notifica Auth Microservice
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.AUTH_API}/auth/api/link-mapping`,
          {
            userMappingId,
            appUserReference: appUserId,
          },
          {
            headers: { Cookie: `curandis_auth_token=${authCookie}` },
          },
        ),
      );
      this.logger.log(`Linked appUser ${appUserId} to Keycloak ${keycloakUserId}`);
    } catch (error: any) {
      this.logger.error(`Failed to notify Auth API for linking: ${error?.message}`);
      throw error;
    }

    return appUser;
  }

  async getPendingUsers(authCookie: string): Promise<PendingUser[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.AUTH_API}/auth/api/pending-users`, {
          headers: { Cookie: `curandis_auth_token=${authCookie}` },
        }),
      );
      return response.data?.data || [];
    } catch (error: any) {
      this.logger.error(`Failed to get pending users: ${error?.message}`);
      return [];
    }
  }

  async provisionAndLink(
    appUserId: string,
    temporaryPassword: string,
    keycloakRoles: string[],
    authCookie: string,
  ): Promise<AppUser> {
    const appUser = await this.appUserRepo.findOne({ where: { id: appUserId } });
    if (!appUser) throw new NotFoundException(`AppUser ${appUserId} not found`);
    if (!appUser.email) throw new Error('AppUser must have an email for provisioning');

    // 1. Crea utente in Keycloak
    const provisionResponse = await firstValueFrom(
      this.httpService.post(
        `${this.AUTH_API}/auth/provision-user`,
        {
          email: appUser.email,
          firstName: appUser.name,
          lastName: appUser.surname || '',
          roles: keycloakRoles,
          temporaryPassword,
        },
        {
          headers: { Cookie: `curandis_auth_token=${authCookie}` },
        },
      ),
    );

    const keycloakId = provisionResponse.data?.keycloakId;
    if (!keycloakId) throw new Error('Failed to provision Keycloak user');

    // 2. Aggiorna DB locale
    appUser.keycloakId = keycloakId;
    appUser.linkedAt = new Date();
    await this.appUserRepo.save(appUser);

    this.logger.log(`Provisioned and linked appUser ${appUserId} -> Keycloak ${keycloakId}`);
    return appUser;
  }
}
