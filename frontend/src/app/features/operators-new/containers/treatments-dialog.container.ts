/**
 * Treatments Dialog Container
 * Layer 2: Smart Component - Dialog per Vista Espansa Trattamenti
 *
 * Responsabilità:
 * - Dialog fullscreen per visualizzazione comoda dei trattamenti
 * - Mostra treatments-tab in modalità espansa
 * - Propaga tutti gli eventi al parent
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
import { TreatmentsTabComponent } from '../components/treatments-tab/treatments-tab.component';

// Models
import { Patient } from '../../../models/patient.model';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { Treatment } from '../../../models/treatment.model';

@Component({
  selector: 'app-treatments-dialog-container',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TreatmentsTabComponent
  ],
  template: `
    @if (isOpen) {
      <div class="dialog-overlay" (click)="onOverlayClick($event)">
        <div class="treatments-dialog" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-content">
              <mat-icon>medical_services</mat-icon>
              <div class="header-text">
                <h2>Trattamenti</h2>
                <span class="patient-info">{{ patient?.nome }} {{ patient?.cognome }} - {{ path?.name }}</span>
              </div>
            </div>
            <div class="header-actions">
              <button mat-icon-button (click)="onClose()" matTooltip="Chiudi">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <app-treatments-tab
              [treatments]="treatments"
              [loading]="loading"
              [selectedTreatmentId]="selectedTreatmentId"
              [showExpandButton]="false"
              (treatmentSelect)="onTreatmentSelect($event)"
              (treatmentDoubleClick)="onTreatmentDoubleClick($event)"
              (treatmentEdit)="onTreatmentEdit($event)">
            </app-treatments-tab>
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <button mat-button (click)="onClose()">
              Chiudi
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

    .treatments-dialog {
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
      padding: 0;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    /* Responsive */
    @media (max-width: 767px) {
      .dialog-overlay {
        padding: 0;
      }

      .treatments-dialog {
        max-width: 100%;
        max-height: 100vh;
        height: 100vh;
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

      .dialog-footer {
        padding: 12px 16px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreatmentsDialogContainer {
  @Input() patient: Patient | null = null;
  @Input() path: TherapeuticPath | null = null;
  @Input() treatments: Treatment[] = [];
  @Input() loading = false;
  @Input() selectedTreatmentId: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() treatmentSelect = new EventEmitter<Treatment>();
  @Output() treatmentDoubleClick = new EventEmitter<Treatment>();
  @Output() treatmentEdit = new EventEmitter<Treatment>();

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

  // === Propagazione eventi ===

  onTreatmentSelect(treatment: Treatment): void {
    this.treatmentSelect.emit(treatment);
  }

  onTreatmentDoubleClick(treatment: Treatment): void {
    this.treatmentDoubleClick.emit(treatment);
  }

  onTreatmentEdit(treatment: Treatment): void {
    this.treatmentEdit.emit(treatment);
  }
}
