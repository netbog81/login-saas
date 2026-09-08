/**
 * Recurring Resolution Dialog Container — Calendario V3
 * Layer 2: Smart Component
 *
 * Riquadro che si apre PRIMA di scrivere una serie ricorrente, quando almeno
 * una occorrenza è in conflitto: l'utente decide una per una se confermarla
 * (fuori disponibilità ma la vuole comunque), spostarla o saltarla, oppure
 * annulla tutta la serie.
 *
 * Sostituisce il vecchio "avvisa e blocca", che davanti a un conflitto
 * fermava l'intera serie senza dare all'utente nessuno strumento per
 * risolverlo — e che rendeva impossibile creare, per dire, una serie di tre
 * mesi se a settembre cambiava il template dell'operatore.
 *
 * Tiene SOLO lo UI state: la ricerca degli slot liberi passa da
 * RebookingService (Layer 3, BaseGraphQLService/NgZone).
 */

import {
  Component, Inject, ChangeDetectionStrategy, ChangeDetectorRef, inject,
  OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import {
  V3RecurringResolutionListComponent, MoveSearchRequest,
} from '../components/recurring-resolution-list/recurring-resolution-list.component';
import { RebookingService } from '../services/rebooking.service';
import { RebookingOperatorInput } from '../models/rebooking.model';
import {
  RecurringOccurrencePreview, OccurrenceResolution, OccurrenceDecision,
  OccurrenceDestination, MoveSlotOption, MoveSearchSpan, ResolvedOccurrenceInput,
} from '../models/recurring-resolution.model';

export interface RecurringResolutionDialogData {
  /** Piano proposto dal backend, conflitti inclusi. */
  occurrences: RecurringOccurrencePreview[];
  /** Operatore della serie. */
  operatorId: string;
  operatorName: string;
  /** Operatori selezionabili quando si cercano slot "anche di altri". */
  operators?: RebookingOperatorInput[];
  /** Servizio, per il controllo strumenti nella ricerca slot. */
  serviceId?: string;
  /** Titolo del riquadro: cambia fra creazione, modifica e "rendi ricorrente". */
  title?: string;
  /**
   * Se false, "conferma comunque" non è offerto: vale per la modifica di una
   * serie esistente, dove i conflitti sono sovrapposizioni o slot palestra
   * chiusi — situazioni che non si forzano, si risolvono.
   */
  allowConfirm?: boolean;
  /** Testo introduttivo alternativo (creazione vs modifica). */
  intro?: string;
}

export interface RecurringResolutionDialogResult {
  action: 'apply' | 'cancel';
  /** Occorrenze da scrivere davvero; le saltate non ci sono. */
  occurrences: ResolvedOccurrenceInput[];
}

@Component({
  selector: 'app-recurring-resolution-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatTooltipModule, V3RecurringResolutionListComponent,
  ],
  template: `
    <h2 mat-dialog-title class="res-title">
      <mat-icon>event_repeat</mat-icon>
      {{ data.title || 'Occorrenze da sistemare' }}
    </h2>

    <mat-dialog-content>
      @if (data.intro) {
        <p class="res-intro">{{ data.intro }}</p>
      } @else {
        <p class="res-intro">
          La serie genera {{ data.occurrences.length }}
          {{ data.occurrences.length === 1 ? 'appuntamento' : 'appuntamenti' }},
          di cui <strong>{{ conflictCount }}</strong> con un problema.
          Decidi cosa fare di {{ conflictCount === 1 ? 'quello' : 'ognuno' }}:
          gli altri vengono creati senza chiedere altro.
        </p>
      }

      <!-- Azioni cumulative: con un template cambiato a metà periodo le
           occorrenze in conflitto possono essere decine, e deciderle una per
           una sarebbe impraticabile proprio quando serve di più. -->
      @if (conflictCount > 1) {
        <div class="bulk-actions">
          <span class="bulk-label">Per tutte:</span>
          @if (confirmableCount > 0) {
            <button mat-stroked-button type="button" (click)="applyToAll('confirm')">
              <mat-icon>check</mat-icon>
              Conferma ({{ confirmableCount }})
            </button>
          }
          <button mat-stroked-button type="button" (click)="applyToAll('skip')">
            <mat-icon>block</mat-icon>
            Salta
          </button>
        </div>
      }

      <app-v3-recurring-resolution-list
        [resolutions]="resolutions"
        [allowConfirm]="allowConfirm"
        [slotsByRow]="slotsByRow"
        [loadingRows]="loadingRows"
        [spanByRow]="spanByRow"
        [otherOperatorsByRow]="otherOperatorsByRow"
        (decisionChange)="onDecisionChange($event)"
        (destinationChange)="onDestinationChange($event)"
        (searchRequest)="onSearchRequest($event)">
      </app-v3-recurring-resolution-list>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <div class="res-summary">
        <mat-icon>playlist_add_check</mat-icon>
        <span>{{ summaryText }}</span>
      </div>
      <span class="spacer"></span>
      <button mat-stroked-button type="button" (click)="cancel()">
        {{ allowConfirm ? 'Annulla la serie' : 'Annulla' }}
      </button>
      <button mat-flat-button color="primary" type="button"
              [disabled]="applicableCount === 0"
              (click)="apply()">
        {{ allowConfirm ? 'Crea' : 'Applica a' }} {{ applicableCount }}
        {{ applicableCount === 1 ? 'appuntamento' : 'appuntamenti' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .res-title { display: flex; align-items: center; gap: 8px; }
    .res-intro { font-size: 0.85rem; color: #475569; margin: 4px 0 12px; }
    .bulk-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .bulk-label { font-size: 0.78rem; color: #64748b; font-weight: 600; }
    .bulk-actions button { font-size: 0.76rem; line-height: 28px; padding: 0 10px; }
    .bulk-actions .mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 3px; }
    mat-dialog-actions { padding: 10px 20px; gap: 8px; }
    .spacer { flex: 1; }
    .res-summary {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: #64748b;
    }
    .res-summary mat-icon { font-size: 17px; width: 17px; height: 17px; }
  `],
})
export class RecurringResolutionDialogContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private rebookingService = inject(RebookingService);

  resolutions: OccurrenceResolution[] = [];
  slotsByRow: Record<number, MoveSlotOption[]> = {};
  loadingRows: Record<number, boolean> = {};
  spanByRow: Record<number, MoveSearchSpan> = {};
  otherOperatorsByRow: Record<number, boolean> = {};

  constructor(
    private dialogRef: MatDialogRef<
      RecurringResolutionDialogContainer, RecurringResolutionDialogResult
    >,
    @Inject(MAT_DIALOG_DATA) public data: RecurringResolutionDialogData,
  ) {}

  ngOnInit(): void {
    // Decisioni di partenza. Un fuori-disponibilità nasce confermato: è la
    // ricorrenza che l'utente ha appena chiesto, e la lista qui davanti gli
    // dice esattamente quali date sono in quella condizione. Una
    // sovrapposizione nasce saltata, perché confermarla non è permesso e
    // creare due appuntamenti nello stesso slot non deve poter succedere
    // per distrazione.
    this.resolutions = this.data.occurrences.map(preview => ({
      preview,
      decision: this.defaultDecision(preview),
    }));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Falso solo dove confermare non è ammesso (modifica serie). */
  get allowConfirm(): boolean {
    return this.data.allowConfirm !== false;
  }

  private defaultDecision(preview: RecurringOccurrencePreview): OccurrenceDecision {
    if (!preview.conflict) return 'keep';
    if (!this.allowConfirm) return 'skip';
    return preview.conflict.type === 'overlap' ? 'skip' : 'confirm';
  }

  get conflictCount(): number {
    return this.resolutions.filter(r => !!r.preview.conflict).length;
  }

  /** Quante occorrenze si possono confermare (le sovrapposte non si possono). */
  get confirmableCount(): number {
    if (!this.allowConfirm) return 0;
    return this.resolutions.filter(
      r => r.preview.conflict && r.preview.conflict.type !== 'overlap',
    ).length;
  }

  /** Occorrenze che verranno effettivamente scritte. */
  get applicableCount(): number {
    return this.resolutions.filter(r => r.decision !== 'skip').length;
  }

  get summaryText(): string {
    const moved = this.resolutions.filter(r => r.decision === 'move').length;
    const skipped = this.resolutions.filter(r => r.decision === 'skip').length;
    const parts: string[] = [];
    if (moved > 0) parts.push(`${moved} spostat${moved === 1 ? 'o' : 'i'}`);
    if (skipped > 0) parts.push(`${skipped} saltat${skipped === 1 ? 'o' : 'i'}`);
    return parts.length > 0 ? parts.join(', ') : 'Nessuna modifica al piano';
  }

  onDecisionChange({ index, decision }: { index: number; decision: OccurrenceDecision }): void {
    const row = this.resolutions[index];
    if (!row) return;
    this.resolutions = this.resolutions.map((r, i) =>
      i === index ? { ...r, decision, destination: decision === 'move' ? r.destination : undefined } : r,
    );
    // Passando a "sposta" si cercano subito gli slot di quel giorno: la
    // domanda successiva dell'utente è sempre "e allora dove lo metto?".
    if (decision === 'move' && !this.slotsByRow[index]) {
      this.searchSlots(index, this.spanByRow[index] ?? 0, !!this.otherOperatorsByRow[index]);
    }
    this.cdr.markForCheck();
  }

  onDestinationChange({ index, destination }: { index: number; destination: OccurrenceDestination }): void {
    this.resolutions = this.resolutions.map((r, i) =>
      i === index ? { ...r, decision: 'move', destination } : r,
    );
    this.cdr.markForCheck();
  }

  onSearchRequest({ index, span, includeOtherOperators }: MoveSearchRequest): void {
    this.spanByRow = { ...this.spanByRow, [index]: span };
    this.otherOperatorsByRow = { ...this.otherOperatorsByRow, [index]: includeOtherOperators };
    this.searchSlots(index, span, includeOtherOperators);
  }

  applyToAll(decision: OccurrenceDecision): void {
    this.resolutions = this.resolutions.map(r => {
      if (!r.preview.conflict) return r;
      // Le sovrapposte non sono confermabili: restano come sono.
      if (decision === 'confirm' && (!this.allowConfirm || r.preview.conflict.type === 'overlap')) return r;
      return { ...r, decision, destination: undefined };
    });
    this.cdr.markForCheck();
  }

  /**
   * Slot liberi per l'occorrenza, nella finestra di giorni richiesta.
   * `span` allarga la ricerca ai giorni prima e dopo, che è quello che serve
   * quando il giorno originale è pieno.
   */
  private searchSlots(index: number, span: MoveSearchSpan, includeOtherOperators: boolean): void {
    const row = this.resolutions[index];
    if (!row) return;

    const dates = this.datesAround(row.preview.date, span);
    const durationMinutes = this.minutesBetween(row.preview.startTime, row.preview.endTime);
    const operatorIds = includeOtherOperators
      ? Array.from(new Set([
          this.data.operatorId,
          ...(this.data.operators ?? []).map(o => o.id),
        ]))
      : [this.data.operatorId];

    this.loadingRows = { ...this.loadingRows, [index]: true };
    this.cdr.markForCheck();

    this.rebookingService.findAvailableSlots(operatorIds, dates, durationMinutes, this.data.serviceId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (slots) => {
          const options: MoveSlotOption[] = slots.map(s => ({
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            operatorId: s.operatorId,
            operatorName: this.operatorName(s.operatorId),
            isOriginalOperator: s.operatorId === this.data.operatorId,
          }));
          // L'operatore originale davanti: è la scelta che l'utente si
          // aspetta per prima, gli altri sono un ripiego.
          options.sort((a, b) => {
            if (a.isOriginalOperator !== b.isOriginalOperator) return a.isOriginalOperator ? -1 : 1;
            return (a.date + a.startTime).localeCompare(b.date + b.startTime);
          });
          this.slotsByRow = { ...this.slotsByRow, [index]: options };
          this.loadingRows = { ...this.loadingRows, [index]: false };
          this.cdr.markForCheck();
        },
        error: () => {
          this.slotsByRow = { ...this.slotsByRow, [index]: [] };
          this.loadingRows = { ...this.loadingRows, [index]: false };
          this.cdr.markForCheck();
        },
      });
  }

  private operatorName(operatorId: string): string {
    if (operatorId === this.data.operatorId) return this.data.operatorName;
    return (this.data.operators ?? []).find(o => o.id === operatorId)?.name ?? 'Altro operatore';
  }

  /** Date da esplorare: il giorno stesso più `span` giorni prima e dopo. */
  private datesAround(date: string, span: MoveSearchSpan): string[] {
    const dates: string[] = [];
    for (let offset = -span; offset <= span; offset++) {
      dates.push(this.addDays(date, offset));
    }
    return dates;
  }

  /** Somma giorni a una data YYYY-MM-DD lavorando in UTC (immune al fuso). */
  private addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  private minutesBetween(start: string, end: string): number {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    return toMin(end) - toMin(start);
  }

  apply(): void {
    const occurrences: ResolvedOccurrenceInput[] = this.resolutions
      .filter(r => r.decision !== 'skip')
      .map(r => {
        const dest = r.decision === 'move' ? r.destination : undefined;
        return {
          appointmentId: r.preview.appointmentId,
          date: dest?.date ?? r.preview.date,
          startTime: dest?.startTime ?? r.preview.startTime,
          endTime: dest?.endTime ?? r.preview.endTime,
          operatorId: dest?.operatorId,
        };
      })
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

    this.dialogRef.close({ action: 'apply', occurrences });
  }

  cancel(): void {
    this.dialogRef.close({ action: 'cancel', occurrences: [] });
  }
}
