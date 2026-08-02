import { Module } from '@nestjs/common';
import { PatientDocumentsService } from './services/patient-documents.service';
import { PatientDocumentsController } from './controllers/patient-documents.controller';
import { PatientDocumentsResolver } from './resolvers/patient-documents.resolver';
import { AppUsersModule } from '../users/app-users.module';

/**
 * Documenti scheda paziente: S3 MicroCeph (bucket-per-tenant) + envelope
 * encryption via OpenBao Transit (chiave clinico-docs-<tenantAlias>).
 *
 * Dipendenze globali (registrate in AppModule): EncryptionCoreModule,
 * StorageCoreModule, OpenbaoTokenModule, TenantDataSourceModule.
 * AppUsersModule serve per AuthorizationGuard (AppUserService).
 */
@Module({
  imports: [AppUsersModule],
  controllers: [PatientDocumentsController],
  providers: [PatientDocumentsService, PatientDocumentsResolver],
  exports: [PatientDocumentsService],
})
export class PatientDocumentsModule {}
