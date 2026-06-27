/**
 * Operator Grid V3 Component
 * Layer 1: Dumb Component
 *
 * Variante di OperatorGridComponent (calendar-v2) con chip appuntamento
 * ridisegnato per migliorare la leggibilita' su righe basse:
 *
 * - Nome paziente PRIMA, orario DOPO, sulla STESSA riga.
 * - L'orario viene mostrato solo se il chip e' abbastanza alto
 *   (heightPx >= TIME_VISIBLE_MIN_HEIGHT). Su chip bassi resta solo il
 *   nome; l'orario resta comunque nel tooltip e nella colonna orari.
 * - L'orario non va mai a capo: o sta in linea col nome, o non si mostra.
 *
 * Logica griglia, drag/drop, resize e scroll-sync identici al v2.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  TrackByFunction,
  ViewChild,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import {
  OperatorGridData,
  OperatorColumnData,
  PositionedEvent,
  CellClickEvent,
  EventClickEvent,
  DragMoveEvent,
  AvailableSlotPosition,
} from '../../../calendar-v2/models/calendar-v2.model';

/** Soglia px sotto la quale il chip mostra solo il nome (orario nascosto). */
const TIME_VISIBLE_MIN_HEIGHT = 36;

@Component({
  selector: 'app-operator-grid-v3',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DragDropModule, MatTooltipModule, MatIconModule],
  template: `
    @if (gridData) {
      <!-- ===== HEADER AREA (fuori dal scroll) ===== -->

      @if (compactMode && showDateInHeader) {
        <div class="day-headers-row" [style.margin-left.px]="timeColumnWidth">
          @for (date of gridData.dates; track date) {
            <div class="day-group-header day-group-header-clickable"
                 [class.day-selected]="selectedDate === date"
                 [style.flex-basis.%]="100 / gridData.dates.length"
                 (click)="dateHeaderClick.emit(date)">
              <div class="day-label">{{ formatDateShort(date) }}</div>
            </div>
          }
        </div>
      }

      <div class="grid-header-row">
        <div class="time-corner" [style.width.px]="timeColumnWidth" [style.min-width.px]="timeColumnWidth"></div>
        <div class="header-columns" [class.header-columns-scroll]="!compactMode" #headerColumnsRef>
          @for (col of gridData.columns; track trackColumn($index, col)) {
            <div class="column-header"
                 [style.min-width.px]="compactMode ? 0 : columnWidth"
                 [style.max-width.px]="compactMode ? undefined : columnWidth"
                 [class.flex-col]="compactMode"
                 [class.compact-header]="compactMode"
                 [class.day-selected]="showDateInHeader && selectedDate === col.date"
                 [class.column-header-clickable]="showDateInHeader"
                 [style.background]="compactMode ? col.operatorColor : undefined"
                 [style.border-bottom-color]="col.operatorColor"
                 [matTooltip]="compactMode ? col.operatorName + (showDateInHeader ? ' - ' + formatDateShort(col.date) : '') : ''"
                 matTooltipPosition="above"
                 (click)="showDateInHeader && dateHeaderClick.emit(col.date)">
              @if (!compactMode) {
                <span class="operator-name">{{ col.operatorName }}</span>
                @if (showDateInHeader) {
                  <span class="column-date">{{ formatDateShort(col.date) }}</span>
                }
              }
            </div>
          }
        </div>
      </div>

      <!-- ===== GRID BODY (scroll area) ===== -->
      <div class="grid-body"
           [class.compact]="compactMode"
           [class.pattern-unavailable]="showUnavailablePattern"
           #gridBodyRef>
          <div class="time-column" [style.width.px]="timeColumnWidth">
            @for (slot of gridData.timeSlots; track slot.index) {
              <div class="time-label" [style.height.px]="gridData.slotHeightPx">
                {{ slot.time }}
              </div>
            }
          </div>

          @for (col of gridData.columns; track trackColumn($index, col)) {
              <div class="operator-column"
                   #operatorColumnRef
                   [style.min-width.px]="compactMode ? 0 : columnWidth"
                   [class.flex-col]="compactMode"
                   (dblclick)="onColumnDblClick($event, col)">

                @for (cell of col.cells; track $index) {
                  <div class="grid-cell"
                       [class]="cell.cssClass"
                       [style.height.px]="gridData.slotHeightPx">
                    @if (cell.unavailableTopPct > 0) {
                      <div class="unavailable-overlay top" [style.height.%]="cell.unavailableTopPct"></div>
                    }
                    @if (cell.unavailableBottomPct > 0) {
                      <div class="unavailable-overlay bottom" [style.height.%]="cell.unavailableBottomPct"></div>
                    }
                  </div>
                }

                <!-- Eventi posizionati (assoluti sopra le celle) -->
                @for (event of col.events; track event.appointment.id) {
                  <div class="event-chip"
                       [class.highlighted]="event.appointment.id === highlightedAppointmentId"
                       cdkDrag
                       [cdkDragData]="event"
                       (cdkDragStarted)="onDragStarted()"
                       (cdkDragEnded)="onDragEnded($event, event)"
                       [style.top.px]="event.topPx"
                       [style.height.px]="event.heightPx"
                       [style.left.%]="event.leftPct"
                       [style.width.%]="event.widthPct"
                       [style.background]="event.color"
                       [matTooltip]="event.title + ' | ' + event.timeLabel"
                       (click)="onEventClick($event, event)"
                       (dblclick)="onEventDblClick($event, event)">
                    <div class="event-content">
                      <span class="event-title">{{ event.title }}</span>
                      @if (event.heightPx >= TIME_VISIBLE_MIN_HEIGHT) {
                        <span class="event-time">{{ event.timeLabel }}</span>
                      }
                      @if (event.isRecurring) {
                        <mat-icon class="recurring-icon">repeat</mat-icon>
                      }
                    </div>
                    <div class="resize-handle" (mousedown)="onResizeStart($event, event)"></div>
                  </div>
                }

                @for (slot of getSlotsForColumn(col.operatorId, col.date); track slot.startTime) {
                  <div class="available-slot-overlay"
                       [style.top.px]="slot.topPx"
                       [style.height.px]="slot.heightPx"
                       [style.border-color]="slot.color"
                       [class.compact-slot]="slot.heightPx < 50"
                       (click)="onAvailableSlotClick($event, slot)"
                       (dblclick)="onAvailableSlotDblClick($event, slot)">
                    <span class="slot-time">{{ slot.startTime }} - {{ slot.endTime }}</span>
                    @if (slot.heightPx >= 50) {
                      <span class="slot-label">Disponibile</span>
                    }
                  </div>
                }
              </div>
            }

          @if (currentTimeTop >= 0) {
            <div class="current-time-line"
                 [style.top.px]="currentTimeTop"
                 [style.left.px]="timeColumnWidth">
              <div class="current-time-dot"></div>
            </div>
          }
        </div><!-- /grid-body -->
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      position: relative;
    }

    .grid-header-row {
      display: flex;
      flex-shrink: 0;
      background: white;
      border-bottom: 1px solid #e2e8f0;
      z-index: 5;
    }

    .time-corner {
      flex-shrink: 0;
      border-right: 1px solid #cbd5e1;
      background: white;
    }

    .header-columns {
      display: flex;
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    .header-columns-scroll {
      flex: 1;
      overflow: hidden;
    }

    .column-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8px 4px;
      border-right: 1px solid #e2e8f0;
      border-bottom: 3px solid;
      text-align: center;
      box-sizing: border-box;
    }

    .column-header.flex-col {
      flex: 1;
      min-width: 0;
    }

    .column-header.compact-header {
      padding: 0;
      height: 14px;
      min-height: 14px;
      border-bottom-width: 0;
      cursor: pointer;
    }

    /* Header colonna/giorno cliccabile (filtro trattamenti per giorno) */
    .column-header-clickable { cursor: pointer; }
    .column-header-clickable:hover { background: #f1f5f9; }
    .day-group-header-clickable { cursor: pointer; }
    .day-group-header-clickable:hover { background: #f1f5f9; }
    /* Giorno selezionato: evidenziazione header */
    .column-header.day-selected,
    .day-group-header.day-selected {
      background: #eef2ff !important;
      box-shadow: inset 0 0 0 2px #4338ca;
    }

    .operator-name {
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .column-date {
      font-size: 0.65rem;
      color: #94a3b8;
      margin-top: 2px;
    }

    .day-headers-row {
      display: flex;
      flex-shrink: 0;
      background: white;
      z-index: 6;
    }

    .day-group-header {
      border-right: 2px solid #cbd5e1;
    }

    .day-label {
      text-align: center;
      font-size: 0.75rem;
      font-weight: 600;
      color: #475569;
      padding: 4px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      text-transform: capitalize;
    }

    .grid-body {
      display: flex;
      flex: 1;
      overflow: auto;
      min-height: 0;
      position: relative;
    }

    .time-column {
      position: sticky;
      left: 0;
      z-index: 3;
      background: white;
      border-right: 1px solid #cbd5e1;
      flex-shrink: 0;
    }

    .time-label {
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding: 2px 6px 0 0;
      font-size: 0.7rem;
      color: #94a3b8;
      border-bottom: 1px solid #f1f5f9;
    }

    .operator-column {
      position: relative;
      border-right: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .operator-column.flex-col {
      flex: 1;
      min-width: 0;
      flex-shrink: 1;
    }

    .grid-cell {
      position: relative;
      border-bottom: 1px solid #f1f5f9;
    }

    .cell-available {
      background: white;
      cursor: pointer;
    }

    .cell-unavailable {
      background: #f8fafc;
      cursor: default;
    }

    /* Flag "mostra sfondo celle non disponibili": aggiunge una trama a
       righe diagonali sopra lo sfondo della cella. CSS puro, nessun
       impatto sulle performance. */
    .grid-body.pattern-unavailable .cell-unavailable {
      background-image: repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 4px,
        rgba(100, 116, 139, 0.18) 4px,
        rgba(100, 116, 139, 0.18) 8px
      );
    }

    .cell-no-template {
      background: white;
      cursor: pointer;
    }

    .unavailable-overlay {
      position: absolute;
      left: 0;
      right: 0;
      background: repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 3px,
        rgba(148, 163, 184, 0.12) 3px,
        rgba(148, 163, 184, 0.12) 6px
      );
      pointer-events: none;
    }

    .unavailable-overlay.top { top: 0; }
    .unavailable-overlay.bottom { bottom: 0; }

    /* ===== EVENT CHIPS (v3) ===== */
    .event-chip {
      position: absolute;
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
      z-index: 2;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      transition: box-shadow 0.15s;
      color: white;
      font-size: 0.7rem;
      padding: 2px 4px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 4;
      }
    }

    /* Chip evidenziato dopo "vai al calendario": bordo pulsante per
       attirare l'occhio senza coprire il contenuto. */
    .event-chip.highlighted {
      z-index: 5;
      outline: 3px solid #f59e0b;
      outline-offset: 1px;
      animation: chip-pulse 1s ease-in-out 3;
    }
    @keyframes chip-pulse {
      0%, 100% { outline-color: #f59e0b; }
      50% { outline-color: rgba(245, 158, 11, 0.25); }
    }

    /* Nome + orario sulla STESSA riga: nome a sinistra (flessibile,
       con ellipsis), orario a destra (non si comprime). */
    .event-content {
      display: flex;
      flex-direction: row;
      align-items: baseline;
      gap: 4px;
      overflow: hidden;
      flex: 1;
      min-width: 0;
    }

    .event-title {
      flex: 1 1 auto;
      min-width: 0;
      font-size: 0.72rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .event-time {
      flex: 0 0 auto;
      font-size: 0.62rem;
      font-weight: 500;
      opacity: 0.85;
      white-space: nowrap;
    }

    .recurring-icon {
      flex: 0 0 auto;
      font-size: 12px;
      width: 12px;
      height: 12px;
      opacity: 0.8;
    }

    .resize-handle {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 6px;
      cursor: ns-resize;
      background: rgba(255, 255, 255, 0.3);

      &:hover {
        background: rgba(255, 255, 255, 0.6);
      }
    }

    .current-time-line {
      position: absolute;
      right: 0;
      height: 2px;
      background: #ef4444;
      z-index: 6;
      pointer-events: none;
    }

    .current-time-dot {
      position: absolute;
      left: -4px;
      top: -4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ef4444;
    }

    .available-slot-overlay {
      position: absolute;
      left: 2px;
      right: 2px;
      z-index: 1;
      border: 2px dashed;
      border-radius: 4px;
      background: rgba(34, 197, 94, 0.08);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      transition: background 0.15s;

      &:hover {
        background: rgba(34, 197, 94, 0.18);
      }
    }

    .available-slot-overlay .slot-time {
      font-size: 0.6rem;
      font-weight: 600;
      color: #15803d;
    }

    .available-slot-overlay .slot-label {
      font-size: 0.55rem;
      color: #22c55e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .available-slot-overlay.compact-slot {
      justify-content: center;
    }

    .cdk-drag-preview {
      opacity: 0.8;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .cdk-drag-placeholder {
      opacity: 0.3;
    }
  `],
})
export class OperatorGridV3Component implements AfterViewInit, OnDestroy {
  @ViewChild('gridBodyRef') gridBodyRef?: ElementRef<HTMLDivElement>;
  @ViewChild('headerColumnsRef') headerColumnsRef?: ElementRef<HTMLDivElement>;
  /** Elementi DOM delle colonne, allineati per indice a gridData.columns. */
  @ViewChildren('operatorColumnRef') operatorColumnRefs?: QueryList<ElementRef<HTMLElement>>;

