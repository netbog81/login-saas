/**
 * Patient Vouchers FE Dialog
 * Elenco dei voucher FE di un paziente con azioni: emetti nuovo, modifica
 * importo, sospendi/riattiva, annulla. Ogni voucher mostra importo totale,
 * residuo, usato, stato e data.
 */
import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
  NgZone, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, finalize } from 'rxjs';

import { Patient } from '../../../../models/patient.model';
import { VoucherFeService } from '../../services/voucher-fe.service';
import {
  VoucherFe, voucherFeUsedAmount, isVoucherFeUntouched,
  voucherFeStatusLabel, voucherFeStatusColor,
} from '../../models/voucher-fe.model';
import {
  VoucherFeIssueDialogComponent,
  VoucherFeIssueDialogResult,
} from '../../../trattamenti/components/voucher-fe-issue-dialog/voucher-fe-issue-dialog.component';

export interface PatientVouchersDialogData {
  patient: Patient;
}

@Component({
  selector: 'app-patient-vouchers-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatIconModule, MatTooltipModule, DragDropModule,
  ],
  template: `
    <div class="dialog-wrapper" cdkDrag cdkDragRootElement=".cdk-overlay-pane">
      <div class="dialog-header" cdkDragHandle>
        <div class="header-title">
          <mat-icon>card_giftcard</mat-icon>
          <span>Voucher FE - {{ patient.nome }} {{ patient.cognome }}</span>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" matTooltip="Chiudi">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        @if (error) {
          <div class="error-banner">{{ error }}</div>
        }

        <div class="toolbar">
          <div class="totals" *ngIf="!loading">
            <span><b>{{ vouchers.length }}</b> voucher</span>
            <span>Residuo tot.: <b>{{ totalResidual | number:'1.2-2' }} €</b></span>
          </div>
          <button mat-flat-button color="primary" (click)="openIssue()" [disabled]="busy">
            <mat-icon>add</mat-icon> Emetti voucher FE
          </button>
        </div>

        @if (loading) {
          <div class="state-msg">Caricamento voucher…</div>
        } @else if (vouchers.length === 0) {
          <div class="state-msg">Nessun voucher FE per questo paziente.</div>
        } @else {
          <div class="voucher-list">
            @for (v of vouchers; track v.id) {
              <div class="voucher-row" [class.dimmed]="v.status === 'cancelled'">
                <div class="row-top">
                  <span class="code">{{ v.code }}</span>
                  <span class="status" [style.background-color]="statusColor(v.status)">
                    {{ statusLabel(v.status) }}
                  </span>
                  <span class="date">{{ formatDate(v.createdAt) }}</span>
                </div>

                <div class="row-amounts">
                  <span class="amt">Totale: <b>{{ v.initialAmount | number:'1.2-2' }} €</b></span>
                  <span class="amt used">Usato: {{ used(v) | number:'1.2-2' }} €</span>
                  <span class="amt residual">Residuo: <b>{{ v.residualAmount | number:'1.2-2' }} €</b></span>
                  @if (v.expiryDate) {
                    <span class="amt expiry">Scad.: {{ formatDate(v.expiryDate) }}</span>
                  }
                </div>

                @if (editingId === v.id) {
                  <div class="edit-row">
                    <label>{{ untouched(v) ? 'Nuovo importo iniziale (€)' : 'Nuovo residuo (€)' }}</label>
                    <input type="number" min="0" step="0.01" [(ngModel)]="editAmount" name="editAmount">
                    <button mat-flat-button color="primary" (click)="saveAmount(v)"
                            [disabled]="busy || !(editAmount >= 0)">Salva</button>
                    <button mat-button (click)="cancelEdit()" [disabled]="busy">Annulla</button>
                  </div>
                } @else {
                  <div class="row-actions">
                    @if (v.status !== 'cancelled') {
                      <button mat-stroked-button (click)="startEdit(v)" [disabled]="busy">
                        <mat-icon>edit</mat-icon> Modifica importo
                      </button>
                      @if (v.status === 'inactive') {
                        <button mat-stroked-button color="primary" (click)="reactivate(v)" [disabled]="busy">
                          <mat-icon>play_arrow</mat-icon> Riattiva
                        </button>
                      } @else {
                        <button mat-stroked-button (click)="suspend(v)" [disabled]="busy">
                          <mat-icon>pause</mat-icon> Sospendi
                        </button>
                      }
                      <button mat-stroked-button color="warn" (click)="cancel(v)" [disabled]="busy">
                        <mat-icon>block</mat-icon> Annulla
                      </button>
                    } @else {
                      <span class="cancelled-note">Voucher annullato</span>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      display: flex; flex-direction: column; height: 100%; max-height: 100%;
      resize: both; overflow: auto; min-width: 480px; min-height: 360px;
    }
    .dialog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; background: #2c3e50; color: white; cursor: move;
      border-radius: 4px 4px 0 0; flex-shrink: 0;
    }
    .header-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 500; }
    .dialog-header button { color: white; }
    .dialog-content { flex: 1; overflow-y: auto; background: white; padding: 10px 14px 14px; }
    .error-banner { padding: 8px 12px; background: #fee2e2; color: #dc2626; border-radius: 4px; margin-bottom: 8px; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin: 4px 2px 12px; gap: 12px; flex-wrap: wrap; }
    .totals { display: flex; gap: 16px; font-size: 0.82rem; color: #475569; }
    .state-msg { padding: 24px 8px; text-align: center; color: #94a3b8; font-size: 0.9rem; }
    .voucher-list { display: flex; flex-direction: column; gap: 8px; }
    .voucher-row {
      padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
      border-left: 3px solid #6366f1; background: #f8fafc;
    }
    .voucher-row.dimmed { opacity: 0.6; }
    .row-top { display: flex; align-items: center; gap: 10px; }
    .code { font-weight: 700; font-size: 0.85rem; color: #1e293b; }
    .status { font-size: 0.62rem; font-weight: 600; color: #fff; padding: 1px 8px; border-radius: 8px; white-space: nowrap; }
    .date { margin-left: auto; font-size: 0.72rem; color: #64748b; }
    .row-amounts { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 6px; font-size: 0.8rem; color: #334155; }
    .amt.used { color: #b45309; }
    .amt.residual { color: #15803d; }
    .amt.expiry { color: #7c3aed; }
    .row-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .row-actions button { line-height: 30px; }
    .row-actions .mat-icon, .edit-row .mat-icon { font-size: 18px; height: 18px; width: 18px; vertical-align: middle; }
    .edit-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .edit-row label { font-size: 0.78rem; color: #475569; }
    .edit-row input { width: 120px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; }
    .cancelled-note { font-size: 0.75rem; color: #94a3b8; font-style: italic; }
  `],
})
export class PatientVouchersDialogComponent implements OnInit, OnDestroy {
  readonly dialogRef = inject(MatDialogRef<PatientVouchersDialogComponent>);
  private readonly data: PatientVouchersDialogData = inject(MAT_DIALOG_DATA);
  private readonly voucherService = inject(VoucherFeService);
  private readonly dialog = inject(MatDialog);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  patient: Patient = this.data.patient;
  vouchers: VoucherFe[] = [];
  loading = false;
  busy = false;
  error: string | null = null;

