import {
  Component,
  Input,
  OnChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Room } from '../../../../services/room.service';
import {
  RoomDayOccupancy,
  RoomViewAppointment,
  operatorColorFor,
} from '../../models/rooms-view.model';

/** Blocco posizionato (fascia template, assenza o appuntamento). */
interface RoomBlock {
  topPx: number;
  heightPx: number;
  leftPct: number;
  widthPct: number;
  label: string;
  sub?: string;
  timeLabel: string;
  color: string;
  tooltip: string;
}

/** Colonna di uno studio in un giorno. */
interface RoomColumnVM {
  roomId: string;
  roomName: string;
  roomColor: string;
  bands: RoomBlock[];
  absences: RoomBlock[];
  appointments: RoomBlock[];
}

/** Gruppo giorno: intestazione data + colonne degli studi selezionati. */
interface DayGroupVM {
  date: string;
  label: string;
  columns: RoomColumnVM[];
}

/** Sezione settimanale (in vista settimanale le settimane sono impilate). */
interface WeekVM {
  label: string;
  days: DayGroupVM[];
}

const CANCELLED_STATUSES = new Set([
  'cancelled',
  'cancelled_early',
  'cancelled_late',
  'no_show',
]);

/**
 * Griglia "Studi" (Layer 1 — dumb, OnPush): giorni raggruppati con gli studi
 * selezionati come sotto-colonne, settimane impilate in vista settimanale.
 * Modalità compatta = colonne adattive alla finestra; espansa = larghezza
 * fissa con scorrimento orizzontale (come la griglia operatori).
 * Sfondo = occupazione da template (con eccezioni); tratteggio = liberato da
 * assenza; sopra gli appuntamenti reali (snapshot roomId). Sola lettura.
 */