  @Input() gridData: OperatorGridData | null = null;
  @Input() columnWidth = 150;
  @Input() timeColumnWidth = 56;
  @Input() showDateInHeader = false;
  /** Giorno YYYY-MM-DD attualmente selezionato (filtro trattamenti): evidenzia l'header. */
  @Input() selectedDate: string | null = null;
  @Input() currentTimeTop = -1;
  @Input() compactMode = false;
  @Input() availableSlots: AvailableSlotPosition[] = [];
  /** Appuntamento da evidenziare (es. dopo "vai al calendario"). */
  @Input() highlightedAppointmentId: string | null = null;
  /** Da calendar settings: trama tratteggiata sulle celle non disponibili. */
  @Input() showUnavailablePattern = false;

  @Output() cellClick = new EventEmitter<CellClickEvent>();
  @Output() cellDblClick = new EventEmitter<CellClickEvent>();
  @Output() eventClick = new EventEmitter<EventClickEvent>();
  @Output() eventDblClick = new EventEmitter<EventClickEvent>();
  @Output() dragMove = new EventEmitter<DragMoveEvent>();
  @Output() availableSlotDblClick = new EventEmitter<AvailableSlotPosition>();
  /** Click singolo su uno slot disponibile (crea appuntamento, richiesta cliente). */
  @Output() availableSlotClick = new EventEmitter<AvailableSlotPosition>();
  @Output() resizeEnd = new EventEmitter<{ appointmentId: string; newEndTime: string }>();
  /** Click sull'intestazione di un giorno/colonna: emette la data YYYY-MM-DD. */
  @Output() dateHeaderClick = new EventEmitter<string>();

