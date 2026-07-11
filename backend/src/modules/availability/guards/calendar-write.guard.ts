import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Guard di scrittura calendario.
 *
 * Le mutation che creano/modificano/spostano/eliminano appuntamenti del
 * calendario sono riservate a SEGRETERIA e AMMINISTRATORI. Operatore, medico
 * e istruttore vedono il proprio calendario in sola lettura (vedi calendar-v3
 * read-only lato frontend): qui chiudiamo il varco a chi tentasse di scrivere
 * bypassando l'UI (chiamata GraphQL diretta).
 *
 * Decisione basata sui RUOLI Keycloak (`tenantContext.roles`), non sui
 * permessi DB: nel seed corrente operatore/medico hanno ancora
 * `calendar_manage`, quindi un controllo per permesso non discriminerebbe.
 * Il criterio per ruolo è inoltre coerente al 100% con il read-only del
 * frontend.
 *
 * Uso:
 *   @UseGuards(CalendarWriteGuard)
 *   @Mutation(() => AvailabilityAppointment)
 *   async createAvailabilityAppointment(...) { ... }
 */
@Injectable()
export class CalendarWriteGuard implements CanActivate {
  private readonly logger = new Logger(CalendarWriteGuard.name);

  /** Ruoli abilitati a scrivere sul calendario. */
  private static readonly WRITE_ROLES = [
    'segreteria',
    'admin',
    'amministratore',
    'superadmin',
  ];

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const tenantContext = ctx.getContext().req?.tenantContext;

    if (!tenantContext) {
      throw new ForbiddenException('No tenant context');
    }

    const roles: string[] = tenantContext.roles || [];
    const canWrite = roles.some((r) =>
      CalendarWriteGuard.WRITE_ROLES.includes(r),
    );

    if (!canWrite) {
      this.logger.warn(
        `Calendar write denied for ${tenantContext.email || tenantContext.userId} (roles: ${roles.join(', ') || 'none'})`,
      );
      throw new ForbiddenException(
        'Operazione riservata a segreteria e amministratori',
      );
    }

    return true;
  }
}