  editingId: string | null = null;
  editAmount = 0;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get totalResidual(): number {
    return this.vouchers
      .filter((v) => v.status !== 'cancelled')
      .reduce((s, v) => s + Number(v.residualAmount), 0);
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.voucherService.vouchersByPatient(this.patient.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.ngZone.run(() => {
          this.vouchers = data || [];
          this.loading = false;
          this.cdr.markForCheck();
        }),
        error: () => this.ngZone.run(() => {
          this.loading = false;
          this.error = 'Errore nel caricamento dei voucher';
          this.cdr.markForCheck();
        }),
      });
  }

  openIssue(): void {
    const ref = this.dialog.open(VoucherFeIssueDialogComponent, {
      data: {
        patientId: this.patient.id,
        patientLabel: `${this.patient.nome ?? ''} ${this.patient.cognome ?? ''}`.trim(),
      },
      width: '380px',
      autoFocus: false,
    });
    ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((res?: VoucherFeIssueDialogResult) => {
      if (!res) return;
      this.runAction(this.voucherService.issue(
        this.patient.id, res.initialAmount, res.expiryDate, res.notes,
      ));
    });
  }

  startEdit(v: VoucherFe): void {
    this.editingId = v.id;
    // Voucher intatto → si modifica l'iniziale; consumato → il residuo.
    this.editAmount = this.untouched(v) ? Number(v.initialAmount) : Number(v.residualAmount);
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingId = null;
    this.cdr.markForCheck();
  }

  saveAmount(v: VoucherFe): void {
    if (!(this.editAmount >= 0)) return;
    this.runAction(this.voucherService.updateAmount(v.id, this.editAmount), () => {
      this.editingId = null;
    });
  }

  suspend(v: VoucherFe): void {
    this.runAction(this.voucherService.suspend(v.id));
  }

  reactivate(v: VoucherFe): void {
    this.runAction(this.voucherService.reactivate(v.id));
  }

  cancel(v: VoucherFe): void {
    const ok = window.confirm(
      `Annullare definitivamente il voucher ${v.code}? L'operazione non è reversibile.`,
    );
    if (!ok) return;
    this.runAction(this.voucherService.cancel(v.id));
  }

  private runAction(obs: ReturnType<VoucherFeService['issue']>, onSuccess?: () => void): void {
    this.busy = true;
    this.error = null;
    this.cdr.markForCheck();
    obs.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.ngZone.run(() => { this.busy = false; this.cdr.markForCheck(); })),
    ).subscribe({
      next: () => this.ngZone.run(() => {
        if (onSuccess) onSuccess();
        this.load();
      }),
      error: (err) => this.ngZone.run(() => {
        this.error = this.extractError(err);
        this.cdr.markForCheck();
      }),
    });
  }

  private extractError(err: any): string {
    return err?.graphQLErrors?.[0]?.message
      || err?.message
      || 'Operazione non riuscita';
  }

  used(v: VoucherFe): number { return voucherFeUsedAmount(v); }
  untouched(v: VoucherFe): boolean { return isVoucherFeUntouched(v); }
  statusLabel(s: string): string { return voucherFeStatusLabel(s); }
  statusColor(s: string): string { return voucherFeStatusColor(s); }

  formatDate(d: string | Date | null | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
