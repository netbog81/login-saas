/**
 * Evaluation Dialog Container
 * Layer 2: Smart Component - Dialog per Vista Espansa Valutazione
 *
 * Responsabilità:
 * - Dialog fullscreen per visualizzazione comoda della valutazione
 * - Mostra evaluation-tab in modalità espansa
 * - Gestisce azioni: modifica, chiudi
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

// Angular Material
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// Components
import { EvaluationTabComponent } from '../components/evaluation-tab/evaluation-tab.component';

// Models
import { EvaluationComplete, AnamnesisComplete } from '../models/evaluation.model';
import { PatientAnamnesis } from '../models/patient-anamnesis.model';
import { Anamnesis } from '../../../models/therapeutic-path.model';
import { Patient } from '../../../models/patient.model';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';

@Component({
  selector: 'app-evaluation-dialog-container',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    EvaluationTabComponent
  ],
  template: `
    @if (isOpen) {
      <div class="dialog-overlay" (click)="onOverlayClick($event)">
        <div class="evaluation-dialog" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-content">
              <mat-icon>assignment</mat-icon>
              <div class="header-text">
                <h2>Valutazione</h2>
                <span class="patient-info">{{ patient?.nome }} {{ patient?.cognome }} - {{ path?.name }}</span>
              </div>
            </div>
            <div class="header-actions">
              <button mat-icon-button (click)="onEditClick()" matTooltip="Modifica valutazione">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button (click)="onClose()" matTooltip="Chiudi">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <app-evaluation-tab
              [anamnesis]="anamnesis"
              [anamnesisComplete]="evaluationComplete"
              [patientAnamnesis]="patientAnamnesis"
              [path]="path"
              [loading]="false"
              (edit)="onEditClick()"
              (delete)="onDeleteClick()"
              (expand)="onClose()">
            </app-evaluation-tab>
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <button mat-button (click)="onClose()">
              Chiudi
            </button>
            <button mat-flat-button color="primary" (click)="onEditClick()">
              <mat-icon>edit</mat-icon>
              Modifica Valutazione
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 24px;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .evaluation-dialog {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 900px;
      max-height: 90vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;

      .header-content {
        display: flex;
        align-items: center;
        gap: 12px;

        > mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
        }

        .header-text {
          h2 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
          }

          .patient-info {
            font-size: 0.8125rem;
            opacity: 0.9;
          }
        }
      }

      .header-actions {
        display: flex;
        gap: 4px;

        button {
          color: white;
        }
      }
    }

    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;

      button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    /* Responsive */
    @media (max-width: 767px) {
      .dialog-overlay {
        padding: 0;
      }

      .evaluation-dialog {
        max-width: 100%;
        max-height: 100vh;
        border-radius: 0;
      }

      .dialog-header {
        padding: 12px 16px;

        .header-content {
          > mat-icon {
            display: none;
          }

          .header-text h2 {
            font-size: 1rem;
          }

          .patient-info {
            display: none;
          }
        }
      }

      .dialog-content {
        padding: 16px;
      }

      .dialog-footer {
        padding: 12px 16px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EvaluationDialogContainer {
  @Input() patient: Patient | null = null;
  @Input() path: TherapeuticPath | null = null;
  @Input() anamnesis: Anamnesis | null = null;
  @Input() evaluationComplete: EvaluationComplete | null = null;
  @Input() patientAnamnesis: PatientAnamnesis | null = null;
  // Backward compatibility alias
  @Input() set anamnesisComplete(value: AnamnesisComplete | null) {
    this.evaluationComplete = value;
  }

  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  isOpen = false;

  constructor(private cdr: ChangeDetectorRef) {}

  /**
   * Apre il dialog
   */
  open(): void {
    this.isOpen = true;
    this.cdr.markForCheck();
  }

  /**
   * Chiude il dialog
   */
  onClose(): void {
    this.isOpen = false;
    this.close.emit();
    this.cdr.markForCheck();
  }

  /**
   * Click sull'overlay chiude il dialog
   */
  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  /**
   * Emette evento modifica
   */
  onEditClick(): void {
    this.onClose();
    this.edit.emit();
  }

  /**
   * Emette evento elimina
   */
  onDeleteClick(): void {
    this.delete.emit();
  }
}
