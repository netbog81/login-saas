import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { Trattamento, TrattamentiViewMode, TreatmentStatus, TreatmentBillingStatus } from '../../models/trattamento.model';
import { BILLING_STATUS_LABELS } from '../treatment-billing-section/treatment-billing-section.component';

export interface TrattamentoGroup {
  key: string;
  label: string;
  subLabel?: string;
  treatments: Trattamento[];
  children?: TrattamentoGroup[];  // livello 2 per by-operator
}

const STATUS_CHIP: Record<TreatmentStatus, { label: string; color: string }> = {
  [TreatmentStatus.WAITING]:          { label: 'In attesa',          color: '#9e9e9e' },
  [TreatmentStatus.IN_PROGRESS]:      { label: 'In corso',           color: '#2196f3' },
  [TreatmentStatus.OPERATOR_COMPLETED]: { label: 'Chiuso da operatore', color: '#ff9800' },
  [TreatmentStatus.CLOSED]:           { label: 'Chiuso da segreteria', color: '#4caf50' },
};

@Component({
  selector: 'app-trattamenti-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule,
    MatExpansionModule,
    MatBadgeModule,
  ],
  template: `
    @if (viewMode === 'flat') {
      <table mat-table [dataSource]="treatments" class="trattamenti-table">
        <!-- SELECT -->
        <ng-container matColumnDef="select">
          <th mat-header-cell *matHeaderCellDef>
            <mat-checkbox
              [checked]="allVisibleSelected"
              [indeterminate]="someVisibleSelected"
              (change)="selectAllToggle.emit($event.checked)"
              [disabled]="!canSelect">
            </mat-checkbox>
          </th>
          <td mat-cell *matCellDef="let t">
            <mat-checkbox
              [checked]="isSelected(t.id)"
              (change)="toggleSelection.emit(t.id)"
              (click)="$event.stopPropagation()"
              [disabled]="!canSelect">
            </mat-checkbox>
          </td>
        </ng-container>

        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Data</th>
          <td mat-cell *matCellDef="let t">
            {{ formatDate(t.appointment?.appointmentDate || (t.startedAt || '').slice(0, 10)) }}<br>
            <small>{{ t.appointment?.startTime || '—' }}</small>
          </td>
        </ng-container>

        <ng-container matColumnDef="patient">
          <th mat-header-cell *matHeaderCellDef>Paziente</th>
          <td mat-cell *matCellDef="let t">
            {{ t.patient ? (t.patient.nome + ' ' + t.patient.cognome) : '—' }}
          </td>
        </ng-container>

        <ng-container matColumnDef="operator">
          <th mat-header-cell *matHeaderCellDef>Operatore</th>
          <td mat-cell *matCellDef="let t">
            <span [style.borderLeft]="'3px solid ' + (t.operator?.color || '#ccc')" style="padding-left: 8px">
              {{ t.operator?.name || 'Operatore rimosso' }} {{ t.operator?.surname || '' }}
            </span>
          </td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Stato</th>
          <td mat-cell *matCellDef="let t">
            <span class="chip" [style.background]="statusChip(t.status).color">
              {{ statusChip(t.status).label }}
            </span>
            @if (billingStatusLabel(t.billingStatus); as billingLabel) {
              <span class="chip billing-chip"
                    [style.background]="billingStatusColor(t.billingStatus)"
                    [matTooltip]="'Stato fatturazione: ' + billingLabel">
                {{ billingLabel }}
              </span>
            }
            @if (t.readyForBilling && !t.billingStatus) {
              <!-- Solo record storici pre-integrazione accounting (senza billingStatus). -->
              <mat-icon class="flag-icon" matTooltip="Inviato a fatturazione (storico)" color="primary">check_circle</mat-icon>
            }
            @if (t.scontoFE) {
              <mat-icon class="flag-icon" matTooltip="Sconto FE attivo" style="color: #e91e63">discount</mat-icon>
            }
            @if (t.forcedClosure) {
              <mat-icon class="flag-icon" style="color: #b91c1c"
                        matTooltip="Chiusura forzata da segreteria/admin (operatore non ha completato)">
                lock_clock
              </mat-icon>
            }
          </td>
        </ng-container>

        <ng-container matColumnDef="price">
          <th mat-header-cell *matHeaderCellDef>Importo</th>
          <td mat-cell *matCellDef="let t">
            <!-- Fattura cumulativa (più trattamenti in un documento): mostra la
                 QUOTA di questo trattamento; totale documento e n° trattamenti
                 stanno nel tooltip dell'icona "layers". Fattura singola: totale
                 REALE confermato da accounting (con bollo) se emessa, altrimenti
                 il prezzo clinico. -->
            € {{ (isMultiInvoice(t)
                    ? (t.accountingTreatmentLinesAmount ?? t.price ?? 0)
                    : (t.accountingTotalAmount ?? t.price ?? 0)) | number:'1.2-2' }}
            @if (isMultiInvoice(t)) {
              <mat-icon class="flag-icon" style="color: #7b1fa2"
                        [matTooltip]="multiInvoiceTooltip(t)">layers</mat-icon>
            } @else if (t.accountingTotalAmount != null && t.accountingTotalAmount !== t.price) {
              <mat-icon class="flag-icon" matTooltip="Totale fattura (marca da bollo inclusa)" style="color: #1976d2">receipt_long</mat-icon>
            }
            @if (t.isPaid) {
              <mat-icon class="flag-icon" matTooltip="Pagato" style="color: #4caf50">paid</mat-icon>
            }
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let t">
            <button mat-icon-button
              (click)="openDetail.emit(t); $event.stopPropagation()"
              matTooltip="Dettagli / modifica">
              <mat-icon>open_in_new</mat-icon>
            </button>
            @if (canManage) {
              <button mat-icon-button color="primary"
                [disabled]="t.status !== TreatmentStatus.OPERATOR_COMPLETED"
                (click)="closeTreatment.emit(t); $event.stopPropagation()"
                [matTooltip]="t.status === TreatmentStatus.OPERATOR_COMPLETED
                  ? 'Chiudi trattamento dalla segreteria'
                  : 'Disponibile solo quando il trattamento è chiuso dall\\'operatore'">
                <mat-icon>done_all</mat-icon>
              </button>
            }
            @if (canSendRow(t)) {
              <button mat-icon-button
                color="accent"
                (click)="sendOne.emit(t); $event.stopPropagation()"
                matTooltip="Invia al sistema di fatturazione">
                <mat-icon>send</mat-icon>
              </button>
            }
            <button mat-icon-button
              [disabled]="!t.appointment"
              (click)="generateCertificate.emit(t); $event.stopPropagation()"
              [matTooltip]="t.appointment
                ? 'Genera attestato di presenza'
                : 'Attestato non disponibile: nessun appuntamento collegato'">
              <mat-icon>history_edu</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"
            (click)="openDetail.emit(row)"
            class="row-hover"></tr>
      </table>

      @if (treatments.length === 0) {
        <div class="empty-state">
          <mat-icon>inbox</mat-icon>
          <p>Nessun trattamento trovato</p>
        </div>
      }
    } @else {
      <!-- GROUPED VIEW (by-patient o by-operator) -->
      <mat-accordion multi>
        @for (group of groups; track group.key) {
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                {{ group.label }}
                <span class="group-count" [matBadge]="group.treatments.length" matBadgeOverlap="false"></span>
              </mat-panel-title>
              @if (group.subLabel) {
                <mat-panel-description>{{ group.subLabel }}</mat-panel-description>
              }
            </mat-expansion-panel-header>

            @if (group.children && group.children.length > 0) {
              <!-- 2 livelli: by-operator -> patient -->
              <mat-accordion multi>
                @for (child of group.children; track child.key) {
                  <mat-expansion-panel>
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        {{ child.label }}
                        <span class="group-count" [matBadge]="child.treatments.length" matBadgeOverlap="false"></span>
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <app-trattamenti-list
                      [treatments]="child.treatments"
                      [viewMode]="'flat'"
                      [canSelect]="canSelect"
                      [canManage]="canManage"
                      [selectedIds]="selectedIds"
                      (toggleSelection)="toggleSelection.emit($event)"
                      (selectAllToggle)="selectAllToggle.emit($event)"
                      (openDetail)="openDetail.emit($event)"
                      (closeTreatment)="closeTreatment.emit($event)"
                      (generateCertificate)="generateCertificate.emit($event)">
                    </app-trattamenti-list>
                  </mat-expansion-panel>
                }
              </mat-accordion>
            } @else {
              <app-trattamenti-list
                [treatments]="group.treatments"
                [viewMode]="'flat'"
                [canSelect]="canSelect"
                [canManage]="canManage"
                [selectedIds]="selectedIds"
                (toggleSelection)="toggleSelection.emit($event)"
                (selectAllToggle)="selectAllToggle.emit($event)"
                (openDetail)="openDetail.emit($event)"
                (sendOne)="sendOne.emit($event)"
                (closeTreatment)="closeTreatment.emit($event)"
                (generateCertificate)="generateCertificate.emit($event)">
              </app-trattamenti-list>
            }
          </mat-expansion-panel>
        }
      </mat-accordion>

      @if (groups.length === 0) {
        <div class="empty-state">
          <mat-icon>inbox</mat-icon>
          <p>Nessun trattamento trovato</p>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .trattamenti-table { width: 100%; }
    .row-hover { cursor: pointer; }
    .row-hover:hover { background: rgba(0,0,0,0.04); }
    .chip {
      display: inline-block;
      padding: 2px 10px;
      color: white;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .billing-chip {
      margin-left: 6px;
    }
    .flag-icon {
      font-size: 18px;
      vertical-align: middle;
      margin-left: 4px;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      color: rgba(0,0,0,0.54);
    }
    .empty-state mat-icon {
      font-size: 48px;
      width: 48px; height: 48px;
    }
    .group-count {
      margin-left: 24px;
    }
    th.mat-header-cell, td.mat-cell { padding: 8px 12px; }
  `],
})
export class TrattamentiListComponent {
  @Input() treatments: Trattamento[] = [];
  @Input() groups: TrattamentoGroup[] = [];
  @Input() viewMode: TrattamentiViewMode = 'flat';
  @Input() canSelect = false;
  /** Se true, mostra le azioni di segreteria in riga (es. chiudi trattamento). */
  @Input() canManage = false;
  @Input() selectedIds: Set<string> = new Set();

