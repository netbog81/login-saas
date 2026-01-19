/**
 * Treatment Detail Dialog Container
 * Layer 3: Smart Component (Business Logic)
 *
 * Responsabilità:
 * - Gestisce visibilità del dialog
 * - Mantiene riferimento al trattamento corrente
 * - Emette eventi al parent per azioni (modifica, chiusura)
 */

import {
  Component,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Treatment } from '../../../models/treatment.model';
import { TreatmentDetailDialogComponent } from '../components/treatment-detail-dialog/treatment-detail-dialog.component';

@Component({
  selector: 'app-treatment-detail-dialog-container',
  standalone: true,
  imports: [CommonModule, TreatmentDetailDialogComponent],
  template: `
    <app-treatment-detail-dialog
      [treatment]="currentTreatment"
      [isVisible]="isVisible"
      [loading]="false"
      (close)="onClose()"
      (edit)="onEdit($event)">
    </app-treatment-detail-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreatmentDetailDialogContainerComponent {
  @Output() close = new EventEmitter<void>();
  @Output() editTreatment = new EventEmitter<Treatment>();

  isVisible = false;
  currentTreatment: Treatment | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  /**
   * Apre il dialog per visualizzare un trattamento
   */
  open(treatment: Treatment): void {
    this.currentTreatment = treatment;
    this.isVisible = true;
    this.cdr.markForCheck();
  }

  /**
   * Chiude il dialog
   */
  onClose(): void {
    this.isVisible = false;
    this.currentTreatment = null;
    this.close.emit();
    this.cdr.markForCheck();
  }

  /**
   * Gestisce richiesta modifica dal dialog presentazionale
   */
  onEdit(treatment: Treatment): void {
    this.onClose();
    this.editTreatment.emit(treatment);
  }
}
