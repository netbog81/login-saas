import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';

import { AbsenceManagementService } from '../services/absence-management.service';
import {
  OperatorAbsence,
  EXTRA_AVAILABILITY_TYPE,
  SCHEDULE_CHANGE_TYPE,
} from '../models/absence.model';
import {
  ExceptionDialogContainerComponent,
  ExceptionDialogResult,
} from './exception-dialog.container';
import { OperatorService } from '../../../../services/operator.service';
import { SseService } from '../../../../services/sse.service';
import { Operator, OperatorMacroCategory } from '../../../../graphql/generated/types';

type EntryFilter = 'all' | 'absences' | 'availability' | 'schedule';

/**
 * Pagina "Assenze e disponibilità" (menu principale, accanto a Statistiche).
 *
 * Tre facce della stessa entità (AvailabilityException), distinte solo da
 * exceptionType:
 *
 *   ASSENZA        toglie ore
 *   DISPONIBILITÀ  aggiunge ore all'orario abituale
 *   CAMBIO ORARIO  sostituisce l'orario del giorno
 *
 * Stessa lista, stessi gruppi, stesso endpoint di cancellazione — ma effetto
 * diverso sui conflitti:
 *
 *  - cancellare un'assenza RIPRISTINA i conflitti che aveva generato;
 *  - cancellare una disponibilità CREA conflitti sugli appuntamenti che la
 *    segreteria ci aveva piazzato e che ora restano scoperti;
 *  - cancellare un cambio orario fa ENTRAMBE le cose.
 *
 * Il dispatch sta nel backend: qui si chiede solo l'anteprima dell'impatto
 * per scriverlo nella conferma. I conflitti si gestiscono in pagina Conflitti.
 */
