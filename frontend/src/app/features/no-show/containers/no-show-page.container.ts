import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { OperatorService } from '../../../services/operator.service';
import { NoShowService } from '../services/no-show.service';
import {
  DEFAULT_EVENT_TYPES,
  NoShowEvent,
  NoShowFilter,
  NoShowPatientGroup,
  NoShowSummary,
} from '../models/no-show.model';
import {
  NoShowFiltersComponent,
  OperatorOption,
} from '../components/no-show-filters/no-show-filters.component';
import { NoShowKpiComponent } from '../components/no-show-kpi/no-show-kpi.component';
import { NoShowTreeComponent } from '../components/no-show-tree/no-show-tree.component';
import { NoShowListComponent } from '../components/no-show-list/no-show-list.component';
import {
  NoShowReviewDialogComponent,
  NoShowReviewDialogResult,
} from '../components/no-show-review-dialog/no-show-review-dialog.component';

type ViewMode = 'tree' | 'list';

const PAGE_SIZE = 100;

/**
 * Statistiche → No Show: gestione delle assenze ingiustificate.
 *
 * Container (smart): tiene il filtro, chiama il servizio e passa i dati ai
 * componenti dumb. Nessun GraphQL qui dentro.
 *
 * Copre sia gli appuntamenti di studio (medici/fisioterapisti) sia quelli
 * di palestra (istruttori): vivono nella stessa tabella e si distinguono
 * per `appointmentType`, quindi il filtro d'ambito è una scelta dell'utente
 * e non due pagine separate.
 */
