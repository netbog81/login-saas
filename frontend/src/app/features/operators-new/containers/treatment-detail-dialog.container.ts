/**
 * Treatment Detail Dialog Container
 * Layer 3: Smart Component (Business Logic)
 *
 * Responsabilità:
 * - Gestisce visibilità del dialog
 * - Mantiene riferimento al trattamento corrente
 * - Emette eventi al parent per azioni (modifica, chiusura)
 * - Scheda Pagamento: registra/annulla l'incasso dal workspace operatore,
 *   anche a trattamento completato/chiuso (es. il paziente paga alla seduta
 *   successiva). Il backend verifica canCollectPayment sull'operatore.
 */

import {
  Component,
  Output,
  EventEmitter,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { Treatment, PaymentMethod, PaymentTenderLine } from '../../../models/treatment.model';
import { TreatmentService } from '../../../services/treatment.service';
import { TreatmentDetailDialogComponent } from '../components/treatment-detail-dialog/treatment-detail-dialog.component';
// Dialog di pagamento condiviso con la feature trattamenti (stesso riuso già
// fatto da edit-treatment-dialog.container): gestisce la dualità scontoFE.
import {
  PagamentoSplitDialogComponent,
  PagamentoSplitDialogData,
  PagamentoSplitDialogResult,
} from '../../trattamenti/components/pagamento-split-dialog/pagamento-split-dialog.component';

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
      (edit)="onEdit($event)"
      (registerPayment)="onRegisterPayment($event)"
      (cancelPayment)="onCancelPayment($event)">
    </app-treatment-detail-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreatmentDetailDialogContainerComponent implements OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() editTreatment = new EventEmitter<Treatment>();
  /** Emesso dopo registrazione/annullo pagamento: il parent aggiorna la lista. */
  @Output() treatmentUpdated = new EventEmitter<Treatment>();

  isVisible = false;
  currentTreatment: Treatment | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private treatmentService: TreatmentService,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

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

  /**
   * Scheda Pagamento → "Registra pagamento": apre lo split dialog con la
   * fonte metodi corretta (scontoFE ON → contanti/voucher FE; OFF → metodi
   * accounting) e registra l'incasso con ruolo OPERATOR.
   */
  onRegisterPayment(treatment: Treatment): void {
    const dialogRef = this.dialog.open<
      PagamentoSplitDialogComponent,
      PagamentoSplitDialogData,
      PagamentoSplitDialogResult
    >(PagamentoSplitDialogComponent, {
      width: '560px',
      data: {
        treatmentId: treatment.id,
        patientId: treatment.patientId ?? null,
        scontoFE: treatment.scontoFE === true,
        totalAmount: treatment.price || 0,
        currentUserId: treatment.operatorId ?? '',
        // Workspace operatore: può scalare i voucher FE esistenti ma NON
        // emetterne di nuovi (riservato a segreteria/admin).
        canIssueVoucherFe: false,
      },
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (!result) return;
      this.treatmentService
        .recordPayment(treatment.id, {
          paymentMethod: this.deriveLegacyMethod(result.tenderLines),
          collectedBy: result.collectedBy || treatment.operatorId,
          amount: result.amount,
          tenderLines: result.tenderLines,
        }, 'OPERATOR')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updated) => this.applyUpdated(updated),
          error: (err) => this.showError(err, 'Errore durante la registrazione del pagamento'),
        });
    });
  }

  /**
   * Scheda Pagamento → "Annulla pagamento". Il backend rifiuta se la fattura
   * è già emessa (lo storno si fa dalla Contabilità) o se l'operatore non ha
   * canCollectPayment.
   */
  onCancelPayment(treatment: Treatment): void {
    if (!window.confirm('Annullare il pagamento registrato per questo trattamento?')) {
      return;
    }
    this.treatmentService
      .cancelPayment(treatment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => this.applyUpdated(updated),
        error: (err) => this.showError(err, "Errore durante l'annullo del pagamento"),
      });
  }

  private applyUpdated(updated: Treatment): void {
    // Merge: la mutation ritorna il treatment aggiornato ma alcune relazioni
    // (operator, service) potrebbero non essere popolate come nella lista.
    this.currentTreatment = { ...this.currentTreatment, ...updated };
    this.treatmentUpdated.emit(this.currentTreatment);
    this.cdr.markForCheck();
  }

  private showError(err: unknown, fallback: string): void {
    const e = err as { graphQLErrors?: Array<{ message?: string }>; message?: string };
    alert(e?.graphQLErrors?.[0]?.message || e?.message || fallback);
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
}
