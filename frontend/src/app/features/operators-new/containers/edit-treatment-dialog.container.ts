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
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, of, switchMap, takeUntil } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { EditTreatmentDialogComponent } from '../components/edit-treatment-dialog/edit-treatment-dialog.component';
import { EditTreatmentDialogData, EditTreatmentFormResult, BaseInstrumentData } from '../models/edit-treatment-dialog.model';
import { TreatmentService } from '../../../services/treatment.service';
import { TherapeuticPathService } from '../../../services/therapeutic-path.service';
import { ServiceService } from '../../../services/service.service';
import { InstrumentService } from '../../../services/instrument.service';
import { Treatment, CompleteTreatmentInput, PaymentMethod, PaymentTenderLine } from '../../../models/treatment.model';
// Dialog di pagamento condiviso con la feature trattamenti: gestisce la
// dualità scontoFE (ON → metodi clinici contanti/voucher FE; OFF → metodi
// accounting + voucher tipo 1/2 via proxy).
import {
  PagamentoSplitDialogComponent,
  PagamentoSplitDialogData,
  PagamentoSplitDialogResult,
} from '../../trattamenti/components/pagamento-split-dialog/pagamento-split-dialog.component';

@Component({
  selector: 'app-edit-treatment-dialog-container',
  standalone: true,
  imports: [CommonModule, EditTreatmentDialogComponent],
  template: `
    <app-edit-treatment-dialog
      #dialogComponent
      [data]="dialogData"
      [isVisible]="isVisible"
      [isSaving]="isSaving"
      (save)="onSave($event)"
      (cancel)="onCancel()"
      (cashCollection)="onOpenCashCollection()"
      (completeTreatment)="onCompleteTreatment($event)"
      (reopenTreatment)="onReopenTreatment()">
    </app-edit-treatment-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditTreatmentDialogContainerComponent implements OnDestroy {
  @Input() patientId!: string;

  @Output() treatmentUpdated = new EventEmitter<Treatment>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('dialogComponent') dialogComponent!: EditTreatmentDialogComponent;

  private destroy$ = new Subject<void>();
  currentTreatment!: Treatment;

  isVisible = false;
  isSaving = false;
  dialogData!: EditTreatmentDialogData;

  constructor(
    private treatmentService: TreatmentService,
    private pathService: TherapeuticPathService,
    private serviceService: ServiceService,
    private instrumentService: InstrumentService,
    private dialog: MatDialog,
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
    this.isVisible = false;
    this.cdr.markForCheck();
  }

  /**
   * Carica i dati necessari per il dialog
   */
  private loadData(patientId: string): void {
    console.log('[EditTreatmentDialogContainer] Loading data for patient:', patientId);

    forkJoin({
      paths: this.pathService.getPathsByPatient(patientId),
      services: this.serviceService.getServicesOnce(),
      instruments: this.instrumentService.getInstruments(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ paths, services, instruments }) => {
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
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

    this.isSaving = true;
    this.cdr.markForCheck();

    // Determina se annullare il pagamento esistente:
    // - Se il trattamento era pagato E ora collectedByOperator è false → isPaid: false
    const shouldResetPayment = this.currentTreatment.isPaid && !result.collectedByOperator;

    this.treatmentService
      .updateTreatment({
        id: this.currentTreatment.id,
        therapeuticPathId: result.therapeuticPathId,
        serviceId: result.serviceId,  // @deprecated - manteniamo per retrocompatibilità
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
        // Nuovo: servizi multipli del trattamento
        treatmentServices: result.treatmentServices,
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
          if (result.collectedByOperator && result.paymentMethod &&
              result.tenderLines?.length && !this.currentTreatment.isPaid) {
            this.recordPayment(updatedTreatment, result);
          } else {
            // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
            this.isSaving = false;
            this.isVisible = false;
            this.treatmentUpdated.emit(updatedTreatment);
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('[EditTreatmentDialogContainer] Error updating treatment:', err);
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
          this.isSaving = false;
          // Estrai messaggio di errore dal backend
          const errorMessage = err?.graphQLErrors?.[0]?.message
            || err?.message
            || 'Errore durante il salvataggio del trattamento';

          // Se il trattamento non è modificabile, suggerisci di riaprirlo
          if (errorMessage.includes('Solo i trattamenti in corso')) {
            alert(errorMessage + '\n\nPer modificare il trattamento, usa prima il pulsante "Riapri Trattamento".');
          } else {
            alert(errorMessage);
          }
          this.cdr.markForCheck();
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
        collectedBy: result.collectedBy || this.currentTreatment.operatorId,
        amount: result.collectedAmount ?? result.price,
        tenderLines: result.tenderLines,
      }, 'OPERATOR')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (paidTreatment) => {
          console.log('[EditTreatmentDialogContainer] Payment recorded:', paidTreatment.id);
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
          this.isSaving = false;
          this.isVisible = false;
          this.treatmentUpdated.emit(paidTreatment);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[EditTreatmentDialogContainer] Error recording payment:', err);
          // Emetti comunque il trattamento aggiornato anche se il pagamento fallisce
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
          this.isSaving = false;
          this.isVisible = false;
          this.treatmentUpdated.emit(treatment);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Apre il dialog di pagamento con split multi-riga.
   *
   * La fonte dei metodi dipende dal valore CORRENTE del toggle scontoFE nel
   * form (non da quello salvato sul trattamento): scontoFE ON → contanti +
   * voucher FE del paziente (solo clinico); OFF → metodi di pagamento di
   * accounting + voucher tipo 1/2. Il pagamento viene registrato solo al
   * Salva/Completa, insieme alle altre modifiche.
   */
  onOpenCashCollection(): void {
    const form = this.dialogComponent?.form;
    const totalAmount = form?.get('price')?.value || 0;
    const scontoFE = form?.get('scontoFE')?.value === true;

    const dialogRef = this.dialog.open<
      PagamentoSplitDialogComponent,
      PagamentoSplitDialogData,
      PagamentoSplitDialogResult
    >(PagamentoSplitDialogComponent, {
      width: '560px',
      data: {
        treatmentId: this.currentTreatment.id,
        patientId: this.currentTreatment.patientId ?? null,
        scontoFE,
        totalAmount,
        currentUserId: this.currentTreatment.operatorId ?? '',
        // Workspace operatore: può scalare i voucher FE esistenti ma NON
        // emetterne di nuovi (riservato a segreteria/admin).
        canIssueVoucherFe: false,
      },
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (!result || !this.dialogComponent) return;
      this.dialogComponent.setCashCollected(
        this.deriveLegacyMethod(result.tenderLines),
        result.tenderLines,
        result.collectedBy,
        result.amount,
      );
      this.cdr.markForCheck();
    });
  }

  /**
   * paymentMethod legacy derivato dalla prima riga 'method' delle tenderLines
   * (il backend usa tenderLines come fonte di verità; il campo legacy serve
   * solo per visualizzazione retrocompatibile).
   */
  private deriveLegacyMethod(lines: PaymentTenderLine[]): PaymentMethod {
    const first = lines.find((l) => l.kind === 'method');
    const code = (first?.paymentMethodId ?? '').toLowerCase();
    if (code.includes('cash') || code.includes('contant')) return 'CASH' as PaymentMethod;
    if (code.includes('card') || code.includes('bancomat') || code.includes('pos')) return 'CARD' as PaymentMethod;
    if (code.includes('transfer') || code.includes('bonific')) return 'TRANSFER' as PaymentMethod;
    if (code.includes('satispay')) return 'SATISPAY' as PaymentMethod;
    return 'OTHER' as PaymentMethod;
  }

  /**
   * Completa il trattamento (status -> operator_completed)
   * Se formResult è presente, prima salva le modifiche poi completa
   */
  onCompleteTreatment(formResult: EditTreatmentFormResult | null): void {
    if (!this.currentTreatment) return;

    this.isSaving = true;
    this.cdr.markForCheck();

    if (formResult) {
      // Form modificato: prima salva le modifiche, poi completa
      console.log('[EditTreatmentDialogContainer] Saving changes and completing treatment:', this.currentTreatment.id);

      const shouldResetPayment = this.currentTreatment.isPaid && !formResult.collectedByOperator;

      this.treatmentService.updateTreatment({
        id: this.currentTreatment.id,
        therapeuticPathId: formResult.therapeuticPathId,
        serviceId: formResult.serviceId,
        clinicalNotes: formResult.clinicalNotes,
        secretaryNotes: formResult.secretaryNotes,
        patientNotes: formResult.patientNotes,
        price: formResult.price,
        scontoFE: formResult.scontoFE,
        painLevel: formResult.painLevel,
        painBefore: formResult.painBefore,
        painAfter: formResult.painAfter,
        rescheduleRequested: formResult.rescheduleRequested,
        reschedulingType: formResult.reschedulingType,
        suggestInDays: formResult.suggestInDays,
        suggestDateRangeStart: formResult.suggestDateRangeStart,
        suggestDateRangeEnd: formResult.suggestDateRangeEnd,
        reschedulingNotes: formResult.reschedulingNotes,
        isPaid: shouldResetPayment ? false : undefined,
        treatmentServices: formResult.treatmentServices,
        instruments: formResult.instruments?.map(inst => ({
          instrumentId: inst.instrumentId,
          instrumentCategoryId: inst.instrumentCategoryId,
          wasUsed: inst.wasUsed,
          startOffsetMinutes: inst.startOffsetMinutes,
          endOffsetMinutes: inst.endOffsetMinutes,
          notes: inst.notes,
        })),
      }).pipe(
        switchMap(updatedTreatment => {
          // Se nel form è stato confermato un NUOVO incasso (dialog di
          // pagamento → tenderLines presenti), registralo prima di completare:
          // il flusso "Completa" non passa dal Salva e perderebbe il pagamento.
          if (formResult.collectedByOperator && formResult.paymentMethod &&
              formResult.tenderLines?.length && !this.currentTreatment.isPaid) {
            return this.treatmentService.recordPayment(updatedTreatment.id, {
              paymentMethod: formResult.paymentMethod,
              collectedBy: formResult.collectedBy || this.currentTreatment.operatorId,
              amount: formResult.collectedAmount ?? formResult.price,
              tenderLines: formResult.tenderLines,
            }, 'OPERATOR');
          }
          return of(updatedTreatment);
        }),
        switchMap(updatedTreatment => {
          console.log('[EditTreatmentDialogContainer] Changes saved, now completing treatment');
          const input: CompleteTreatmentInput = {
            price: updatedTreatment.price || 0,
            clinicalNotes: updatedTreatment.clinicalNotes,
            secretaryNotes: updatedTreatment.secretaryNotes,
            operatorNotes: updatedTreatment.operatorNotes
          };
          return this.treatmentService.completeTreatment(updatedTreatment.id, input);
        }),
        takeUntil(this.destroy$)
      ).subscribe({
        next: (completedTreatment) => {
          console.log('[EditTreatmentDialogContainer] Treatment saved and completed:', completedTreatment.id);
          this.isSaving = false;
          this.isVisible = false;
          this.treatmentUpdated.emit(completedTreatment);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[EditTreatmentDialogContainer] Error saving/completing treatment:', err);
          this.isSaving = false;
          const errorMessage = err?.graphQLErrors?.[0]?.message
            || err?.message
            || 'Errore durante il salvataggio e completamento del trattamento';
          alert(errorMessage);
          this.cdr.markForCheck();
        }
      });
    } else {
      // Form non modificato: completa direttamente
      console.log('[EditTreatmentDialogContainer] Completing treatment:', this.currentTreatment.id);

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
            this.isSaving = false;
            this.isVisible = false;
            this.treatmentUpdated.emit(updatedTreatment);
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error('[EditTreatmentDialogContainer] Error completing treatment:', err);
            this.isSaving = false;
            // Propaga il messaggio del backend (es. OwnershipGuard:
            // "Operazione consentita solo al creatore del trattamento...")
            // invece di un generico "Errore".
            const errorMessage = err?.graphQLErrors?.[0]?.message
              || err?.message
              || 'Errore durante il completamento del trattamento';
            alert(errorMessage);
            this.cdr.markForCheck();
          }
        });
    }
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

    this.isSaving = true;
    this.cdr.markForCheck();

    this.treatmentService.reopenTreatment(this.currentTreatment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTreatment) => {
          console.log('[EditTreatmentDialogContainer] Treatment reopened:', updatedTreatment.id);
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
          this.isSaving = false;
          this.isVisible = false;
          this.treatmentUpdated.emit(updatedTreatment);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[EditTreatmentDialogContainer] Error reopening treatment:', err);
          // Apollo già esegue dentro NgZone, non serve wrapping aggiuntivo
          this.isSaving = false;
          // Propaga il messaggio del backend (es. ownership) invece di un generico "Errore".
          const errorMessage = err?.graphQLErrors?.[0]?.message
            || err?.message
            || 'Errore durante la riapertura del trattamento';
          alert(errorMessage);
          this.cdr.markForCheck();
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
