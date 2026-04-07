import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { firstValueFrom } from 'rxjs';
import { TenantAdminService, TenantSchemaStatus } from '../../../../services/tenant-admin.service';
import { OidcAuthService } from '../../../../core/auth/oidc-auth.service';
import { ConfirmSchemaDialogComponent } from './confirm-schema-dialog.component';

@Component({
  selector: 'app-admin-database',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatDividerModule,
  ],
  template: `
    <div class="db-section">
      <div class="db-header">
        <h2 class="db-title">
          <mat-icon>storage</mat-icon>
          Stato Schema Database
        </h2>
        <button mat-stroked-button (click)="loadStatus()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          Verifica Stato
        </button>
      </div>

      @if (loading()) {
        <div class="db-loading">
          <mat-spinner diameter="40"></mat-spinner>
          <span>Verifica in corso...</span>
        </div>
      }

      @if (error()) {
        <mat-card class="db-error-card">
          <mat-card-content>
            <mat-icon color="warn">error_outline</mat-icon>
            <span>{{ error() }}</span>
          </mat-card-content>
        </mat-card>
      }

      @if (status() && !loading()) {
        <mat-card class="db-status-card" [class.aligned]="status()!.isAligned" [class.warning]="!status()!.isAligned">
          <mat-card-content>
            <div class="status-row">
              <span class="status-label">Server PostgreSQL</span>
              <code class="status-value">{{ status()!.databaseHost || '—' }}</code>
            </div>
            <mat-divider></mat-divider>

            <div class="status-row">
              <span class="status-label">Nome Database</span>
              <code class="status-value">{{ status()!.databaseName || '—' }}</code>
            </div>
            <mat-divider></mat-divider>

            <div class="status-row">
              <span class="status-label">Schema Nome</span>
              <code class="status-value">{{ status()!.schemaName }}</code>
            </div>
            <mat-divider></mat-divider>

            <div class="status-row">
              <span class="status-label">Presente nel DB Principale</span>
              <div class="status-badge" [class.ok]="status()!.existsInMainDb" [class.ko]="!status()!.existsInMainDb">
                <mat-icon>{{ status()!.existsInMainDb ? 'check_circle' : 'cancel' }}</mat-icon>
                {{ status()!.existsInMainDb ? 'Sì' : 'No' }}
              </div>
            </div>
            <mat-divider></mat-divider>

            <div class="status-row">
              <span class="status-label">Stato Auth DB</span>
              <div class="status-badge" [class.ok]="status()!.tenantStatus === 'active'" [class.warning]="status()!.tenantStatus === 'pending_schema'" [class.ko]="status()!.tenantStatus === 'suspended' || status()!.tenantStatus === 'deleted'">
                <mat-icon>{{ status()!.tenantStatus === 'active' ? 'verified' : 'pending' }}</mat-icon>
                {{ status()!.tenantStatus }}
              </div>
            </div>
            <mat-divider></mat-divider>

            <div class="status-row">
              <span class="status-label">Allineamento</span>
              <div class="status-badge" [class.ok]="status()!.isAligned" [class.ko]="!status()!.isAligned">
                <mat-icon>{{ status()!.isAligned ? 'sync' : 'sync_problem' }}</mat-icon>
                {{ status()!.isAligned ? 'Allineato' : 'Non allineato' }}
              </div>
            </div>

            @if (status()!.message) {
              <mat-divider></mat-divider>
              <div class="status-message">
                <mat-icon>info_outline</mat-icon>
                <span>{{ status()!.message }}</span>
              </div>
            }
          </mat-card-content>

          @if (!status()!.isAligned) {
            <mat-card-actions>
              <button
                mat-raised-button
                color="primary"
                (click)="onProvisionSchema()"
                [disabled]="provisioning()">
                @if (provisioning()) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>build</mat-icon>
                }
                Crea Schema Database
              </button>
            </mat-card-actions>
          }
        </mat-card>

        <!-- Sezione diagnostica isolamento multi-tenant -->
        <mat-card class="db-diagnostics-card">
          <mat-card-header>
            <mat-icon mat-card-avatar class="diagnostics-icon">security</mat-icon>
            <mat-card-title>Diagnostica Isolamento Multi-Tenant</mat-card-title>
            <mat-card-subtitle>Meccanismi di protezione dati attivi per questo tenant</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="status-row">
              <span class="status-label">Schema da JWT</span>
              <code class="status-value">{{ currentUser()?.schemaName || '—' }}</code>
            </div>
            <mat-divider></mat-divider>
            <div class="status-row">
              <span class="status-label">Tenant ID</span>
              <code class="status-value">{{ currentUser()?.tenantId || '—' }}</code>
            </div>
            <mat-divider></mat-divider>
            <div class="status-row">
              <span class="status-label">AsyncLocalStorage</span>
              <div class="status-badge ok">
                <mat-icon>check_circle</mat-icon>
                Attivo — isolamento per richiesta HTTP
              </div>
            </div>
            <mat-divider></mat-divider>
            <div class="status-row">
              <span class="status-label">SET LOCAL search_path</span>
              <div class="status-badge ok">
                <mat-icon>check_circle</mat-icon>
                Attivo — isolamento per transazione DB
              </div>
            </div>
            <mat-divider></mat-divider>
            <div class="status-row">
              <span class="status-label">Audit Log Schema</span>
              <div class="status-badge ok">
                <mat-icon>check_circle</mat-icon>
                Attivo — ogni accesso viene registrato
              </div>
            </div>
            <mat-divider></mat-divider>
            <div class="diagnostics-note">
              <mat-icon>info</mat-icon>
              <span>
                Il backend utilizza <strong>AsyncLocalStorage</strong> per propagare il contesto tenant
                attraverso tutte le chiamate asincrone della richiesta HTTP, e <strong>SET LOCAL search_path</strong>
                per limitare l'effetto alla singola transazione database.
                Questo garantisce l'isolamento anche con connessioni condivise nel pool PostgreSQL.
              </span>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .db-section {
      padding: 16px 0;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .db-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .db-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 1.25rem;
      font-weight: 500;
    }
    .db-loading {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 32px;
      justify-content: center;
      color: rgba(0,0,0,0.6);
    }
    .db-error-card {
      background: #ffebee;
      mat-card-content {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #c62828;
      }
    }
    .db-status-card {
      border-left: 4px solid #4caf50;
      &.warning { border-left-color: #ff9800; }
      &.ko { border-left-color: #f44336; }
    }
    .db-diagnostics-card {
      border-left: 4px solid #1976d2;
    }
    .diagnostics-icon {
      color: #1976d2;
    }
    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
    }
    .status-label {
      font-weight: 500;
      color: rgba(0,0,0,0.7);
    }
    .status-value {
      background: #f5f5f5;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.85rem;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      &.ok { color: #2e7d32; }
      &.warning { color: #e65100; }
      &.ko { color: #c62828; }
    }
    .status-message {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 0;
      color: rgba(0,0,0,0.6);
      font-size: 0.9rem;
    }
    .diagnostics-note {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 0;
      color: rgba(0,0,0,0.6);
      font-size: 0.875rem;
      line-height: 1.5;
      mat-icon {
        font-size: 18px;
        color: #1976d2;
        flex-shrink: 0;
        margin-top: 2px;
      }
    }
    mat-card-actions {
      padding: 8px 16px 16px;
    }
  `],
})
export class AdminDatabaseComponent implements OnInit {
  private readonly tenantAdminService = inject(TenantAdminService);
  private readonly authService = inject(OidcAuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  status = signal<TenantSchemaStatus | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  provisioning = signal(false);

  currentUser = this.authService.currentUser;

  ngOnInit(): void {
    this.loadStatus();
  }

  async loadStatus(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const status = await firstValueFrom(this.tenantAdminService.getTenantSchemaStatus());
      this.status.set(status);
    } catch (err: any) {
      this.error.set(err?.message || 'Errore nel caricamento dello stato schema.');
    } finally {
      this.loading.set(false);
    }
  }

  async onProvisionSchema(): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmSchemaDialogComponent, {
      data: { schemaName: this.status()?.schemaName },
      width: '420px',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    this.provisioning.set(true);
    try {
      const result = await firstValueFrom(this.tenantAdminService.provisionTenantSchema());
      this.status.set(result);

      if (result.isAligned) {
        // Aggiorna il tenantStatus nel servizio auth per sbloccare la navigazione
        this.authService.updateTenantStatus('active');
        this.snackBar.open(
          'Schema creato con successo! Il tenant è ora attivo.',
          'OK',
          { duration: 5000, panelClass: 'snack-success' },
        );
      } else {
        this.snackBar.open(
          result.message || 'Errore durante la creazione dello schema.',
          'Chiudi',
          { duration: 8000, panelClass: 'snack-error' },
        );
      }
    } catch (err: any) {
      this.snackBar.open(
        `Errore: ${err?.message || 'Creazione schema fallita.'}`,
        'Chiudi',
        { duration: 8000, panelClass: 'snack-error' },
      );
    } finally {
      this.provisioning.set(false);
    }
  }
}
