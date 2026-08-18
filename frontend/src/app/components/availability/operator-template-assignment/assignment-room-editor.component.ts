import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Room, Chair } from '../../../services/room.service';
import {
  PatternGroup,
  RoomAvailabilityInfo,
  DAY_NAMES,
} from '../../../graphql/types';

/** Riga override scambiata con il modal di assegnazione. */
export interface EditorOverrideDraft {
  dayInPattern: number;
  startTime: string;
  endTime: string;
  roomId: string;
  chairId: string;
}

export interface EditorResult {
  roomId: string;
  chairId: string;
  overrides: EditorOverrideDraft[];
}

interface EditorCell {
  dayInPattern: number;
  start: number; // minuti da mezzanotte
  end: number;
  roomId: string; // '' = nessuno studio
  chairId: string;
  topPx: number;
  heightPx: number;
  key: string;
}

interface EditorDay {
  dayInPattern: number;
  label: string;
  cells: EditorCell[];
}

interface EditorWeek {
  index: number;
  days: EditorDay[];
}

/** Durate cella selezionabili; 25' richiesto dal cliente per le sue fasce. */
const SLOT_OPTIONS = [15, 20, 25, 30];
const DEFAULT_SLOT_MINUTES = 30;
const HOUR_PX = 44;
/** Con celle da 15' l'ora viene disegnata più alta, così la cella resta leggibile. */
const HOUR_PX_DENSE = 56;

/**
 * Modalità grafica di abbinamento studi/poltrone alle fasce del template:
 * stessa resa della creazione template ma con le fasce bloccate; si
 * selezionano slot (click o click-and-drag su slot consecutivi), si scelgono
 * studio e poltrona dal pannello comandi (sempre visibile) e si applica.
 * Il risultato viene compattato in default + override dal chiamante.
 */
@Component({
  selector: 'app-assignment-room-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignment-room-editor.component.html',
  styleUrls: ['./assignment-room-editor.component.scss'],
})
export class AssignmentRoomEditorComponent implements OnInit {
  @Input({ required: true }) patternGroup!: PatternGroup;
  @Input() rooms: Room[] = [];
  @Input() roomAvailability: RoomAvailabilityInfo[] = [];
  @Input() initialRoomId = '';
  @Input() initialChairId = '';
  @Input() initialOverrides: EditorOverrideDraft[] = [];
  @Input() operatorLabel = '';

  @Output() save = new EventEmitter<EditorResult>();
  @Output() cancelEditor = new EventEmitter<void>();

  weeks: EditorWeek[] = [];
  hours: number[] = [];
  columnHeightPx = 0;
  hourPx = HOUR_PX;
  slotMinutes = DEFAULT_SLOT_MINUTES;
  readonly slotOptions = SLOT_OPTIONS;
  private minHour = 7;

  // Pannello comandi
  panelRoomId = '';
  panelChairId = '';
  panelError: string | null = null;

  // Selezione
  selectedKeys = new Set<string>();
  private dragging = false;
  private dragDay: number | null = null;
  private dragAnchorIndex = 0;
  private dragAdditive = false;
  private preDragSelection = new Set<string>();

  private cellsByKey = new Map<string, EditorCell>();

  ngOnInit(): void {
    this.buildGrid();
    this.panelRoomId = this.initialRoomId || '';
    this.panelChairId = this.initialChairId || '';
  }

  // ==================== COSTRUZIONE GRIGLIA ====================

  private toMinutes(time: string): number {
    const [h, m] = String(time).split(':');
    return parseInt(h, 10) * 60 + parseInt(m || '0', 10);
  }

  private toTime(min: number): string {
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  }

