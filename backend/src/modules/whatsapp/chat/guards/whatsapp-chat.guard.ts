import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Guard di accesso alla chat WhatsApp.
 *
 * Le conversazioni contengono testo libero scritto da e verso i pazienti: e'
 * dato sanitario a tutti gli effetti, e la corrispondenza con lo studio non
 * riguarda il singolo operatore o istruttore. L'accesso resta quindi alla sola
 * SEGRETERIA (e agli amministratori), come per le altre funzioni di front
 * office.
 *
 * Come per BillingWriteGuard il controllo e' sui RUOLI Keycloak e non sui
 * permessi DB: non esiste un permesso specifico "chat", e riusarne uno
 * generico darebbe accesso anche a chi non deve averlo.
 */
@Injectable()
export class WhatsappChatGuard implements CanActivate {
  private readonly logger = new Logger(WhatsappChatGuard.name);

  /** Ruoli abilitati a leggere e scrivere nelle conversazioni. */
  private static readonly CHAT_ROLES = [
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
    const allowed = roles.some((r) => WhatsappChatGuard.CHAT_ROLES.includes(r));

    if (!allowed) {
      this.logger.warn(
        `Accesso chat WhatsApp negato a ${tenantContext.email || tenantContext.userId} ` +
        `(ruoli: ${roles.join(', ') || 'nessuno'})`,
      );
      throw new ForbiddenException(
        'Accesso alle conversazioni WhatsApp riservato alla segreteria',
      );
    }

    return true;
  }
}