  @Output() toggleSelection = new EventEmitter<string>();
  @Output() selectAllToggle = new EventEmitter<boolean>();
  @Output() openDetail = new EventEmitter<Trattamento>();
  @Output() sendOne = new EventEmitter<Trattamento>();
  /** Chiusura rapida dalla segreteria (solo trattamenti OPERATOR_COMPLETED). */
  @Output() closeTreatment = new EventEmitter<Trattamento>();
  /** Genera l'attestato di presenza dal template predefinito. */
  @Output() generateCertificate = new EventEmitter<Trattamento>();

  /** Esposto al template per confrontare lo stato del trattamento. */
  readonly TreatmentStatus = TreatmentStatus;

  columns = ['select', 'date', 'patient', 'operator', 'status', 'price', 'actions'];

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  get allVisibleSelected(): boolean {
    return this.treatments.length > 0
      && this.treatments.every(t => this.selectedIds.has(t.id));
  }

  get someVisibleSelected(): boolean {
    const c = this.treatments.filter(t => this.selectedIds.has(t.id)).length;
    return c > 0 && c < this.treatments.length;
  }

  statusChip(status: TreatmentStatus) {
    return STATUS_CHIP[status] ?? { label: status, color: '#9e9e9e' };
  }

  /**
   * Bottone "Invia al sistema di fatturazione" (riga lista) disponibile
   * SOLO se status CLOSED/OPERATOR_COMPLETED (il backend auto-chiude i
   * completati all'invio) + scontoFE=false + billingStatus IN
   * (NOT_READY, READY_FOR_BILLING) o null. Esclude treatment già SENT/
   * PENDING/INVOICED/CANCELLED (idempotenza UI: una volta inviato, niente
   * re-invio).
   */
  canSendRow(t: Trattamento): boolean {
    if (t.status !== TreatmentStatus.CLOSED
        && t.status !== TreatmentStatus.OPERATOR_COMPLETED) return false;
    if (t.scontoFE === true) return false;
    const status = t.billingStatus;
    return status == null
      || status === TreatmentBillingStatus.NotReady
      || status === TreatmentBillingStatus.ReadyForBilling;
  }

