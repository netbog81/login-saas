import { Module } from '@nestjs/common';
import { GeneralSettingsService } from './services/general-settings.service';
import { GeneralSettingsResolver } from './resolvers/general-settings.resolver';

@Module({
  imports: [
  ],
  providers: [
    GeneralSettingsService,
    GeneralSettingsResolver],
  exports: [
    GeneralSettingsService],
})
export class SettingsModule {
  // NOTA containerization-2026-06-11: rimosso `onModuleInit` che chiamava
  // `initializeDefaults()` al boot. In architettura DB-per-tenant non
  // esiste un tenant "predefinito" al bootstrap (nessun AsyncLocalStorage
  // context disponibile). I default vanno inizializzati per-tenant al
  // provisioning (vedi TMS) o lazy alla prima request.
}
