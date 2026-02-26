import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OidcAuthService } from '../../../../core/auth/oidc-auth.service';

@Component({
  selector: 'app-pending-schema',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="pending-wrapper">
      <mat-card class="pending-card">
        <mat-card-header>
          <mat-card-title class="pending-title">
            <mat-icon class="pending-icon">hourglass_top</mat-icon>
            Database in fase di configurazione
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <p>
            Il database del tuo tenant è in fase di configurazione iniziale.
            L'amministratore deve completare la procedura di creazione dello schema.
          </p>
          <p>
            Contatta il tuo amministratore di sistema o attendi il completamento
            della configurazione.
          </p>
        </mat-card-content>

        <mat-card-actions>
          <button mat-stroked-button color="warn" (click)="logout()">
            <mat-icon>logout</mat-icon>
            Esci
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
      min-height: 100vh;
      background: #f5f5f5;
    }
    .pending-card {
      max-width: 480px;
      width: 100%;
      margin: 24px;
    }
    .pending-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pending-icon {
      color: #ff9800;
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    mat-card-content p {
      color: rgba(0,0,0,0.7);
      line-height: 1.6;
      margin-bottom: 12px;
    }
  `],
})
export class PendingSchemaComponent {
  private readonly oidcAuth = inject(OidcAuthService);

  logout(): void {
    this.oidcAuth.logout();
  }
}