  private buildGrid(): void {
    const patterns = this.patternGroup?.patterns || [];
    const duration = this.patternGroup?.patternDuration || 7;
    const weeksCount = Math.max(Math.ceil(duration / 7), 1);
    this.hourPx = this.slotMinutes < 20 ? HOUR_PX_DENSE : HOUR_PX;

    // Finestra oraria comune a tutte le settimane
    let minH = 24;
    let maxH = 0;
    for (const p of patterns) {
      minH = Math.min(minH, Math.floor(this.toMinutes(p.startTime) / 60));
      maxH = Math.max(maxH, Math.ceil(this.toMinutes(p.endTime) / 60));
    }
    if (minH >= maxH) {
      minH = 7;
      maxH = 20;
    }
    this.minHour = minH;
    this.hours = [];
    for (let h = minH; h < maxH; h++) this.hours.push(h);
    this.columnHeightPx = this.hours.length * this.hourPx;

    // Override iniziali per risoluzione cella
    const dayOverrides = (day: number) =>
      this.initialOverrides.filter((o) => o.dayInPattern === day);

    this.weeks = [];
    this.cellsByKey.clear();

    for (let w = 0; w < weeksCount; w++) {
      const days: EditorDay[] = [];
      for (let dow = 0; dow < 7; dow++) {
        const day = w * 7 + dow;
        if (day >= duration) break;

        const overrides = dayOverrides(day);
        const dayLevel = overrides.find((o) => !o.startTime || !o.endTime) || null;
        const timed = overrides.filter((o) => o.startTime && o.endTime);

        const cells: EditorCell[] = [];
        const bands = patterns
          .filter((p) => p.dayInPattern === day)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        for (const band of bands) {
          const bandStart = this.toMinutes(band.startTime);
          const bandEnd = this.toMinutes(band.endTime);
          for (let s = bandStart; s < bandEnd; s += this.slotMinutes) {
            const e = Math.min(s + this.slotMinutes, bandEnd);
            const timedOv = timed.find(
              (o) => this.toMinutes(o.startTime) <= s && this.toMinutes(o.endTime) >= e,
            );
            const pick = timedOv ?? dayLevel ?? {
              roomId: this.initialRoomId || '',
              chairId: this.initialChairId || '',
            };
            const cell: EditorCell = {
              dayInPattern: day,
              start: s,
              end: e,
              roomId: pick.roomId || '',
              chairId: pick.chairId || '',
              topPx: ((s - minH * 60) / 60) * this.hourPx,
              heightPx: Math.max(((e - s) / 60) * this.hourPx, 12),
              key: `${day}|${s}`,
            };
            cells.push(cell);
            this.cellsByKey.set(cell.key, cell);
          }
        }

        days.push({
          dayInPattern: day,
          label: DAY_NAMES[dow],
          cells,
        });
      }
      this.weeks.push({ index: w, days });
    }
  }

  // ==================== SELEZIONE (click e click-and-drag) ====================

  onCellMouseDown(day: EditorDay, cellIndex: number, event: MouseEvent): void {
    event.preventDefault();
    this.dragging = true;
    this.dragDay = day.dayInPattern;
    this.dragAnchorIndex = cellIndex;
    this.dragAdditive = event.ctrlKey || event.metaKey;
    this.preDragSelection = this.dragAdditive
      ? new Set(this.selectedKeys)
      : new Set<string>();
    this.applyDragRange(day, cellIndex);
  }

  onCellMouseEnter(day: EditorDay, cellIndex: number): void {
    if (!this.dragging || day.dayInPattern !== this.dragDay) return;
    this.applyDragRange(day, cellIndex);
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.dragging = false;
    this.dragDay = null;
  }

  private applyDragRange(day: EditorDay, cellIndex: number): void {
    const next = new Set(this.preDragSelection);
    const from = Math.min(this.dragAnchorIndex, cellIndex);
    const to = Math.max(this.dragAnchorIndex, cellIndex);
    for (let i = from; i <= to; i++) {
      const cell = day.cells[i];
      if (cell) next.add(cell.key);
    }
    this.selectedKeys = next;
    this.panelError = null;
  }

  clearSelection(): void {
    this.selectedKeys = new Set();
    this.panelError = null;
  }

  get selectedCells(): EditorCell[] {
    return Array.from(this.selectedKeys)
      .map((k) => this.cellsByKey.get(k))
      .filter((c): c is EditorCell => !!c);
  }

  // ==================== PANNELLO COMANDI ====================