@Component({
  selector: 'app-rooms-grid',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rooms-grid" [class.compact-grid]="compact" *ngIf="weeks.length > 0; else emptyState">
      <div class="week-section" *ngFor="let week of weeks">
        <div class="week-label" *ngIf="weeks.length > 1">{{ week.label }}</div>

        <div class="week-row">
          <!-- Gutter orario -->
          <div class="time-gutter">
            <div class="gutter-spacer"></div>
            <div class="hour-cell" *ngFor="let h of hours" [style.height.px]="hourHeightPx">
              {{ h }}:00
            </div>
          </div>

          <!-- Giorni: ogni gruppo ha la sua intestazione e le colonne studi -->
          <div class="days-wrap" [class.compact]="compact">
            <div
              class="day-group"
              *ngFor="let day of week.days"
              [class.compact]="compact"
              [style.width.px]="compact ? null : day.columns.length * columnWidthPx"
            >
              <div class="day-header">{{ day.label }}</div>

              <div class="day-columns">
                <div
                  class="room-col"
                  *ngFor="let col of day.columns"
                  [class.compact]="compact"
                  [style.width.px]="compact ? null : columnWidthPx"
                >
                  <div class="room-header" [title]="col.roomName">
                    <span class="room-dot" [style.background]="col.roomColor"></span>
                    <span class="room-name">{{ col.roomName }}</span>
                  </div>

                  <div class="room-body" [style.height.px]="bodyHeightPx">
                    <div class="hour-line" *ngFor="let h of hours; let i = index"
                         [style.top.px]="i * hourHeightPx"></div>

                    <div class="absence-block"
                         *ngFor="let ab of col.absences"
                         [style.top.px]="ab.topPx"
                         [style.height.px]="ab.heightPx"
                         [title]="ab.tooltip">
                      <span class="absence-label">{{ ab.label }}</span>
                    </div>

                    <div class="band-block"
                         *ngFor="let band of col.bands"
                         [style.top.px]="band.topPx"
                         [style.height.px]="band.heightPx"
                         [style.left.%]="band.leftPct"
                         [style.width.%]="band.widthPct"
                         [style.border-left-color]="band.color"
                         [style.--op-color]="band.color"
                         [title]="band.tooltip">
                      <span class="band-label">{{ band.label }}</span>
                      <span class="band-sub" *ngIf="band.sub">{{ band.sub }}</span>
                    </div>

                    <div class="appointment-block"
                         *ngFor="let apt of col.appointments"
                         [style.top.px]="apt.topPx"
                         [style.height.px]="apt.heightPx"
                         [style.left.%]="apt.leftPct"
                         [style.width.%]="apt.widthPct"
                         [style.background]="apt.color"
                         [title]="apt.tooltip">
                      <span class="apt-label">{{ apt.label }}</span>
                      <span class="apt-time">{{ apt.timeLabel }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ng-template #emptyState>
      <div class="rooms-empty">
        <p>Nessuno studio da mostrare.</p>
        <p class="hint">
          Configura gli studi in Configurazioni → Studi e Poltrone, associali
          alle assegnazioni template e abilitali dal pannello laterale.
        </p>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .rooms-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: auto; // scroll orizzontale in modalità espansa, verticale sempre
      max-height: 100%;
      padding-bottom: 8px;
    }

    .week-section {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    // Solo in espansa la riga cresce oltre il contenitore (scroll orizzontale)
    .rooms-grid:not(.compact-grid) .week-section { min-width: fit-content; }

    .week-label {
      position: sticky;
      left: 0;
      padding: 10px 14px 6px;
      font-size: 13px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .week-row { display: flex; width: 100%; }

    .time-gutter {
      width: 52px;
      flex-shrink: 0;
      position: sticky;
      left: 0;
      background: white;
      z-index: 5;

      .gutter-spacer { height: 56px; }

      .hour-cell {
        font-size: 11px;
        color: #94a3b8;
        text-align: right;
        padding-right: 6px;
        box-sizing: border-box;
      }
    }

    .days-wrap {
      display: flex;

      // Compatta: i giorni si dividono lo spazio disponibile (responsivo)
      &.compact { flex: 1; min-width: 0; }
    }

    .day-group {
      display: flex;
      flex-direction: column;
      border-left: 2px solid #cbd5e1;

      &.compact { flex: 1; min-width: 0; }
      &:not(.compact) { flex: 0 0 auto; }

      .day-header {
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        color: #1e293b;
        background: #e2e8f0;
        text-transform: capitalize;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .day-columns { display: flex; flex: 1; min-width: 0; }
    }

    .room-col {
      display: flex;
      flex-direction: column;
      border-left: 1px solid #e2e8f0;
      // La colonna è un container: sotto una certa larghezza le scritte
      // spariscono e resta il colore (nome al mouse-over via title).
      container-type: inline-size;

      &:first-child { border-left: none; }
      &.compact { flex: 1 1 0; min-width: 0; }
      &:not(.compact) { flex: 0 0 auto; }

      .room-header {
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 0 4px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        overflow: hidden;

        .room-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .room-name {
          font-size: 11px;
          font-weight: 700;
          color: #334155;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .room-body {
        position: relative;
        background: #fafbfc;
      }
    }

    .hour-line {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 1px solid #eef2f6;
      pointer-events: none;
    }

    .absence-block {
      position: absolute;
      left: 0;
      right: 0;
      box-sizing: border-box;
      background: repeating-linear-gradient(
        45deg,
        rgba(148, 163, 184, 0.10),
        rgba(148, 163, 184, 0.10) 6px,
        transparent 6px,
        transparent 12px
      );
      border: 1px dashed #cbd5e1;
      border-radius: 4px;
      padding: 2px 4px;
      overflow: hidden;

      .absence-label {
        font-size: 9px;
        font-style: italic;
        color: #94a3b8;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
        display: block;
      }
    }

    .band-block {
      position: absolute;
      box-sizing: border-box;
      background: rgba(74, 144, 226, 0.10);
      border: 1px solid rgba(74, 144, 226, 0.25);
      border-left-width: 3px;
      border-radius: 3px;
      padding: 2px 4px;
      overflow: hidden;

      .band-label {
        display: block;
        font-size: 10px;
        font-weight: 700;
        color: #334155;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      .band-sub {
        display: block;
        font-size: 9px;
        color: #64748b;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }
    }

    .appointment-block {
      position: absolute;
      box-sizing: border-box;
      border-radius: 3px;
      padding: 1px 4px;
      color: white;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);

      .apt-label {
        display: block;
        font-size: 10px;
        font-weight: 700;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      .apt-time { display: block; font-size: 9px; opacity: 0.9; }
    }

    .rooms-empty {
      padding: 60px 20px;
      text-align: center;
      color: #64748b;

      .hint { font-size: 13px; color: #94a3b8; }
    }

    // Colonne strette: via i testi, resta il colore dell'operatore
    // (nome e orari restano leggibili nel tooltip al passaggio del mouse).
    @container (max-width: 64px) {
      .room-header .room-name { display: none; }
      .band-block .band-label,
      .band-block .band-sub { display: none; }
      .appointment-block .apt-label,
      .appointment-block .apt-time { display: none; }
      .absence-block .absence-label { display: none; }

      .band-block {
        background: var(--op-color, rgba(74, 144, 226, 0.35));
        opacity: 0.65;
        border-color: transparent;
      }
    }
  `],
})
export class RoomsGridComponent implements OnChanges {
  @Input() rooms: Room[] = [];
  @Input() dates: string[] = [];
  @Input() occupancy: RoomDayOccupancy[] = [];
  @Input() appointments: RoomViewAppointment[] = [];
  @Input() zoom = 1;
  /** true = colonne adattive alla finestra; false = larghezza fissa + scroll orizzontale */
  @Input() compact = true;
  /** Mostra sabato e domenica nella vista settimanale. */
  @Input() showWeekend = false;
  /** true = finestra oraria limitata all'orario di lavoro; false = 00-24. */
  @Input() showWorkingHoursOnly = true;

  weeks: WeekVM[] = [];
  hours: number[] = [];
  hourHeightPx = 60;
  bodyHeightPx = 0;
  columnWidthPx = 120;

  ngOnChanges(): void {
    this.hourHeightPx = 60 * (this.zoom || 1);
    // Espansa: colonne più larghe in vista giornaliera (come griglia operatori)
    this.columnWidthPx = this.dates.length > 1 ? 120 : 180;

    // Finestra oraria: con "orario lavoro" attivo 07-20 allargata se i dati
    // escono; disattivato, giornata intera 00-24.
    let startHour = 7;
    let endHour = 20;
    if (!this.showWorkingHoursOnly) {
      startHour = 0;
      endHour = 24;
    } else {
      const stretch = (time: string) => {
        const h = parseInt(String(time).split(':')[0], 10);
        if (!isNaN(h)) {
          if (h < startHour) startHour = h;
          if (h + 1 > endHour) endHour = Math.min(h + 1, 24);
        }
      };
      this.occupancy.forEach((o) => {
        o.bands.forEach((b) => { stretch(b.startTime); stretch(b.endTime); });
        (o.absences || []).forEach((b) => { stretch(b.startTime); stretch(b.endTime); });
      });
      this.appointments.forEach((a) => { stretch(a.startTime); stretch(a.endTime); });
    }

    this.hours = [];
    for (let h = startHour; h < endHour; h++) this.hours.push(h);
    this.bodyHeightPx = this.hours.length * this.hourHeightPx;

    const occByKey = new Map<string, RoomDayOccupancy>();
    this.occupancy.forEach((o) => occByKey.set(`${o.roomId}|${o.date}`, o));

    const aptsByKey = new Map<string, RoomViewAppointment[]>();
    this.appointments
      .filter((a) => a.roomId && !CANCELLED_STATUSES.has(String(a.bookingStatus).toLowerCase()))
      .forEach((a) => {
        const key = `${a.roomId}|${String(a.appointmentDate).slice(0, 10)}`;
        if (!aptsByKey.has(key)) aptsByKey.set(key, []);
        aptsByKey.get(key)!.push(a);
      });

    const toMin = (t: string) => {
      const [h, m] = String(t).split(':');
      return parseInt(h, 10) * 60 + parseInt(m || '0', 10);
    };
    const topOf = (t: string) => ((toMin(t) - startHour * 60) / 60) * this.hourHeightPx;
    const heightOf = (s: string, e: string) =>
      Math.max(((toMin(e) - toMin(s)) / 60) * this.hourHeightPx, 14);
    const colorFor = (id: string) => operatorColorFor(id);

    const layoutLanes = (blocks: { start: number; end: number; block: RoomBlock }[]) => {
      const sorted = [...blocks].sort((a, b) => a.start - b.start);
      const laneEnds: number[] = [];
      const laneOf = new Map<RoomBlock, number>();
      for (const item of sorted) {
        let lane = laneEnds.findIndex((end) => end <= item.start);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(item.end);
        } else {
          laneEnds[lane] = item.end;
        }
        laneOf.set(item.block, lane);
      }
      const laneCount = Math.max(laneEnds.length, 1);
      for (const item of sorted) {
        const lane = laneOf.get(item.block)!;
        item.block.widthPct = 100 / laneCount;
        item.block.leftPct = (100 / laneCount) * lane;
      }
    };

    const buildColumn = (room: Room, date: string): RoomColumnVM => {
      const col: RoomColumnVM = {
        roomId: room.id,
        roomName: room.name,
        roomColor: room.color || '#4A90E2',
        bands: [],
        absences: [],
        appointments: [],
      };

      const occ = occByKey.get(`${room.id}|${date}`);
      if (occ) {
        const items = occ.bands.map((b) => {
          const block: RoomBlock = {
            topPx: topOf(b.startTime),
            heightPx: heightOf(b.startTime, b.endTime),
            leftPct: 0,
            widthPct: 100,
            label: b.operatorName,
            sub: b.chairName,
            timeLabel: `${b.startTime} - ${b.endTime}`,
            color: b.operatorColor || colorFor(b.operatorId),
            tooltip:
              `${b.operatorName} ${b.startTime}-${b.endTime}` +
              (b.chairName ? ` — ${b.chairName}` : ''),
          };
          return { start: toMin(b.startTime), end: toMin(b.endTime), block };
        });
        layoutLanes(items);
        col.bands = items.map((i) => i.block);

        col.absences = (occ.absences || []).map((ab) => ({
          topPx: topOf(ab.startTime),
          heightPx: heightOf(ab.startTime, ab.endTime),
          leftPct: 0,
          widthPct: 100,
          label: `libero (${ab.reason})`,
          timeLabel: `${ab.startTime} - ${ab.endTime}`,
          color: '#94a3b8',
          tooltip: `Libero: ${ab.operatorName} in ${ab.reason} ${ab.startTime}-${ab.endTime}`,
        }));
      }

      const apts = aptsByKey.get(`${room.id}|${date}`);
      if (apts) {
        const items = apts.map((a) => {
          const start = String(a.startTime).slice(0, 5);
          const end = String(a.endTime).slice(0, 5);
          const opName = a.operator
            ? `${a.operator.name} ${a.operator.surname ?? ''}`.trim()
            : 'Appuntamento';
          const block: RoomBlock = {
            topPx: topOf(start),
            heightPx: heightOf(start, end),
            leftPct: 0,
            widthPct: 100,
            label: opName,
            timeLabel: `${start} - ${end}`,
            color: a.operator?.color || colorFor(a.operatorId || a.id),
            tooltip: `${opName} ${start}-${end}`,
          };
          return { start: toMin(start), end: toMin(end), block };
        });
        layoutLanes(items);
        col.appointments = items.map((i) => i.block);
      }

      return col;
    };

    // Giorni raggruppati; in vista multi-settimana le settimane sono impilate.
    this.weeks = [];
    if (this.rooms.length === 0 || this.dates.length === 0) return;

    for (let w = 0; w * 7 < this.dates.length; w++) {
      let weekDates = this.dates.slice(w * 7, w * 7 + 7);
      if (weekDates.length === 0) break;

      // Weekend nascosto solo in vista multi-giorno: in giornaliera il
      // singolo giorno si mostra comunque, anche se è sabato o domenica.
      if (!this.showWeekend && weekDates.length > 1) {
        weekDates = weekDates.filter((d) => {
          const dow = new Date(d).getDay();
          return dow !== 0 && dow !== 6;
        });
        if (weekDates.length === 0) continue;
      }

      const days: DayGroupVM[] = weekDates.map((date) => ({
        date,
        label: this.formatDateLabel(date),
        columns: this.rooms.map((room) => buildColumn(room, date)),
      }));

      this.weeks.push({
        label:
          `Settimana ${w + 1} — ` +
          `${this.formatDateLabel(weekDates[0])} → ${this.formatDateLabel(weekDates[weekDates.length - 1])}`,
        days,
      });
    }
  }

  private formatDateLabel(date: string): string {
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
  }
}
