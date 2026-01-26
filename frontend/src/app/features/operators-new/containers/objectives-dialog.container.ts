/**
 * Objectives Dialog Container
 * Layer 2: Smart Component - Dialog per Vista Espansa Obiettivi
 *
 * Responsabilità:
 * - Dialog fullscreen per visualizzazione comoda di obiettivi e test
 * - Mostra objectives-tab in modalità espansa
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
import { ObjectivesTabComponent } from '../components/objectives-tab/objectives-tab.component';

// Models
import { AnamnesisComplete } from '../models/anamnesis.model';
import { Patient } from '../../../models/patient.model';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import {
  ObjectiveWithProgress,
  TestWithEvaluations,
  ObjectiveProgressChangeEvent,
  TestEvaluationAddedEvent,
  TestEvaluationEditedEvent,
  TestResetEvent,
  TestDeleteEvent
} from '../models/objectives-tracking.model';

@Component({
  selector: 'app-objectives-dialog-container',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ObjectivesTabComponent
  ],
  template: `
    @if (isOpen) {
      <div class="dialog-overlay" (click)="onOverlayClick($event)">
        <div class="objectives-dialog" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-content">
              <mat-icon>track_changes</mat-icon>
              <div class="header-text">
                <h2>Obiettivi e Test</h2>
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
            <app-objectives-tab
              [anamnesisComplete]="anamnesisComplete"
              [objectivesWithProgress]="objectivesWithProgress"
              [testsWithEvaluations]="testsWithEvaluations"
              [readonly]="false"
              [showExpandButton]="false"
              (objectiveProgressChanged)="onObjectiveProgressChanged($event)"
              (testEvaluationAdded)="onTestEvaluationAdded($event)"
              (testEvaluationEdited)="onTestEvaluationEdited($event)"
              (testReset)="onTestReset($event)"
              (testDeleted)="onTestDeleted($event)"
              (openTestHistory)="onOpenTestHistory($event)">
            </app-objectives-tab>
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

    .objectives-dialog {
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
      padding: 0;  /* ObjectivesTabComponent ha già il suo padding */
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

      .objectives-dialog {
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
export class ObjectivesDialogContainer {
  @Input() patient: Patient | null = null;
  @Input() path: TherapeuticPath | null = null;
  @Input() anamnesisComplete: AnamnesisComplete | null = null;
  @Input() objectivesWithProgress: ObjectiveWithProgress[] = [];
  @Input() testsWithEvaluations: TestWithEvaluations[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() objectiveProgressChanged = new EventEmitter<ObjectiveProgressChangeEvent>();
  @Output() testEvaluationAdded = new EventEmitter<TestEvaluationAddedEvent>();
  @Output() testEvaluationEdited = new EventEmitter<TestEvaluationEditedEvent>();
  @Output() testReset = new EventEmitter<TestResetEvent>();
  @Output() testDeleted = new EventEmitter<TestDeleteEvent>();
  @Output() openTestHistory = new EventEmitter<TestWithEvaluations>();

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

  onObjectiveProgressChanged(event: ObjectiveProgressChangeEvent): void {
    this.objectiveProgressChanged.emit(event);
  }

  onTestEvaluationAdded(event: TestEvaluationAddedEvent): void {
    this.testEvaluationAdded.emit(event);
  }

  onTestEvaluationEdited(event: TestEvaluationEditedEvent): void {
    this.testEvaluationEdited.emit(event);
  }

  onTestReset(event: TestResetEvent): void {
    this.testReset.emit(event);
  }

  onTestDeleted(event: TestDeleteEvent): void {
    this.testDeleted.emit(event);
  }

  onOpenTestHistory(test: TestWithEvaluations): void {
    this.openTestHistory.emit(test);
  }
}
