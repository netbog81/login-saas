import { Injectable, Injector } from '@angular/core';
import { gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

export interface TenantSchemaStatus {
  schemaName: string;
  existsInMainDb: boolean;
  tenantStatus: string;
  isAligned: boolean;
  message?: string;
  databaseName?: string;
  databaseHost?: string;
}

const TENANT_SCHEMA_STATUS = gql`
  query TenantSchemaStatus {
    tenantSchemaStatus {
      schemaName
      existsInMainDb
      tenantStatus
      isAligned
      message
      databaseName
      databaseHost
    }
  }
`;

const PROVISION_TENANT_SCHEMA = gql`
  mutation ProvisionTenantSchema {
    provisionTenantSchema {
      schemaName
      existsInMainDb
      tenantStatus
      isAligned
      message
      databaseName
      databaseHost
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class TenantAdminService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getTenantSchemaStatus(): Observable<TenantSchemaStatus> {
    return this.query<{ tenantSchemaStatus: TenantSchemaStatus }>(TENANT_SCHEMA_STATUS).pipe(
      map((result) => result.tenantSchemaStatus),
    );
  }

  provisionTenantSchema(): Observable<TenantSchemaStatus> {
    return this.mutate<{ provisionTenantSchema: TenantSchemaStatus }>(
      PROVISION_TENANT_SCHEMA,
      {},
      [{ query: TENANT_SCHEMA_STATUS }],
    ).pipe(map((result) => result.provisionTenantSchema));
  }
}
