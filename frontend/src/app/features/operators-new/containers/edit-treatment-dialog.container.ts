/**
 * Edit Treatment Dialog Container
 * Layer 3: Smart Component (Business Logic)
 *
 * Responsabilita:
 * - Carica dati per il dialog (percorsi, servizi, strumenti)
 * - Gestisce chiamate al TreatmentService
 * - Gestisce stati loading/saving
 * - Emette eventi al parent
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { EditTreatmentDialogComponent } from '../components/edit-treatment-dialog/edit-treatment-dialog.component';
import { CashCollectionConfirmDialogComponent } from '../components/cash-collection-confirm-dialog/cash-collection-confirm-dialog.component';
import { EditTreatmentDialogData, EditTreatmentFormResult, BaseInstrumentData } from '../models/edit-treatment-dialog.model';
import { CashCollectionData } from '../models/start-treatment-dialog.model';
import { TreatmentService } from '../../../services/treatment.service';
import { TherapeuticPathService } from '../../../services/therapeutic-path.service';
import { ServiceService } from '../../../services/service.service';
import { InstrumentService } from '../../../services/instrument.service';
import { Treatment, CompleteTreatmentInput } from '../../../models/treatment.model';

@Component({
  selector: 'app-edit-treatment-dialog-container',
  standalone: true,
  imports: [CommonModule, EditTreatmentDialogComponent, CashCollectionConfirmDialogComponent],
  template: `
    <app-edit-treatment-dialog
      #dialogComponent
      [data]="dialogData"
      [isVisible]="isVisible"
      [isSaving]="isSaving"
      (save)="onSave($event)"
      (cancel)="onCancel()"
      (cashCollection)="onOpenCashCollection()"
      (completeTreatment)="onCompleteTreatment()"
      (reopenTreatment)="onReopenTreatment()">
    </app-edit-treatment-dialog>

    <!-- Cash Collection Dialog -->
    @if (showCashCollectionDialog) {
      <div class="cash-collection-overlay">
        <app-cash-collection-confirm-dialog
          [amount]="currentFormPrice"
          [operatorId]="currentTreatment?.operatorId || ''"
          (confirm)="onCashCollectionConfirm($event)"
          (cancel)="onCashCollectionCancel()">
        </app-cash-collection-confirm-dialog>
      </div>
    }
  `,
  styles: [`
    .cash-collection-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1100;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditTreatmentDialogContainerComponent implements OnDestroy {
  @Input() patientId!: number;

  @Output() treatmentUpdated = new EventEmitter<Treatment>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('dialogComponent') dialogComponent!: EditTreatmentDialogComponent;

  private destroy$ = new Subject<void>();
  currentTreatment!: Treatment;

  isVisible = false;
  isSaving = false;
  dialogData!: EditTreatmentDialogData;

  // Cash collection state
  showCashCollectionDialog = false;
  cashCollectionData: CashCollectionData | null = null;
  currentFormPrice: number = 0; // Prezzo corrente dal form (con sconto FE applicato)

  constructor(
    private treatmentService: TreatmentService,
    private pathService: TherapeuticPathService,
    private serviceService: ServiceService,
    private instrumentService: InstrumentService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Apre il dialog per modificare un trattamento
   */
  open(treatment: Treatment): void {
    console.log('[EditTreatmentDialogContainer] Opening for treatment:', {
      id: treatment.id,
      therapeuticPathId: treatment.therapeuticPathId,
      serviceId: treatment.serviceId,
      price: treatment.price
    });
    this.currentTreatment = treatment;

    // Usa patientId dal trattamento se disponibile
    const patientId = treatment.patientId || this.patientId;
    if (!patientId) {
      console.error('[EditTreatmentDialogContainer] patientId is required');
      return;
    }

    this.loadData(patientId);
  }

  /**
   * Chiude il dialog
   */
  close(): void {
    this.ngZone.run(() => {
      this.isVisible = false;
      this.cdr.markForCheck();
    });
  }

  /**
   * Carica i dati necessari per il dialog
   */
  private loadData(patientId: number): void {
    console.log('[EditTreatmentDialogContainer] Loading data for patient:', patientId);

    forkJoin({
      paths: this.pathService.getPathsByPatient(patientId),
      services: this.serviceService.getServicesOnce(),
      instruments: this.instrumentService.getInstruments(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ paths, services, instruments }) => {
          this.ngZone.run(() => {
            console.log('[EditTreatmentDialogContainer] Data loaded:', {
              paths: paths.length,
              services: services.length,
              instruments: instruments.length
            });

            // Convert appointment instruments to BaseInstrumentData format
            // AppointmentInstrument has instrumentName directly, not nested instrument object
            const appointmentInstruments: BaseInstrumentData[] = (
              this.currentTreatment.appointment?.instruments || []
            ).map((inst: any) => ({
              instrumentId: inst.instrumentId,
              instrument: inst.instrument
                ? { id: inst.instrument.id, name: inst.instrument.name }
                : inst.instrumentName
                  ? { id: inst.instrumentId, name: inst.instrumentName }
                  : undefined,
              startOffsetMinutes: inst.startOffsetMinutes || 0,
              endOffsetMinutes: inst.endOffsetMinutes || 0,
              instrumentCategoryId: inst.instrumentCategoryId,
            }));

            this.dialogData = {
              treatment: this.currentTreatment,
              availablePaths: paths.filter(p => p.status?.toLowerCase() === 'active'),
              availableServices: services.filter(s => s.isActive),
              availableInstruments: instruments.filter(i => i.isActive),
              appointmentInstruments,
            };
            this.isVisible = true;
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[EditTreatmentDialogContainer] Error loading data:', err);
        },
      });
  }

  /**
   * Salva le modifiche al trattamento
   */
  onSave(result: EditTreatmentFormResult): void {
    console.log('[EditTreatmentDialogContainer] Saving treatment:', result);

    this.ngZone.run(() => {
      this.isSaving = true;
      this.cdr.markForCheck();
    });

    // Determina se annullare il pagamento esistente:
    // - Se il trattamento era pagato E ora collectedByOperator è false → isPaid: false
    const shouldResetPayment = this.currentTreatment.isPaid && !result.collectedByOperator;

    this.treatmentService
      .updateTreatment({
        id: this.currentTreatment.id,
        therapeuticPathId: result.therapeuticPathId,
        serviceId: result.serviceId,
        clinicalNotes: result.clinicalNotes,
        secretaryNotes: result.secretaryNotes,
        patientNotes: result.patientNotes,
        price: result.price,
        scontoFE: result.scontoFE,
        painLevel: result.painLevel,
        painBefore: result.painBefore,
        painAfter: result.painAfter,
        rescheduleRequested: result.rescheduleRequested,
        // Campi riprogrammazione
        reschedulingType: result.reschedulingType,
        suggestInDays: result.suggestInDays,
        suggestDateRangeStart: result.suggestDateRangeStart,
        suggestDateRangeEnd: result.suggestDateRangeEnd,
        reschedulingNotes: result.reschedulingNotes,
        isPaid: shouldResetPayment ? false : undefined, // Resetta pagamento se necessario
        instruments: result.instruments?.map(inst => ({
          instrumentId: inst.instrumentId,
          instrumentCategoryId: inst.instrumentCategoryId,
          wasUsed: inst.wasUsed,
          startOffsetMinutes: inst.startOffsetMinutes,
          endOffsetMinutes: inst.endOffsetMinutes,
          notes: inst.notes,
        })),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTreatment) => {
          console.log('[EditTreatmentDialogContainer] Treatment updated:', updatedTreatment.id);

          // Se è stato richiesto NUOVO incasso da operatore (non era già pagato), registra il pagamento
          if (result.collectedByOperator && result.paymentMethod && !this.currentTreatment.isPaid) {
            this.recordPayment(updatedTreatment, result);
          } else {
            this.ngZone.run(() => {
              this.isSaving = false;
              this.isVisible = false;
              this.treatmentUpdated.emit(updatedTreatment);
              this.cdr.markForCheck();
            });
          }
        },
        error: (err) => {
          console.error('[EditTreatmentDialogContainer] Error updating treatment:', err);
          this.ngZone.run(() => {
            this.isSaving = false;
            this.cdr.markForCheck();
          });
        },
      });
  }

  /**
   * Registra il pagamento per il trattamento
   */
  private recordPayment(treatment: Treatment, result: EditTreatmentFormResult): void {
    if (!result.paymentMethod) return;

    this.treatmentService
      .recordPayment(treatment.id, {
        paymentMethod: result.paymentMethod,
        collectedBy: this.currentTreatment.operatorId,
        amount: result.price,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (paidTreatment) => {
          console.log('[EditTreatmentDialogContainer] Payment recorded:', paidTreatment.id);
          this.ngZone.run(() => {
            this.isSaving = false;
            this.isVisible = false;
            this.treatmentUpdated.emit(paidTreatment);
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[EditTreatmentDialogContainer] Error recording payment:', err);
          // Emetti comunque il trattamento aggiornato anche se il pagamento fallisce
          this.ngZone.run(() => {
            this.isSaving = false;
            this.isVisible = false;
            this.treatmentUpdated.emit(treatment);
            this.cdr.markForCheck();
          });
        },
      });
  }

  /**
   * Apre il dialog di cash collection
   */
  onOpenCashCollection(): void {
    // Leggi il prezzo corrente dal form del component (con sconto FE applicato)
    if (this.dialogComponent?.form) {
      this.currentFormPrice = this.dialogComponent.form.get('price')?.value || 0;
    }
    console.log('[EditTreatmentDialogContainer] Opening cash collection dialog with price:', this.currentFormPrice);
    this.ngZone.run(() => {
      this.showCashCollectionDialog = true;
      this.cdr.markForCheck();
    });
  }

  /**
   * Conferma incasso da operatore
   */
  onCashCollectionConfirm(data: CashCollectionData): void {
    console.log('[EditTreatmentDialogContainer] Cash collection confirmed:', data);
    this.cashCollectionData = data;
    this.ngZone.run(() => {
      this.showCashCollectionDialog = false;

      // Notifica il component dialog che l'incasso è stato confermato (dentro ngZone)
      if (this.dialogComponent) {
        this.dialogComponent.setCashCollected(data.paymentMethod);
      }

      this.cdr.markForCheck();
    });
  }

  /**
   * Annulla dialog cash collection
   */
  onCashCollectionCancel(): void {
    console.log('[EditTreatmentDialogContainer] Cash collection cancelled');
    this.ngZone.run(() => {
      this.showCashCollectionDialog = false;
      this.cdr.markForCheck();
    });
  }

  /**
   * Completa il trattamento (status -> operator_completed)
   */
  onCompleteTreatment(): void {
    if (!this.currentTreatment) return;

    if (!confirm('Confermi di voler completare il trattamento?')) {
      return;
    }

    console.log('[EditTreatmentDialogContainer] Completing treatment:', this.currentTreatment.id);

    this.ngZone.run(() => {
      this.isSaving = true;
      this.cdr.markForCheck();
    });

    const input: CompleteTreatmentInput = {
      price: this.currentTreatment.price || 0,
      clinicalNotes: this.currentTreatment.clinicalNotes,
      secretaryNotes: this.currentTreatment.secretaryNotes,
      operatorNotes: this.currentTreatment.operatorNotes
    };

    this.treatmentService.completeTreatment(this.currentTreatment.id, input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTreatment) => {
          console.log('[EditTreatmentDialogContainer] Treatment completed:', updatedTreatment.id);
          this.ngZone.run(() => {
            this.isSaving = false;
            this.isVisible = false;
            this.treatmentUpdated.emit(updatedTreatment);
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[EditTreatmentDialogContainer] Error completing treatment:', err);
          this.ngZone.run(() => {
            this.isSaving = false;
            alert('Errore durante il completamento del trattamento');
            this.cdr.markForCheck();
          });
        }
      });
  }

  /**
   * Riapre un trattamento completato (status -> in_progress)
   */
  onReopenTreatment(): void {
    if (!this.currentTreatment) return;

    if (!confirm('Confermi di voler rimettere in corso il trattamento?')) {
      return;
    }

    console.log('[EditTreatmentDialogContainer] Reopening treatment:', this.currentTreatment.id);

    this.ngZone.run(() => {
      this.isSaving = true;
      this.cdr.markForCheck();
    });

    this.treatmentService.reopenTreatment(this.currentTreatment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTreatment) => {
          console.log('[EditTreatmentDialogContainer] Treatment reopened:', updatedTreatment.id);
          this.ngZone.run(() => {
            this.isSaving = false;
            this.isVisible = false;
            this.treatmentUpdated.emit(updatedTreatment);
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('[EditTreatmentDialogContainer] Error reopening treatment:', err);
          this.ngZone.run(() => {
            this.isSaving = false;
            alert('Errore durante la riapertura del trattamento');
            this.cdr.markForCheck();
          });
        }
      });
  }

  /**
   * Gestisce annullamento dal dialog
   */
  onCancel(): void {
    console.log('[EditTreatmentDialogContainer] Cancel');
    this.close();
    this.cancel.emit();
  }
}