@Component({
  selector: 'app-absence-management-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>
          <mat-icon>event_note</mat-icon>
          Assenze e disponibilità
        </h1>
        <div class="header-actions">
          <button mat-flat-button color="primary" (click)="openDialog()">
            <mat-icon>add</mat-icon>
            Nuova voce
          </button>
        </div>
      </div>

      <p class="page-hint">
        Assenze, disponibilità straordinarie e cambi orario di operatori e
        medici. Gli appuntamenti impattati vengono marcati come conflitti e si
        gestiscono dalla pagina <strong>Conflitti</strong> (spostamento su altro
        operatore/orario). Per gli istruttori palestra usare le eccezioni in
        <strong>Configurazioni palestra</strong> (con sostituto).
      </p>

      <!-- Filtri -->
      <div class="filters">
        <mat-button-toggle-group
          [(ngModel)]="entryFilter"
          (change)="applyFilter()"
          class="entry-filter"
        >
          <mat-button-toggle value="all">Tutte</mat-button-toggle>
          <mat-button-toggle value="absences">Assenze</mat-button-toggle>
          <mat-button-toggle value="availability">Disponibilità</mat-button-toggle>
          <mat-button-toggle value="schedule">Cambi orario</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field appearance="outline">
          <mat-label>Operatore</mat-label>
          <mat-select [(ngModel)]="filterOperatorId" (selectionChange)="load()">
            <mat-option [value]="null">Tutti</mat-option>
            <mat-option *ngFor="let op of operators" [value]="op.id">
              {{ op.name }} {{ op.surname }}
            </mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Dal</mat-label>
          <input matInput [matDatepicker]="pFrom" [(ngModel)]="filterFrom" (ngModelChange)="load()" />
          <mat-datepicker-toggle matSuffix [for]="pFrom"></mat-datepicker-toggle>
          <mat-datepicker #pFrom></mat-datepicker>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Al</mat-label>
          <input matInput [matDatepicker]="pTo" [(ngModel)]="filterTo" (ngModelChange)="load()" />
          <mat-datepicker-toggle matSuffix [for]="pTo"></mat-datepicker-toggle>
          <mat-datepicker #pTo></mat-datepicker>
        </mat-form-field>
      </div>

      <div *ngIf="loading" class="loading-inline">
        <mat-spinner diameter="24"></mat-spinner>
        Caricamento...
      </div>

      <p *ngIf="!loading && visibleEntries.length === 0" class="empty-hint">
        Nessuna voce nel periodo selezionato.
      </p>

      <table
        mat-table
        [dataSource]="visibleEntries"
        class="mat-elevation-z1 absence-table"
        *ngIf="!loading && visibleEntries.length > 0"
      >
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Data</th>
          <td mat-cell *matCellDef="let a">{{ formatDate(a.exceptionDate) }}</td>
        </ng-container>

        <ng-container matColumnDef="operator">
          <th mat-header-cell *matHeaderCellDef>Operatore</th>
          <td mat-cell *matCellDef="let a">
            {{ a.operator?.name }} {{ a.operator?.surname }}
          </td>
        </ng-container>

        <ng-container matColumnDef="window">
          <th mat-header-cell *matHeaderCellDef>Fascia</th>
          <td mat-cell *matCellDef="let a">
            <ng-container *ngIf="a.startTime && a.endTime">
              {{ shortTime(a.startTime) }}–{{ shortTime(a.endTime) }}
            </ng-container>
            <ng-container *ngIf="!a.startTime || !a.endTime">Giornata intera</ng-container>
          </td>
        </ng-container>

        <ng-container matColumnDef="type">
          <th mat-header-cell *matHeaderCellDef>Tipo</th>
          <td mat-cell *matCellDef="let a">
            <span class="type-badge" [ngClass]="'badge-' + kindOf(a)">
              <mat-icon>{{ badgeIcon(a) }}</mat-icon>
              {{ a.absenceTypeSnapshot?.name || typeLabel(a.exceptionType) }}
            </span>
          </td>
        </ng-container>

        <ng-container matColumnDef="reason">
          <th mat-header-cell *matHeaderCellDef>Motivo</th>
          <td mat-cell *matCellDef="let a">{{ a.reason || '—' }}</td>
        </ng-container>

        <ng-container matColumnDef="group">
          <th mat-header-cell *matHeaderCellDef>Gruppo</th>
          <td mat-cell *matCellDef="let a">
            <mat-icon
              *ngIf="a.sourceGroupId"
              class="group-icon"
              [matTooltip]="'Creata in blocco (' + groupSize(a.sourceGroupId) + ' voci)'"
            >link</mat-icon>
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef class="actions-col">Azioni</th>
          <td mat-cell *matCellDef="let a" class="actions-col">
            <button
              mat-icon-button
              color="warn"
              [matTooltip]="deleteTooltip(a)"
              (click)="deleteOne(a)"
            >
              <mat-icon>delete</mat-icon>
            </button>
            <button
              *ngIf="a.sourceGroupId && groupSize(a.sourceGroupId) > 1"
              mat-icon-button
              color="warn"
              matTooltip="Elimina TUTTO il gruppo ({{ groupSize(a.sourceGroupId) }} voci)"
              (click)="deleteGroup(a)"
            >
              <mat-icon>delete_sweep</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    </div>
  `,
  styles: [
    `
      .page {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        gap: 16px;
        flex-wrap: wrap;
      }
      .page-header h1 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
        font-size: 24px;
      }
      .header-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .page-hint {
        color: rgba(0, 0, 0, 0.6);
        margin: 0 0 16px;
        font-size: 13px;
      }
      .filters {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        align-items: center;
      }
      .filters mat-form-field {
        min-width: 200px;
      }
      .entry-filter {
        height: 40px;
      }
      .loading-inline {
        display: flex;
        align-items: center;
        gap: 10px;
        color: rgba(0, 0, 0, 0.54);
        padding: 16px 0;
      }
      .empty-hint {
        padding: 24px;
        background: #fafafa;
        border-radius: 4px;
        color: rgba(0, 0, 0, 0.54);
      }
      .absence-table {
        width: 100%;
      }
      .actions-col {
        width: 120px;
        text-align: right;
      }
      .group-icon {
        color: #607d8b;
        font-size: 20px;
      }
      .type-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 10px 2px 6px;
        border-radius: 12px;
        background: #ffebee;
        color: #b71c1c;
        font-size: 12px;
        white-space: nowrap;
      }
      .type-badge.badge-availability {
        background: #e8f5e9;
        color: #1b5e20;
      }
      .type-badge.badge-schedule {
        background: #e3f2fd;
        color: #0d47a1;
      }
      .type-badge mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    `,
  ],
})
export class AbsenceManagementContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private absenceService = inject(AbsenceManagementService);
  private operatorService = inject(OperatorService);
  private sseService = inject(SseService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private ngZone = inject(NgZone);

  columns = ['date', 'operator', 'window', 'type', 'reason', 'group', 'actions'];

  operators: Operator[] = [];
  /** Tutte le voci del periodo, prima del filtro assenze/disponibilità. */
  entries: OperatorAbsence[] = [];
  visibleEntries: OperatorAbsence[] = [];
  loading = false;

  entryFilter: EntryFilter = 'all';
  filterOperatorId: string | null = null;
  filterFrom: Date = new Date();
  filterTo: Date = this.addDays(new Date(), 90);

  private groupCounts = new Map<string, number>();

  ngOnInit(): void {
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

    // Realtime: assenze e disponibilità inserite da un altro utente (o dal
    // calendario) devono comparire senza ricaricare la pagina. Il backend
    // emette availability_changed su OGNI mutation del modulo availability.
    this.sseService
      .getAppointmentEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => {
          if (event.type === 'availability_changed' || event.type === 'stream_connected') {
            this.ngZone.run(() => this.load());
          }
        },
      });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    if (!this.filterFrom || !this.filterTo) return;
    this.loading = true;
    this.absenceService
      .list({
        operatorId: this.filterOperatorId || undefined,
        startDate: this.toIso(this.filterFrom),
        endDate: this.toIso(this.filterTo),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (entries) =>
          this.ngZone.run(() => {
            // Nasconde le eccezioni degli istruttori palestra (hanno la
            // loro gestione in Configurazioni palestra).
            this.entries = entries.filter(
              (a) => a.operator?.macroCategory !== OperatorMacroCategory.GymInstructor,
            );
            this.groupCounts.clear();
            for (const a of this.entries) {
              if (a.sourceGroupId) {
                this.groupCounts.set(
                  a.sourceGroupId,
                  (this.groupCounts.get(a.sourceGroupId) || 0) + 1,
                );
              }
            }
            this.applyFilter();
            this.loading = false;
          }),
        error: (err) =>
          this.ngZone.run(() => {
            console.error('Errore caricamento assenze/disponibilità:', err);
            this.loading = false;
            this.snackBar.open('Errore nel caricamento', 'Chiudi', { duration: 4000 });
          }),
      });
  }

  applyFilter(): void {
    const wanted: Record<string, 'absence' | 'availability' | 'schedule'> = {
      absences: 'absence',
      availability: 'availability',
      schedule: 'schedule',
    };
    const kind = wanted[this.entryFilter];
    this.visibleEntries = kind
      ? this.entries.filter((a) => this.kindOf(a) === kind)
      : this.entries;
  }

  /** Categoria della voce: guida badge, filtro e testi di conferma. */
  kindOf(entry: OperatorAbsence): 'absence' | 'availability' | 'schedule' {
    if (entry.exceptionType === EXTRA_AVAILABILITY_TYPE) return 'availability';
    if (entry.exceptionType === SCHEDULE_CHANGE_TYPE) return 'schedule';
    return 'absence';
  }

  isAvailability(entry: OperatorAbsence): boolean {
    return this.kindOf(entry) === 'availability';
  }

  badgeIcon(entry: OperatorAbsence): string {
    return {
      absence: 'event_busy',
      availability: 'event_available',
      schedule: 'schedule',
    }[this.kindOf(entry)];
  }

  /**
   * Cosa succede eliminando questa voce. Tre effetti diversi, e vale la pena
   * dirlo prima del click: il cambio orario li fa entrambi.
   */
  deleteTooltip(entry: OperatorAbsence): string {
    switch (this.kindOf(entry)) {
      case 'availability':
        return 'Elimina questa disponibilità (gli appuntamenti scoperti finiscono in Conflitti)';
      case 'schedule':
        return "Elimina questo cambio orario: torna l'orario abituale, gli appuntamenti fuori da quello finiscono in Conflitti";
      default:
        return 'Elimina questa assenza (ripristina i conflitti)';
    }
  }

  openDialog(): void {
    const ref = this.dialog.open(ExceptionDialogContainerComponent, {
      width: '780px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      disableClose: true,
    });
    ref.afterClosed().subscribe((result: ExceptionDialogResult | false | undefined) => {
      if (!result) return;
      this.snackBar.open(this.creationMessage(result), 'Chiudi', { duration: 7000 });
      this.load();
    });
  }

  /**
   * Riepilogo del salvataggio. Gli effetti collaterali vanno detti subito,
   * non lasciati scoprire dopo: giorni scartati, conflitti generati,
   * disponibilità soppiantate da un'assenza.
   */
  private creationMessage(result: ExceptionDialogResult): string {
    const what = {
      absence: 'Assenza creata',
      availability: 'Disponibilità creata',
      schedule: 'Cambio orario applicato',
    }[result.mode];

    const notes: string[] = [];
    if (result.skippedCount > 0) {
      notes.push(`${result.skippedCount} giorni non applicati`);
    }
    if (result.conflictCount > 0) {
      notes.push(`${result.conflictCount} appuntamenti in Conflitti`);
    }
    if (result.removedAvailabilityCount > 0) {
      notes.push(`${result.removedAvailabilityCount} disponibilità rimosse`);
    }
    return notes.length > 0 ? `${what} — ${notes.join(', ')}` : what;
  }

  /**
   * Cancellazione singola. Per disponibilità e cambi orario chiede prima al
   * backend quali appuntamenti resterebbero scoperti, così la conferma dice
   * quanti pazienti sono coinvolti invece di una formula generica.
   */
  deleteOne(entry: OperatorAbsence): void {
    const who = `${entry.operator?.name ?? ''} ${entry.operator?.surname ?? ''}`.trim();
    const when = this.formatDate(entry.exceptionDate);
    const kind = this.kindOf(entry);

    if (kind === 'absence') {
      if (
        !confirm(
          `Eliminare l'assenza di ${who} del ${when}?\nI conflitti generati verranno ripristinati.`,
        )
      ) {
        return;
      }
      this.runDelete(entry.id);
      return;
    }

    const label = kind === 'availability' ? 'la disponibilità' : 'il cambio orario';
    this.absenceService
      .previewAvailabilityRemoval([entry.id])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (impacted) =>
          this.ngZone.run(() => {
            if (!confirm(`Eliminare ${label} di ${who} del ${when}?${this.warn(impacted.length)}`)) {
              return;
            }
            this.runDelete(entry.id, impacted.length);
          }),
        error: () => this.ngZone.run(() => this.impactError()),
      });
  }

  /** Avviso sugli appuntamenti che resterebbero scoperti. */
  private warn(count: number): string {
    if (count === 0) return '';
    return `\n\nATTENZIONE: ${count} appuntament${count === 1 ? 'o' : 'i'} rimarrà scoperto e verrà segnalato nella pagina Conflitti.`;
  }

  private impactError(): void {
    this.snackBar.open('Errore nel calcolo degli impatti', 'Chiudi', { duration: 4000 });
  }

  private runDelete(id: string, conflictCount = 0): void {
    this.absenceService
      .deleteAbsence(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () =>
          this.ngZone.run(() => {
            if (conflictCount > 0) {
              this.snackBar.open(
                `${conflictCount} appuntamenti segnalati nella pagina Conflitti`,
                'Chiudi',
                { duration: 5000 },
              );
            }
            this.load();
          }),
        error: () =>
          this.ngZone.run(() =>
            this.snackBar.open('Errore nella cancellazione', 'Chiudi', { duration: 4000 }),
          ),
      });
  }

  /**
   * Cancellazione di un intero gruppo creato in blocco. Un solo endpoint per
   * tutti i tipi: è il backend a sapere quale effetto applicare ai conflitti
   * (ripristino, nuovi conflitti, o entrambi per il cambio orario).
   */
  deleteGroup(entry: OperatorAbsence): void {
    const sourceGroupId = entry.sourceGroupId;
    if (!sourceGroupId) return;
    const count = this.groupSize(sourceGroupId);
    const what = {
      absence: 'assenze',
      availability: 'disponibilità',
      schedule: 'cambi orario',
    }[this.kindOf(entry)];

    this.absenceService
      .previewGroupRemoval(sourceGroupId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (impacted) =>
          this.ngZone.run(() => {
            if (
              !confirm(
                `Eliminare TUTTO il gruppo di ${what} (${count} voci)?${this.warn(impacted.length)}`,
              )
            ) {
              return;
            }
            this.absenceService
              .deleteExceptionGroup(sourceGroupId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (result) =>
                  this.ngZone.run(() => {
                    const suffix =
                      result.conflictCount > 0
                        ? ` — ${result.conflictCount} appuntamenti in Conflitti`
                        : '';
                    this.snackBar.open(
                      `Eliminate ${result.deleted} voci${suffix}`,
                      'Chiudi',
                      { duration: 5000 },
                    );
                    this.load();
                  }),
                error: () =>
                  this.ngZone.run(() =>
                    this.snackBar.open('Errore nella cancellazione del gruppo', 'Chiudi', {
                      duration: 4000,
                    }),
                  ),
              });
          }),
        error: () => this.ngZone.run(() => this.impactError()),
      });
  }

  groupSize(sourceGroupId: string): number {
    return this.groupCounts.get(sourceGroupId) || 0;
  }

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      SICK: 'Malattia',
      VACATION: 'Ferie',
      HOLIDAY: 'Festività',
      PERSONAL_LEAVE: 'Permesso',
      UNAVAILABLE: 'Non disponibile',
      MODIFIED: 'Cambio orario',
      EXTRA: 'Disponibilità',
    };
    return labels[type] || type;
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

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
}
