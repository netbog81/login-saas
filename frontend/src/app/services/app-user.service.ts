import { Injectable, Injector } from '@angular/core';
import { gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

// ─── Interfaces ──────────────────────────────────────────────────

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
}

export interface AssignRoleInput {
  appUserId: string;
  roleId: string;
}

export interface KeycloakOrgMember {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  isLinked: boolean;
  linkedAppUserId?: string;
  linkedAppUserName?: string;
  realmRoles?: KeycloakRealmRole[];
}

export interface KeycloakRealmRole {
  id: string;
  name: string;
  description?: string;
}

export interface CreateKeycloakUserInput {
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  realmRole?: string;
}

// ─── GraphQL Documents ──────────────────────────────────────────

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

const GET_KEYCLOAK_ORG_MEMBERS = gql`
  query GetKeycloakOrgMembers {
    keycloakOrgMembers {
      id
      username
      email
      firstName
      lastName
      enabled
      emailVerified
      isLinked
      linkedAppUserId
      linkedAppUserName
      realmRoles {
        id
        name
      }
    }
  }
`;

const GET_KEYCLOAK_REALM_ROLES = gql`
  query GetKeycloakRealmRoles {
    keycloakRealmRoles {
      id
      name
      description
    }
  }
`;

const CREATE_KEYCLOAK_USER = gql`
  mutation CreateKeycloakUser($input: CreateKeycloakUserInput!) {
    createKeycloakUser(input: $input) {
      id
      username
      email
      firstName
      lastName
      enabled
      emailVerified
      isLinked
    }
  }
`;

const ASSIGN_KC_REALM_ROLE = gql`
  mutation AssignKeycloakRealmRole($keycloakUserId: ID!, $roleName: String!) {
    assignKeycloakRealmRole(keycloakUserId: $keycloakUserId, roleName: $roleName)
  }
`;

const REVOKE_KC_REALM_ROLE = gql`
  mutation RevokeKeycloakRealmRole($keycloakUserId: ID!, $roleName: String!) {
    revokeKeycloakRealmRole(keycloakUserId: $keycloakUserId, roleName: $roleName)
  }
`;

const DELETE_APP_USER = gql`
  mutation DeleteAppUser($id: ID!) {
    deleteAppUser(id: $id)
  }
`;

const UNLINK_KEYCLOAK_USER = gql`
  ${APP_USER_FIELDS}
  mutation UnlinkKeycloakUser($appUserId: ID!) {
    unlinkKeycloakUser(appUserId: $appUserId) {
      ...AppUserFields
    }
  }
`;

const DELETE_KEYCLOAK_USER = gql`
  mutation DeleteKeycloakUser($keycloakUserId: ID!) {
    deleteKeycloakUser(keycloakUserId: $keycloakUserId)
  }
`;

// ─── Service ────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AppUserService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  // ─── AppUser Queries ────────────────────────────────────────

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

  // ─── AppUser Mutations ──────────────────────────────────────

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
      [{ query: GET_APP_USERS }, { query: GET_UNLINKED_USERS }, { query: GET_KEYCLOAK_ORG_MEMBERS }],
    ).pipe(map((r) => r.linkKeycloakUser));
  }

  // ─── Role Queries/Mutations ─────────────────────────────────

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

  // ─── Keycloak Queries/Mutations ─────────────────────────────

  getKeycloakOrgMembers(): Observable<KeycloakOrgMember[]> {
    return this.query<{ keycloakOrgMembers: KeycloakOrgMember[] }>(
      GET_KEYCLOAK_ORG_MEMBERS,
    ).pipe(map((r) => r.keycloakOrgMembers));
  }

  getKeycloakRealmRoles(): Observable<KeycloakRealmRole[]> {
    return this.query<{ keycloakRealmRoles: KeycloakRealmRole[] }>(
      GET_KEYCLOAK_REALM_ROLES,
    ).pipe(map((r) => r.keycloakRealmRoles));
  }

  createKeycloakUser(input: CreateKeycloakUserInput): Observable<KeycloakOrgMember> {
    return this.mutate<{ createKeycloakUser: KeycloakOrgMember }>(
      CREATE_KEYCLOAK_USER,
      { input },
      [{ query: GET_KEYCLOAK_ORG_MEMBERS }],
    ).pipe(map((r) => r.createKeycloakUser));
  }

  assignKcRealmRole(keycloakUserId: string, roleName: string): Observable<boolean> {
    return this.mutate<{ assignKeycloakRealmRole: boolean }>(
      ASSIGN_KC_REALM_ROLE,
      { keycloakUserId, roleName },
      [{ query: GET_KEYCLOAK_ORG_MEMBERS }],
    ).pipe(map((r) => r.assignKeycloakRealmRole));
  }

  revokeKcRealmRole(keycloakUserId: string, roleName: string): Observable<boolean> {
    return this.mutate<{ revokeKeycloakRealmRole: boolean }>(
      REVOKE_KC_REALM_ROLE,
      { keycloakUserId, roleName },
      [{ query: GET_KEYCLOAK_ORG_MEMBERS }],
    ).pipe(map((r) => r.revokeKeycloakRealmRole));
  }

  // ─── Delete & Unlink ──────────────────────────────────────────

  deleteUser(id: string): Observable<boolean> {
    return this.mutate<{ deleteAppUser: boolean }>(
      DELETE_APP_USER,
      { id },
      [{ query: GET_APP_USERS }, { query: GET_UNLINKED_USERS }],
    ).pipe(map((r) => r.deleteAppUser));
  }

  unlinkKeycloakUser(appUserId: string): Observable<AppUser> {
    return this.mutate<{ unlinkKeycloakUser: AppUser }>(
      UNLINK_KEYCLOAK_USER,
      { appUserId },
      [{ query: GET_APP_USERS }, { query: GET_UNLINKED_USERS }, { query: GET_KEYCLOAK_ORG_MEMBERS }],
    ).pipe(map((r) => r.unlinkKeycloakUser));
  }

  deleteKeycloakUser(keycloakUserId: string): Observable<boolean> {
    return this.mutate<{ deleteKeycloakUser: boolean }>(
      DELETE_KEYCLOAK_USER,
      { keycloakUserId },
      [{ query: GET_KEYCLOAK_ORG_MEMBERS }, { query: GET_APP_USERS }],
    ).pipe(map((r) => r.deleteKeycloakUser));
  }
}
