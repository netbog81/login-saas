import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { WhatsappScheduledMessage } from '../../models/whatsapp.models';

@Component({
  selector: 'app-scheduled-cancel-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="warn-icon">cancel_schedule_send</mat-icon>
      Annulla invio programmato
    </h2>
    <mat-dialog-content>
      <p>
        Il messaggio previsto per
        <strong>{{ data.scheduledFor | date: 'dd/MM/yyyy \\'alle\\' HH:mm' }}</strong>
        a <strong>{{ data.patientName || data.phone }}</strong> non verrà inviato.
      </p>

      @if (data.content) {
        <div class="message-preview">{{ data.content }}</div>
      } @else {
        <p class="info-text">
          <mat-icon>info</mat-icon>
          È un recap ancora in composizione: annullandolo si svuota anche l'elenco
          degli appuntamenti già accumulati.
        </p>
      }

      <p class="warning-text">
        <mat-icon>warning</mat-icon>
        L'operazione è irreversibile: per rimandarlo occorre riprenotare o spostare l'appuntamento.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Chiudi</button>
      <button mat-raised-button color="warn" (click)="onConfirm()">Annulla invio</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .warn-icon {
      color: #d32f2f;
    }

    .message-preview {
      background: #f5f5f5;
      border-left: 4px solid #25d366;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      white-space: pre-wrap;
      margin: 12px 0;
    }

    .warning-text, .info-text {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      margin: 12px 0 0;
    }

    .warning-text {
      color: #d32f2f;
    }

    .info-text {
      color: #666;
    }

    .warning-text mat-icon, .info-text mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `],
})
export class ScheduledCancelDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: WhatsappScheduledMessage,
    private dialogRef: MatDialogRef<ScheduledCancelDialogComponent, boolean>,
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
