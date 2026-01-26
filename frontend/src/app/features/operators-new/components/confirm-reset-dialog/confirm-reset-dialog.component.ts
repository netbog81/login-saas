import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-confirm-reset-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-overlay" (click)="onCancel()">
      <div class="dialog-container" (click)="$event.stopPropagation()">
        <header class="dialog-header">
          <mat-icon color="warn">warning</mat-icon>
          <h2>Conferma Reset</h2>
        </header>

        <div class="dialog-content">
          <p>Stai per eliminare <strong>tutte le valutazioni</strong> per il test:</p>
          <p class="test-name">{{ testName }}</p>
          <div class="warning-box">
            <p>Questa operazione eliminerà definitivamente lo storico di
            <strong>{{ evaluationsCount }} valutazion{{ evaluationsCount === 1 ? 'e' : 'i' }}</strong>.</p>
          </div>
          <p>Vuoi procedere?</p>
        </div>

        <footer class="dialog-footer">
          <button mat-button (click)="onCancel()">Annulla</button>
          <button mat-flat-button color="warn" (click)="onConfirm()">
            <mat-icon>delete_forever</mat-icon>
            Elimina tutto
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1100; /* Sopra altri dialog */
      padding: 16px;
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .dialog-container {
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2);
      animation: scaleIn 0.15s ease-out;
    }

    @keyframes scaleIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }

    .dialog-content {
      padding: 16px 24px;
    }

    .dialog-content p {
      margin: 8px 0;
      color: #334155;
    }

    .test-name {
      font-weight: 600;
      color: #1e293b;
      margin: 12px 0;
      font-size: 16px;
    }

    .warning-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 12px;
      margin: 12px 0;
    }

    .warning-box p {
      color: #dc2626;
      margin: 0;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 24px;
      border-top: 1px solid #e2e8f0;
    }

    /* RESPONSIVE */
    @media (max-width: 599px) {
      .dialog-footer {
        flex-direction: column-reverse;
      }

      .dialog-footer button {
        width: 100%;
      }
    }
  `]
})
export class ConfirmResetDialogComponent {
  @Input() testName = '';
  @Input() evaluationsCount = 0;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
