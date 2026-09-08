/**
 * Gym Move Dialog Container
 * Layer 2: Smart Component (orchestratore del pannello "sposta")
 *
 * Spostamento guidato di una prenotazione palestra: cerca gli slot liberi
 * nell'intorno della data attuale e applica quello scelto.
 *
 * PERCHÉ NON RIUSA IL PANNELLO DELLA VISTA OPERATORI. Là l'asse alternativo
 * è la persona: se l'operatore non è disponibile si cerca un collega che
 * possa prendere il paziente, e il pannello ha una casella "anche altri
 * operatori". Qui l'istruttore non si sceglie — lo assegna il template della
 * sala per quella fascia — e l'alternativa è un altro orario o un'altra
 * sala, con la capienza residua come criterio. Sono due domande diverse, e
 * un unico componente con un flag di modalità avrebbe finito per contenere
 * due implementazioni parallele in un file solo.
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GymSlotPickerComponent } from '../components/gym-slot-picker/gym-slot-picker.component';
import { GymRebookingService, GymRoomLookup } from '../services/gym-rebooking.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { RecurringSeriesScope } from '../../../graphql/generated/types';
import {
  GymMoveSlot,
  GymMoveSlotsByDay,
  GymMoveSearchSpan,
  GymMoveTarget,
  GymRoomOption,
} from '../models/gym-move.model';

export interface GymMoveDialogData {
  appointment: GymMoveTarget;
  /** Sale attive fra cui cercare. La sala di partenza deve essere inclusa. */
  rooms: GymRoomLookup[];
}

export interface GymMoveDialogResult {
  moved: boolean;
  appointmentId: string;
  /**
   * Spostamento riuscito solo in parte. La validazione preventiva è
   * tutto-o-niente, ma fra quella e la scrittura passano secondi: bastano
   * perché un'altra prenotazione occupi uno degli slot. Chiudere in silenzio
   * lascerebbe l'utente convinto che la serie sia tutta al posto nuovo.
   */
  warning?: string;
}

