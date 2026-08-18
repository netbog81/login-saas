import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { Room } from '../../../services/room.service';
import { RoomsViewDataService } from '../services/rooms-view-data.service';
import {
  RoomDayOccupancy,
  RoomViewAppointment,
  RoomsViewPeriod,
  LegendOperator,
  operatorColorFor,
} from '../models/rooms-view.model';
import { RoomsGridComponent } from '../components/rooms-grid/rooms-grid.component';
import { RoomsSidebarComponent } from '../components/rooms-sidebar/rooms-sidebar.component';

/**
 * Container (Layer 2 — smart) della vista calendario "Studi".
 *
 * Riceve dal calendario le date visibili e la configurazione (vista
 * giornaliera/settimanale, compatta/espansa, zoom); carica sempre 4 settimane
 * di occupazione dal lunedì corrente e decide cosa mostrare:
 *  - giornaliera → il solo giorno corrente;
 *  - settimanale → N settimane impilate (auto = ciclo max dei template,
 *    oppure forzate dal selettore nel pannello laterale).
 * Gestisce lo stato UI (studi abilitati, periodo, loading) e passa dati puri
 * ai dumb components (griglia e pannello).
 */
@Component({
  selector: 'app-rooms-view-container',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    RoomsGridComponent,
    RoomsSidebarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rooms-view">
      <app-rooms-sidebar
        [rooms]="rooms"
        [selectedIds]="selectedIds"
        [period]="period"
        [autoWeeks]="autoWeeks"
        [showPeriod]="viewType === 'weekly'"
        [legendOperators]="legendOperators"
        (toggleRoom)="onToggleRoom($event)"
        (setAll)="onSetAll($event)"
        (periodChange)="onPeriodChange($event)">
      </app-rooms-sidebar>

      <div class="rooms-main">
        @if (loading) {
          <div class="loading-overlay">
            <mat-spinner diameter="40"></mat-spinner>
          </div>
        }
        <app-rooms-grid
          [rooms]="visibleRooms"
          [dates]="displayDates"
          [occupancy]="occupancy"
          [appointments]="appointments"
          [zoom]="zoom"
          [compact]="compactMode"
          [showWeekend]="showWeekend"
          [showWorkingHoursOnly]="showWorkingHoursOnly">
        </app-rooms-grid>
      </div>
    </div>
  `,
  styles: [`
    // Vive dentro .calendar-v3-main: riempie tutta l'altezza disponibile
    :host { display: flex; height: 100%; min-width: 0; }

    .rooms-view {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    app-rooms-sidebar { height: 100%; }

    .rooms-main {
      flex: 1;
      min-width: 0;
      position: relative;
      overflow: hidden;
      padding: 12px;
      display: flex;
      flex-direction: column;
    }

    .loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20;
    }
  `],
})
export class RoomsViewContainer implements OnChanges, OnDestroy {
  /** Date visibili del calendario (la prima determina giorno/settimana). */
  @Input() dates: string[] = [];
  @Input() viewType: 'daily' | 'weekly' = 'weekly';
  @Input() compactMode = true;
  @Input() zoom = 1;
  /** Mostra sabato e domenica nella vista settimanale (default Studi: OFF). */
  @Input() showWeekend = false;
  /** Limita la finestra oraria all'orario di lavoro (default Studi: ON). */
  @Input() showWorkingHoursOnly = true;

  private destroy$ = new Subject<void>();
  private dataService = inject(RoomsViewDataService);
  private cdr = inject(ChangeDetectorRef);

  rooms: Room[] = [];
  occupancy: RoomDayOccupancy[] = [];
  appointments: RoomViewAppointment[] = [];
  selectedIds = new Set<string>();
  period: RoomsViewPeriod = 'auto';
  autoWeeks = 1;
  loading = false;
  legendOperators: LegendOperator[] = [];

  /** 28 giorni dal lunedì della settimana corrente (sempre caricati tutti). */
  private allDates: string[] = [];
  private loadedRangeKey = '';

  get effectiveWeeks(): number {
    return this.period === 'auto' ? this.autoWeeks : this.period;
  }

  /** Giornaliera: il giorno corrente; settimanale: N settimane dal lunedì. */
  get displayDates(): string[] {
    if (this.viewType === 'daily') {
      return this.dates.length > 0 ? [this.dates[0]] : [];
    }
    return this.allDates.slice(0, this.effectiveWeeks * 7);
  }

  get visibleRooms(): Room[] {
    return this.rooms.filter((r) => this.selectedIds.has(r.id));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dates'] && this.dates.length > 0) {
      this.loadData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private loadData(): void {
    const base = new Date(this.dates[0]);
    const dow = base.getDay(); // 0 = domenica
    base.setDate(base.getDate() + (dow === 0 ? -6 : 1 - dow));

    const all: string[] = [];
    const cursor = new Date(base);
    for (let i = 0; i < 28; i++) {
      all.push(this.formatDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    this.allDates = all;

    // La stessa finestra di 28 giorni non va ricaricata (es. cambio
    // giornaliera/settimanale dentro la stessa settimana).
    const rangeKey = `${all[0]}|${all[all.length - 1]}`;
    if (rangeKey === this.loadedRangeKey) return;
    this.loadedRangeKey = rangeKey;

    this.loading = true;
    this.cdr.markForCheck();

    this.dataService.loadRoomsView(all[0], all[all.length - 1])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ rooms, occupancy, appointments, maxCycleWeeks }) => {
          this.rooms = rooms;
          this.occupancy = occupancy;
          this.appointments = appointments;
          this.autoWeeks = maxCycleWeeks;

          // Legenda operatori: chi occupa studi nel periodo caricato, con lo
          // stesso colore usato da fasce e appuntamenti (colore configurato
          // sull'operatore, fallback palette).
          const named = new Map<string, { name: string; color: string }>();
          occupancy.forEach((o) =>
            o.bands.forEach((b) => {
              if (!named.has(b.operatorId)) {
                named.set(b.operatorId, {
                  name: b.operatorName,
                  color: b.operatorColor || operatorColorFor(b.operatorId),
                });
              }
            }),
          );
          this.legendOperators = Array.from(named, ([id, v]) => ({
            id,
            name: v.name,
            color: v.color,
          })).sort((a, b) => a.name.localeCompare(b.name));

          // Selezione studi: default tutti; preserva le scelte se già fatte
          const valid = new Set(rooms.map((r) => r.id));
          const kept = Array.from(this.selectedIds).filter((id) => valid.has(id));
          this.selectedIds =
            kept.length > 0 ? new Set(kept) : new Set(rooms.map((r) => r.id));

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.loadedRangeKey = '';
          this.cdr.markForCheck();
        },
      });
  }

  onToggleRoom(roomId: string): void {
    const next = new Set(this.selectedIds);
    if (next.has(roomId)) next.delete(roomId); else next.add(roomId);
    this.selectedIds = next;
    this.cdr.markForCheck();
  }

  onSetAll(all: boolean): void {
    this.selectedIds = all
      ? new Set(this.rooms.map((r) => r.id))
      : new Set<string>();
    this.cdr.markForCheck();
  }

  onPeriodChange(period: RoomsViewPeriod): void {
    this.period = period;
    this.cdr.markForCheck();
  }
}
