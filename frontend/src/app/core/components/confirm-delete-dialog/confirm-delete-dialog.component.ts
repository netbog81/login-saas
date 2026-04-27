import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDeleteDialogData {
  title: string;
  /** Messaggio principale, può contenere informazioni sui figli (es. "5 trattamenti, 3 chiusi"). */
  message: string;
  /** Avviso aggiuntivo, mostrato in evidenza (es. "Operazione irreversibile"). */
  warning?: string;
  /** Etichetta del bottone di conferma. Default: "Sposta nel cestino". */
  confirmLabel?: string;
  /** Etichetta del bottone annulla. Default: "Annulla". */
  cancelLabel?: string;
  /** Se true, usa colore "warn" (rosso) invece del default. */
  destructive?: boolean;
}

/**
 * Dialog standard di conferma cancellazione.
 *
 *   const ref = this.dialog.open<ConfirmDeleteDialogComponent, ConfirmDeleteDialogData, boolean>(
 *     ConfirmDeleteDialogComponent,
 *     { data: { title: '...', message: '...' } },
 *   );
 *   ref.afterClosed().subscribe(confirmed => { if (confirmed) ... });
 */
@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon [class.warn]="data.destructive !== false">{{ data.destructive !== false ? 'delete_forever' : 'delete' }}</mat-icon>
      {{ data.title }}
    </h2>
    <mat-dialog-content>
      <p class="message">{{ data.message }}</p>
      @if (data.warning) {
        <div class="warning-box">
          <mat-icon>warning</mat-icon>
          <span>{{ data.warning }}</span>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">
        {{ data.cancelLabel ?? 'Annulla' }}
      </button>
      <button
        mat-flat-button
        [color]="data.destructive !== false ? 'warn' : 'primary'"
        (click)="confirm()">
        {{ data.confirmLabel ?? 'Sposta nel cestino' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dialog-title mat-icon.warn {
        color: #f44336;
      }
      .message {
        margin: 8px 0 16px;
        line-height: 1.5;
      }
      .warning-box {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-radius: 4px;
        background: #fff3e0;
        color: #e65100;
        align-items: flex-start;
      }
      .warning-box mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    `,
  ],
})
export class ConfirmDeleteDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDeleteDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDeleteDialogData,
  ) {}

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