  /** Label umana per il chip billingStatus nella tabella. */
  billingStatusLabel(status: TreatmentBillingStatus | null | undefined): string | null {
    if (!status || status === TreatmentBillingStatus.NotReady) return null;
    return BILLING_STATUS_LABELS[status] ?? status;
  }

  /** Colore semantico per il chip billingStatus. */
  billingStatusColor(status: TreatmentBillingStatus | null | undefined): string {
    if (!status) return '#9e9e9e';
    switch (status) {
      case TreatmentBillingStatus.ReadyForBilling: return '#fbc02d';   // giallo
      case TreatmentBillingStatus.Sent:            return '#1976d2';   // blu
      case TreatmentBillingStatus.Pending:         return '#5e35b1';   // indaco
      case TreatmentBillingStatus.Invoiced:        return '#43a047';   // verde
      case TreatmentBillingStatus.Reissued:        return '#00acc1';   // ciano
      case TreatmentBillingStatus.Refunded:        return '#e53935';   // rosso
      case TreatmentBillingStatus.PartiallyRefunded: return '#ef6c00'; // arancio
      case TreatmentBillingStatus.Cancelled:       return '#757575';   // grigio
      default:                                     return '#9e9e9e';
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    // iso è 'YYYY-MM-DD'
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  /** Il documento corrente copre più trattamenti (fattura cumulativa). */
  isMultiInvoice(t: Trattamento): boolean {
    return (t.accountingDocumentTreatmentCount ?? 1) > 1
      && t.accountingTotalAmount != null;
  }

  /** Tooltip dell'icona fattura cumulativa: riferimento, totale e quota. */
  multiInvoiceTooltip(t: Trattamento): string {
    const fmt = (n: number) => n.toLocaleString('it-IT', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    const parts = [
      `Fattura cumulativa${t.patientInvoiceNumber ? ' ' + t.patientInvoiceNumber : ''}: ` +
        `${t.accountingDocumentTreatmentCount} trattamenti`,
      `Totale documento € ${fmt(Number(t.accountingTotalAmount ?? 0))} (bollo incluso)`,
      `Quota di questo trattamento € ${fmt(Number(t.accountingTreatmentLinesAmount ?? t.price ?? 0))}`,
    ];
    return parts.join(' · ');
  }
}
