import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';

import { AbsenceManagementService } from '../services/absence-management.service';
import { AbsenceImpactPreview } from '../models/absence.model';
import { OperatorAbsenceTypeService } from '../../operator-absence-types/services/operator-absence-type.service';
import { OperatorAbsenceType } from '../../operator-absence-types/models/operator-absence-type.model';
import { OperatorService } from '../../../../services/operator.service';
import { Operator, OperatorMacroCategory } from '../../../../graphql/generated/types';

/**
 * Dialog "Nuova assenza" per operatori e medici (NON istruttori palestra:
 * la palestra ha il suo flusso con sostituti in Configurazioni palestra).
 *
 * Granularità: giorno singolo o range dal…al; giornata intera o fascia
 * oraria. Prima del salvataggio mostra l'ANTEPRIMA degli appuntamenti che
 * finirebbero in conflitto (+ eventuali ATTENDED senza trattamento, solo
 * avviso). Al salvataggio il backend marca i conflitti, visibili poi nella
 * pagina Conflitti per lo spostamento.
 */
@Component({
  selector: 'app-absence-dialog-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    DragDropModule,
  ],
  template: `
    <div class="dialog-wrapper" cdkDrag cdkDragRootElement=".cdk-overlay-pane">
      <div class="dialog-header" cdkDragHandle>
        <div class="header-title">
          <mat-icon>event_busy</mat-icon>
          <span>Nuova assenza operatore/medico</span>
        </div>
        <button mat-icon-button (click)="onCancel()" aria-label="Chiudi">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <!-- Operatori -->
        <div class="operators-block">
          <div class="operators-header">
            <h3>Operatori</h3>
            <mat-checkbox
              [checked]="allSelected()"
              (change)="toggleAll($event.checked)"
            >
              Tutti (es. studio chiuso)
            </mat-checkbox>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Seleziona uno o più operatori</mat-label>
            <mat-select multiple [(ngModel)]="selectedOperatorIds" (selectionChange)="onFormChanged()">
              <mat-option *ngFor="let op of operators" [value]="op.id">
                {{ op.name }} {{ op.surname }}
                <span class="cat-hint">({{ categoryLabel(op.macroCategory) }})</span>
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Tipo di assenza + motivo -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Tipo di assenza</mat-label>
            <mat-select [(ngModel)]="absenceTypeId">
              <mat-option [value]="null">— Nessuno —</mat-option>
              <mat-option *ngFor="let t of absenceTypes" [value]="t.id">
                {{ t.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Motivo (opzionale)</mat-label>
            <input matInput [(ngModel)]="reason" />
          </mat-form-field>
        </div>

        <!-- Periodo -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Dal giorno</mat-label>
            <input
              matInput
              [matDatepicker]="pickerFrom"
              [(ngModel)]="dateFrom"
              (ngModelChange)="onDateFromChanged()"
            />
            <mat-datepicker-toggle matSuffix [for]="pickerFrom"></mat-datepicker-toggle>
            <mat-datepicker #pickerFrom></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Al giorno</mat-label>
            <input
              matInput
              [matDatepicker]="pickerTo"
              [(ngModel)]="dateTo"
              (ngModelChange)="onFormChanged()"
            />
            <mat-datepicker-toggle matSuffix [for]="pickerTo"></mat-datepicker-toggle>
            <mat-datepicker #pickerTo></mat-datepicker>
          </mat-form-field>
        </div>

        <!-- Giornata intera vs fascia -->
        <div class="mode-toggle">
          <mat-slide-toggle [(ngModel)]="wholeDay" (change)="onFormChanged()">
            Giornata intera
          </mat-slide-toggle>
          <p class="mode-hint">
            Disattiva per indicare una fascia oraria (es. assente dalle 15:00).
          </p>
        </div>
        <div class="form-row" *ngIf="!wholeDay">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Dalle</mat-label>
            <input matInput type="time" [(ngModel)]="startTime" (ngModelChange)="onFormChanged()" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Alle</mat-label>
            <input matInput type="time" [(ngModel)]="endTime" (ngModelChange)="onFormChanged()" />
          </mat-form-field>
        </div>

        <!-- Anteprima impatti -->
        <div class="preview-block">
          <div class="preview-header">
            <h3>Appuntamenti impattati</h3>
            <button
              mat-stroked-button
              color="primary"
              [disabled]="!canPreview() || previewLoading"
              (click)="loadPreview()"
            >
              <mat-icon>visibility</mat-icon>
              Anteprima
            </button>
          </div>

          <div *ngIf="previewLoading" class="loading-inline">
            <mat-spinner diameter="20"></mat-spinner>
            Verifica appuntamenti...
          </div>

          <ng-container *ngIf="preview && !previewLoading">
            <p *ngIf="preview.conflicts.length === 0" class="ok-hint">
              <mat-icon>check_circle</mat-icon>
              Nessun appuntamento in conflitto nel periodo indicato.
            </p>

            <div *ngIf="preview.conflicts.length > 0" class="impact-list warn-box">
              <p class="impact-title">
                <mat-icon>warning</mat-icon>
                {{ preview.conflicts.length }} appuntament{{ preview.conflicts.length === 1 ? 'o' : 'i' }}
                finiranno in <strong>conflitto</strong> (gestibili dalla pagina Conflitti):
              </p>
              <div class="impact-row" *ngFor="let apt of preview.conflicts">
                <span class="impact-date">{{ formatDate(apt.appointmentDate) }}</span>
                <span class="impact-time">{{ shortTime(apt.startTime) }}–{{ shortTime(apt.endTime) }}</span>
                <span class="impact-name">{{ apt.clientName }}</span>
                <span class="impact-op" *ngIf="apt.operator">
                  ({{ apt.operator.name }} {{ apt.operator.surname }})
                </span>
              </div>
            </div>

            <div *ngIf="preview.attendedWithoutTreatment.length > 0" class="impact-list info-box">
              <p class="impact-title">
                <mat-icon>info</mat-icon>
                Attenzione: {{ preview.attendedWithoutTreatment.length }} appuntament{{
                  preview.attendedWithoutTreatment.length === 1 ? 'o' : 'i'
                }} risultano già PRESENTATO senza trattamento aperto (probabile
                auto-presenza appena scattata) — da verificare manualmente:
              </p>
              <div class="impact-row" *ngFor="let apt of preview.attendedWithoutTreatment">
                <span class="impact-date">{{ formatDate(apt.appointmentDate) }}</span>
                <span class="impact-time">{{ shortTime(apt.startTime) }}–{{ shortTime(apt.endTime) }}</span>
                <span class="impact-name">{{ apt.clientName }}</span>
              </div>
            </div>
          </ng-container>
        </div>

        <div *ngIf="errorMessage" class="error-box">
          <mat-icon>error</mat-icon>
          {{ errorMessage }}
        </div>
      </div>

      <div class="dialog-footer">
        <button mat-button (click)="onCancel()">Annulla</button>
        <button
          mat-flat-button
          color="primary"
          [disabled]="saving || !canSubmit()"
          (click)="onSave()"
        >
          <mat-spinner *ngIf="saving" diameter="18"></mat-spinner>
          Crea assenza
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .dialog-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 100%;
      }
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #2c3e50;
        color: white;
        cursor: move;
        border-radius: 4px 4px 0 0;
        flex-shrink: 0;
      }
      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 500;
      }
      .dialog-header button {
        color: white;
      }
      .dialog-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }
      .dialog-footer {
        flex-shrink: 0;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        background: #fafafa;
      }
      .form-row {
        display: flex;
        gap: 16px;
      }
      .flex-1 {
        flex: 1;
      }
      .full-width {
        width: 100%;
      }
      .operators-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }
      .operators-header h3 {
        margin: 0;
      }
      .cat-hint {
        color: rgba(0, 0, 0, 0.45);
        font-size: 12px;
        margin-left: 4px;
      }
      .mode-toggle {
        margin: 4px 0 16px;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 4px;
      }
      .mode-hint {
        margin: 4px 0 0;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.54);
      }
      .preview-block {
        margin-top: 8px;
      }
      .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .preview-header h3 {
        margin: 0;
      }
      .loading-inline {
        display: flex;
        align-items: center;
        gap: 8px;
        color: rgba(0, 0, 0, 0.54);
        padding: 8px 0;
      }
      .ok-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #2e7d32;
        padding: 8px 12px;
        background: #e8f5e9;
        border-radius: 4px;
      }
      .impact-list {
        border-radius: 4px;
        padding: 12px;
        margin-bottom: 12px;
        max-height: 220px;
        overflow-y: auto;
      }
      .warn-box {
        background: #fff3e0;
      }
      .info-box {
        background: #e3f2fd;
      }
      .impact-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 8px;
        font-size: 13px;
      }
      .impact-row {
        display: flex;
        gap: 12px;
        font-size: 13px;
        padding: 2px 0;
      }
      .impact-date {
        min-width: 90px;
        font-weight: 500;
      }
      .impact-time {
        min-width: 90px;
      }
      .error-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: #ffebee;
        color: #c62828;
        border-radius: 4px;
        margin-top: 12px;
      }
    `,
  ],
})
export class AbsenceDialogContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dialogRef = inject<MatDialogRef<AbsenceDialogContainerComponent, boolean>>(MatDialogRef);
  private absenceService = inject(AbsenceManagementService);
  private absenceTypeService = inject(OperatorAbsenceTypeService);
  private operatorService = inject(OperatorService);
  private ngZone = inject(NgZone);

  operators: Operator[] = [];
  absenceTypes: OperatorAbsenceType[] = [];

  selectedOperatorIds: string[] = [];
  absenceTypeId: string | null = null;
  reason = '';
  dateFrom: Date = new Date();
  dateTo: Date = new Date();
  wholeDay = true;
  startTime = '';
  endTime = '';

  preview: AbsenceImpactPreview | null = null;
  previewLoading = false;
  saving = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    // Solo operatori/medici: gli istruttori palestra hanno il flusso
    // dedicato con sostituti in Configurazioni palestra.
    this.operatorService
      .getOperators(undefined, undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ops) =>
          this.ngZone.run(() => {
            this.operators = (ops || []).filter(
              (o) => o.macroCategory !== OperatorMacroCategory.GymInstructor,
            );
          }),
        error: (err) => console.error('Errore caricamento operatori:', err),
      });

    this.absenceTypeService
      .list(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => this.ngZone.run(() => (this.absenceTypes = types)),
        error: (err) => console.error('Errore caricamento tipi di assenza:', err),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  allSelected(): boolean {
    return this.operators.length > 0 && this.selectedOperatorIds.length === this.operators.length;
  }

  toggleAll(checked: boolean): void {
    this.selectedOperatorIds = checked ? this.operators.map((o) => o.id) : [];
    this.onFormChanged();
  }

  categoryLabel(cat?: string | null): string {
    switch (cat) {
      case OperatorMacroCategory.Doctor:
        return 'Medico';
      case OperatorMacroCategory.Physiotherapist:
        return 'Fisioterapista';
      default:
        return 'Operatore';
    }
  }

  onDateFromChanged(): void {
    // Il range non può finire prima di iniziare: riallinea dateTo.
    if (this.dateTo < this.dateFrom) {
      this.dateTo = new Date(this.dateFrom);
    }
    this.onFormChanged();
  }

  /** Ogni modifica al form invalida l'anteprima precedente. */
  onFormChanged(): void {
    this.preview = null;
  }

  canPreview(): boolean {
    if (this.selectedOperatorIds.length === 0) return false;
    if (!this.dateFrom || !this.dateTo || this.dateTo < this.dateFrom) return false;
    if (!this.wholeDay && (!this.startTime || !this.endTime || this.startTime >= this.endTime)) {
      return false;
    }
    return true;
  }

  canSubmit(): boolean {
    return this.canPreview();
  }

  loadPreview(): void {
    if (!this.canPreview()) return;
    this.previewLoading = true;
    this.errorMessage = null;
    this.absenceService
      .previewImpact({
        operatorIds: this.selectedOperatorIds,
        dateFrom: this.toIso(this.dateFrom),
        dateTo: this.toIso(this.dateTo),
        startTime: this.wholeDay ? undefined : this.startTime,
        endTime: this.wholeDay ? undefined : this.endTime,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (preview) =>
          this.ngZone.run(() => {
            this.preview = preview;
            this.previewLoading = false;
          }),
        error: (err) =>
          this.ngZone.run(() => {
            this.previewLoading = false;
            this.errorMessage =
              err?.graphQLErrors?.[0]?.message || 'Errore nel calcolo dell\'anteprima';
          }),
      });
  }

  onSave(): void {
    if (this.saving || !this.canSubmit()) return;
    this.saving = true;
    this.errorMessage = null;
    this.absenceService
      .createAbsences({
        operatorIds: this.selectedOperatorIds,
        dateFrom: this.toIso(this.dateFrom),
        dateTo: this.toIso(this.dateTo),
        startTime: this.wholeDay ? undefined : this.startTime,
        endTime: this.wholeDay ? undefined : this.endTime,
        absenceTypeId: this.absenceTypeId || undefined,
        reason: this.reason || undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () =>
          this.ngZone.run(() => {
            this.saving = false;
            this.dialogRef.close(true);
          }),
        error: (err) =>
          this.ngZone.run(() => {
            this.saving = false;
            this.errorMessage =
              err?.graphQLErrors?.[0]?.message ||
              err?.message ||
              'Errore nel salvataggio dell\'assenza';
          }),
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  formatDate(date: string): string {
    const d = String(date).slice(0, 10);
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  }

  shortTime(t: string): string {
    return (t || '').slice(0, 5);
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
