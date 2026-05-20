import { Resolver, Query, Mutation, Context } from '@nestjs/graphql';
import { ForbiddenException, Logger } from '@nestjs/common';
import { TenantSchemaService } from './tenant-schema.service';
import { TenantSchemaStatus } from './dto/tenant-schema-status';

/**
 * Resolver GraphQL per la gestione dello schema tenant.
 * Espone query e mutation accessibili solo dagli admin.
 *
 * Tutte le operazioni leggono il tenantContext iniettato da TenantContextMiddleware.
 */
@Resolver()
export class TenantAdminResolver {
  private readonly logger = new Logger(TenantAdminResolver.name);

  constructor(private readonly tenantSchemaService: TenantSchemaService) {}

  /**
   * Verifica lo stato dello schema del tenant corrente:
   * - existsInMainDb: schema presente nel DB PostgreSQL
   * - tenantStatus: stato nel Auth DB (active | pending_schema | suspended)
   * - isAligned: schema presente E stato active
   */
  @Query(() => TenantSchemaStatus)
  async tenantSchemaStatus(@Context() ctx: any): Promise<TenantSchemaStatus> {
    const tenantContext = ctx.req?.tenantContext;
    if (!tenantContext) {
      throw new ForbiddenException('Nessun contesto tenant disponibile');
    }

    const { schemaName, tenantStatus, roles } = tenantContext;
    this.requireAdminRole(roles);

    const existsInMainDb = schemaName
      ? await this.tenantSchemaService.schemaExists(schemaName)
      : false;

    const isAligned = existsInMainDb && tenantStatus === 'active';

    let message: string;
    if (isAligned) {
      message = `Schema "${schemaName}" presente e allineato con Auth DB.`;
    } else if (!existsInMainDb && tenantStatus === 'pending_schema') {
      message = `Schema "${schemaName}" non ancora creato nel database principale.`;
    } else if (existsInMainDb && tenantStatus === 'pending_schema') {
      message = `Schema "${schemaName}" presente nel DB ma Auth DB non è stato notificato. Riprova il provisioning.`;
    } else if (!existsInMainDb && tenantStatus === 'active') {
      message = `Schema "${schemaName}" risulta attivo nell'Auth DB ma non esiste nel database principale. Contattare il supporto.`;
    } else {
      message = `Stato tenant: ${tenantStatus}`;
    }

    const connInfo = this.tenantSchemaService.getConnectionInfo();

    return { schemaName: schemaName || '', existsInMainDb, tenantStatus, isAligned, message, ...connInfo };
  }

  /**
   * Crea lo schema del tenant nel database principale e notifica l'Auth DB.
   * Idempotente: se lo schema esiste già non lo ricrea.
   */
  @Mutation(() => TenantSchemaStatus)
  async provisionTenantSchema(@Context() ctx: any): Promise<TenantSchemaStatus> {
    const tenantContext = ctx.req?.tenantContext;
    if (!tenantContext) {
      throw new ForbiddenException('Nessun contesto tenant disponibile');
    }

    const { schemaName, tenantId, tenantStatus, roles } = tenantContext;
    this.requireAdminRole(roles);

    if (!schemaName || !tenantId) {
      throw new ForbiddenException('schemaName o tenantId mancante nel token JWT');
    }

    // Recupera il Bearer token per la chiamata callback al TMS
    const authHeader = ctx.req?.headers?.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    this.logger.log(`Admin richiede provisioning schema "${schemaName}" per tenant "${tenantId}"`);

    await this.tenantSchemaService.provisionTenantSchema(schemaName, tenantId, bearerToken);

    const existsInMainDb = await this.tenantSchemaService.schemaExists(schemaName);
    // Dopo confirmSchemaCreated, l'Auth DB ha aggiornato lo stato
    // Ma il JWT corrente ha ancora il vecchio tenantStatus — il frontend
    // dovrà ricaricare il currentUser per ottenere tenantStatus aggiornato
    const newTenantStatus = existsInMainDb ? 'active' : tenantStatus;
    const isAligned = existsInMainDb && newTenantStatus === 'active';

    return {
      schemaName,
      existsInMainDb,
      tenantStatus: newTenantStatus,
      isAligned,
      message: isAligned
        ? `Schema "${schemaName}" creato con successo. Il tenant è ora attivo.`
        : `Errore durante la creazione dello schema. Riprovare.`,
    };
  }

  private requireAdminRole(roles: string[]): void {
    const adminRoles = ['admin', 'superadmin', 'it_manager', 'amministratore'];
    const hasAdmin = roles?.some((r) => adminRoles.includes(r.toLowerCase()));
    if (!hasAdmin) {
      throw new ForbiddenException('Accesso riservato agli amministratori');
    }
  }
}