  /** Esposto al template per la soglia di visibilita' orario. */
  readonly TIME_VISIBLE_MIN_HEIGHT = TIME_VISIBLE_MIN_HEIGHT;

  private scrollListener?: () => void;
  private isDragging = false;

  ngAfterViewInit(): void {
    if (this.gridBodyRef?.nativeElement) {
      this.scrollListener = () => {
        if (this.headerColumnsRef?.nativeElement && this.gridBodyRef?.nativeElement) {
          this.headerColumnsRef.nativeElement.scrollLeft = this.gridBodyRef.nativeElement.scrollLeft;
        }
      };
      this.gridBodyRef.nativeElement.addEventListener('scroll', this.scrollListener, { passive: true });
    }
  }

  ngOnDestroy(): void {
    if (this.scrollListener && this.gridBodyRef?.nativeElement) {
      this.gridBodyRef.nativeElement.removeEventListener('scroll', this.scrollListener);
    }
  }

  trackColumn: TrackByFunction<OperatorColumnData> = (_, col) => `${col.operatorId}-${col.date}`;

  getSlotsForColumn(operatorId: string, date: string): AvailableSlotPosition[] {
    return this.availableSlots.filter(s => s.operatorId === operatorId && s.date === date);
  }

  onAvailableSlotClick(event: MouseEvent, slot: AvailableSlotPosition): void {
    event.stopPropagation();
    this.availableSlotClick.emit(slot);
  }

