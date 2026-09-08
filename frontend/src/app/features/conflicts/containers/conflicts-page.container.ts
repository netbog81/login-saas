/**
 * Conflicts Page Container
 * Layer 2: Smart Component (orchestratore della pagina /conflicts)
 *
 * Sostituisce il vecchio ConflictDashboardComponent, che teneva tabella,
 * filtri, statistiche e dialog di risoluzione in un unico componente con
 * HTML e CSS scritti a mano. Qui la pagina è solo stato e coordinamento: il
 * rendering sta nei dumb di `components/`, la risoluzione nel dialog
 * condiviso con i due calendari.
 *
 * REALTIME: la pagina si iscrive agli stessi eventi SSE dei calendari.
 * Serviva perché adesso un conflitto si risolve anche dal calendario, e chi
 * ha questa pagina aperta su un altro schermo continuerebbe a vedere righe
 * già chiuse da un collega. Il debounce assorbe le raffiche — una modifica
 * di template ne genera una per appuntamento toccato.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, filter } from 'rxjs/operators';

import { ConflictService, ConflictFilters } from '../services/conflict.service';
import { OperatorService } from '../../../services/operator.service';
import { SseService } from '../../../services/sse.service';
import {
  ConflictStatsComponent,
  ConflictStatsView,
} from '../components/conflict-stats/conflict-stats.component';
import {
  ConflictFiltersComponent,
  ConflictFilterOperator,
  ConflictFilterValues,
} from '../components/conflict-filters/conflict-filters.component';
import {
  ConflictTableComponent,
  ConflictRowAction,
} from '../components/conflict-table/conflict-table.component';
import {
  ConflictedAppointment,
  ConflictResolutionAction,
  ConflictResolutionResult,
} from '../models/conflict.model';
import { AvailabilityAppointment, Operator } from '../../../graphql/generated/types';

/** Eventi SSE che possono aver cambiato l'elenco conflitti. */
const CONFLICT_RELEVANT_EVENTS = [
  'appointment_changed',
  'appointment_status_changed',
  'availability_changed',
];

@Component({
  selector: 'app-conflicts-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    ConflictStatsComponent,
    ConflictFiltersComponent,
    ConflictTableComponent,
  ],
  template: `
    <div class="conflicts-page">
      <header class="page-header">
        <div class="header-text">
          <h1>Conflitti di disponibilità</h1>
          <p class="subtitle">
            Appuntamenti finiti fuori dalla disponibilità dopo essere stati
            prenotati. Restano dove sono finché non decidi tu.
          </p>
        </div>
      </header>

      <app-conflict-stats [stats]="stats"></app-conflict-stats>

      <mat-card appearance="outlined" class="filters-card">
        <app-conflict-filters
          [operators]="filterOperators"
          [loading]="loading"
          (apply)="onApplyFilters($event)"
          (clear)="onClearFilters()"
          (refresh)="loadConflicts()">
        </app-conflict-filters>
      </mat-card>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <div class="error-banner" *ngIf="error">
        <mat-icon color="warn">error</mat-icon>
        <span>{{ error }}</span>
        <button mat-icon-button type="button" (click)="error = null" aria-label="Chiudi">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Azioni multiple: compaiono solo con una selezione attiva -->
      <div class="batch-bar" *ngIf="selectedIds.size > 0">
        <span class="batch-count">{{ selectedIds.size }} selezionati</span>
        <span class="spacer"></span>
        <button mat-flat-button color="primary" type="button"
                [disabled]="loading" (click)="resolveSelected(Actions.Keep)">
          <mat-icon>check</mat-icon>
          Accetta selezionati
        </button>
        <button mat-stroked-button color="warn" type="button"
                [disabled]="loading" (click)="resolveSelected(Actions.Cancel)">
          <mat-icon>event_busy</mat-icon>
          Cancella selezionati
        </button>
      </div>

      @if (!loading && conflicts.length === 0) {
        <mat-card appearance="outlined" class="empty-state">
          <mat-icon class="empty-icon">check_circle</mat-icon>
          <h3>Nessun conflitto</h3>
          <p>Non ci sono appuntamenti in conflitto con i criteri selezionati.</p>
        </mat-card>
      } @else {
        <app-conflict-table
          [conflicts]="conflicts"
          [selectedIds]="selectedIds"
          (toggleOne)="onToggleOne($event)"
          (toggleAll)="onToggleAll()"
          (action)="onRowAction($event)">
        </app-conflict-table>
      }
    </div>
  `,
  styles: [`
    .conflicts-page {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: #0f172a;
    }

    .subtitle {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 0.875rem;
      max-width: 62ch;
    }

    .filters-card { padding: 14px 16px; }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      background: #fef2f2;
      color: #b91c1c;
    }

    .error-banner span { flex: 1 1 auto; }

    .batch-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
    }

    .batch-count { font-weight: 600; color: #1e40af; }
    .spacer { flex: 1 1 auto; }

    .batch-bar mat-icon {
      font-size: 18px; width: 18px; height: 18px;
      margin-right: 4px; vertical-align: middle;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px 20px;
      text-align: center;
      color: #64748b;
    }

    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #16a34a;
    }

    .empty-state h3 { margin: 0; color: #0f172a; }
    .empty-state p { margin: 0; }

    @media (max-width: 599px) {
      .conflicts-page { padding: 12px; }
      .batch-bar button { flex: 1 1 auto; }
      .spacer { display: none; }
    }
  `],
})
export class ConflictsPageContainer implements OnInit, OnDestroy {
  private readonly conflictService = inject(ConflictService);
  private readonly operatorService = inject(OperatorService);
  private readonly sseService = inject(SseService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly destroy$ = new Subject<void>();

  readonly Actions = ConflictResolutionAction;

  conflicts: ConflictedAppointment[] = [];
  stats: ConflictStatsView | null = null;
  filterOperators: ConflictFilterOperator[] = [];
  selectedIds = new Set<string>();

  loading = false;
  error: string | null = null;

  private filters: ConflictFilters = {};
  /** Operatori grezzi: servono al dialog di spostamento, non solo al filtro. */
  private operators: Operator[] = [];

  ngOnInit(): void {
    this.loadOperators();
    this.loadConflicts();
    this.listenToRealtimeUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== CARICAMENTO ====================

  private loadOperators(): void {
    this.operatorService
      .getOperators(undefined, undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operators) => {
          this.operators = operators;
          this.filterOperators = operators.map((o) => ({
            id: o.id,
            label: `${o.name} ${o.surname || ''}`.trim(),
          }));
          this.cdr.markForCheck();
        },
        error: () => {
          // Il filtro operatore resta vuoto: l'elenco conflitti funziona lo stesso.
        },
      });
  }

