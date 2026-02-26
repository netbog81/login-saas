import { Injectable, Injector } from '@angular/core';
import { gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

export type AppUserType = 'OPERATOR' | 'SECRETARY' | 'PRIVACY_OFFICER' | 'IT_MANAGER';

export interface AppUser {
  id: string;
  name: string;
  surname?: string;
  email?: string;
  phone?: string;
  userType: AppUserType;
  isActive: boolean;
  keycloakId?: string;
  linkedAt?: string;
  userRoles?: { role: { id: string; name: string } }[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
}

export interface CreateAppUserInput {
  name: string;
  surname?: string;
  email?: string;
  phone?: string;
  userType: AppUserType;
}

export interface UpdateAppUserInput {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

export interface LinkKeycloakUserInput {
  appUserId: string;
  keycloakUserId: string;
  userMappingId: string;
}

export interface AssignRoleInput {
  appUserId: string;
  roleId: string;
}

const APP_USER_FIELDS = gql`
  fragment AppUserFields on AppUser {
    id
    name
    surname
    email
    phone
    userType
    isActive
    keycloakId
    linkedAt
    userRoles {
      role {
        id
        name
      }
    }
  }
`;

const GET_APP_USERS = gql`
  ${APP_USER_FIELDS}
  query GetAppUsers($userType: AppUserType, $isActive: Boolean) {
    appUsers(userType: $userType, isActive: $isActive) {
      ...AppUserFields
    }
  }
`;

const GET_UNLINKED_USERS = gql`
  ${APP_USER_FIELDS}
  query GetUnlinkedAppUsers($userType: AppUserType) {
    unlinkedAppUsers(userType: $userType) {
      ...AppUserFields
    }
  }
`;

const CREATE_APP_USER = gql`
  ${APP_USER_FIELDS}
  mutation CreateAppUser($input: CreateAppUserInput!) {
    createAppUser(input: $input) {
      ...AppUserFields
    }
  }
`;

const UPDATE_APP_USER = gql`
  ${APP_USER_FIELDS}
  mutation UpdateAppUser($id: ID!, $input: UpdateAppUserInput!) {
    updateAppUser(id: $id, input: $input) {
      ...AppUserFields
    }
  }
`;

const LINK_KEYCLOAK_USER = gql`
  ${APP_USER_FIELDS}
  mutation LinkKeycloakUser($input: LinkKeycloakUserInput!) {
    linkKeycloakUser(input: $input) {
      ...AppUserFields
    }
  }
`;

const GET_ROLES = gql`
  query GetRoles {
    roles {
      id
      name
      description
      isSystem
    }
  }
`;

const ASSIGN_ROLE = gql`
  mutation AssignRole($input: AssignRoleInput!) {
    assignRole(input: $input) {
      appUserId
      roleId
    }
  }
`;

const REVOKE_ROLE = gql`
  mutation RevokeRole($input: AssignRoleInput!) {
    revokeRole(input: $input)
  }
`;

@Injectable({ providedIn: 'root' })
export class AppUserService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getUsers(userType?: AppUserType, isActive?: boolean): Observable<AppUser[]> {
    return this.query<{ appUsers: AppUser[] }>(
      GET_APP_USERS,
      { userType, isActive },
    ).pipe(map((r) => r.appUsers));
  }

  getUnlinkedUsers(userType?: AppUserType): Observable<AppUser[]> {
    return this.query<{ unlinkedAppUsers: AppUser[] }>(
      GET_UNLINKED_USERS,
      { userType },
    ).pipe(map((r) => r.unlinkedAppUsers));
  }

  createUser(input: CreateAppUserInput): Observable<AppUser> {
    return this.mutate<{ createAppUser: AppUser }>(
      CREATE_APP_USER,
      { input },
      [{ query: GET_APP_USERS }],
    ).pipe(map((r) => r.createAppUser));
  }

  updateUser(id: string, input: UpdateAppUserInput): Observable<AppUser> {
    return this.mutate<{ updateAppUser: AppUser }>(
      UPDATE_APP_USER,
      { id, input },
      [{ query: GET_APP_USERS }],
    ).pipe(map((r) => r.updateAppUser));
  }

  linkKeycloakUser(input: LinkKeycloakUserInput): Observable<AppUser> {
    return this.mutate<{ linkKeycloakUser: AppUser }>(
      LINK_KEYCLOAK_USER,
      { input },
      [{ query: GET_APP_USERS }, { query: GET_UNLINKED_USERS }],
    ).pipe(map((r) => r.linkKeycloakUser));
  }

  getRoles(): Observable<Role[]> {
    return this.query<{ roles: Role[] }>(GET_ROLES).pipe(map((r) => r.roles));
  }

  assignRole(input: AssignRoleInput): Observable<boolean> {
    return this.mutate<{ assignRole: any }>(
      ASSIGN_ROLE,
      { input },
      [{ query: GET_APP_USERS }],
    ).pipe(map(() => true));
  }

  revokeRole(input: AssignRoleInput): Observable<boolean> {
    return this.mutate<{ revokeRole: boolean }>(
      REVOKE_ROLE,
      { input },
      [{ query: GET_APP_USERS }],
    ).pipe(map((r) => r.revokeRole));
  }
}