  onAvailableSlotDblClick(event: MouseEvent, slot: AvailableSlotPosition): void {
    // Il click singolo gestisce gia' la creazione; qui evitiamo solo che il
    // doppio click propaghi alla cella sottostante.
    event.stopPropagation();
  }

  getColumnsForDate(date: string): OperatorColumnData[] {
    return this.gridData?.columns.filter(c => c.date === date) || [];
  }

  // ==================== EVENT HANDLERS ====================

  onColumnDblClick(event: MouseEvent, col: OperatorColumnData): void {
    if ((event.target as HTMLElement).closest('.event-chip')) return;
    if (!this.gridData || this.gridData.timeSlots.length === 0) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const yOffset = event.clientY - rect.top + (event.currentTarget as HTMLElement).scrollTop;
    const slotIndex = Math.floor(yOffset / (this.gridData.slotHeightPx || 60));
    const slot = this.gridData.timeSlots[slotIndex];

    if (slot) {
      const slotDuration = this.gridData.timeSlots.length > 1
        ? this.timeToMinutes(this.gridData.timeSlots[1].time) - this.timeToMinutes(this.gridData.timeSlots[0].time)
        : 45;
      const endMinutes = this.timeToMinutes(slot.time) + slotDuration;
      const endTime = this.minutesToTime(endMinutes);

      this.cellDblClick.emit({
        operatorId: col.operatorId,
        date: col.date,
        startTime: slot.time,
        endTime,
      });
    }
  }