  /**
   * Carica l'elenco e, SOLO DOPO, le statistiche.
   *
   * Non in parallelo: la query dell'elenco esegue lato backend anche la
   * revalidazione (toglie i flag non più reali e marca quelli mai rilevati).
   * Chieste insieme, le statistiche verrebbero calcolate su uno stato che
   * l'elenco sta ancora cambiando, e i contatori resterebbero indietro di un
   * giro.
   */
  loadConflicts(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.conflictService
      .getConflictedAppointments(this.filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.conflicts = list.map((a) => this.toConflicted(a));
          this.pruneSelection();
          this.loading = false;
          this.cdr.markForCheck();
          this.loadStats();
        },
        error: (err) => {
          this.error =
            'Errore nel caricamento dei conflitti' +
            (err?.message ? `: ${err.message}` : '.');
          this.loading = false;
          this.cdr.markForCheck();
          this.loadStats();
        },
      });
  }

  private loadStats(): void {
    this.conflictService
      .getConflictStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = {
            totalConflicts: stats.totalConflicts,
            byReason: (stats.byReason as Record<string, number>) ?? {},
          };
          this.cdr.markForCheck();
        },
        error: () => {
          // I contatori restano quelli precedenti: meglio di azzerarli a schermo.
        },
      });
  }

  /**
   * Ricarica quando qualcun altro tocca appuntamenti o disponibilità.
   *
   * Il debounce non è cosmetico: cambiare il template di un operatore emette
   * un evento per mutation, e senza attesa la pagina rifarebbe la
   * revalidazione completa una volta per evento.
   */
  private listenToRealtimeUpdates(): void {
    this.sseService
      .getEvents()
      .pipe(
        filter((e) => CONFLICT_RELEVANT_EVENTS.includes(e.type)),
        debounceTime(1200),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        // Se un caricamento è già in volo, quello in corso porterà i dati
        // freschi: accodarne un altro raddoppierebbe solo la revalidazione.
        if (this.loading) return;
        this.ngZone.run(() => this.loadConflicts());
      });
  }

  // ==================== FILTRI E SELEZIONE ====================

  onApplyFilters(values: ConflictFilterValues): void {
    this.filters = {
      operatorId: values.operatorId,
      dateFrom: values.dateFrom,
      dateTo: values.dateTo,
      conflictReason: values.conflictReason,
    };
    this.loadConflicts();
  }

  onClearFilters(): void {
    this.filters = {};
    this.loadConflicts();
  }

  onToggleOne(c: ConflictedAppointment): void {
    if (this.selectedIds.has(c.id)) this.selectedIds.delete(c.id);
    else this.selectedIds.add(c.id);
    // Set mutato in place: con OnPush il figlio non se ne accorgerebbe.
    this.selectedIds = new Set(this.selectedIds);
    this.cdr.markForCheck();
  }

  onToggleAll(): void {
    this.selectedIds =
      this.selectedIds.size === this.conflicts.length
        ? new Set<string>()
        : new Set(this.conflicts.map((c) => c.id));
    this.cdr.markForCheck();
  }

  /** Toglie dalla selezione le righe sparite dopo un ricaricamento. */
  private pruneSelection(): void {
    if (this.selectedIds.size === 0) return;
    const alive = new Set(this.conflicts.map((c) => c.id));
    this.selectedIds = new Set([...this.selectedIds].filter((id) => alive.has(id)));
  }

  // ==================== AZIONI ====================

  onRowAction(action: ConflictRowAction): void {
    switch (action.type) {
      case 'move':
        this.openGuidedMove(action.conflict);
        break;
      case 'resolve':
      case 'open':
        this.openResolveDialog(action.conflict);
        break;
    }
  }

  private async openResolveDialog(conflict: ConflictedAppointment): Promise<void> {
    const m = await import('./conflict-resolve-dialog.container');
    const ref = this.dialog.open(m.ConflictResolveDialogContainer, {
      autoFocus: false,
      data: {
        appointment: conflict,
        origin: 'dashboard',
        // Senza paziente collegato il dialog Appuntamenti non ha su cosa
        // aprirsi: resta la riprogrammazione manuale.
        canMove: !!conflict.patientId,
      },
    });

    ref.afterClosed().pipe(takeUntil(this.destroy$))
      .subscribe((res: ConflictResolutionResult | undefined) => {
        if (!res) return;
        if (res.outcome === 'move') {
          this.openGuidedMove(conflict);
          return;
        }
        if (res.outcome === 'resolved') this.loadConflicts();
      });
  }

  /**
   * Spostamento guidato: apre il dialog Appuntamenti (lo stesso del
   * calendario) già puntato sul paziente e sull'appuntamento in conflitto,
   * con la ricerca di slot liberi e la possibilità di riassegnare.
   */
  private openGuidedMove(conflict: ConflictedAppointment): void {
    if (!conflict.patientId) {
      this.error =
        'Appuntamento senza paziente collegato: usa "Risolvi" per riprogrammarlo a mano.';
      this.cdr.markForCheck();
      return;
    }

    import('../../calendar-v3/containers/appuntamenti-dialog.container').then((m) => {
      const ref = this.dialog.open(m.AppuntamentiDialogContainer, {
        width: '1150px',
        maxWidth: '97vw',
        height: '82vh',
        maxHeight: '92vh',
        hasBackdrop: false,
        panelClass: 'appuntamenti-dialog-pane',
        disableClose: false,
        autoFocus: false,
        data: {
          operators: this.operators.map((o) => ({
            id: o.id,
            name: `${o.name} ${o.surname || ''}`.trim(),
            macroCategory: o.macroCategory ?? '',
          })),
          initialPatientId: conflict.patientId,
          initialAppointmentId: conflict.id,
        },
      });
      ref.afterClosed().pipe(takeUntil(this.destroy$))
        .subscribe(() => this.ngZone.run(() => this.loadConflicts()));
    });
  }

  resolveSelected(action: ConflictResolutionAction.Keep | ConflictResolutionAction.Cancel): void {
    if (this.selectedIds.size === 0) return;

    const ids = Array.from(this.selectedIds);
    const verb = action === ConflictResolutionAction.Keep ? 'accettare' : 'cancellare';
    if (!confirm(`Vuoi ${verb} ${ids.length} appuntamenti in conflitto?`)) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.conflictService
      .resolveMultipleConflicts(ids, action)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.selectedIds = new Set<string>();
          this.snackBar.open(`${ids.length} conflitti risolti.`, 'OK', { duration: 3000 });
          this.loadConflicts();
        },
        error: (err) => {
          this.loading = false;
          this.error =
            'Errore nella risoluzione dei conflitti' +
            (err?.message ? `: ${err.message}` : '.');
          this.cdr.markForCheck();
        },
      });
  }

  // ==================== MAPPING ====================

  /**
   * Da AvailabilityAppointment (GraphQL) alla forma piatta che i dumb e il
   * dialog si aspettano.
   *
   * APPROACH: GraphQL Fragments — operator e service arrivano già popolati
   * dalla query, quindi qui si estraggono soltanto i campi che servono a
   * schermo, senza chiamate aggiuntive.
   */
  private toConflicted(a: AvailabilityAppointment): ConflictedAppointment {
    return {
      id: a.id,
      appointmentDate: a.appointmentDate,
      startTime: a.startTime,
      endTime: a.endTime,
      clientName: a.clientName,
      clientPhone: a.clientPhone,
      patientId: a.patientId ? String(a.patientId) : null,
      operatorId: a.operator?.id ?? null,
      operatorName: a.operator
        ? `${a.operator.name} ${a.operator.surname || ''}`.trim()
        : null,
      operatorColor: a.operator?.color ?? null,
      serviceName: a.service?.name ?? null,
      conflictReason: a.conflictReason,
      conflictDetectedAt: a.conflictDetectedAt,
    };
  }
}
