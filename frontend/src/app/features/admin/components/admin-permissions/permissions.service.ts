import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { gql } from '@apollo/client/core';

import { BaseGraphQLService } from '../../../../core/services/base-graphql.service';

export interface PermissionRow {
  id: string;
  name: string;
  resourceType?: string | null;
  action?: string | null;
  description?: string | null;
}

export interface RoleWithPermissions {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  rolePermissions?: { permission: PermissionRow }[] | null;
}

export interface DenialOperation {
  operation: string;
  count: number;
}

export interface DenialSummary {
  appUserId?: string | null;
  keycloakId?: string | null;
  email?: string | null;
  permission: string;
  reason: string;
  count: number;
  lastOccurredAt: string;
  operations: DenialOperation[];
}

const GET_MATRIX = gql`
  query PermissionMatrix {
    roles {
      id
      name
      description
      isSystem
      rolePermissions {
        permission {
          id
          name
        }
      }
    }
    permissions {
      id
      name
      resourceType
      action
      description
    }
  }
`;

const GRANT = gql`
  mutation AssignPermissionToRole($roleId: ID!, $permissionId: ID!) {
    assignPermissionToRole(roleId: $roleId, permissionId: $permissionId) {
      roleId
      permissionId
    }
  }
`;

const REVOKE = gql`
  mutation RevokePermissionFromRole($roleId: ID!, $permissionId: ID!) {
    revokePermissionFromRole(roleId: $roleId, permissionId: $permissionId)
  }
`;

const GET_DENIALS = gql`
  query PermissionDenialSummary($days: Int!) {
    permissionDenialSummary(days: $days) {
      appUserId
      keycloakId
      email
      permission
      reason
      count
      lastOccurredAt
      operations {
        operation
        count
      }
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class PermissionsAdminService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getMatrix(): Observable<{ roles: RoleWithPermissions[]; permissions: PermissionRow[] }> {
    return this.query<{ roles: RoleWithPermissions[]; permissions: PermissionRow[] }>(GET_MATRIX);
  }

  grant(roleId: string, permissionId: string): Observable<boolean> {
    return this.mutate<{ assignPermissionToRole: unknown }>(GRANT, { roleId, permissionId })
      .pipe(map(() => true));
  }

  revoke(roleId: string, permissionId: string): Observable<boolean> {
    return this.mutate<{ revokePermissionFromRole: boolean }>(REVOKE, { roleId, permissionId })
      .pipe(map((r) => r.revokePermissionFromRole));
  }

  getDenials(days: number): Observable<DenialSummary[]> {
    return this.query<{ permissionDenialSummary: DenialSummary[] }>(GET_DENIALS, { days })
      .pipe(map((r) => r.permissionDenialSummary));
  }
}