  get panelChairs(): Chair[] {
    if (!this.panelRoomId) return [];
    const room = this.rooms.find((r) => r.id === this.panelRoomId);
    return (room?.chairs || []).filter((c) => c.isActive);
  }

  /**
   * Tendina studi del pannello, filtrata sulla selezione corrente: con celle
   * selezionate uno studio pieno in almeno una di esse è disabilitato con il
   * motivo; senza selezione lo stato complessivo è solo informativo.
   */
  get panelRoomOptions(): { id: string; name: string; disabled: boolean; suffix: string }[] {
    const cells = this.selectedCells;
    return this.rooms.map((room) => {
      const info = this.roomAvailability.find((r) => r.roomId === room.id);
      if (!info) {
        return { id: room.id, name: room.name, disabled: false, suffix: '' };
      }

      if (cells.length > 0) {
        const fullCells = cells.filter((c) =>
          this.busyForCell(room.id, c).some((b) => b.freeSeats <= 0),
        );
        if (fullCells.length > 0) {
          const first = fullCells[0];
          return {
            id: room.id,
            name: room.name,
            disabled: true,
            suffix:
              ` — pieno in ${fullCells.length} cell${fullCells.length > 1 ? 'e' : 'a'} sel. ` +
              `(es. ${DAY_NAMES[first.dayInPattern % 7]} ${this.toTime(first.start)})`,
          };
        }
        const sharedCells = cells.filter(
          (c) => this.busyForCell(room.id, c).length > 0,
        );
        return {
          id: room.id,
          name: room.name,
          disabled: false,
          suffix: sharedCells.length > 0 ? ' ⚠ condiviso nelle celle selezionate' : '',
        };
      }

      // Nessuna selezione: stato complessivo sul template (informativo)
      if (info.full) {
        return { id: room.id, name: room.name, disabled: false, suffix: ` ⚠ ${info.unavailableReason}` };
      }
      if (info.sharing) {
        return { id: room.id, name: room.name, disabled: false, suffix: ` ⚠ ${info.unavailableReason}` };
      }
      return { id: room.id, name: room.name, disabled: false, suffix: '' };
    });
  }

  /** Tendina poltrone del pannello, filtrata sulla selezione corrente. */
  get panelChairOptions(): { id: string; name: string; disabled: boolean; suffix: string }[] {
    const chairs = this.panelChairs;
    const info = this.roomAvailability.find((r) => r.roomId === this.panelRoomId);
    const cells = this.selectedCells;

    return chairs.map((chair) => {
      if (!info) {
        return { id: chair.id, name: chair.name, disabled: false, suffix: '' };
      }

      if (cells.length > 0) {
        const busyCells = cells.filter((c) =>
          this.busyForCell(this.panelRoomId, c).some((b) =>
            b.busyChairIds.includes(chair.id),
          ),
        );
        if (busyCells.length > 0) {
          const first = busyCells[0];
          return {
            id: chair.id,
            name: chair.name,
            disabled: true,
            suffix:
              ` — occupata in ${busyCells.length} cell${busyCells.length > 1 ? 'e' : 'a'} sel. ` +
              `(es. ${DAY_NAMES[first.dayInPattern % 7]} ${this.toTime(first.start)})`,
          };
        }
        return { id: chair.id, name: chair.name, disabled: false, suffix: '' };
      }

      const chairInfo = info.chairs.find((c) => c.chairId === chair.id);
      if (chairInfo && !chairInfo.fullyFree) {
        return {
          id: chair.id,
          name: chair.name,
          disabled: false,
          suffix: ` ⚠ ${chairInfo.firstConflict}`,
        };
      }
      return { id: chair.id, name: chair.name, disabled: false, suffix: '' };
    });
  }

  onPanelRoomChange(): void {
    if (
      this.panelChairId &&
      !this.panelChairs.some((c) => c.id === this.panelChairId)
    ) {
      this.panelChairId = '';
    }
    this.panelError = null;
  }

