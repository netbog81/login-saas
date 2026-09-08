import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Guard di scrittura fatturazione.
 *
 * Le mutation che gestiscono il ciclo di FATTURAZIONE di un trattamento
 * (invio/marcatura "pronto per fatturazione", annullo invio, richiamo,
 * re-invio, chiusura banner/alert di accounting) sono riservate a SEGRETERIA
 * e AMMINISTRATORI. L'operatore può lavorare clinicamente sui propri
 * trattamenti (completare/chiudere/riaprire) ma NON deve interagire col
 * sistema di fatturazione.
 *
 * Decisione basata sui RUOLI Keycloak (`tenantContext.roles`), non sui
 * permessi DB: alcune di queste mutation usano permessi (es.
 * `treatment_delete_own`, `treatment_write`) che l'operatore possiede
 * legittimamente per il lavoro clinico, quindi un controllo per permesso non
 * discriminerebbe l'azione di billing. Stesso criterio del CalendarWriteGuard.
 *
 * Uso:
 *   @UseGuards(BillingWriteGuard)
 *   @Mutation(() => Treatment)
 *   async cancelTreatment(...) { ... }
 */
/**
 * Ruoli che operano "da segreteria": abilitati alle azioni di fatturazione e,
 * più in generale, a incassare qualsiasi trattamento (anche gli sconto FE di
 * qualunque operatore). Fonte unica: la usano BillingWriteGuard,
 * TreatmentResolver e PendingFeCollectionsResolver.
 */
export const BILLING_SECRETARY_ROLES = [
  'segreteria',
  'admin',
  'amministratore',
  'superadmin',
];

@Injectable()
export class BillingWriteGuard implements CanActivate {
  private readonly logger = new Logger(BillingWriteGuard.name);

  /** Ruoli abilitati alle azioni di fatturazione. */
  private static readonly BILLING_ROLES = BILLING_SECRETARY_ROLES;

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const tenantContext = ctx.getContext().req?.tenantContext;

    if (!tenantContext) {
      throw new ForbiddenException('No tenant context');
    }

    const roles: string[] = tenantContext.roles || [];
    const canWrite = roles.some((r) =>
      BillingWriteGuard.BILLING_ROLES.includes(r),
    );

    if (!canWrite) {
      this.logger.warn(
        `Billing action denied for ${tenantContext.email || tenantContext.userId} (roles: ${roles.join(', ') || 'none'})`,
      );
      throw new ForbiddenException(
        'Operazione di fatturazione riservata a segreteria e amministratori',
      );
    }

    return true;
  }
}
