import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneralSettings } from './entities/general-settings.entity';
import { GeneralSettingsService } from './services/general-settings.service';
import { GeneralSettingsResolver } from './resolvers/general-settings.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([GeneralSettings]),
  ],
  providers: [
    GeneralSettingsService,
    GeneralSettingsResolver,
  ],
  exports: [
    GeneralSettingsService,
    TypeOrmModule,
  ],
})
export class SettingsModule implements OnModuleInit {
  constructor(private readonly settingsService: GeneralSettingsService) {}

  async onModuleInit(): Promise<void> {
    // Inizializza le impostazioni predefinite all'avvio del modulo
    // Se esistono già, non vengono sovrascritte
    await this.settingsService.initializeDefaults();
    console.log('[SettingsModule] Default settings initialized');
  }
}
