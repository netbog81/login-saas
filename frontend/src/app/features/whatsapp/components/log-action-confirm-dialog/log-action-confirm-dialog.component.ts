import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface LogActionConfirmData {
  action: 'anonymize' | 'delete';
  count: number;
  isAll: boolean;
}

@Component({
  selector: 'app-log-action-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon [class.warn-icon]="data.action === 'delete'">
        {{ data.action === 'delete' ? 'delete_forever' : 'visibility_off' }}
      </mat-icon>
      {{ data.action === 'delete' ? 'Conferma Eliminazione' : 'Conferma Anonimizzazione' }}
    </h2>
    <mat-dialog-content>
      <p>
        Stai per
        <strong>{{ data.action === 'delete' ? 'eliminare' : 'anonimizzare' }}</strong>
        @if (data.isAll) {
          <strong>tutti i {{ data.count }} log scaduti</strong>.
        } @else {
          <strong>{{ data.count }}</strong> log selezionati.
        }
      </p>
      @if (data.action === 'delete') {
        <p class="warning-text">
          <mat-icon>warning</mat-icon>
          Questa azione è irreversibile. I log verranno eliminati definitivamente.
        </p>
      } @else {
        <p class="info-text">
          <mat-icon>info</mat-icon>
          I dati personali (nome, telefono, testo messaggio) verranno sostituiti con valori anonimi.
          I dati statistici verranno conservati.
        </p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Annulla</button>
      <button mat-raised-button
              [color]="data.action === 'delete' ? 'warn' : 'primary'"
              (click)="onConfirm()">
        {{ data.action === 'delete' ? 'Elimina' : 'Anonimizza' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .warn-icon {
      color: #c62828;
    }

    .warning-text {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: #c62828;
      background: #ffebee;
      padding: 12px;
      border-radius: 4px;
      margin-top: 12px;
    }

    .info-text {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: #1565c0;
      background: #e3f2fd;
      padding: 12px;
      border-radius: 4px;
      margin-top: 12px;
    }

    .warning-text mat-icon,
    .info-text mat-icon {
      flex-shrink: 0;
    }
  `],
})
export class LogActionConfirmDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: LogActionConfirmData,
    private readonly dialogRef: MatDialogRef<LogActionConfirmDialogComponent>,
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
