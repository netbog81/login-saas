import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-admin-backup',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  template: `
    <div class="backup-section">
      <mat-card class="backup-placeholder">
        <mat-card-content>
          <mat-icon class="backup-icon">backup</mat-icon>
          <h3>Backup ed Esportazione Dati</h3>
          <p>Questa funzionalità sarà disponibile prossimamente.</p>
          <p class="backup-hint">
            Sarà possibile eseguire backup del database tenant,
            esportare dati in formati standard (CSV, JSON)
            e pianificare backup automatici.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .backup-section { padding: 16px 0; }
    .backup-placeholder {
      text-align: center;
      padding: 48px 24px;
    }
    .backup-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: rgba(0,0,0,0.2);
      margin-bottom: 16px;
    }
    h3 { margin: 0 0 8px; color: rgba(0,0,0,0.5); }
    p { color: rgba(0,0,0,0.4); margin: 4px 0; }
    .backup-hint { font-size: 0.85rem; margin-top: 12px; }
  `],
})
export class AdminBackupComponent {}