  onEventClick(event: MouseEvent, posEvent: PositionedEvent): void {
    event.stopPropagation();
    if (this.isDragging) {
      this.isDragging = false;
      return;
    }
    this.eventClick.emit({ appointment: posEvent.appointment, mouseEvent: event });
  }

  onEventDblClick(event: MouseEvent, posEvent: PositionedEvent): void {
    event.stopPropagation();
    if (this.isDragging) return;
    this.eventDblClick.emit({ appointment: posEvent.appointment, mouseEvent: event });
  }

  onDragStarted(): void {
    this.isDragging = true;
  }

  onDragEnded(cdkEvent: CdkDragEnd, posEvent: PositionedEvent): void {
    const delta = cdkEvent.distance;
    if (!this.gridData) {
      cdkEvent.source.reset();
      this.isDragging = false;
      return;
    }

    const slotDuration = this.gridData.timeSlots.length > 1
      ? this.timeToMinutes(this.gridData.timeSlots[1].time) - this.timeToMinutes(this.gridData.timeSlots[0].time)
      : 45;
    const pxPerSlot = this.gridData.slotHeightPx;

    const minuteDelta = Math.round(delta.y / pxPerSlot) * slotDuration;

    // Hit-test orizzontale: su quale colonna (operatore/giorno) e' stato
    // rilasciato il chip. Va fatto PRIMA del reset() perche' usa le
    // coordinate del punto di rilascio.
    const targetColumn = this.resolveColumnAtX(cdkEvent.dropPoint.x);

    cdkEvent.source.reset();

    // Vincolo operatore: un appuntamento puo' cambiare solo giorno, MAI
    // operatore (il backend non supporta la riassegnazione). Se il chip
    // viene rilasciato sulla colonna di un altro operatore, lo spostamento
    // viene annullato del tutto (niente cambio orario "di consolazione").
    if (targetColumn && targetColumn.operatorId !== posEvent.operatorId) {
      setTimeout(() => { this.isDragging = false; }, 200);
      return;
    }

    // Colonna di destinazione: stesso operatore, giorno = quello sotto il
    // punto di rilascio (o quello originale se il drop e' fuori griglia).
    const destOperatorId = posEvent.operatorId;
    const destDate = targetColumn?.date ?? posEvent.date;
    const columnChanged = destDate !== posEvent.date;

    // Nessuno spostamento (ne' orario ne' giorno) → niente da fare.
    if (minuteDelta === 0 && !columnChanged) {
      setTimeout(() => { this.isDragging = false; }, 100);
      return;
    }

    const startMinutes = this.timeToMinutes(posEvent.originalStartTime) + minuteDelta;
    const endMinutes = this.timeToMinutes(posEvent.originalEndTime) + minuteDelta;

    // Annulla lo spostamento se la destinazione esce dai limiti della griglia.
    // Senza questo controllo un drag oltre il bordo produrrebbe orari fuori
    // range (anche negativi) che corrompono il calcolo di disponibilita'.
    const gridStart = this.timeToMinutes(this.gridData.timeSlots[0].time);
    const gridEnd = this.timeToMinutes(
      this.gridData.timeSlots[this.gridData.timeSlots.length - 1].time,
    ) + slotDuration;
    if (startMinutes < gridStart || endMinutes > gridEnd) {
      setTimeout(() => { this.isDragging = false; }, 200);
      return;
    }

    this.dragMove.emit({
      appointmentId: posEvent.appointment.id as string,
      operatorId: destOperatorId,
      newDate: destDate,
      newStartTime: this.minutesToTime(startMinutes),
      newEndTime: this.minutesToTime(endMinutes),
    });

    setTimeout(() => { this.isDragging = false; }, 200);
  }