  /** Fasce occupate dello studio che intersecano una cella. */
  private busyForCell(roomId: string, cell: EditorCell) {
    const info = this.roomAvailability.find((r) => r.roomId === roomId);
    if (!info) return [];
    const start = this.toTime(cell.start);
    const end = this.toTime(cell.end);
    return info.busy.filter(
      (b) =>
        b.dayInPattern === cell.dayInPattern &&
        b.startTime < end &&
        b.endTime > start,
    );
  }

  /** Lo studio scelto nel pannello è pieno in questa cella? (bordo rosso) */
  cellFullForPanelRoom(cell: EditorCell): boolean {
    if (!this.panelRoomId) return false;
    return this.busyForCell(this.panelRoomId, cell).some((b) => b.freeSeats <= 0);
  }

  cellTooltip(cell: EditorCell): string {
    const parts: string[] = [`${this.toTime(cell.start)}-${this.toTime(cell.end)}`];
    if (cell.roomId) {
      parts.push(this.roomLabel(cell));
      const shared = this.busyForCell(cell.roomId, cell);
      if (shared.length > 0) {
        const names = Array.from(new Set(shared.flatMap((b) => b.occupantNames)));
        parts.push(`condiviso con ${names.join(', ')}`);
      }
    } else if (this.panelRoomId) {
      const busy = this.busyForCell(this.panelRoomId, cell);
      if (busy.length > 0) {
        const names = Array.from(new Set(busy.flatMap((b) => b.occupantNames)));
        const full = busy.some((b) => b.freeSeats <= 0);
        parts.push(`${full ? 'PIENO' : 'occupato'}: ${names.join(', ')}`);
      }
    }
    return parts.join(' — ');
  }

  applyToSelection(): void {
    const cells = this.selectedCells;
    if (cells.length === 0) {
      this.panelError = 'Seleziona una o più celle nella griglia';
      return;
    }
    if (!this.panelRoomId) {
      this.panelError = 'Scegli lo studio da applicare';
      return;
    }

    // Blocco: celle dove lo studio scelto è pieno o la poltrona occupata
    const fullCells = cells.filter((c) => this.cellFullForPanelRoom(c));
    if (fullCells.length > 0) {
      const first = fullCells[0];
      this.panelError =
        `Lo studio è pieno in ${fullCells.length} cell${fullCells.length > 1 ? 'e' : 'a'} ` +
        `selezionat${fullCells.length > 1 ? 'e' : 'a'} ` +
        `(es. ${DAY_NAMES[first.dayInPattern % 7]} ${this.toTime(first.start)})`;
      return;
    }
    if (this.panelChairId) {
      const chairBusy = cells.filter((c) =>
        this.busyForCell(this.panelRoomId, c).some((b) =>
          b.busyChairIds.includes(this.panelChairId),
        ),
      );
      if (chairBusy.length > 0) {
        const first = chairBusy[0];
        this.panelError =
          `La poltrona è occupata in ${chairBusy.length} cell${chairBusy.length > 1 ? 'e' : 'a'} ` +
          `(es. ${DAY_NAMES[first.dayInPattern % 7]} ${this.toTime(first.start)})`;
        return;
      }
    }

    for (const cell of cells) {
      cell.roomId = this.panelRoomId;
      cell.chairId = this.panelChairId;
    }
    this.panelError = null;
  }

  removeFromSelection(): void {
    const cells = this.selectedCells;
    if (cells.length === 0) {
      this.panelError = 'Seleziona una o più celle nella griglia';
      return;
    }
    for (const cell of cells) {
      cell.roomId = '';
      cell.chairId = '';
    }
    this.panelError = null;
  }

  /** Copia gli abbinamenti della settimana 1 sulle settimane successive. */
  replicateWeekOne(): void {
    if (this.weeks.length < 2) return;
    const week1 = this.weeks[0];

    for (let w = 1; w < this.weeks.length; w++) {
      for (const day of this.weeks[w].days) {
        const sourceDay = week1.days.find(
          (d) => d.dayInPattern % 7 === day.dayInPattern % 7,
        );
        if (!sourceDay) continue;
        for (const cell of day.cells) {
          const source = sourceDay.cells.find(
            (c) => c.start <= cell.start && c.end >= cell.end,
          ) ?? sourceDay.cells.find(
            (c) => c.start < cell.end && c.end > cell.start,
          );
          if (source) {
            cell.roomId = source.roomId;
            cell.chairId = source.chairId;
          }
        }
      }
    }
    this.panelError = null;
  }

