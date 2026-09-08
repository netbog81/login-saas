/**
 * Pending FE Dialog Container
 * Layer 2: Smart Component (Business Logic)
 *
 * Responsabilità:
 * - Caricare gli sconto FE non incassati del paziente
 * - Registrare l'incasso di una riga riusando il flusso di pagamento
 *   condiviso (PagamentoSplitDialogComponent → recordTreatmentPayment)
 * - Restituire al chiamante il numero di scoperti rimasti, così il badge
 *   della cartella paziente si aggiorna alla chiusura
 */

import {
  Component,
  Inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { TreatmentService } from '../../../services/treatment.service';
import { PaymentMethod, PaymentTenderLine } from '../../../models/treatment.model';
import { PendingFeService } from '../services/pending-fe.service';
import {
  EMPTY_PENDING_FE_COLLECTIONS,
  PendingFeCollectionItem,
  PendingFeCollections,
} from '../models/pending-fe.model';
import { PendingFeListComponent } from '../components/pending-fe-list/pending-fe-list.component';
// Stesso dialog di pagamento della pagina Trattamenti: per gli sconto FE
// propone contanti + voucher FE del paziente (vedi payment-source-duality).
import {
  PagamentoSplitDialogComponent,
  PagamentoSplitDialogData,
  PagamentoSplitDialogResult,
} from '../../trattamenti/components/pagamento-split-dialog/pagamento-split-dialog.component';

export interface PendingFeDialogData {
  patientId: string;
  patientName: string;
}

/** Numero di scoperti FE rimasti alla chiusura del riquadro. */
export interface PendingFeDialogResult {
  remainingCount: number;
}

@Component({
  selector: 'app-pending-fe-dialog-container',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    PendingFeListComponent,
  ],
  template: `
    <div class="fe-dialog">
      <div class="fe-dialog__header">
        <h2>
          <mat-icon>notification_important</mat-icon>
          <span>Sconto FE da incassare — {{ data.patientName }}</span>
        </h2>
        <button mat-icon-button (click)="onClose()" aria-label="Chiudi">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="fe-dialog__summary">
        <span>
          <strong>{{ collections.count }}</strong>
          {{ collections.count === 1 ? 'trattamento' : 'trattamenti' }}
          con sconto FE mai incassato
        </span>
        <span class="total">Totale: <strong>{{ collections.totalAmount | currency: 'EUR' }}</strong></span>
      </div>

      @if (!collections.callerIsSecretary && !collections.allowAnyOperatorCollect) {
        <div class="fe-dialog__hint">
          <mat-icon>info</mat-icon>
          <span>
            Vedi tutti gli scoperti del paziente ma puoi incassare solo i tuoi:
            l'impostazione «permetti a tutti gli operatori di incassare sconto FE»
            è disattivata (Configurazioni → Incassi sconto FE).
          </span>
        </div>
      }

      <mat-dialog-content class="fe-dialog__content">
        <app-pending-fe-list
          [items]="collections.items"
          [loading]="loading"
          [error]="error"
          [busyTreatmentId]="busyTreatmentId"
          (collect)="onCollect($event)">
        </app-pending-fe-list>
      </mat-dialog-content>

      <div class="fe-dialog__actions">
        <button mat-stroked-button (click)="onClose()">Chiudi</button>
      </div>
    </div>
  `,
  styles: [`
    .fe-dialog {
      display: flex;
      flex-direction: column;
      max-height: 80vh;
    }

    .fe-dialog__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white;

      h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
      }

      button { color: white; }
    }

    .fe-dialog__summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 24px;
      background: #fef2f2;
      border-bottom: 1px solid #fee2e2;
      color: #7f1d1d;
      font-size: 0.9375rem;

      .total { white-space: nowrap; }
    }

    .fe-dialog__hint {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 24px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 0.8125rem;
      border-bottom: 1px solid #dbeafe;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .fe-dialog__content {
      padding: 16px 24px;
      overflow: auto;
    }

    .fe-dialog__actions {
      display: flex;
      justify-content: flex-end;
      padding: 12px 24px;
      border-top: 1px solid #e5e7eb;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingFeDialogContainer implements OnInit, OnDestroy {
  collections: PendingFeCollections = EMPTY_PENDING_FE_COLLECTIONS;
  loading = true;
  error: string | null = null;
  busyTreatmentId: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private dialogRef: MatDialogRef<PendingFeDialogContainer, PendingFeDialogResult>,
    private dialog: MatDialog,
    private pendingFeService: PendingFeService,
    private treatmentService: TreatmentService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: PendingFeDialogData,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onClose(): void {
    this.dialogRef.close({ remainingCount: this.collections.count });
  }

  /**
   * "Incassa" su una riga: apre il dialog di pagamento in modalità sconto FE
   * (contanti + voucher FE) e registra l'incasso. Il backend riverifica il
   * permesso: `canCollect` qui serve solo a non proporre azioni impossibili.
   */
  onCollect(item: PendingFeCollectionItem): void {
    if (this.busyTreatmentId) return;

    const dialogRef = this.dialog.open<
      PagamentoSplitDialogComponent,
      PagamentoSplitDialogData,
      PagamentoSplitDialogResult
    >(PagamentoSplitDialogComponent, {
      width: '560px',
      data: {
        treatmentId: item.treatmentId,
        patientId: this.data.patientId,
        scontoFE: true,
        totalAmount: item.amount,
        // Default di `collectedBy`: il backend lo normalizza comunque
        // sull'AppUser di chi sta incassando (mai su chi eseguì il
        // trattamento), così l'incasso resta attribuito a chi lo registra.
        // Il fallback sull'operatore evita che il dialog resti bloccato se
        // il profilo utente non è ancora caricato (campo obbligatorio lì).
        currentUserId: this.currentUserId || item.operatorId,
        // L'emissione di nuovi voucher FE resta a segreteria/admin.
        canIssueVoucherFe: this.collections.callerIsSecretary,
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;
        this.busyTreatmentId = item.treatmentId;
        this.cdr.markForCheck();

        this.treatmentService
          .recordPayment(
            item.treatmentId,
            {
              paymentMethod: this.deriveLegacyMethod(result.tenderLines),
              collectedBy: result.collectedBy || this.currentUserId || item.operatorId,
              amount: result.amount,
              tenderLines: result.tenderLines,
            },
            this.collections.callerIsSecretary ? 'SECRETARY' : 'OPERATOR',
          )
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.busyTreatmentId = null;
              this.load();
            },
            error: (err) => {
              this.busyTreatmentId = null;
              this.error = this.extractError(err);
              this.cdr.markForCheck();
            },
          });
      });
  }

  private load(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.pendingFeService
      .getForPatient(this.data.patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (collections) => {
          this.collections = collections;
          this.error = null;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = this.extractError(err);
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private get currentUserId(): string {
    const user = this.auth.currentUser();
    return (user as { userId?: string } | null)?.userId ?? '';
  }

  /**
   * `paymentMethod` legacy dalla prima riga 'method' (il backend usa
   * `tenderLines` come fonte di verità): un incasso interamente a voucher FE
   * resta marcato OTHER.
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

  private extractError(err: unknown): string {
    const e = err as { graphQLErrors?: Array<{ message?: string }>; message?: string };
    return e?.graphQLErrors?.[0]?.message || e?.message || 'Operazione non riuscita';
  }
}
