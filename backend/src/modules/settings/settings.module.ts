import { Module } from '@nestjs/common';
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
export class SettingsModule {}
