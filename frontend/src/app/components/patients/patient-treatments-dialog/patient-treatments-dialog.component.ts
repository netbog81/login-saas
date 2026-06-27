/**
 * Patient Treatments Dialog
 * Mostra l'elenco di TUTTI i trattamenti eseguiti di un paziente (qualsiasi
 * operatore/tipo), con stato, data, servizio e operatore. Sola lettura.
 */
import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
  NgZone, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';

import { TreatmentService } from '../../../services/treatment.service';
import { Patient } from '../../../models/patient.model';
import {
  Treatment, getTreatmentStatusLabel, getTreatmentStatusColor,
} from '../../../models/treatment.model';

export interface PatientTreatmentsDialogData {
  patient: Patient;
}

@Component({
  selector: 'app-patient-treatments-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, DragDropModule],
  template: `
    <div class="dialog-wrapper" cdkDrag cdkDragRootElement=".cdk-overlay-pane">
      <div class="dialog-header" cdkDragHandle>
        <div class="header-title">
          <mat-icon>healing</mat-icon>
          <span>Trattamenti - {{ patient.nome }} {{ patient.cognome }}</span>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" matTooltip="Chiudi">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        @if (error) {
          <div class="error-banner">{{ error }}</div>
        }
        @if (loading) {
          <div class="state-msg">Caricamento trattamenti…</div>
        } @else if (treatments.length === 0) {
          <div class="state-msg">Nessun trattamento per questo paziente.</div>
        } @else {
          <div class="count-line">{{ treatments.length }} trattamenti</div>
          <div class="treatment-list">
            @for (t of treatments; track t.id) {
              <div class="treatment-row">
                <div class="row-main">
                  <span class="row-date">{{ formatDate(t.startedAt) }}</span>
                  <span class="row-status" [style.background-color]="statusColor(t.status)">
                    {{ statusLabel(t.status) }}
                  </span>
                </div>
                <div class="row-sub">
                  <span class="row-service">{{ t.service?.name || 'Servizio non specificato' }}</span>
                  <span class="row-operator">{{ operatorName(t) }}</span>
                </div>
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
      resize: both; overflow: auto; min-width: 420px; min-height: 320px;
    }
    .dialog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; background: #2c3e50; color: white; cursor: move;
      border-radius: 4px 4px 0 0; flex-shrink: 0;
    }
    .header-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 500; }
    .dialog-header button { color: white; }
    .dialog-content { flex: 1; overflow-y: auto; background: white; padding: 8px 12px 12px; }
    .error-banner { padding: 8px 12px; background: #fee2e2; color: #dc2626; border-radius: 4px; margin-bottom: 8px; }
    .state-msg { padding: 24px 8px; text-align: center; color: #94a3b8; font-size: 0.9rem; }
    .count-line { font-size: 0.72rem; color: #64748b; margin: 4px 2px 8px; }
    .treatment-list { display: flex; flex-direction: column; gap: 6px; }
    .treatment-row {
      padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px;
      border-left: 3px solid #6366f1; background: #f8fafc;
    }
    .row-main { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .row-date { font-weight: 600; font-size: 0.82rem; color: #1e293b; }
    .row-status {
      font-size: 0.62rem; font-weight: 600; color: #fff; padding: 1px 8px;
      border-radius: 8px; white-space: nowrap;
    }
    .row-sub { display: flex; justify-content: space-between; align-items: center; margin-top: 3px; gap: 8px; }
    .row-service { font-size: 0.78rem; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-operator { font-size: 0.7rem; color: #64748b; white-space: nowrap; }
  `],
})
export class PatientTreatmentsDialogComponent implements OnInit, OnDestroy {
  readonly dialogRef = inject(MatDialogRef<PatientTreatmentsDialogComponent>);
  private readonly data: PatientTreatmentsDialogData = inject(MAT_DIALOG_DATA);
  private readonly treatmentService = inject(TreatmentService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  patient: Patient = this.data.patient;
  treatments: Treatment[] = [];
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.loading = true;
    this.treatmentService.getTreatmentsByPatient(this.patient.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.ngZone.run(() => {
          this.treatments = data || [];
          this.loading = false;
          this.cdr.markForCheck();
        }),
        error: () => this.ngZone.run(() => {
          this.loading = false;
          this.error = 'Errore nel caricamento dei trattamenti';
          this.cdr.markForCheck();
        }),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  statusLabel(s: any): string { return getTreatmentStatusLabel(s); }
  statusColor(s: any): string { return getTreatmentStatusColor(s); }

  operatorName(t: Treatment): string {
    const op: any = t.operator;
    if (!op) return '';
    return `${op.name ?? ''}${op.surname ? ' ' + op.surname : ''}`.trim();
  }

  formatDate(d: Date | string): string {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
