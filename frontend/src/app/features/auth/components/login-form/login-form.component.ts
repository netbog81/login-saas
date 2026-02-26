import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

// Layer 1: Dumb component - solo input/output, nessuna logica business
@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  template: `
    <div class="login-wrapper">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title class="login-title">Curandis</mat-card-title>
          <mat-card-subtitle class="login-subtitle">
            Accedi alla piattaforma
            @if (tenantAlias) {
              <span class="tenant-badge">{{ tenantAlias }}</span>
            }
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form (ngSubmit)="onSubmit()" class="login-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                [(ngModel)]="username"
                name="username"
                placeholder="nome@clinica.it"
                required
                autocomplete="email"
                [disabled]="loading"
              />
              <mat-icon matPrefix>email</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input
                matInput
                [type]="hidePassword ? 'password' : 'text'"
                [(ngModel)]="password"
                name="password"
                required
                autocomplete="current-password"
                [disabled]="loading"
              />
              <mat-icon matPrefix>lock</mat-icon>
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="hidePassword = !hidePassword"
                [attr.aria-label]="hidePassword ? 'Mostra password' : 'Nascondi password'"
              >
                <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>

            @if (errorMessage) {
              <div class="error-message">
                <mat-icon>error_outline</mat-icon>
                <span>{{ errorMessage }}</span>
              </div>
            }

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="full-width login-button"
              [disabled]="loading || !username || !password"
            >
              @if (loading) {
                <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
                Accesso in corso...
              } @else {
                Accedi
              }
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #1a237e 0%, #0d47a1 50%, #01579b 100%);
    }

    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 32px 24px;
    }

    .login-title {
      font-size: 28px !important;
      font-weight: 600 !important;
      text-align: center;
      width: 100%;
      color: #1a237e;
    }

    .login-subtitle {
      text-align: center;
      width: 100%;
      margin-top: 4px !important;
    }

    .tenant-badge {
      display: inline-block;
      background: #e3f2fd;
      color: #1565c0;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      margin-left: 8px;
    }

    mat-card-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 24px;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .full-width {
      width: 100%;
    }

    .login-button {
      height: 48px;
      font-size: 16px;
      margin-top: 8px;
    }

    .button-spinner {
      display: inline-block;
      margin-right: 8px;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d32f2f;
      background: #ffebee;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .error-message mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    @media (max-width: 480px) {
      .login-card {
        padding: 24px 16px;
      }
      .login-title {
        font-size: 24px !important;
      }
    }
  `],
})
export class LoginFormComponent {
  @Input() loading = false;
  @Input() errorMessage: string | null = null;
  @Input() tenantAlias: string | null = null;

  @Output() submitLogin = new EventEmitter<{ username: string; password: string }>();

  username = '';
  password = '';
  hidePassword = true;

  onSubmit(): void {
    if (this.username && this.password) {
      this.submitLogin.emit({ username: this.username, password: this.password });
    }
  }
}