  // ==================== ETICHETTE ====================

  roomLabel(cell: EditorCell): string {
    if (!cell.roomId) return '';
    const room = this.rooms.find((r) => r.id === cell.roomId);
    const chair = cell.chairId
      ? (room?.chairs || []).find((c) => c.id === cell.chairId)
      : null;
    const roomName = room?.name ?? 'Studio';
    return chair ? `${roomName} · ${chair.name}` : roomName;
  }

  roomColor(cell: EditorCell): string {
    if (!cell.roomId) return 'transparent';
    return this.rooms.find((r) => r.id === cell.roomId)?.color || '#4A90E2';
  }

  isSelected(cell: EditorCell): boolean {
    return this.selectedKeys.has(cell.key);
  }

  get legendRooms(): Room[] {
    const used = new Set(
      Array.from(this.cellsByKey.values())
        .map((c) => c.roomId)
        .filter(Boolean),
    );
    return this.rooms.filter((r) => used.has(r.id));
  }

  // ==================== GRANULARITÀ CELLE ====================

  /**
   * Cambio durata cella: lo stato corrente viene compattato e riproposto
   * come stato iniziale della nuova griglia, così gli abbinamenti già fatti
   * non si perdono. Un abbinamento che non copre interamente una cella della
   * nuova griglia torna al default in quella cella (limite intrinseco del
   * cambio di granularità).
   */
  onSlotMinutesChange(minutes: number): void {
    const current = this.compactCurrent();
    this.initialRoomId = current.roomId;
    this.initialChairId = current.chairId;
    this.initialOverrides = current.overrides;
    this.slotMinutes = Number(minutes);
    this.selectedKeys = new Set();
    this.panelError = null;
    this.buildGrid();
  }

  // ==================== SALVATAGGIO (compattazione) ====================

  onSave(): void {
    this.save.emit(this.compactCurrent());
  }

  private compactCurrent(): EditorResult {
    const cells = Array.from(this.cellsByKey.values());
    const assigned = cells.filter((c) => c.roomId);

    // Tutto il template sullo stesso studio/poltrona → solo default
    if (assigned.length === cells.length && cells.length > 0) {
      const first = cells[0];
      const uniform = cells.every(
        (c) => c.roomId === first.roomId && c.chairId === first.chairId,
      );
      if (uniform) {
        return { roomId: first.roomId, chairId: first.chairId, overrides: [] };
      }
    }

    // Niente assegnato → nessuno studio
    if (assigned.length === 0) {
      return { roomId: '', chairId: '', overrides: [] };
    }

    // Misto → default vuoto + override per gli intervalli assegnati,
    // compattando gli slot consecutivi uguali dello stesso giorno.
    const overrides: EditorOverrideDraft[] = [];
    for (const week of this.weeks) {
      for (const day of week.days) {
        let current: EditorOverrideDraft | null = null;
        let currentEnd = -1;
        for (const cell of day.cells) {
          if (!cell.roomId) {
            current = null;
            continue;
          }
          if (
            current &&
            currentEnd === cell.start &&
            current.roomId === cell.roomId &&
            current.chairId === cell.chairId
          ) {
            current.endTime = this.toTime(cell.end);
            currentEnd = cell.end;
          } else {
            current = {
              dayInPattern: day.dayInPattern,
              startTime: this.toTime(cell.start),
              endTime: this.toTime(cell.end),
              roomId: cell.roomId,
              chairId: cell.chairId,
            };
            currentEnd = cell.end;
            overrides.push(current);
          }
        }
      }
    }

    return { roomId: '', chairId: '', overrides };
  }

  onCancel(): void {
    this.cancelEditor.emit();
  }
}
