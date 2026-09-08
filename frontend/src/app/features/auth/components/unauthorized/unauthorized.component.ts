import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { OidcAuthService } from '../../../../core/auth/oidc-auth.service';
import { TenantResolverService } from '../../../../core/auth/tenant-resolver.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="unauthorized-wrapper">
      <mat-card class="unauthorized-card">
        <mat-card-header>
          <mat-card-title class="unauthorized-title">
            @if (isTenantMismatch()) {
              <mat-icon style="color:#ed6c02;font-size:28px;width:28px;height:28px">warning</mat-icon>
              Organizzazione errata
            } @else if (isLoginLoop()) {
              <mat-icon style="color:#ed6c02;font-size:28px;width:28px;height:28px">sync_problem</mat-icon>
              Accesso non completato
            } @else {
              <mat-icon class="unauthorized-icon">block</mat-icon>
              Accesso negato
            }
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (isTenantMismatch()) {
            <p>
              Il tuo account appartiene all'organizzazione <strong>{{ tokenOrg() }}</strong>,
              ma stai cercando di accedere a <strong>{{ requestedTenant() }}</strong>.
            </p>
            <p style="color:#666;font-size:0.875rem;margin-top:8px">
              Accedi con un account associato a questa organizzazione oppure vai alla tua.
            </p>
          } @else if (isLoginLoop()) {
            <p>
              Il rientro da Keycloak non è andato a buon fine più volte di seguito,
              quindi ci siamo fermati invece di continuare a ricaricare la pagina.
            </p>
            <p style="color:#666;font-size:0.875rem;margin-top:8px">
              Di norma succede quando il gestionale è aperto in <strong>più schede</strong>:
              ogni scheda sovrascrive il login dell'altra. Chiudi le altre schede di
              questo indirizzo e riprova. Se non basta, esci e rientra.
            </p>
            @if (loginError()) {
              <p style="color:#999;font-size:0.75rem;margin-top:12px;word-break:break-word">
                Dettaglio tecnico: {{ loginError() }}
              </p>
            }
          } @else {
            <p>Non hai i permessi necessari per accedere a questa sezione.</p>
          }
        </mat-card-content>
        <mat-card-actions align="end" style="display:flex;gap:8px">
          @if (isTenantMismatch()) {
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
          } @else if (isLoginLoop()) {
            <button mat-stroked-button (click)="switchAccount()">
              <mat-icon>logout</mat-icon>
              Esci e rientra
            </button>
            <button mat-raised-button color="primary" (click)="retryLogin()">
              <mat-icon>refresh</mat-icon>
              Riprova
            </button>
          } @else {
            <button mat-raised-button color="primary" (click)="goHome()">
              <mat-icon>home</mat-icon>
              Torna alla home
            </button>
          }
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .unauthorized-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100%;
      padding: 16px;
      background: #f5f5f5;
    }
    .unauthorized-card { max-width: 450px; width: 100%; padding: 24px; }
    .unauthorized-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .unauthorized-icon { color: #d32f2f; font-size: 28px; width: 28px; height: 28px; }
  `],
})
export class UnauthorizedComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly oidcAuth = inject(OidcAuthService);
  private readonly tenantResolver = inject(TenantResolverService);

  readonly isTenantMismatch = signal(false);
  readonly isLoginLoop = signal(false);
  readonly loginError = signal<string | null>(null);
  readonly tokenOrg = signal<string | null>(null);
  readonly requestedTenant = signal<string | null>(null);

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'tenant_mismatch') {
      this.isTenantMismatch.set(true);
      this.tokenOrg.set(this.oidcAuth.getTokenOrgAlias());
      this.requestedTenant.set(this.tenantResolver.getTenantAlias());
    } else if (reason === 'login_loop') {
      this.isLoginLoop.set(true);
      this.loginError.set(this.oidcAuth.getLoginErrorDetail());
    }
  }

  /** Riparte da zero col login, dopo che l'utente ha chiuso le altre schede. */
  retryLogin(): void {
    this.oidcAuth.retryLogin();
  }

  goHome(): void {
    // Home dinamica per ruolo (homeRedirectGuard): non rimandare su /calendar,
    // o un operatore finito qui ci tornerebbe in loop di "accesso negato".
    this.router.navigateByUrl('/');
  }

  switchAccount(): void {
    this.oidcAuth.forceLogin();
  }
}
