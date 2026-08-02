import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WhatsappService } from '../services/whatsapp.service';
import { ScheduledTableComponent } from '../components/scheduled-table/scheduled-table.component';
import { ScheduledCancelDialogComponent } from '../components/scheduled-cancel-dialog/scheduled-cancel-dialog.component';
import { WhatsappScheduledMessage } from '../models/whatsapp.models';

@Component({
  selector: 'app-whatsapp-scheduled',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    ScheduledTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card>
      <mat-card-content>
        <div class="toolbar">
          <div class="intro">
            <h3>Messaggi in programma</h3>
            <p>
              Messaggi già in coda sul gateway e non ancora inviati: promemoria 24h, notifiche di
              spostamento e cancellazione, recap ancora dentro la finestra di raggruppamento.
            </p>
          </div>
          <button mat-stroked-button (click)="load()" [disabled]="loading">
            <mat-icon>refresh</mat-icon>
            Aggiorna
          </button>
        </div>

        @if (error) {
          <div class="error-box">
            <mat-icon>error_outline</mat-icon>
            {{ error }}
          </div>
        }

        <app-scheduled-table
          [messages]="messages"
          [loading]="loading"
          [cancellingJobId]="cancellingJobId"
          (cancel)="onCancel($event)">
        </app-scheduled-table>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .toolbar {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 8px;
    }

    .intro {
      flex: 1;
    }

    .intro h3 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 500;
    }

    .intro p {
      margin: 0;
      font-size: 13px;
      color: #666;
      max-width: 720px;
    }

    .error-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      margin: 12px 0;
      border-radius: 4px;
      background: #fdecea;
      color: #b71c1c;
      font-size: 13px;
    }
  `],
})
export class WhatsappScheduledContainer implements OnInit {
  messages: WhatsappScheduledMessage[] = [];
  loading = false;
  cancellingJobId: string | null = null;
  error: string | null = null;

  constructor(
    private whatsappService: WhatsappService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.whatsappService.getScheduledMessages().subscribe({
      next: (messages) => {
        this.messages = messages;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = `Impossibile leggere la coda del gateway: ${err?.message ?? 'errore sconosciuto'}`;
        this.messages = [];
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onCancel(message: WhatsappScheduledMessage): void {
    this.dialog
      .open(ScheduledCancelDialogComponent, { data: message, width: '520px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.cancelMessage(message);
      });
  }

  private cancelMessage(message: WhatsappScheduledMessage): void {
    this.cancellingJobId = message.jobId;
    this.cdr.markForCheck();

    this.whatsappService.cancelScheduledMessage(message.jobId).subscribe({
      next: () => {
        this.snackBar.open('Invio annullato', 'OK', { duration: 3000 });
        this.messages = this.messages.filter((m) => m.jobId !== message.jobId);
        this.cancellingJobId = null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.snackBar.open(
          `Annullamento non riuscito: ${err?.message ?? 'errore sconosciuto'}`,
          'OK',
          { duration: 6000 },
        );
        this.cancellingJobId = null;
        this.cdr.markForCheck();
        // Il messaggio potrebbe essere appena partito: riallineo la lista.
        this.load();
      },
    });
  }
}
