import { Module } from '@nestjs/common';
// Entities
import { AppUser } from './entities/app-user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Secretary } from './entities/secretary.entity';
import { PrivacyOfficer } from './entities/privacy-officer.entity';
import { ItManager } from './entities/it-manager.entity';
import { Operator } from '../availability/entities/operator.entity';
// Services
import { AppUserService } from './services/app-user.service';
import { RoleService } from './services/role.service';
import { UserLinkingService } from './services/user-linking.service';
import { KeycloakAdminService } from './services/keycloak-admin.service';
import { SecretaryService } from './services/secretary.service';
import { PrivacyOfficerService } from './services/privacy-officer.service';
import { ItManagerService } from './services/it-manager.service';
// Resolvers
import { AppUserResolver } from './resolvers/app-user.resolver';
import { RoleResolver } from './resolvers/role.resolver';
import { SecretaryResolver } from './resolvers/secretary.resolver';
import { PrivacyOfficerResolver } from './resolvers/privacy-officer.resolver';
import { ItManagerResolver } from './resolvers/it-manager.resolver';
// Guards
import { AuthorizationGuard } from './guards/authorization.guard';

@Module({
  imports: [
  ],
  providers: [
    // Services
    AppUserService,
    RoleService,
    UserLinkingService,
    KeycloakAdminService,
    SecretaryService,
    PrivacyOfficerService,
    ItManagerService,
    // Resolvers
    AppUserResolver,
    RoleResolver,
    SecretaryResolver,
    PrivacyOfficerResolver,
    ItManagerResolver,
    // Guards
    AuthorizationGuard],
  exports: [
    AppUserService,
    RoleService,
    UserLinkingService,
    KeycloakAdminService,
    SecretaryService,
    PrivacyOfficerService,
    ItManagerService,
    AuthorizationGuard],
})
export class AppUsersModule {}
