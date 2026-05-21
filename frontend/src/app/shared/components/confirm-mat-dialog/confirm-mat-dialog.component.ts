/**
 * ConfirmMatDialog - dialog di conferma generico basato su MatDialog.
 *
 * Pensato per conferme "consapevoli" (es. forzare un appuntamento fuori
 * dalla disponibilita' dell'operatore). Ritorna `true` se l'utente
 * conferma, `false`/`undefined` se annulla.
 */

import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';

export interface ConfirmMatDialogData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 'warn' colora il bottone di conferma in rosso (azione delicata). */
  confirmColor?: 'primary' | 'warn';
  icon?: string;
}

@Component({
  selector: 'app-confirm-mat-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title class="confirm-title">
      @if (data.icon) {
        <mat-icon [class.warn-icon]="data.confirmColor === 'warn'">{{ data.icon }}</mat-icon>
      }
      {{ data.title || 'Conferma' }}
    </h2>
    <mat-dialog-content>
      <p class="confirm-message">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="onCancel()">
        {{ data.cancelText || 'Annulla' }}
      </button>
      <button mat-flat-button
              [color]="data.confirmColor || 'primary'"
              (click)="onConfirm()">
        {{ data.confirmText || 'Conferma' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .confirm-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .warn-icon {
      color: #e53935;
    }
    .confirm-message {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.5;
      color: #334155;
      white-space: pre-line;
    }
  `],
})
export class ConfirmMatDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ConfirmMatDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmMatDialogData,
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
