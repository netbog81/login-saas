import { Resolver, Query, Mutation } from '@nestjs/graphql';
import { Logger, Inject } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';

import { TenantSchemaStatus } from './dto/tenant-schema-status';

/**
 * Stub del resolver "tenant schema status" — backward-compat con il dashboard
 * admin del frontend (admin/Database tab) che è ancora cablato sul vecchio
 * modello schema-per-tenant.
 *
 * Nel mondo DB-per-tenant post-containerization non esiste più uno "schema"
 * da provisionare: ogni tenant ha il suo DB completo (kv/tenant-clinico-db/<alias>)
 * gestito dal TMS al provisioning. Quindi i metodi sotto ritornano sempre
 * "tutto OK" se il caller arriva fin qui (ha già passato il middleware
 * auth-core, quindi il tenant esiste ed è attivo).
 *
 * Il dashboard admin/Database può essere dismesso quando il frontend smetterà
 * di chiamare queste query. A quel punto questo file e il DTO possono essere
 * rimossi senza impatto.
 */
@Resolver(() => TenantSchemaStatus)
export class TenantAdminResolver {
  private readonly logger = new Logger(TenantAdminResolver.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  @Query(() => TenantSchemaStatus, {
    name: 'tenantSchemaStatus',
    description: 'Deprecato: nel mondo DB-per-tenant ritorna sempre healthy.',
  })
  async getStatus(): Promise<TenantSchemaStatus> {
    const alias = this.tenantContext.getTenantAlias() ?? '';
    const dbName = this.tenantContext.getDbName() ?? '';
    return {
      schemaName: 'public',
      existsInMainDb: true,
      tenantStatus: 'active',
      isAligned: true,
      message: `Tenant "${alias}" su DB "${dbName}" — modello DB-per-tenant`,
      databaseName: dbName,
      databaseHost: process.env.DB_PUBLIC_HOST ?? 'saas.curandis.cloud',
    };
  }

  @Mutation(() => TenantSchemaStatus, {
    name: 'provisionTenantSchema',
    description: 'Deprecato: provisioning dei tenant avviene dal TMS, non più da qui.',
  })
  async provision(): Promise<TenantSchemaStatus> {
    this.logger.warn(
      'provisionTenantSchema chiamata: no-op in architettura DB-per-tenant. ' +
        'Il provisioning avviene dal TMS al onboarding del tenant.',
    );
    return this.getStatus();
  }
}
