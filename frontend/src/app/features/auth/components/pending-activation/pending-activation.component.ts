import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OidcAuthService } from '../../../../core/auth/oidc-auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pending-activation',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="pending-wrapper">
      <mat-card class="pending-card">
        <mat-card-header>
          <mat-card-title class="pending-title">
            <mat-icon class="pending-icon">hourglass_empty</mat-icon>
            Account in attesa di attivazione
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <p class="pending-message">
            Il tuo account e' stato creato ma non e' ancora attivo.
            L'amministratore deve completare l'attivazione abbinandolo
            a un operatore del sistema.
          </p>
          <p class="pending-hint">
            Contatta l'amministratore per velocizzare il processo.
          </p>
        </mat-card-content>

        <mat-card-actions align="end">
          <button
            mat-button
            color="warn"
            (click)="onLogout()"
          >
            <mat-icon>logout</mat-icon>
            Esci
          </button>
          <button
            mat-raised-button
            color="primary"
            (click)="onRetry()"
            [disabled]="checking()"
          >
            @if (checking()) {
              <mat-spinner diameter="18" class="button-spinner"></mat-spinner>
            } @else {
              <mat-icon>refresh</mat-icon>
            }
            Verifica stato
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .pending-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100%;
      padding: 16px;
      background: #f5f5f5;
    }

    .pending-card {
      max-width: 500px;
      width: 100%;
      padding: 24px;
    }

    .pending-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 20px !important;
    }

    .pending-icon {
      color: #f57c00;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .pending-message {
      color: #555;
      line-height: 1.6;
      margin-bottom: 8px;
    }

    .pending-hint {
      color: #888;
      font-size: 14px;
      font-style: italic;
    }

    .button-spinner {
      display: inline-block;
      margin-right: 8px;
    }

    mat-card-actions {
      display: flex;
      gap: 8px;
    }
  `],
})
export class PendingActivationComponent {
  private readonly oidcAuth = inject(OidcAuthService);
  private readonly router = inject(Router);

  readonly checking = signal(false);

  async onRetry(): Promise<void> {
    this.checking.set(true);
    try {
      const user = await this.oidcAuth.loadCurrentUser();
      if (user) {
        await this.router.navigate(['/calendar']);
      }
    } finally {
      this.checking.set(false);
    }
  }

  onLogout(): void {
    this.oidcAuth.logout();
  }
}