@Component({
  selector: 'app-no-show-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    NoShowFiltersComponent,
    NoShowKpiComponent,
    NoShowTreeComponent,
    NoShowListComponent,
  ],
  template: `
    <div class="page">
      <header class="page-header">
        <h1><mat-icon>person_off</mat-icon> No Show — assenze ingiustificate</h1>

        <div class="view-switch">
          <button
            mat-button
            [class.active]="viewMode === 'tree'"
            (click)="setViewMode('tree')">
            <mat-icon>account_tree</mat-icon> Per paziente
          </button>
          <button
            mat-button
            [class.active]="viewMode === 'list'"
            (click)="setViewMode('list')">
            <mat-icon>list</mat-icon> Cronologico
          </button>
        </div>
      </header>

      <app-no-show-kpi [summary]="summary" />

      <app-no-show-filters
        [filter]="filter"
        [operators]="operators"
        (filterChange)="onFilterChange($event)" />

      @if (error) {
        <div class="error-banner">{{ error }}</div>
      }

      @if (loading) {
        <div class="state-msg">Caricamento…</div>
      } @else if (viewMode === 'tree') {
        <app-no-show-tree
          [groups]="groups"
          [summary]="summary"
          (reviewClick)="openReview($event)" />

        @if (groups.length && groups.length < totalPatients) {
          <div class="more">
            <span>{{ groups.length }} di {{ totalPatients }} pazienti</span>
            <button mat-stroked-button (click)="loadMorePatients()">
              <mat-icon>expand_more</mat-icon> Carica altri
            </button>
          </div>
        }
      } @else {
        <app-no-show-list
          [events]="events"
          [total]="totalEvents"
          (reviewClick)="openReview($event)"
          (loadMore)="loadMoreEvents()" />
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .page { padding: 20px 24px 40px; }
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .page-header h1 {
      display: flex; align-items: center; gap: 8px;
      margin: 0; font-size: 20px; font-weight: 500;
    }
    .view-switch { display: flex; gap: 4px; }
    .view-switch button { min-width: 0; border: 1px solid transparent; font-size: 13px; }
    .view-switch button.active { background: #e8eaf6; color: #3f51b5; border-color: #c5cae9; }
    .view-switch mat-icon { font-size: 17px; width: 17px; height: 17px; margin-right: 4px; }

    .state-msg { padding: 40px; text-align: center; color: rgba(0,0,0,0.5); }
    .error-banner {
      background: #ffebee; color: #c62828; border: 1px solid #ef9a9a;
      border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px;
    }
    .more {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      padding: 14px; font-size: 12.5px; color: rgba(0,0,0,0.55);
    }
  `],
})
export class NoShowPageContainer implements OnInit {
  private readonly noShowService = inject(NoShowService);
  private readonly operatorService = inject(OperatorService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  viewMode: ViewMode = 'tree';
  loading = false;
  error: string | null = null;

  filter: NoShowFilter = NoShowPageContainer.defaultFilter();
  operators: OperatorOption[] = [];

  summary: NoShowSummary | null = null;

  groups: NoShowPatientGroup[] = [];
  totalPatients = 0;

  events: NoShowEvent[] = [];
  totalEvents = 0;

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadOperators(), this.reload()]);
  }

  setViewMode(mode: ViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    void this.reload();
  }

  onFilterChange(filter: NoShowFilter): void {
    this.filter = filter;
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      // Il riepilogo non dipende dalla vista: si ricarica sempre insieme.
      const summaryPromise = firstValueFrom(this.noShowService.summary(this.filter));

      if (this.viewMode === 'tree') {
        const [summary, page] = await Promise.all([
          summaryPromise,
          firstValueFrom(
            this.noShowService.byPatient(this.filter, { limit: PAGE_SIZE, offset: 0 }),
          ),
        ]);
        this.summary = summary;
        this.groups = page.groups;
        this.totalPatients = page.totalPatients;
      } else {
        const [summary, page] = await Promise.all([
          summaryPromise,
          firstValueFrom(
            this.noShowService.events(this.filter, { limit: PAGE_SIZE, offset: 0 }),
          ),
        ]);
        this.summary = summary;
        this.events = page.events;
        this.totalEvents = page.total;
      }
    } catch (err) {
      this.error = NoShowPageContainer.errorMessage(err);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadMorePatients(): Promise<void> {
    try {
      const page = await firstValueFrom(
        this.noShowService.byPatient(this.filter, {
          limit: PAGE_SIZE,
          offset: this.groups.length,
        }),
      );
      this.groups = [...this.groups, ...page.groups];
      this.totalPatients = page.totalPatients;
    } catch (err) {
      this.error = NoShowPageContainer.errorMessage(err);
    } finally {
      this.cdr.markForCheck();
    }
  }

  async loadMoreEvents(): Promise<void> {
    try {
      const page = await firstValueFrom(
        this.noShowService.events(this.filter, {
          limit: PAGE_SIZE,
          offset: this.events.length,
        }),
      );
      this.events = [...this.events, ...page.events];
      this.totalEvents = page.total;
    } catch (err) {
      this.error = NoShowPageContainer.errorMessage(err);
    } finally {
      this.cdr.markForCheck();
    }
  }

  openReview(event: NoShowEvent): void {
    const ref = this.dialog.open<
      NoShowReviewDialogComponent,
      { event: NoShowEvent },
      NoShowReviewDialogResult
    >(NoShowReviewDialogComponent, { data: { event } });

    ref.afterClosed().subscribe(async (result) => {
      if (!result) return;
      try {
        if (result.clear) {
          await firstValueFrom(this.noShowService.deleteReview(event.appointmentId));
        } else {
          await firstValueFrom(
            this.noShowService.upsertReview({
              appointmentId: event.appointmentId,
              decision: result.decision,
              notes: result.notes,
              chargedAmount: result.chargedAmount,
            }),
          );
        }
        // Ricarica: la decisione può far uscire l'evento dai filtri attivi
        // (es. "giustificato" con l'esclusione dei giustificati accesa).
        await this.reload();
      } catch (err) {
        this.error = NoShowPageContainer.errorMessage(err);
        this.cdr.markForCheck();
      }
    });
  }

  private async loadOperators(): Promise<void> {
    try {
      const operators = await firstValueFrom(
        this.operatorService.getOperators(undefined, undefined, true),
      );
      this.operators = (operators ?? []).map((op) => ({
        id: op.id,
        label: [op.name, op.surname].filter(Boolean).join(' ').trim(),
        macroCategory: op.macroCategory,
      }));
    } catch {
      // L'elenco operatori è un filtro accessorio: se non arriva, la
      // pagina funziona lo stesso senza quel menu.
      this.operators = [];
    } finally {
      this.cdr.markForCheck();
    }
  }

  /** Ultimi 12 mesi, solo le assenze che pesano. */
  private static defaultFilter(): NoShowFilter {
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
      types: [...DEFAULT_EVENT_TYPES],
      context: 'ALL',
      excludeJustified: true,
      minEvents: 1,
    };
  }

  private static errorMessage(err: unknown): string {
    const message = (err as { message?: string })?.message;
    return message || 'Errore nel caricamento delle assenze.';
  }
}
