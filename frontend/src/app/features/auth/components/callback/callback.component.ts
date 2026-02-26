import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OAuthService } from 'angular-oauth2-oidc';
import { OidcAuthService } from '../../../../core/auth/oidc-auth.service';
import { TenantResolverService } from '../../../../core/auth/tenant-resolver.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    @if (tenantMismatch()) {
      <div class="flex items-center justify-center min-h-screen bg-gray-50">
        <mat-card class="max-w-md w-full mx-4 p-6">
          <mat-card-header>
            <mat-card-title class="flex items-center gap-3">
              <mat-icon class="text-orange-600" style="font-size:28px;width:28px;height:28px">warning</mat-icon>
              Organizzazione errata
            </mat-card-title>
          </mat-card-header>
          <mat-card-content class="mt-4">
            <p class="text-gray-700 mb-2">
              Il tuo account appartiene all'organizzazione <strong>{{ tokenOrg() }}</strong>,
              ma stai cercando di accedere a <strong>{{ requestedTenant() }}</strong>.
            </p>
            <p class="text-gray-500 text-sm">
              Accedi con un account associato a questa organizzazione oppure vai alla tua.
            </p>
          </mat-card-content>
          <mat-card-actions class="flex gap-2 justify-end mt-4">
            @if (tokenOrg()) {
              <a mat-stroked-button [href]="'https://' + tokenOrg() + '.curandis.cloud'">
                <mat-icon>open_in_new</mat-icon>
                Vai a {{ tokenOrg() }}
              </a>
            }
            <button mat-raised-button color="primary" (click)="switchAccount()">
              <mat-icon>switch_account</mat-icon>
              Accedi con un altro account
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    } @else {
      <div class="flex items-center justify-center min-h-screen bg-gray-50">
        <div class="text-center">
          <mat-spinner diameter="48" class="mx-auto mb-4"></mat-spinner>
          <p class="text-gray-600">Accesso in corso...</p>
        </div>
      </div>
    }
  `,
})
export class CallbackComponent implements OnInit {
  private readonly oauthService = inject(OAuthService);
  private readonly oidcAuth = inject(OidcAuthService);
  private readonly router = inject(Router);
  private readonly tenantResolver = inject(TenantResolverService);

  readonly tenantMismatch = signal(false);
  readonly tokenOrg = signal<string | null>(null);
  readonly requestedTenant = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    // Se initialize() ha già rilevato il mismatch, mostra subito l'errore
    if (this.oidcAuth.isTenantMismatch()) {
      this.showMismatchError();
      return;
    }

    if (!this.oauthService.hasValidAccessToken()) {
      this.oidcAuth.login();
      return;
    }

    try {
      const user = await this.oidcAuth.loadCurrentUser();
      if (!user) {
        this.oidcAuth.login();
        return;
      }

      // Redirect in base allo stato del tenant
      if (user.tenantStatus === 'pending_schema') {
        const isAdmin = this.oidcAuth.hasRole(['admin', 'superadmin', 'it_manager', 'amministratore']);
        await this.router.navigate(isAdmin ? ['/admin'] : ['/pending-schema'], {
          queryParams: isAdmin ? { tab: 'database' } : undefined,
        });
      } else if (user.tenantStatus === 'suspended' || user.tenantStatus === 'deleted') {
        await this.router.navigate(['/unauthorized']);
      } else {
        await this.router.navigate(['/calendar']);
      }
    } catch (err: any) {
      if (err?.type === 'TENANT_MISMATCH') {
        this.showMismatchError();
        return;
      }
      // Errore generico: riprova login
      this.oidcAuth.login();
    }
  }

  private showMismatchError(): void {
    this.tokenOrg.set(this.oidcAuth.getTokenOrgAlias());
    this.requestedTenant.set(this.tenantResolver.getTenantAlias());
    this.tenantMismatch.set(true);
  }

  switchAccount(): void {
    this.oidcAuth.forceLogin();
  }
}
