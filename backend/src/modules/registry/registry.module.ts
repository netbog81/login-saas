import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { RegistryConfig } from './registry.config';
import { RegistryClient } from './registry.client';
import { RegistryServiceTokenService } from './registry-service-token.service';
import { RegistrySubjectFieldsResolver } from './resolvers/registry-subject-fields.resolver';

/**
 * Modulo globale: tutti i moduli che hanno bisogno del RegistryClient
 * (patients, registry-events, ecc.) lo iniettano direttamente.
 */
@Global()
@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    RegistryConfig,
    RegistryServiceTokenService,
    RegistryClient,
    RegistrySubjectFieldsResolver,
  ],
  exports: [RegistryConfig, RegistryClient, RegistryServiceTokenService],
})
export class RegistryModule {}
