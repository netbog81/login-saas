/**
 * Gym Recurring Resolution Dialog Container
 * Layer 2: Smart Component (orchestratore del riquadro risoluzione serie)
 *
 * Mostra il piano di una serie palestra — che date genererebbe la regola e
 * quali sono in conflitto — e lascia decidere occorrenza per occorrenza.
 *
 * È il gemello palestra di `calendar-v3/containers/recurring-resolution-dialog`,
 * scritto a parte perché le domande sono diverse: là si cerca un altro
 * operatore, qui un altro orario o un'altra sala; là un'occorrenza fuori
 * disponibilità si può confermare lo stesso, qui una fascia chiusa o una sala
 * piena non si forzano. Vedi il commento in
 * `components/gym-occurrence-resolution-list`.
 */

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  GymOccurrenceResolutionListComponent,
  GymOccurrenceRow,
  GymOccurrenceDecision,
  GymSlotRequest,
} from '../components/gym-occurrence-resolution-list/gym-occurrence-resolution-list.component';
import { GymRebookingService, GymRoomLookup } from '../services/gym-rebooking.service';
import { GymMoveSlot, GymResolvedOccurrence } from '../models/gym-move.model';
import { RecurringOccurrencePreview } from '../../calendar-v3/models/recurring-resolution.model';

export interface GymRecurringResolutionDialogData {
  occurrences: RecurringOccurrencePreview[];
  /** Sala di partenza della serie. */
  gymRoomId: string;
  /** Sale attive, per la ricerca "anche altre sale". */
  rooms: GymRoomLookup[];
  title?: string;
}

export interface GymRecurringResolutionDialogResult {
  action: 'confirm' | 'cancel';
  occurrences: GymResolvedOccurrence[];
}

