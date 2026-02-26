/**
 * @deprecated Usare OidcAuthService.
 * Stub di compatibilità per i componenti non ancora migrati.
 * Delega tutte le operazioni a OidcAuthService.
 */
import { Injectable, inject } from '@angular/core';
import { UserInfo } from './auth.models';
import { OidcAuthService } from './oidc-auth.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oidcAuth = inject(OidcAuthService);

  get currentUser() { return this.oidcAuth.currentUser; }

  async loginApp(_username: string, _password: string, _org: string): Promise<void> {
    // Con Keycloak OIDC il login avviene tramite redirect — non più username/password
    this.oidcAuth.login();
  }

  async loadCurrentUser(): Promise<UserInfo | null> {
    return this.oidcAuth.loadCurrentUser();
  }

  async renewToken(): Promise<boolean> {
    // angular-oauth2-oidc gestisce il rinnovo automaticamente
    return this.oidcAuth.isAuthenticated();
  }

  logout(): void {
    this.oidcAuth.logout();
  }

  isAuthenticated(): boolean {
    return this.oidcAuth.isAuthenticated();
  }

  hasRole(roles: string[]): boolean {
    return this.oidcAuth.hasRole(roles);
  }

  isLinked(): boolean {
    // Con Keycloak Organizations il linking è implicito
    return this.oidcAuth.isAuthenticated();
  }

  isSchemaReady(): boolean {
    return this.oidcAuth.isSchemaReady();
  }

  updateTenantStatus(tenantStatus: string): void {
    this.oidcAuth.updateTenantStatus(tenantStatus);
  }
}
