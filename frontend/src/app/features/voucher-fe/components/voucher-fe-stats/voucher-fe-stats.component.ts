/**
 * Statistiche Voucher FE.
 * Totali generali in alto (numero, emesso, consumato, residuo) + elenco dei
 * voucher con importo totale/usato/residuo per ciascuno. Filtri per periodo
 * (pulsanti rapidi o date custom) e per stato residuo/consumato.
 */
import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { VoucherFeService } from '../../services/voucher-fe.service';
import {
  VoucherFe, voucherFeUsedAmount, voucherFeStatusLabel, voucherFeStatusColor,
  voucherFePatientName,
} from '../../models/voucher-fe.model';

type ResidualFilter = 'all' | 'residual' | 'consumed';

@Component({
  selector: 'app-voucher-fe-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1><mat-icon>card_giftcard</mat-icon> Statistiche Voucher FE</h1>
      </header>

      <!-- KPI totali generali -->
      <div class="kpi-grid">
        <div class="kpi">
          <span class="kpi-label">Voucher emessi</span>
          <span class="kpi-value">{{ filtered.length }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Totale emesso</span>
          <span class="kpi-value">{{ totalIssued | number:'1.2-2' }} €</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Totale consumato</span>
          <span class="kpi-value used">{{ totalUsed | number:'1.2-2' }} €</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Totale residuo</span>
          <span class="kpi-value residual">{{ totalResidual | number:'1.2-2' }} €</span>
        </div>
      </div>

      <div class="status-breakdown">
        <span>Attivi: <b>{{ countByStatus('active') }}</b></span>
        <span>Sospesi: <b>{{ countByStatus('inactive') }}</b></span>
        <span>Esauriti: <b>{{ countByStatus('depleted') }}</b></span>
        <span>Annullati: <b>{{ countByStatus('cancelled') }}</b></span>
      </div>

      <!-- Filtri -->
      <div class="filters">
        <div class="quick-periods">
          <button mat-stroked-button (click)="setYearToDate()">Da inizio anno</button>
          <button mat-stroked-button (click)="setLastMonths(6)">Ultimi 6 mesi</button>
          <button mat-stroked-button (click)="setLastMonths(3)">Ultimi 3 mesi</button>
          <button mat-stroked-button (click)="setLastMonths(2)">Ultimi 2 mesi</button>
          <button mat-stroked-button (click)="setLastMonths(1)">Ultimo mese</button>
          <button mat-stroked-button (click)="clearPeriod()">Tutto</button>
        </div>
        <div class="date-range">
          <label>Dal <input type="date" [(ngModel)]="from" (change)="reload()"></label>
          <label>Al <input type="date" [(ngModel)]="to" (change)="reload()"></label>
        </div>
        <div class="residual-filter">
          <button mat-button [class.active]="residualFilter === 'all'" (click)="setResidualFilter('all')">Tutti</button>
          <button mat-button [class.active]="residualFilter === 'residual'" (click)="setResidualFilter('residual')">Solo con residuo</button>
          <button mat-button [class.active]="residualFilter === 'consumed'" (click)="setResidualFilter('consumed')">Consumati</button>
        </div>
      </div>

      @if (error) {
        <div class="error-banner">{{ error }}</div>
      }

      <!-- Elenco -->
      @if (loading) {
        <div class="state-msg">Caricamento…</div>
      } @else if (filtered.length === 0) {
        <div class="state-msg">Nessun voucher FE nel periodo/filtro selezionato.</div>
      } @else {
        <div class="table-scroll">
          <table class="voucher-table">
            <thead>
              <tr>
                <th>Codice</th>
                <th>Paziente</th>
                <th>Data</th>
                <th>Stato</th>
                <th class="num">Totale</th>
                <th class="num">Usato</th>
                <th class="num">Residuo</th>
              </tr>
            </thead>
            <tbody>
              @for (v of filtered; track v.id) {
                <tr [class.dimmed]="v.status === 'cancelled'">
                  <td class="code">{{ v.code }}</td>
                  <td>{{ patientName(v) }}</td>
                  <td>{{ formatDate(v.createdAt) }}</td>
                  <td>
                    <span class="status" [style.background-color]="statusColor(v.status)">
                      {{ statusLabel(v.status) }}
                    </span>
                  </td>
                  <td class="num">{{ v.initialAmount | number:'1.2-2' }} €</td>
                  <td class="num used">{{ used(v) | number:'1.2-2' }} €</td>
                  <td class="num residual">{{ v.residualAmount | number:'1.2-2' }} €</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">Totali ({{ filtered.length }})</td>
                <td class="num"><b>{{ totalIssued | number:'1.2-2' }} €</b></td>
                <td class="num used"><b>{{ totalUsed | number:'1.2-2' }} €</b></td>
                <td class="num residual"><b>{{ totalResidual | number:'1.2-2' }} €</b></td>
              </tr>
            </tfoot>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 20px 24px; max-width: 1100px; margin: 0 auto; }
    .page-header h1 { display: flex; align-items: center; gap: 8px; font-size: 1.4rem; color: #1e293b; margin: 0 0 18px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 12px; }
    .kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
    .kpi-label { font-size: 0.74rem; color: #64748b; text-transform: uppercase; letter-spacing: .3px; }
    .kpi-value { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
    .kpi-value.used { color: #b45309; }
    .kpi-value.residual { color: #15803d; }
    .status-breakdown { display: flex; gap: 18px; flex-wrap: wrap; font-size: 0.82rem; color: #475569; margin: 0 2px 18px; }
    .filters { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .quick-periods, .date-range, .residual-filter { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .date-range label { font-size: 0.82rem; color: #475569; display: flex; align-items: center; gap: 6px; }
    .date-range input { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; }
    .residual-filter button.active { background: #6366f1; color: #fff; }
    .error-banner { padding: 8px 12px; background: #fee2e2; color: #dc2626; border-radius: 4px; margin-bottom: 12px; }
    .state-msg { padding: 32px 8px; text-align: center; color: #94a3b8; }
    .table-scroll { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; }
    .voucher-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
    .voucher-table th, .voucher-table td { padding: 9px 12px; text-align: left; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
    .voucher-table thead th { background: #f8fafc; color: #475569; font-weight: 600; font-size: 0.76rem; text-transform: uppercase; }
    .voucher-table td.num, .voucher-table th.num { text-align: right; }
    .voucher-table td.used { color: #b45309; }
    .voucher-table td.residual { color: #15803d; }
    .voucher-table td.code { font-weight: 600; color: #1e293b; }
    .voucher-table tr.dimmed { opacity: 0.55; }
    .voucher-table tfoot td { background: #f8fafc; font-weight: 600; border-top: 2px solid #e2e8f0; }
    .status { font-size: 0.62rem; font-weight: 600; color: #fff; padding: 2px 8px; border-radius: 8px; }
  `],
})
export class VoucherFeStatsComponent implements OnInit {
  private readonly voucherService = inject(VoucherFeService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  vouchers: VoucherFe[] = [];
  loading = false;
  error: string | null = null;

  from = '';
  to = '';
  residualFilter: ResidualFilter = 'all';

  ngOnInit(): void {
    this.setYearToDate();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.voucherService.allVouchers(this.from || undefined, this.to || undefined)
      .subscribe({
        next: (data) => this.ngZone.run(() => {
          this.vouchers = data || [];
          this.loading = false;
          this.cdr.markForCheck();
        }),
        error: () => this.ngZone.run(() => {
          this.loading = false;
          this.error = 'Errore nel caricamento delle statistiche';
          this.cdr.markForCheck();
        }),
      });
  }

  // ==================== Filtri periodo ====================

  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  setYearToDate(): void {
    const now = new Date();
    this.from = `${now.getFullYear()}-01-01`;
    this.to = this.toIso(now);
    this.reload();
  }

  setLastMonths(months: number): void {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - months);
    this.from = this.toIso(start);
    this.to = this.toIso(now);
    this.reload();
  }

  clearPeriod(): void {
    this.from = '';
    this.to = '';
    this.reload();
  }

  setResidualFilter(f: ResidualFilter): void {
    this.residualFilter = f;
    this.cdr.markForCheck();
  }

  // ==================== Derivati (filtro residuo client-side) ====================

  get filtered(): VoucherFe[] {
    switch (this.residualFilter) {
      case 'residual':
        return this.vouchers.filter((v) => Number(v.residualAmount) > 0.005 && v.status !== 'cancelled');
      case 'consumed':
        return this.vouchers.filter((v) => voucherFeUsedAmount(v) > 0.005);
      default:
        return this.vouchers;
    }
  }

  get totalIssued(): number {
    return this.filtered.reduce((s, v) => s + Number(v.initialAmount), 0);
  }

  get totalUsed(): number {
    return this.filtered.reduce((s, v) => s + voucherFeUsedAmount(v), 0);
  }

  get totalResidual(): number {
    return this.filtered.reduce((s, v) => s + Number(v.residualAmount), 0);
  }

  countByStatus(status: string): number {
    return this.filtered.filter((v) => v.status === status).length;
  }

  used(v: VoucherFe): number { return voucherFeUsedAmount(v); }
  patientName(v: VoucherFe): string { return voucherFePatientName(v); }
  statusLabel(s: string): string { return voucherFeStatusLabel(s); }
  statusColor(s: string): string { return voucherFeStatusColor(s); }

  formatDate(d: string | Date | null | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