@Component({
  selector: 'app-gym-move-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    FormsModule,
    GymSlotPickerComponent,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon>swap_horiz</mat-icon>
      Sposta prenotazione
    </h2>

    <mat-dialog-content>
      <div class="current-position">
        <div class="cp-label">Ora è</div>
        <div class="cp-value">
          <strong>{{ data.appointment.clientName || 'Prenotazione' }}</strong>
          · {{ formatDate(data.appointment.appointmentDate) }}
          · {{ hhmm(data.appointment.startTime) }}-{{ hhmm(data.appointment.endTime) }}
          <span *ngIf="data.appointment.gymRoomName"> · {{ data.appointment.gymRoomName }}</span>
        </div>
      </div>

      <!-- Serie ricorrente: a chi si applica lo spostamento -->
      <div class="series-scope" *ngIf="isRecurring">
        <div class="scope-head">
          <mat-icon>repeat</mat-icon>
          <span>Fa parte di una serie ricorrente. Applica lo spostamento a:</span>
        </div>
        <mat-radio-group [(ngModel)]="scope" name="scope" class="scope-options">
          <mat-radio-button [value]="Scopes.CurrentOnly">Solo questa occorrenza</mat-radio-button>
          <mat-radio-button [value]="Scopes.ThisAndFollowing">Questa e le successive</mat-radio-button>
          <mat-radio-button [value]="Scopes.All">Tutta la serie</mat-radio-button>
        </mat-radio-group>
        <!-- Traslare la serie sposta OGNI occorrenza dello stesso numero di
             giorni: va detto prima, perché scegliendo un giovedì per un
             appuntamento del lunedì tutta la serie diventa di giovedì. -->
        <div class="scope-hint" *ngIf="scope !== Scopes.CurrentOnly">
          <ng-container *ngIf="selectedSlot">
            Le altre occorrenze verranno spostate dello stesso scarto
            ({{ shiftDescription }}) e alla stessa ora.
          </ng-container>
          <!-- I posti liberi mostrati sui chip sono quelli di QUELLA data:
               dirlo evita di leggere "4 posti" come una garanzia su tutte le
               occorrenze della serie. Le altre le verifica il backend. -->
          I posti liberi indicati valgono per la data mostrata; le altre
          occorrenze vengono verificate al momento della conferma.
        </div>
        <!-- Cambio sala sull'intera serie: ogni occorrenza deve trovare
             istruttore e posto libero nella sala nuova, alla sua data. Se
             anche una sola non ci sta, non parte niente — va detto prima. -->
        <div class="scope-warn" *ngIf="crossRoomSeriesMove">
          <mat-icon>info</mat-icon>
          <span>
            Tutte le occorrenze passeranno in
            <strong>{{ selectedSlot!.gymRoomName }}</strong>. Se in una data
            la sala è chiusa, senza istruttore o al completo, lo spostamento
            viene annullato per intero.
          </span>
        </div>
      </div>

      <app-gym-slot-picker
        [slotsByDay]="slotsByDay"
        [rooms]="roomOptions"
        [span]="span"
        [selected]="selectedSlot"
        [loading]="loading"
        (select)="onSelect($event)"
        (spanChange)="onSpanChange($event)"
        (toggleRoom)="onToggleRoom($event)">
      </app-gym-slot-picker>

      <div class="server-error" *ngIf="error">
        <mat-icon color="warn">error</mat-icon>
        <span>{{ error }}</span>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <div class="chosen" *ngIf="selectedSlot">
        <mat-icon>arrow_forward</mat-icon>
        {{ formatDate(selectedSlot.date) }} · {{ selectedSlot.startTime }}
        <span *ngIf="!selectedSlot.isOriginalRoom"> · {{ selectedSlot.gymRoomName }}</span>
      </div>
      <span class="spacer"></span>
      <mat-spinner *ngIf="saving" diameter="20"></mat-spinner>
      <button mat-stroked-button type="button" [disabled]="saving" (click)="onCancel()">
        Annulla
      </button>
      <button mat-flat-button color="primary" type="button"
              [disabled]="!selectedSlot || saving" (click)="onConfirm()">
        Sposta qui
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title { display: flex; align-items: center; gap: 8px; }

    mat-dialog-content {
      min-width: min(720px, 90vw);
      max-height: 66vh;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .current-position {
      padding: 10px 12px;
      border-radius: 8px;
      background: #f1f5f9;
    }

    .cp-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #64748b;
    }

    .cp-value { font-size: 0.9375rem; color: #0f172a; }

    .series-scope {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 0.8125rem;
    }

    .scope-head { display: flex; align-items: center; gap: 8px; }
    .scope-head mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .scope-options {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 20px;
      padding-left: 26px;
    }

    .scope-hint { padding-left: 26px; opacity: 0.9; }

    .scope-warn {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin-left: 26px;
      padding: 8px 10px;
      border-radius: 6px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
    }

    .scope-warn mat-icon { font-size: 18px; width: 18px; height: 18px; flex: 0 0 auto; }

    .server-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      background: #fef2f2;
      color: #b91c1c;
      font-size: 0.875rem;
    }

    mat-dialog-actions {
      flex-wrap: wrap;
      gap: 8px;
    }

    .chosen {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.875rem;
      color: #14532d;
      background: #dcfce7;
      border-radius: 999px;
      padding: 4px 12px;
    }

    .chosen mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .spacer { flex: 1 1 auto; }

    @media (max-width: 599px) {
      .spacer { display: none; }
      .chosen { width: 100%; justify-content: center; }
    }
  `],
})
export class GymMoveDialogContainer implements OnInit {
  private readonly rebooking = inject(GymRebookingService);
  private readonly seriesService = inject(AvailabilityAppointmentService);
  private readonly dialogRef =
    inject<MatDialogRef<GymMoveDialogContainer, GymMoveDialogResult>>(MatDialogRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly data = inject<GymMoveDialogData>(MAT_DIALOG_DATA);

  roomOptions: GymRoomOption[] = [];
  slotsByDay: GymMoveSlotsByDay[] = [];
  selectedSlot: GymMoveSlot | null = null;
  span: GymMoveSearchSpan = 1;
  loading = false;
  saving = false;
  error: string | null = null;

  /** Alias per il template: l'enum non è raggiungibile da lì. */
  readonly Scopes = RecurringSeriesScope;

  /**
   * A chi applicare lo spostamento. Parte da "solo questa occorrenza": è
   * l'intenzione di gran lunga più frequente quando si sposta una singola
   * prenotazione, ed è anche la meno distruttiva se qualcuno non legge.
   */
  scope: RecurringSeriesScope = RecurringSeriesScope.CurrentOnly;

  get isRecurring(): boolean {
    return !!this.data.appointment.isRecurring && !!this.data.appointment.recurringGroupId;
  }

  /**
   * Spostamento di una serie che cambia anche sala. Il backend valida ogni
   * occorrenza contro chiusure, istruttore e capienza della sala nuova alla
   * sua data, e applica tutto o niente: qui serve solo a dirlo prima.
   */
  get crossRoomSeriesMove(): boolean {
    return (
      this.isRecurring &&
      this.scope !== RecurringSeriesScope.CurrentOnly &&
      !!this.selectedSlot &&
      !this.selectedSlot.isOriginalRoom
    );
  }

  /** "3 giorni avanti", "1 giorno indietro", "stesso giorno": per l'avviso. */
  get shiftDescription(): string {
    if (!this.selectedSlot) return '';
    const from = new Date(this.dateOnly(this.data.appointment.appointmentDate) + 'T00:00:00');
    const to = new Date(this.selectedSlot.date + 'T00:00:00');
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    if (days === 0) return 'stesso giorno';
    const n = Math.abs(days);
    return `${n} ${n === 1 ? 'giorno' : 'giorni'} ${days > 0 ? 'avanti' : 'indietro'}`;
  }

  ngOnInit(): void {
    // All'apertura si cercano gli slot di TUTTE le sale attive. Restringere
    // alla sola sala di partenza sarebbe la scelta prudente, ma il caso in
    // cui si apre questo pannello è quasi sempre "quella fascia non va più
    // bene": partire già con le alternative sott'occhio evita un giro.
    this.roomOptions = this.data.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      selected: true,
      isOriginal: r.id === this.data.appointment.gymRoomId,
    }));
    this.loadSlots();
  }

  onSpanChange(span: GymMoveSearchSpan): void {
    this.span = span;
    this.loadSlots();
  }

  onToggleRoom(roomId: string): void {
    this.roomOptions = this.roomOptions.map((r) =>
      r.id === roomId ? { ...r, selected: !r.selected } : r,
    );
    // Se lo slot scelto apparteneva a una sala appena esclusa, la scelta non
    // è più coerente con quello che si vede: va azzerata, non lasciata
    // invisibile ma attiva sul pulsante di conferma.
    if (this.selectedSlot && !this.isRoomSelected(this.selectedSlot.gymRoomId)) {
      this.selectedSlot = null;
    }
    this.loadSlots();
  }

  onSelect(slot: GymMoveSlot): void {
    this.selectedSlot = this.isSame(slot, this.selectedSlot) ? null : slot;
    this.cdr.markForCheck();
  }

  onCancel(): void {
    this.destroy$.next();
    this.dialogRef.close({ moved: false, appointmentId: this.data.appointment.id });
  }

  onConfirm(): void {
    const slot = this.selectedSlot;
    if (!slot || this.saving) return;

    this.saving = true;
    this.error = null;
    this.cdr.markForCheck();

    const onError = (err: any, prefix = 'Spostamento non riuscito') => {
      this.saving = false;
      this.error =
        prefix + (err?.message ? `: ${err.message}` : '. Riprova con un altro slot.');
      // Lo slot scelto potrebbe essersi riempito nel frattempo: si ricarica
      // per mostrare la situazione aggiornata.
      this.loadSlots();
    };

    // Spostamento dell'intera serie (o della coda): passa da
    // updateRecurringSeries, che trasla tutte le occorrenze dello scope dello
    // stesso scarto e valida ciascuna contro chiusure e capienza. Il singolo
    // update non saprebbe nulla delle sorelle.
    if (this.isRecurring && this.scope !== RecurringSeriesScope.CurrentOnly) {
      this.seriesService
        .updateRecurringSeries({
          appointmentId: this.data.appointment.id,
          scope: this.scope,
          newDate: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          // Solo se cambia davvero: passarla identica farebbe rieseguire a
          // vuoto il riallineamento di istruttore e capienza su ogni
          // occorrenza della serie.
          gymRoomId: slot.isOriginalRoom ? undefined : slot.gymRoomId,
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            if (!result.applied && result.conflicts.length > 0) {
              // Avvisa-e-blocca: nulla è stato applicato. Si dice QUALI date
              // non passano e perché — "3 occorrenze in conflitto" non
              // basterebbe a decidere se cambiare slot o ripiegare sulla
              // singola occorrenza.
              this.saving = false;
              this.error = this.describeSeriesConflicts(result.conflicts);
              this.cdr.markForCheck();
              return;
            }
            const partial = result.conflicts.length > 0
              ? `${result.conflicts.length} ${result.conflicts.length === 1 ? 'occorrenza non è stata spostata' : 'occorrenze non sono state spostate'}: verificale nel calendario.`
              : undefined;
            this.dialogRef.close({
              moved: true,
              appointmentId: this.data.appointment.id,
              warning: partial,
            });
          },
          error: (err) => onError(err, 'Spostamento della serie non riuscito'),
        });
      return;
    }

    this.rebooking
      .moveAppointment({
        appointmentId: this.data.appointment.id,
        appointmentDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        // La sala si passa solo se cambia davvero: un update che riscrive lo
        // stesso valore farebbe comunque scattare il riallineamento di
        // capienza e istruttore lato backend.
        gymRoomId: slot.isOriginalRoom ? undefined : slot.gymRoomId,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialogRef.close({ moved: true, appointmentId: this.data.appointment.id });
        },
        error: (err) => onError(err),
      });
  }

  /**
   * Messaggio d'errore di una serie non spostata: prime tre date con il loro
   * motivo, e il conteggio del resto. Tre perché è quanto sta in un banner
   * senza farlo diventare un elenco da scorrere.
   */
  private describeSeriesConflicts(
    conflicts: { date: string; reason: string }[],
  ): string {
    const shown = conflicts.slice(0, 3)
      .map((c) => `${this.formatDate(c.date)}: ${c.reason}`)
      .join(' · ');
    const rest = conflicts.length - Math.min(3, conflicts.length);
    const more = rest > 0 ? ` (e altre ${rest})` : '';
    return (
      `Serie non spostata, nessuna occorrenza è stata modificata. ${shown}${more}. ` +
      'Scegli un altro slot oppure applica solo a questa occorrenza.'
    );
  }

  // ==================== DATI ====================

  private loadSlots(): void {
    const rooms = this.data.rooms.filter((r) => this.isRoomSelected(r.id));
    if (rooms.length === 0) {
      this.slotsByDay = [];
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    const { from, to } = this.dateRange();

    this.rebooking
      .getAvailableSlots(rooms, from, to, this.data.appointment.gymRoomId, {
        gymRoomId: this.data.appointment.gymRoomId,
        date: this.dateOnly(this.data.appointment.appointmentDate),
        startTime: this.data.appointment.startTime,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (slots) => {
          this.slotsByDay = this.groupByDay(slots);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.slotsByDay = [];
          this.loading = false;
          this.error =
            'Impossibile caricare gli slot liberi' +
            (err?.message ? `: ${err.message}` : '.');
          this.cdr.markForCheck();
        },
      });
  }

  private groupByDay(slots: GymMoveSlot[]): GymMoveSlotsByDay[] {
    const byDay = new Map<string, GymMoveSlot[]>();
    for (const s of slots) {
      const list = byDay.get(s.date) ?? [];
      list.push(s);
      byDay.set(s.date, list);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => ({ date, slots: list }));
  }

  private dateRange(): { from: string; to: string } {
    const base = new Date(this.dateOnly(this.data.appointment.appointmentDate) + 'T00:00:00');
    const from = new Date(base);
    from.setDate(from.getDate() - this.span);
    const to = new Date(base);
    to.setDate(to.getDate() + this.span);
    return { from: this.toDateString(from), to: this.toDateString(to) };
  }

  private isRoomSelected(roomId: string): boolean {
    return this.roomOptions.find((r) => r.id === roomId)?.selected ?? false;
  }

  private isSame(a: GymMoveSlot, b: GymMoveSlot | null): boolean {
    return (
      !!b &&
      a.gymRoomId === b.gymRoomId &&
      a.date === b.date &&
      a.startTime === b.startTime
    );
  }

  hhmm(t: string | null | undefined): string {
    return (t ?? '').slice(0, 5);
  }

  formatDate(value: string | Date): string {
    const d = value instanceof Date ? value : new Date(this.dateOnly(value) + 'T00:00:00');
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('it-IT', {
      weekday: 'short', day: '2-digit', month: '2-digit',
    });
  }

  private dateOnly(value: string | Date): string {
    if (value instanceof Date) return this.toDateString(value);
    return String(value).slice(0, 10);
  }

  /** Data locale in 'YYYY-MM-DD': mai via toISOString (sposta di un giorno). */
  private toDateString(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
