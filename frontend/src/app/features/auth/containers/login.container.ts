import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { TenantResolverService } from '../../../core/auth/tenant-resolver.service';
import { PostLoginRedirectService } from '../../../core/auth/post-login-redirect.service';
import { LoginFormComponent } from '../components/login-form/login-form.component';

// Layer 2: Smart container - gestisce stato UI e coordina con services
@Component({
  selector: 'app-login-container',
  standalone: true,
  imports: [LoginFormComponent],
  template: `
    <app-login-form
      [loading]="loading()"
      [errorMessage]="errorMessage()"
      [tenantAlias]="tenantAlias"
      (submitLogin)="onLogin($event)"
    ></app-login-form>
  `,
})
export class LoginContainer {
  private readonly authService = inject(AuthService);
  private readonly tenantResolver = inject(TenantResolverService);
  private readonly postLoginRedirect = inject(PostLoginRedirectService);
  private readonly router = inject(Router);

  readonly tenantAlias = this.tenantResolver.getTenantAlias();
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    // Se gia' autenticato, redirect
    if (this.authService.isAuthenticated()) {
      this.postLoginRedirect.redirect();
    }
  }

  async onLogin(credentials: { username: string; password: string }): Promise<void> {
    const org = this.tenantAlias;
    if (!org) {
      this.errorMessage.set(
        'Dominio non valido. Accedere da <organizzazione>.curandis.cloud',
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.authService.loginApp(credentials.username, credentials.password, org);
      this.postLoginRedirect.redirect();
    } catch (error: any) {
      const body = error?.error;
      if (body?.error === 'org_mismatch') {
        this.errorMessage.set(
          `Il tuo account appartiene all'organizzazione "${body.tokenOrg}"`,
        );
      } else if (body?.error === 'access_denied') {
        this.errorMessage.set(body.message || 'Accesso negato');
      } else if (error?.status === 401) {
        this.errorMessage.set('Credenziali non valide');
      } else {
        this.errorMessage.set('Errore di connessione. Riprova.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