@Component({
  selector: 'app-gym-recurring-resolution-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    GymOccurrenceResolutionListComponent,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="title-icon">event_repeat</mat-icon>
      {{ data.title || 'Serie palestra: occorrenze da sistemare' }}
    </h2>

    <mat-dialog-content>
      <p class="intro">
        {{ conflictCount }} {{ conflictCount === 1 ? 'occorrenza' : 'occorrenze' }}
        su {{ rows.length }} non {{ conflictCount === 1 ? 'è prenotabile' : 'sono prenotabili' }}
        così com'{{ conflictCount === 1 ? 'è' : 'sono' }}. Per ciascuna scegli
        un altro slot o saltala: le occorrenze senza problemi vengono create
        come sono.
      </p>

      <app-gym-occurrence-resolution-list
        [rows]="rows"
        [slotsByRow]="slotsByRow"
        [spanByRow]="spanByRow"
        [otherRoomsByRow]="otherRoomsByRow"
        [loadingRow]="loadingRow"
        (decide)="onDecide($event)"
        (chooseSlot)="onChooseSlot($event)"
        (requestSlots)="onRequestSlots($event)">
      </app-gym-occurrence-resolution-list>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <div class="summary">
        {{ createCount }} da creare · {{ skipCount }} saltate
      </div>
      <span class="spacer"></span>
      <button mat-stroked-button type="button" (click)="onCancel()">
        Annulla serie
      </button>
      <button mat-flat-button color="primary" type="button"
              [disabled]="!canConfirm" (click)="onConfirm()">
        Conferma
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title { display: flex; align-items: center; gap: 8px; }
    .title-icon { color: #dc2626; }

    mat-dialog-content {
      min-width: min(760px, 92vw);
      max-height: 66vh;
    }

    .intro {
      margin: 0 0 14px;
      color: #475569;
      font-size: 0.875rem;
      line-height: 1.45;
      max-width: 68ch;
    }

    mat-dialog-actions { flex-wrap: wrap; gap: 8px; }

    .summary { font-size: 0.875rem; color: #475569; }
    .spacer { flex: 1 1 auto; }

    @media (max-width: 599px) {
      .spacer { display: none; }
      .summary { width: 100%; }
    }
  `],
})
export class GymRecurringResolutionDialogContainer implements OnInit {
  private readonly rebooking = inject(GymRebookingService);
  private readonly dialogRef = inject<
    MatDialogRef<GymRecurringResolutionDialogContainer, GymRecurringResolutionDialogResult>
  >(MatDialogRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly data = inject<GymRecurringResolutionDialogData>(MAT_DIALOG_DATA);

  rows: GymOccurrenceRow[] = [];
  slotsByRow: Record<number, GymMoveSlot[]> = {};
  spanByRow: Record<number, number> = {};
  otherRoomsByRow: Record<number, boolean> = {};
  loadingRow = -1;

  ngOnInit(): void {
    this.rows = this.data.occurrences.map((o) => ({
      date: o.date,
      startTime: o.startTime,
      endTime: o.endTime,
      conflict: o.conflict ?? null,
      // Le occorrenze in conflitto partono da "salta": è la scelta sicura, e
      // soprattutto è già una decisione valida — l'utente può confermare
      // subito e ottenere una serie coerente senza toccare nulla.
      decision: o.conflict ? 'skip' : 'keep',
      destination: null,
    }));
  }

  get conflictCount(): number {
    return this.rows.filter((r) => !!r.conflict).length;
  }

  get createCount(): number {
    return this.rows.filter((r) => r.decision !== 'skip').length;
  }

  get skipCount(): number {
    return this.rows.filter((r) => r.decision === 'skip').length;
  }

  /**
   * Non si conferma con una riga in "sposta" ma senza destinazione scelta:
   * sarebbe una decisione a metà, e il backend la riceverebbe come
   * un'occorrenza nella posizione originale — cioè quella in conflitto.
   */
  get canConfirm(): boolean {
    if (this.createCount === 0) return false;
    return !this.rows.some((r) => r.decision === 'move' && !r.destination);
  }

  onDecide({ index, decision }: { index: number; decision: GymOccurrenceDecision }): void {
    this.rows = this.rows.map((r, i) =>
      i === index
        ? { ...r, decision, destination: decision === 'move' ? r.destination : null }
        : r,
    );
    this.cdr.markForCheck();

    if (decision === 'move' && !this.slotsByRow[index]) {
      this.onRequestSlots({ index, span: 0, includeOtherRooms: false });
    }
  }

  onChooseSlot({ index, slot }: { index: number; slot: GymMoveSlot }): void {
    this.rows = this.rows.map((r, i) => {
      if (i !== index) return r;
      const same =
        r.destination?.gymRoomId === slot.gymRoomId &&
        r.destination?.date === slot.date &&
        r.destination?.startTime === slot.startTime;
      return { ...r, destination: same ? null : slot };
    });
    this.cdr.markForCheck();
  }

  onRequestSlots({ index, span, includeOtherRooms }: GymSlotRequest): void {
    this.spanByRow = { ...this.spanByRow, [index]: span };
    this.otherRoomsByRow = { ...this.otherRoomsByRow, [index]: includeOtherRooms };
    this.loadingRow = index;
    this.cdr.markForCheck();

    const rooms = includeOtherRooms
      ? this.data.rooms
      : this.data.rooms.filter((r) => r.id === this.data.gymRoomId);

    const base = new Date(this.rows[index].date + 'T00:00:00');
    const from = new Date(base);
    from.setDate(from.getDate() - span);
    const to = new Date(base);
    to.setDate(to.getDate() + span);

    this.rebooking
      .getAvailableSlots(
        rooms,
        this.toDateString(from),
        this.toDateString(to),
        this.data.gymRoomId,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (slots) => {
          this.slotsByRow = { ...this.slotsByRow, [index]: slots };
          this.loadingRow = -1;
          this.cdr.markForCheck();
        },
        error: () => {
          this.slotsByRow = { ...this.slotsByRow, [index]: [] };
          this.loadingRow = -1;
          this.cdr.markForCheck();
        },
      });
  }

  onConfirm(): void {
    const occurrences: GymResolvedOccurrence[] = this.rows
      .filter((r) => r.decision !== 'skip')
      .map((r) => {
        if (r.decision === 'move' && r.destination) {
          return {
            date: r.destination.date,
            startTime: r.destination.startTime,
            endTime: r.destination.endTime,
            // Solo se cambia davvero: passare la sala di partenza farebbe
            // scattare inutilmente il riallineamento lato backend.
            gymRoomId: r.destination.isOriginalRoom ? undefined : r.destination.gymRoomId,
          };
        }
        return { date: r.date, startTime: r.startTime, endTime: r.endTime };
      });

    this.dialogRef.close({ action: 'confirm', occurrences });
  }

  onCancel(): void {
    this.destroy$.next();
    this.dialogRef.close({ action: 'cancel', occurrences: [] });
  }

  /** Data locale in 'YYYY-MM-DD': mai via toISOString (sposta di un giorno). */
  private toDateString(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
