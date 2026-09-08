import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { GeneralSettingsService } from '../../settings/services/general-settings.service';

/**
 * Guard delle marcature di presenza/assenza (presentato, non presentato,
 * ritardo).
 *
 * Segnare che un paziente non e' venuto e' un FATTO OSSERVATO, non una
 * decisione economica: chi lo vede per primo e' spesso l'operatore in sala,
 * non la segreteria. Per questo non si usa `CalendarWriteGuard` (che riserva
 * tutto a segreteria/admin e bloccava gli istruttori di palestra sul
 * `markAppointmentLateArrival`), ma una regola in due tempi:
 *
 *  - segreteria e amministratori possono sempre;
 *  - tutti gli altri ruoli solo se l'impostazione
 *    `noShow.operatorsCanMark` e' attiva (default true).
 *
 * La decisione economica sull'assenza (addebita / esonera) resta altrove,
 * sotto `BillingWriteGuard`.
 */
@Injectable()
export class AttendanceMarkGuard implements CanActivate {
  private readonly logger = new Logger(AttendanceMarkGuard.name);

  /** Ruoli che possono marcare presenze/assenze a prescindere dall'impostazione. */
  private static readonly ALWAYS_ALLOWED_ROLES = [
    'segreteria',
    'admin',
    'amministratore',
    'superadmin',
  ];

  constructor(private readonly settingsService: GeneralSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const tenantContext = ctx.getContext().req?.tenantContext;

    if (!tenantContext) {
      throw new ForbiddenException('No tenant context');
    }

    const roles: string[] = tenantContext.roles || [];
    if (roles.some((r) => AttendanceMarkGuard.ALWAYS_ALLOWED_ROLES.includes(r))) {
      return true;
    }

    if (await this.settingsService.canOperatorsMarkAttendance()) {
      return true;
    }

    this.logger.warn(
      `Marcatura presenza negata a ${tenantContext.email || tenantContext.userId} ` +
        `(ruoli: ${roles.join(', ') || 'nessuno'}) — noShow.operatorsCanMark = false`,
    );
    throw new ForbiddenException(
      'La marcatura delle assenze è riservata alla segreteria. ' +
        'Un amministratore può abilitarla per gli operatori dalle Impostazioni.',
    );
  }
}
