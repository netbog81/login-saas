import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AppUserService } from '../../users/services/app-user.service';
import { Treatment } from '../entities/treatment.entity';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { Operator } from '../entities/operator.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

export type OwnedResourceType = 'treatment' | 'therapeutic_path';

export interface RequireOwnershipOptions {
  resource: OwnedResourceType;
  /**
   * Path dell'id da leggere dagli argomenti GraphQL.
   * - 'id'        → args.id (default)
   * - 'input.id'  → args.input.id (input object con campo id)
   */
  idArg?: string;
  /**
   * Permesso di bypass (admin/override). Se l'utente ha questo permesso,
   * l'ownership non viene verificata. Default: 'treatment_delete_any' o
   * 'therapeutic_path_delete_any' a seconda della risorsa.
   */
  bypassPermission?: string;
}

export const OWNERSHIP_METADATA_KEY = 'requireOwnership';

/**
 * Dichiara che un resolver/mutation richiede ownership della risorsa:
 * solo l'AppUser che ha creato il record (sul Treatment: `createdByUserId`;
 * sul TherapeuticPath: `createdByUserId`) può eseguire l'operazione.
 *
 * Il bypass per admin è gestito tramite un permesso (`bypassPermission`).
 *
 *   @RequireOwnership({ resource: 'treatment' })
 *   @UseGuards(OwnershipGuard)
 *   @Mutation()
 *   updateTreatment(@Args('id') id: string) { ... }
 */
export const RequireOwnership = (opts: RequireOwnershipOptions) =>
  SetMetadata(OWNERSHIP_METADATA_KEY, opts);

@Injectable()
export class OwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OwnershipGuard.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly reflector: Reflector,
    private readonly appUserService: AppUserService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get treatmentRepo() { return this.dataSource.getRepository(Treatment); }

  private get pathRepo() { return this.dataSource.getRepository(TherapeuticPath); }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<RequireOwnershipOptions>(
      OWNERSHIP_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!opts) return true;

    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const tenantContext = request?.tenantContext;
    if (!tenantContext) {
      throw new ForbiddenException('No tenant context');
    }

    const appUser = await this.appUserService.findByKeycloakId(
      tenantContext.userId,
    );
    if (!appUser) {
      throw new ForbiddenException('User not found in app');
    }

    // Bypass admin: se l'utente ha il permesso di override, skip check.
    const bypass =
      opts.bypassPermission ??
      (opts.resource === 'treatment'
        ? 'treatment_delete_any'
        : 'therapeutic_path_delete_any');
    const userPermissions = await this.appUserService.getUserPermissions(appUser.id);
    if (userPermissions.includes(bypass)) {
      return true;
    }

    // Leggi id dall'argomento GraphQL configurato. Supporta path dotted,
    // es. 'input.id' per mutation con DTO.
    const args = ctx.getArgs();
    const idArg = opts.idArg ?? 'id';
    const resourceId = idArg
      .split('.')
      .reduce<any>((acc, key) => (acc == null ? acc : acc[key]), args);
    if (!resourceId || typeof resourceId !== 'string') {
      throw new ForbiddenException(
        `OwnershipGuard: argomento "${idArg}" non trovato o non è una stringa`,
      );
    }

    const ownerUserId = await this.resolveOwnerUserId(opts.resource, resourceId);
    if (ownerUserId !== appUser.id) {
      this.logger.warn(
        `AppUser ${appUser.email} ha tentato di operare su ${opts.resource}:${resourceId} ` +
          `di proprietà di ${ownerUserId ?? '<null>'}`,
      );
      throw new ForbiddenException(
        `Operazione consentita solo al creatore del ${opts.resource === 'treatment' ? 'trattamento' : 'percorso'} o a un amministratore.`,
      );
    }

    return true;
  }

  /**
   * Risolve l'AppUser proprietario del record seguendo la catena
   * naturale dei dati esistenti:
   *   - Treatment       → operatorId          → Operator.appUserId
   *   - TherapeuticPath → primaryOperatorId   → Operator.appUserId
   *
   * Niente nuove colonne, niente backfill: i record storici sono già
   * coperti perché la FK Operator esiste da sempre.
   */
  private async resolveOwnerUserId(
    resource: OwnedResourceType,
    id: string,
  ): Promise<string | null> {
    if (resource === 'treatment') {
      const row = await this.treatmentRepo
        .createQueryBuilder('t')
        .leftJoin(Operator, 'op', 'op.id = t."operatorId"')
        .where('t.id = :id', { id })
        .select('op."app_user_id"', 'appUserId')
        .getRawOne<{ appUserId: string | null }>();
      if (!row) throw new NotFoundException(`Trattamento ${id} non trovato`);
      return row.appUserId ?? null;
    }

    const row = await this.pathRepo
      .createQueryBuilder('p')
      .leftJoin(Operator, 'op', 'op.id = p."primaryOperatorId"')
      .where('p.id = :id', { id })
      .select('op."app_user_id"', 'appUserId')
      .getRawOne<{ appUserId: string | null }>();
    if (!row) throw new NotFoundException(`Percorso ${id} non trovato`);
    return row.appUserId ?? null;
  }
}
