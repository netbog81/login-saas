import { Module } from '@nestjs/common';

import { AppUsersModule } from '../users/app-users.module';
import { SettingsModule } from '../settings/settings.module';
import { NoShowService } from './services/no-show.service';
import { NoShowResolver } from './resolvers/no-show.resolver';

/**
 * GESTIONE ASSENZE INGIUSTIFICATE (Statistiche → No Show).
 *
 * Modulo di sola lettura sugli appuntamenti + la tabella `no_show_reviews`
 * con la decisione dello staff. Le entity sono registrate globalmente in
 * app.module.ts; i repository si ottengono dalla DataSource del tenant
 * (stesso pattern di operator-fe-accounts / document-templates).
 */
@Module({
  imports: [AppUsersModule, SettingsModule],
  providers: [NoShowService, NoShowResolver],
  exports: [NoShowService],
})
export class NoShowModule {}
