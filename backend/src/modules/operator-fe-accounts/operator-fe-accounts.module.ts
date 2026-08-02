import { Module } from '@nestjs/common';
import { AppUsersModule } from '../users/app-users.module';
import { OperatorFeAccountsService } from './services/operator-fe-accounts.service';
import { OperatorFeAccountsResolver } from './resolvers/operator-fe-accounts.resolver';

/**
 * CONTI FE — conteggi compensi operatore sui trattamenti con sconto FE
 * (Statistiche → Conti FE). Speculare ai "Conti operatori" dell'accounting
 * ma calcolato interamente nel clinico sui campi FE dei servizi:
 *
 *   compenso = royaltyPercentage% × max(0, prezzo praticato − Extra studio FE)
 *
 * Le entity sono registrate globalmente in app.module.ts; i repository si
 * ottengono via DataSource del tenant (pattern document-templates).
 */
@Module({
  imports: [AppUsersModule],
  providers: [OperatorFeAccountsService, OperatorFeAccountsResolver],
  exports: [OperatorFeAccountsService],
})
export class OperatorFeAccountsModule {}
