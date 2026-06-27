import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { RecurringSeriesScope } from '../../../services/availability-appointment.service';

export interface RecurringScopeSelection {
  scope: RecurringSeriesScope;
  rangeFrom?: string;
  rangeTo?: string;
  includeCurrent?: boolean;
}

/**
 * Pannello "Applica a" per le serie ricorrenti: l'utente sceglie l'ambito
 * (solo corrente / corrente+successivi / intera serie / intervallo date) e poi
 * preme Modifica orario oppure Elimina. Entrambi mostrano una micro-conferma.
 *
 * La modifica riguarda SOLO orario/durata: cambi di data/giorno vanno gestiti
 * eliminando e ricreando la serie.
 */
@Component({
  selector: 'app-recurring-scope-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatRadioModule, MatCheckboxModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatDatepickerModule,
  ],
  template: `
    <div class="scope-panel">
      <div class="panel-header">
        <mat-icon>repeat</mat-icon>
        <span class="panel-title">Appuntamento ricorrente</span>
        @if (futureCount !== null) {
          <span class="panel-info">({{ futureCount }} seguenti)</span>
        }
      </div>

      <div class="apply-to">
        <span class="apply-label">Applica a:</span>
        <mat-radio-group [(ngModel)]="scope" class="scope-radios-inline">
          <mat-radio-button value="CURRENT_ONLY">Solo questo</mat-radio-button>
          <mat-radio-button value="THIS_AND_FOLLOWING">Questo e successivi</mat-radio-button>
          <mat-radio-button value="ALL">Intera serie</mat-radio-button>
          <mat-radio-button value="DATE_RANGE">Intervallo date</mat-radio-button>
        </mat-radio-group>
      </div>

      @if (scope === 'DATE_RANGE') {
        <div class="range-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="range-field">
            <mat-label>Dal</mat-label>
            <input matInput [matDatepicker]="pFrom" [(ngModel)]="rangeFromDate" />
            <mat-datepicker-toggle matIconSuffix [for]="pFrom"></mat-datepicker-toggle>
            <mat-datepicker #pFrom></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="range-field">
            <mat-label>Al</mat-label>
            <input matInput [matDatepicker]="pTo" [(ngModel)]="rangeToDate" />
            <mat-datepicker-toggle matIconSuffix [for]="pTo"></mat-datepicker-toggle>
            <mat-datepicker #pTo></mat-datepicker>
          </mat-form-field>
          <mat-checkbox [(ngModel)]="includeCurrent">Includi corrente</mat-checkbox>
        </div>
      }

      <!-- Stato conferma in linea (micro-dialog) -->
      @if (pendingAction) {
        <div class="confirm-bar" [class.danger]="pendingAction === 'delete'">
          <mat-icon>{{ pendingAction === 'delete' ? 'warning' : 'help_outline' }}</mat-icon>
          <span class="confirm-text">{{ confirmMessage }}</span>
          <button mat-flat-button [color]="pendingAction === 'delete' ? 'warn' : 'primary'"
                  (click)="confirm()">Conferma</button>
          <button mat-button (click)="pendingAction = null">Annulla</button>
        </div>
      } @else {
        <div class="action-buttons">
          <button mat-stroked-button color="primary" (click)="askEdit()"
                  [disabled]="!isScopeValid()">
            <mat-icon>schedule</mat-icon> Modifica orario
          </button>
          <button mat-stroked-button color="warn" (click)="askDelete()"
                  [disabled]="!isScopeValid()">
            <mat-icon>delete</mat-icon> Elimina
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .scope-panel {
      border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;
      margin: 8px 24px; background: #f8fafc;
    }
    .panel-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
    .panel-header mat-icon { color: #6366f1; }
    .panel-title { font-weight: 600; font-size: 0.85rem; color: #334155; }
    .panel-info { font-size: 0.75rem; color: #94a3b8; }
    .apply-to { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; margin-bottom: 8px; }
    .apply-label { font-size: 0.75rem; font-weight: 600; color: #64748b; }
    /* Opzioni di ambito sulla stessa riga (vanno a capo se serve). */
    .scope-radios-inline { display: flex; flex-wrap: wrap; gap: 4px 16px; }
    .scope-radios-inline mat-radio-button { font-size: 0.78rem; }
    .range-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .range-field { width: 140px; }
    .action-buttons { display: flex; gap: 8px; }
    .confirm-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 8px; border-radius: 6px; background: #eef2ff;
    }
    .confirm-bar.danger { background: #fef2f2; }
    .confirm-text { flex: 1; font-size: 0.8rem; color: #334155; min-width: 180px; }
  `],
})
export class RecurringScopePanelComponent {
  /** Numero di occorrenze successive (per info), null se sconosciuto. */
  @Input() futureCount: number | null = null;
  /** Data dell'occorrenza corrente (YYYY-MM-DD), default per il range. */
  @Input() currentDate = '';

  @Output() applyEdit = new EventEmitter<RecurringScopeSelection>();
  @Output() applyDelete = new EventEmitter<RecurringScopeSelection>();

  scope: RecurringSeriesScope = 'CURRENT_ONLY';
  rangeFromDate: Date | null = null;
  rangeToDate: Date | null = null;
  includeCurrent = true;

  pendingAction: 'edit' | 'delete' | null = null;

  get confirmMessage(): string {
    const what = this.pendingAction === 'delete' ? 'eliminare' : 'modificare l\'orario di';
    const scopeLabel = this.scopeLabel();
    return `Sei sicuro di voler ${what} ${scopeLabel}?`;
  }

  private scopeLabel(): string {
    switch (this.scope) {
      case 'CURRENT_ONLY': return 'questo appuntamento';
      case 'THIS_AND_FOLLOWING': return 'questo e i successivi appuntamenti';
      case 'ALL': return 'tutti gli appuntamenti della serie';
      case 'DATE_RANGE': return 'gli appuntamenti nell\'intervallo selezionato';
    }
  }

  isScopeValid(): boolean {
    if (this.scope === 'DATE_RANGE') {
      return !!this.rangeFromDate && !!this.rangeToDate;
    }
    return true;
  }

  askEdit(): void { this.pendingAction = 'edit'; }
  askDelete(): void { this.pendingAction = 'delete'; }

  confirm(): void {
    const sel: RecurringScopeSelection = { scope: this.scope };
    if (this.scope === 'DATE_RANGE') {
      sel.rangeFrom = this.toIso(this.rangeFromDate);
      sel.rangeTo = this.toIso(this.rangeToDate);
      sel.includeCurrent = this.includeCurrent;
    }
    if (this.pendingAction === 'edit') this.applyEdit.emit(sel);
    else if (this.pendingAction === 'delete') this.applyDelete.emit(sel);
    this.pendingAction = null;
  }

  private toIso(d: Date | null): string | undefined {
    if (!d) return undefined;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