  /**
   * Trova la colonna (operatore/giorno) il cui elemento DOM contiene la
   * coordinata X data. Ritorna null se X cade fuori da ogni colonna.
   * Gli elementi #operatorColumnRef sono allineati per indice a
   * gridData.columns.
   */
  private resolveColumnAtX(x: number): OperatorColumnData | null {
    if (!this.gridData || !this.operatorColumnRefs) return null;
    const refs = this.operatorColumnRefs.toArray();
    for (let i = 0; i < refs.length; i++) {
      const rect = refs[i].nativeElement.getBoundingClientRect();
      if (x >= rect.left && x < rect.right) {
        return this.gridData.columns[i] ?? null;
      }
    }
    return null;
  }

  onResizeStart(event: MouseEvent, posEvent: PositionedEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.isDragging = true;

    if (!this.gridData) return;

    const startY = event.clientY;
    const originalHeightPx = posEvent.heightPx;
    const chipEl = (event.target as HTMLElement).parentElement!;
    const slotDuration = this.gridData.timeSlots.length > 1
      ? this.timeToMinutes(this.gridData.timeSlots[1].time) - this.timeToMinutes(this.gridData.timeSlots[0].time)
      : 45;
    const pxPerMinute = this.gridData.slotHeightPx / slotDuration;

    const onMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(pxPerMinute * slotDuration * 0.5, originalHeightPx + deltaY);
      chipEl.style.height = `${newHeight}px`;
    };

    const onMouseUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const deltaY = e.clientY - startY;
      const minuteDelta = Math.round(deltaY / pxPerMinute / slotDuration) * slotDuration;

      chipEl.style.height = `${originalHeightPx}px`;

      if (minuteDelta !== 0 && this.gridData) {
        const endMinutes = this.timeToMinutes(posEvent.originalEndTime) + minuteDelta;
        const startMinutes = this.timeToMinutes(posEvent.originalStartTime);
        const gridEnd = this.timeToMinutes(
          this.gridData.timeSlots[this.gridData.timeSlots.length - 1].time,
        ) + slotDuration;
        // Assicura endTime > startTime (almeno 1 slot) ed entro il bordo griglia.
        if (endMinutes > startMinutes && endMinutes <= gridEnd) {
          this.resizeEnd.emit({
            appointmentId: posEvent.appointment.id as string,
            newEndTime: this.minutesToTime(endMinutes),
          });
        }
      }

      setTimeout(() => { this.isDragging = false; }, 200);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // ==================== UTILITIES ====================

  formatDateShort(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
