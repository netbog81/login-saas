/**
 * Operator Grid Component
 * Layer 1: Dumb Component
 *
 * Griglia ad alte performance per vista operatori.
 * ARCHITETTURA PERFORMANCE:
 * - Zero componenti Angular per le celle (puri <div>)
 * - Tutti i dati pre-calcolati (CellState, PositionedEvent) ricevuti via @Input
 * - Nessuna funzione chiamata dal template
 * - Event delegation per mouse events
 * - CDK DragDrop per spostamento appuntamenti
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  TrackByFunction,
  ViewChild,
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
  TimeSlot,
  CellClickEvent,
  EventClickEvent,
  DragMoveEvent,
  AvailableSlotPosition,
} from '../../models/calendar-v2.model';

@Component({
  selector: 'app-operator-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DragDropModule, MatTooltipModule, MatIconModule],
  template: `
    @if (gridData) {
      <!-- ===== HEADER AREA (fuori dal scroll) ===== -->

      <!-- Day labels (compact weekly) -->
      @if (compactMode && showDateInHeader) {
        <div class="day-headers-row" [style.margin-left.px]="timeColumnWidth">
          @for (date of gridData.dates; track date) {
            <div class="day-group-header"
                 [style.flex-basis.%]="100 / gridData.dates.length">
              <div class="day-label">{{ formatDateShort(date) }}</div>
            </div>
          }
        </div>
      }

      <!-- Column headers (nomi operatori o celle colorate) -->
      <div class="grid-header-row">
        <div class="time-corner" [style.width.px]="timeColumnWidth" [style.min-width.px]="timeColumnWidth"></div>
        <div class="header-columns" [class.header-columns-scroll]="!compactMode" #headerColumnsRef>
          @for (col of gridData.columns; track trackColumn($index, col)) {
            <div class="column-header"
                 [style.min-width.px]="compactMode ? 0 : columnWidth"
                 [style.max-width.px]="compactMode ? undefined : columnWidth"
                 [class.flex-col]="compactMode"
                 [class.compact-header]="compactMode"
                 [style.background]="compactMode ? col.operatorColor : undefined"
                 [style.border-bottom-color]="col.operatorColor"
                 [matTooltip]="compactMode ? col.operatorName + (showDateInHeader ? ' - ' + formatDateShort(col.date) : '') : ''"
                 matTooltipPosition="above">
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
      <div class="grid-body" [class.compact]="compactMode" #gridBodyRef>
          <!-- Time column (sticky left) -->
          <div class="time-column" [style.width.px]="timeColumnWidth">
            @for (slot of gridData.timeSlots; track slot.index) {
              <div class="time-label" [style.height.px]="gridData.slotHeightPx">
                {{ slot.time }}
              </div>
            }
          </div>

          <!-- Colonne operatori (celle + eventi) - direttamente nel body flex-row -->
          @for (col of gridData.columns; track trackColumn($index, col)) {
              <div class="operator-column"
                   [style.min-width.px]="compactMode ? 0 : columnWidth"
                   [class.flex-col]="compactMode"
                   (dblclick)="onColumnDblClick($event, col)">

                <!-- Celle (puri div, ZERO componenti Angular) -->
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
                      <span class="event-time">{{ event.timeLabel }}</span>
                      <span class="event-title">{{ event.title }}</span>
                      @if (event.isRecurring) {
                        <mat-icon class="recurring-icon">repeat</mat-icon>
                      }
                    </div>
                    <div class="resize-handle" (mousedown)="onResizeStart($event, event)"></div>
                  </div>
                }

                <!-- Available slot overlays -->
                @for (slot of getSlotsForColumn(col.operatorId, col.date); track slot.startTime) {
                  <div class="available-slot-overlay"
                       [style.top.px]="slot.topPx"
                       [style.height.px]="slot.heightPx"
                       [style.border-color]="slot.color"
                       [class.compact-slot]="slot.heightPx < 50"
                       (dblclick)="onAvailableSlotDblClick($event, slot)">
                    <span class="slot-time">{{ slot.startTime }} - {{ slot.endTime }}</span>
                    @if (slot.heightPx >= 50) {
                      <span class="slot-label">Disponibile</span>
                    }
                  </div>
                }
              </div>
            }
        </div><!-- /grid-body -->

      <!-- Current time indicator -->
      @if (currentTimeTop >= 0) {
        <div class="current-time-line"
             [style.top.px]="currentTimeTop"
             [style.left.px]="timeColumnWidth">
          <div class="current-time-dot"></div>
        </div>
      }
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      position: relative;
    }

    /* ===== HEADER ROW (time-corner + column-headers sulla stessa riga) ===== */
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
      overflow: hidden; /* nasconde overflow, scroll sync via JS */
    }

    /* In expanded mode, header-columns non deve comprimersi */
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

    /* Day group headers row (compact weekly - fuori dal scroll) */
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

    /* ===== BODY ===== */
    .grid-body {
      display: flex;
      flex: 1;
      overflow: auto;
      min-height: 0; /* necessario per flex + overflow */
    }

    /* ===== TIME COLUMN ===== */
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
      /* NO box-sizing border-box: altezza = slotHeight, border è extra */
    }

    /* ===== COLUMNS ===== */
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

    /* ===== CELLS (puri div) ===== */
    .grid-cell {
      position: relative;
      border-bottom: 1px solid #f1f5f9;
      /* NO box-sizing border-box: il border è EXTRA, come nel calendar v1 */
    }

    .cell-available {
      background: white;
      cursor: pointer;
    }

    .cell-unavailable {
      background: #f8fafc;
      cursor: default;
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

    /* ===== EVENT CHIPS ===== */
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

    .event-content {
      display: flex;
      flex-direction: column;
      gap: 1px;
      overflow: hidden;
      flex: 1;
    }

    .event-time {
      font-weight: 600;
      font-size: 0.65rem;
      opacity: 0.9;
    }

    .event-title {
      font-size: 0.7rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .recurring-icon {
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

    /* ===== CURRENT TIME ===== */
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

    /* ===== AVAILABLE SLOT OVERLAYS ===== */
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

    /* ===== CDK DRAG ===== */
    .cdk-drag-preview {
      opacity: 0.8;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .cdk-drag-placeholder {
      opacity: 0.3;
    }
  `],
})
export class OperatorGridComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gridBodyRef') gridBodyRef?: ElementRef<HTMLDivElement>;
  @ViewChild('headerColumnsRef') headerColumnsRef?: ElementRef<HTMLDivElement>;

  @Input() gridData: OperatorGridData | null = null;
  @Input() columnWidth = 150;
  @Input() timeColumnWidth = 56;
  @Input() showDateInHeader = false;
  @Input() currentTimeTop = -1;
  @Input() compactMode = false;  // true = colonne adattive, false = colonne fisse con scroll
  @Input() availableSlots: AvailableSlotPosition[] = [];  // slot disponibili da ricerca

  @Output() cellClick = new EventEmitter<CellClickEvent>();
  @Output() cellDblClick = new EventEmitter<CellClickEvent>();
  @Output() eventClick = new EventEmitter<EventClickEvent>();
  @Output() eventDblClick = new EventEmitter<EventClickEvent>();
  @Output() dragMove = new EventEmitter<DragMoveEvent>();
  @Output() availableSlotDblClick = new EventEmitter<AvailableSlotPosition>();
  @Output() resizeEnd = new EventEmitter<{ appointmentId: string; newEndTime: string }>();

  private scrollListener?: () => void;
  private isDragging = false;

  ngAfterViewInit(): void {
    // Sync scroll orizzontale tra body e header (vista espansa)
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

  // Track-by per colonne: usa operatorId+date come chiave stabile
  trackColumn: TrackByFunction<OperatorColumnData> = (_, col) => `${col.operatorId}-${col.date}`;

  getSlotsForColumn(operatorId: string, date: string): AvailableSlotPosition[] {
    return this.availableSlots.filter(s => s.operatorId === operatorId && s.date === date);
  }

  onAvailableSlotDblClick(event: MouseEvent, slot: AvailableSlotPosition): void {
    event.stopPropagation();
    this.availableSlotDblClick.emit(slot);
  }

  /** Filtra colonne per una data specifica (usato in compact mode) */
  getColumnsForDate(date: string): OperatorColumnData[] {
    return this.gridData?.columns.filter(c => c.date === date) || [];
  }

  // ==================== EVENT HANDLERS ====================

  onColumnDblClick(event: MouseEvent, col: OperatorColumnData): void {
    // Ignora se il click era su un evento
    if ((event.target as HTMLElement).closest('.event-chip')) return;
    if (!this.gridData || this.gridData.timeSlots.length === 0) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const yOffset = event.clientY - rect.top + (event.currentTarget as HTMLElement).scrollTop;
    const slotIndex = Math.floor(yOffset / (this.gridData.slotHeightPx || 60));
    const slot = this.gridData.timeSlots[slotIndex];

    if (slot) {
      // Durata slot = differenza tra i primi 2 slot
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
    // Ignora click dopo drag
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

    // Calcola spostamento in minuti (snap a slot)
    const minuteDelta = Math.round(delta.y / pxPerSlot) * slotDuration;

    cdkEvent.source.reset();

    if (minuteDelta === 0) {
      // Nessuno spostamento — il click handler gestira' l'apertura dialog
      // isDragging viene resettato nel click handler
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
      operatorId: posEvent.operatorId,
      newDate: posEvent.date,
      newStartTime: this.minutesToTime(startMinutes),
      newEndTime: this.minutesToTime(endMinutes),
    });

    // Reset drag flag dopo un breve delay per bloccare il click
    setTimeout(() => { this.isDragging = false; }, 200);
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

      // Ripristina altezza originale (il reload riposizionera')
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
