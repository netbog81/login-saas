import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  createdTimestamp: number;
}

export interface KeycloakRealmRole {
  id: string;
  name: string;
  description?: string;
  composite: boolean;
}

@Injectable()
export class KeycloakAdminService implements OnModuleInit {
  private readonly logger = new Logger(KeycloakAdminService.name);

  private readonly KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'https://my.curandis.cloud';
  private readonly REALM = process.env.KEYCLOAK_REALM || 'curandis';
  private readonly OPENBAO_ADDR = process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200';

  private clientId = '';
  private clientSecret = '';

  /** Ruoli interni Keycloak da filtrare nelle risposte */
  private static readonly INTERNAL_ROLES = new Set([
    'uma_authorization',
    'offline_access',
  ]);

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  async onModuleInit(): Promise<void> {
    await this.loadCredentialsFromOpenbao();

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'Credenziali Keycloak service account non disponibili. ' +
        'Le operazioni Keycloak Admin non saranno disponibili.',
      );
    }
  }

  /**
   * Legge client_id e client_secret da OpenBao Agent (KV v2).
   * Path: kv/data/keycloak/service-account
   * Fallback a env vars solo in development se OpenBao non risponde.
   */
  private async loadCredentialsFromOpenbao(): Promise<void> {
    try {
      const url = `${this.OPENBAO_ADDR}/v1/kv/data/keycloak/service-account`;
      // No X-Vault-Token header: OpenBao Agent proxy auto-injects its own token
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn(
          `OpenBao: impossibile leggere credenziali KC service account (HTTP ${response.status})`,
        );
        this.fallbackToEnvVars();
        return;
      }

      const body = await response.json() as any;
      // KV v2: body.data.data
      const data = body?.data?.data;
      const id = data?.client_id as string;
      const secret = data?.client_secret as string;

      if (!id || !secret) {
        this.logger.warn(
          `OpenBao: client_id o client_secret mancanti in kv/data/keycloak/service-account. Dati: ${JSON.stringify(data)}`,
        );
        this.fallbackToEnvVars();
        return;
      }

      this.clientId = id;
      this.clientSecret = secret;
      this.logger.log('Credenziali KC service account caricate da OpenBao');
    } catch (error: any) {
      this.logger.warn(
        `OpenBao non raggiungibile per credenziali KC: ${error?.message}`,
      );
      this.fallbackToEnvVars();
    }
  }

  private fallbackToEnvVars(): void {
    if (process.env.NODE_ENV === 'development') {
      this.clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID || '';
      this.clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || '';
      if (this.clientId) {
        this.logger.warn('Fallback: credenziali KC da env vars (solo development)');
      }
    }
  }

  // ─── Token Management ───────────────────────────────────────────

  private async getAdminToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.accessToken;
    }

    const tokenUrl = `${this.KEYCLOAK_URL}/realms/${this.REALM}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Admin token request failed: HTTP ${response.status} - ${errorText}`);
      throw new Error(`Keycloak admin token request failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    this.logger.debug(`Admin token ottenuto, scade in ${data.expires_in}s`);
    return this.accessToken!;
  }

  // ─── HTTP Helper ────────────────────────────────────────────────

  private async adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAdminToken();
    const url = `${this.KEYCLOAK_URL}/admin/realms/${this.REALM}${path}`;

    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
      },
    });
  }

  // ─── Organization Members ──────────────────────────────────────

  async getOrganizationMembers(orgId: string): Promise<KeycloakUser[]> {
    const response = await this.adminFetch(`/organizations/${orgId}/members?first=0&max=1000`);
    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`getOrganizationMembers failed: HTTP ${response.status} - ${error}`);
      throw new Error(`Failed to get org members: HTTP ${response.status}`);
    }
    return response.json();
  }

  // ─── Create User ───────────────────────────────────────────────

  async createUser(data: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    enabled?: boolean;
    emailVerified?: boolean;
  }): Promise<string> {
    const response = await this.adminFetch('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: data.username,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        enabled: data.enabled ?? true,
        emailVerified: data.emailVerified ?? false,
      }),
    });

    if (response.status !== 201) {
      const errorBody = await response.text();
      this.logger.error(`createUser failed: HTTP ${response.status} - ${errorBody}`);
      throw new Error(`Failed to create Keycloak user: ${response.status} - ${errorBody}`);
    }

    // Keycloak restituisce l'ID nel header Location: .../users/{id}
    const location = response.headers.get('Location');
    if (!location) throw new Error('No Location header in create user response');
    const userId = location.split('/').pop();
    if (!userId) throw new Error('Could not extract user ID from Location header');

    this.logger.log(`Utente Keycloak creato: ${userId}`);
    return userId;
  }

  // ─── Add Member to Organization ────────────────────────────────

  async addMemberToOrganization(orgId: string, userId: string): Promise<void> {
    const response = await this.adminFetch(
      `/organizations/${orgId}/members`,
      {
        method: 'POST',
        body: JSON.stringify(userId),
      },
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      this.logger.error(`addMemberToOrganization failed: HTTP ${response.status} - ${error}`);
      throw new Error(`Failed to add member to org: ${response.status}`);
    }

    this.logger.log(`Utente ${userId} aggiunto a org ${orgId}`);
  }

  // ─── Realm Roles ───────────────────────────────────────────────

  async getRealmRoles(): Promise<KeycloakRealmRole[]> {
    const response = await this.adminFetch('/roles');
    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`getRealmRoles failed: HTTP ${response.status} - ${error}`);
      throw new Error(`Failed to get realm roles: ${response.status}`);
    }

    const roles: KeycloakRealmRole[] = await response.json();

    // Filtra ruoli interni di Keycloak
    return roles.filter(
      r =>
        !KeycloakAdminService.INTERNAL_ROLES.has(r.name) &&
        !r.name.startsWith('default-roles-'),
    );
  }

  // ─── Assign Realm Roles ────────────────────────────────────────

  async assignRealmRoles(userId: string, roleNames: string[]): Promise<void> {
    if (roleNames.length === 0) return;

    // KC richiede rappresentazione completa (id + name)
    const allRoles = await this.getRealmRoles();
    const rolesToAssign = allRoles.filter(r => roleNames.includes(r.name));
    if (rolesToAssign.length === 0) {
      this.logger.warn(`Nessun ruolo trovato per i nomi: ${roleNames.join(', ')}`);
      return;
    }

    const response = await this.adminFetch(
      `/users/${userId}/role-mappings/realm`,
      {
        method: 'POST',
        body: JSON.stringify(
          rolesToAssign.map(r => ({ id: r.id, name: r.name })),
        ),
      },
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      this.logger.error(`assignRealmRoles failed: HTTP ${response.status} - ${error}`);
      throw new Error(`Failed to assign realm roles: ${response.status}`);
    }

    this.logger.log(`Ruoli ${roleNames.join(', ')} assegnati a utente ${userId}`);
  }

  // ─── Get User Realm Roles ────────────────────────────────────

  async getUserRealmRoles(userId: string): Promise<KeycloakRealmRole[]> {
    const response = await this.adminFetch(`/users/${userId}/role-mappings/realm`);
    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`getUserRealmRoles failed: HTTP ${response.status} - ${error}`);
      throw new Error(`Failed to get user realm roles: ${response.status}`);
    }

    const roles: KeycloakRealmRole[] = await response.json();

    return roles.filter(
      r =>
        !KeycloakAdminService.INTERNAL_ROLES.has(r.name) &&
        !r.name.startsWith('default-roles-'),
    );
  }

  // ─── Revoke Realm Roles ──────────────────────────────────────

  async revokeRealmRoles(userId: string, roleNames: string[]): Promise<void> {
    if (roleNames.length === 0) return;

    const userRoles = await this.getUserRealmRoles(userId);
    const rolesToRevoke = userRoles.filter(r => roleNames.includes(r.name));
    if (rolesToRevoke.length === 0) {
      this.logger.warn(`Nessun ruolo trovato per i nomi: ${roleNames.join(', ')}`);
      return;
    }

    const response = await this.adminFetch(
      `/users/${userId}/role-mappings/realm`,
      {
        method: 'DELETE',
        body: JSON.stringify(
          rolesToRevoke.map(r => ({ id: r.id, name: r.name })),
        ),
      },
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      this.logger.error(`revokeRealmRoles failed: HTTP ${response.status} - ${error}`);
      throw new Error(`Failed to revoke realm roles: ${response.status}`);
    }

    this.logger.log(`Ruoli ${roleNames.join(', ')} rimossi da utente ${userId}`);
  }

  // ─── Update User ──────────────────────────────────────────────

  async updateUser(userId: string, data: {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    emailVerified?: boolean;
  }): Promise<void> {
    const response = await this.adminFetch(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`updateUser failed: HTTP ${response.status} - ${error}`);
      throw new Error(`Failed to update Keycloak user: ${response.status} - ${error}`);
    }

    this.logger.log(`Utente Keycloak ${userId} aggiornato`);
  }

  // ─── Reset Password ─────────────────────────────────────────

  async resetPassword(userId: string, newPassword: string, temporary: boolean): Promise<void> {
    const response = await this.adminFetch(`/users/${userId}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({
        type: 'password',
        value: newPassword,
        temporary,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`resetPassword failed: HTTP ${response.status} - ${error}`);
      throw new Error(`Failed to reset password: ${response.status} - ${error}`);
    }

    this.logger.log(`Password reset per utente ${userId} (temporary: ${temporary})`);
  }

  // ─── Delete User ──────────────────────────────────────────────

  async deleteUser(userId: string): Promise<void> {
    const response = await this.adminFetch(`/users/${userId}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      this.logger.error(`deleteUser failed: HTTP ${response.status} - ${error}`);
      throw new Error(`Failed to delete Keycloak user: ${response.status}`);
    }
    this.logger.log(`Utente Keycloak ${userId} eliminato`);
  }
}
