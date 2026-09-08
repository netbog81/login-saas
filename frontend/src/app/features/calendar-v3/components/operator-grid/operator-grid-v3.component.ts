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
import { ConflictBadgeComponent } from '../../../conflicts/components/conflict-badge/conflict-badge.component';
import { conflictReasonLabel } from '../../../conflicts/models/conflict.model';

/** Soglia px sotto la quale il chip mostra solo il nome (orario nascosto). */
const TIME_VISIBLE_MIN_HEIGHT = 36;

/**
 * Granularità (minuti) dello snap di drag e resize degli appuntamenti,
 * indipendente dalla durata delle celle della griglia: con celle da 30/45'
 * lo spostamento resta comunque possibile al quarto d'ora.
 */
const DRAG_SNAP_MINUTES = 15;

@Component({
  selector: 'app-operator-grid-v3',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DragDropModule, MatTooltipModule, MatIconModule, ConflictBadgeComponent],
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
           [class.selection-mode]="selectionMode"
           [class.paste-mode]="pasteMode"
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

                <!-- Eventi posizionati (assoluti sopra le celle).
                     Le assenze non sono trascinabili: su una striscia da 22px
                     un clic diventa facilmente un micro-trascinamento e si
                     sposterebbe un appuntamento senza volerlo. -->
                @for (event of col.events; track event.appointment.id) {
                  <div class="event-chip"
                       [class.read-only]="readOnly"
                       [class.highlighted]="event.appointment.id === highlightedAppointmentId"
                       [class.has-conflict]="event.hasConflict"
                       [class.no-show]="event.isNoShow"
                       [class.copyable]="selectionMode"
                       cdkDrag
                       [cdkDragData]="event"
                       [cdkDragDisabled]="selectionMode || pasteMode || readOnly || event.isNoShow"
                       (cdkDragStarted)="onDragStarted()"
                       (cdkDragEnded)="onDragEnded($event, event)"
                       [style.top.px]="event.topPx"
                       [style.height.px]="event.heightPx"
                       [style.left]="chipLeft(event)"
                       [style.width]="chipWidth(event)"
                       [style.background]="event.color"
                       [matTooltip]="tooltipFor(event)"
                       (click)="onEventClick($event, event)"
                       (dblclick)="onEventDblClick($event, event)">
                    @if (event.isNoShow) {
                      <!-- Assenza: il chip si ritira su una striscia stretta a
                           sinistra. La fascia e' tornata prenotabile davvero
                           (il backend non la considera piu' occupata), quindi
                           deve tornare libera anche al doppio clic: se il chip
                           restasse a tutta larghezza continuerebbe a
                           intercettarlo e non si potrebbe piu' prenotare
                           nessuno li'. Nome e orario restano nel tooltip. -->
                      <div class="no-show-strip">
                        <mat-icon>person_off</mat-icon>
                      </div>
                    } @else {
                      <div class="event-content">
                        <!-- Il triangolo va PRIMA del nome: su chip stretti il
                             testo viene troncato da destra, e un badge in coda
                             sarebbe il primo a sparire proprio sugli
                             appuntamenti che più devono farsi notare. -->
                        @if (event.hasConflict) {
                          <app-conflict-badge
                            [conflict]="{ hasConflict: true, reason: event.conflictReason, detectedAt: event.conflictDetectedAt }"
                            [size]="event.heightPx < TIME_VISIBLE_MIN_HEIGHT ? 'sm' : 'md'">
                          </app-conflict-badge>
                        }
                        <span class="event-title">{{ event.title }}</span>
                        @if (event.heightPx >= TIME_VISIBLE_MIN_HEIGHT) {
                          <span class="event-time">{{ event.timeLabel }}</span>
                        }
                        @if (event.isRecurring) {
                          <mat-icon class="recurring-icon">repeat</mat-icon>
                        }
                      </div>
                      @if (!readOnly) {
                        <div class="resize-handle" (mousedown)="onResizeStart($event, event)"></div>
                      }
                    }
                  </div>
                }

                <!-- Linea ora corrente: solo nelle colonne del giorno di oggi
                     (in vista settimanale NON deve attraversare gli altri giorni) -->
                @if (currentTimeTop >= 0 && isTodayColumn(col)) {
                  <div class="current-time-line-col" [style.top.px]="currentTimeTop">
                    @if (isFirstTodayColumn($index)) {
                      <div class="current-time-dot"></div>
                    }
                  </div>
                }

                @for (slot of getSlotsForColumn(col.operatorId, col.date); track slot.startTime) {
                  <div class="available-slot-overlay"
                       [class.paste-target]="pasteMode"
                       [attr.data-paste-slot]="pasteMode ? slotKey(slot) : null"
                       [style.top.px]="slot.topPx"
                       [style.height.px]="slot.heightPx"
                       [style.border-color]="slot.color"
                       [class.compact-slot]="slot.heightPx < 50"
                       (click)="onAvailableSlotClick($event, slot)"
                       (dblclick)="onAvailableSlotDblClick($event, slot)">
                    <span class="slot-time">{{ slot.startTime }} - {{ slot.endTime }}</span>
                    @if (slot.heightPx >= 50) {
                      <span class="slot-label">{{ pasteMode ? 'Incolla qui' : 'Disponibile' }}</span>
                    }
                  </div>
                }
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

    /* Paziente non presentato: striscia stretta a lato, sbiadita e a righe.
       Resta visibile come promemoria dell'assenza (prima l'appuntamento
       spariva del tutto dal calendario) ma non occupa piu' la fascia, che e'
       tornata libera per una nuova prenotazione. Il nome del paziente non ci
       sta: vive nel tooltip. */
    .event-chip.no-show {
      opacity: 0.6;
      padding: 0;
      background-image: repeating-linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.3) 0,
        rgba(255, 255, 255, 0.3) 4px,
        transparent 4px,
        transparent 8px
      );
      border: 1px dashed rgba(255, 255, 255, 0.9);

      &:hover {
        opacity: 0.95;
      }
    }

    .no-show-strip {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
      overflow: hidden;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: white;
      }
    }

    /* Conflitto di disponibilità: contorno tratteggiato rosso in aggiunta al
       triangolo. Il chip conserva il colore dell'operatore (serve a leggere
       la griglia a colpo d'occhio) quindi la segnalazione deve stare sul
       bordo, dove nessun colore operatore può confondersi con essa. */
    .event-chip.has-conflict {
      outline: 2px dashed #dc2626;
      outline-offset: -2px;
    }

    /* In sola lettura (vista operatore) il resize-handle non viene
       renderizzato: manca la striscia bianca che per la segreteria separa
       visivamente i chip impilati, e appuntamenti consecutivi dello stesso
       colore si fondono in un blocco unico. Bordo basso marcato come
       separatore. */
    .event-chip.read-only {
      border-bottom: 3px solid rgba(255, 255, 255, 0.9);
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

    /* Il badge è un componente figlio: il suo host va allineato a mano,
       perché .event-content usa align-items:baseline (giusto per testo e
       orario) e un'icona su baseline resterebbe appesa troppo in basso. */
    .event-content app-conflict-badge {
      flex: 0 0 auto;
      display: inline-flex;
      align-self: center;
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

    /* Segmento della linea ora corrente, uno per ogni colonna operatore del
       giorno di oggi: i segmenti adiacenti si fondono visivamente in una
       linea continua limitata alla colonna del giorno. */
    .current-time-line-col {
      position: absolute;
      left: 0;
      right: -1px; /* copre il border-right della colonna, niente gap */
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

    /* ===== MODALITA' COPIA/INCOLLA ===== */

    /* Fase selezione: gli appuntamenti diventano "copiabili" (cursore copia,
       leggero rilievo) per invitare al click che copia l'appuntamento. */
    .grid-body.selection-mode .event-chip.copyable {
      cursor: copy;
      outline: 2px solid rgba(67, 56, 202, 0.6);
      outline-offset: 1px;
    }
    .grid-body.selection-mode .event-chip.copyable:hover {
      outline-color: #4338ca;
      box-shadow: 0 2px 10px rgba(67, 56, 202, 0.45);
    }

    /* Fase incollo: gli appuntamenti esistenti si attenuano e non sono
       interattivi; restano protagonisti solo gli slot dove incollare. */
    .grid-body.paste-mode .event-chip {
      opacity: 0.35;
      pointer-events: none;
    }

    /* Slot bersaglio dell'incollo: evidenziato (verde piu' marcato) e
       pulsante per attirare l'occhio. */
    .available-slot-overlay.paste-target {
      border-style: solid;
      border-width: 2px;
      background: rgba(34, 197, 94, 0.22);
      cursor: copy;
      animation: paste-target-pulse 1.4s ease-in-out infinite;
    }
    .available-slot-overlay.paste-target:hover {
      background: rgba(34, 197, 94, 0.45);
      box-shadow: 0 0 0 2px #16a34a;
    }
    @keyframes paste-target-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.0); }
      50% { box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.35); }
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
  /**
   * Modalita' selezione del flusso copia/incolla: il click su un appuntamento
   * lo copia (gestito dal container) invece di aprirne i dettagli.
   */
  /** Sola lettura: niente drag, resize o creazione su cella vuota. */
  @Input() readOnly = false;

  @Input() selectionMode = false;
  /**
   * Modalita' incollo: gli slot disponibili diventano bersagli (click o drop)
   * e gli appuntamenti esistenti si attenuano.
   */
  @Input() pasteMode = false;

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
  /**
   * Incollo su uno slot (click in pasteMode o drop della chip dal banner):
   * emette lo slot bersaglio. Il container crea il nuovo appuntamento.
   */
  @Output() pasteOnSlot = new EventEmitter<AvailableSlotPosition>();

  /** Esposto al template per la soglia di visibilita' orario. */
  readonly TIME_VISIBLE_MIN_HEIGHT = TIME_VISIBLE_MIN_HEIGHT;

  /**
   * Tooltip del chip. Il motivo del conflitto entra qui e non solo nel badge
   * perché il triangolo è alto 12px: puntarlo con precisione su una griglia
   * settimanale fitta è un esercizio di mira, mentre il chip è un bersaglio
   * grande e chi ci passa sopra vuole già sapere cosa non va.
   */
  /**
   * Larghezza della striscia con cui si disegna un'assenza, in pixel.
   * Fissa e non percentuale: le colonne cambiano larghezza con lo zoom e col
   * numero di operatori, e una percentuale darebbe una striscia a volte
   * invisibile e a volte larga mezza fascia.
   */
  readonly NO_SHOW_STRIP_PX = 22;

  /** Striscia + respiro: da qui in poi comincia lo spazio prenotabile. */
  private readonly NO_SHOW_GUTTER_PX = 24;

  /** Posizione orizzontale del chip: la striscia dell'assenza sta a sinistra. */
  chipLeft(event: PositionedEvent): string {
    if (event.isNoShow) return '0';
    if (!event.overlapsNoShow) return `${event.leftPct}%`;
    // Lo spazio utile e' la colonna meno la grondaia dell'assenza, poi
    // ripartito fra gli appuntamenti sovrapposti come al solito.
    const g = this.NO_SHOW_GUTTER_PX;
    return `calc(${g}px + (100% - ${g}px) * ${event.leftPct / 100})`;
  }

  /**
   * Larghezza del chip. Il no-show occupa solo la striscia e lascia libero il
   * resto della cella, che torna cliccabile come uno slot vuoto: e' li' che il
   * doppio clic apre la creazione di un nuovo appuntamento.
   */
  chipWidth(event: PositionedEvent): string {
    if (event.isNoShow) return `${this.NO_SHOW_STRIP_PX}px`;
    if (!event.overlapsNoShow) return `${event.widthPct}%`;
    const g = this.NO_SHOW_GUTTER_PX;
    return `calc((100% - ${g}px) * ${event.widthPct / 100})`;
  }

  tooltipFor(event: PositionedEvent): string {
    const lines = [`${event.title} | ${event.timeLabel}`];
    if (event.isNoShow) {
      lines.push('🚫 Paziente non presentato');
    }
    if (event.hasConflict) {
      lines.push(`⚠ ${conflictReasonLabel(event.conflictReason)}`);
    }
    return lines.join('\n');
  }

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

  /** Data odierna in formato YYYY-MM-DD locale (stesso formato di col.date). */
  private get todayStr(): string {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${m}-${d}`;
  }

  /** True se la colonna appartiene al giorno di oggi (segmento linea ora). */
  isTodayColumn(col: OperatorColumnData): boolean {
    return col.date === this.todayStr;
  }

  /** True solo per la prima colonna di oggi: ospita il pallino della linea. */
  isFirstTodayColumn(index: number): boolean {
    const today = this.todayStr;
    return this.gridData?.columns.findIndex(c => c.date === today) === index;
  }

  getSlotsForColumn(operatorId: string, date: string): AvailableSlotPosition[] {
    return this.availableSlots.filter(s => s.operatorId === operatorId && s.date === date);
  }

  onAvailableSlotClick(event: MouseEvent, slot: AvailableSlotPosition): void {
    event.stopPropagation();
    // In modalita' incollo il click sullo slot incolla l'appuntamento copiato
    // invece di aprire il dialog di creazione standard.
    if (this.pasteMode) {
      this.pasteOnSlot.emit(slot);
      return;
    }
    this.availableSlotClick.emit(slot);
  }

  /** Chiave univoca slot (operatore|data|inizio) per l'hit-test del drop. */
  slotKey(slot: AvailableSlotPosition): string {
    return `${slot.operatorId}|${slot.date}|${slot.startTime}`;
  }

  /**
   * Hit-test: dato un punto (coordinate viewport del rilascio della chip dal
   * banner), ritorna lo slot bersaglio sottostante, o null se non e' su uno
   * slot. Chiamato dal container su dragEnded della chip.
   *
   * Usa data-paste-slot (presente solo in pasteMode) per riconoscere lo slot
   * sotto il cursore senza accoppiare il drop a cdkDropList dinamiche.
   */
  resolveSlotAtPoint(x: number, y: number): AvailableSlotPosition | null {
    if (!this.pasteMode) return null;
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      const key = (el as HTMLElement).getAttribute?.('data-paste-slot');
      if (key) {
        return this.availableSlots.find((s) => this.slotKey(s) === key) ?? null;
      }
    }
    return null;
  }

  /** Inoltra al container l'incollo su uno slot risolto (click o drop). */
  emitPasteOnSlot(slot: AvailableSlotPosition): void {
    this.pasteOnSlot.emit(slot);
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

    // Snap a 15': lo spostamento NON è vincolato alla granularità delle
    // celle (es. 30/45') — altrimenti un rilascio a metà cella scatterebbe
    // alla mezz'ora e l'orario scelto andrebbe perso. Griglie già più fini
    // di 15' mantengono la propria granularità.
    const snapMinutes = Math.min(DRAG_SNAP_MINUTES, slotDuration);
    const pxPerMinute = pxPerSlot / slotDuration;
    const minuteDelta = Math.round(delta.y / pxPerMinute / snapMinutes) * snapMinutes;

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
      // Stesso snap a 15' del drag: la durata non deve essere vincolata
      // alla granularità delle celle.
      const snapMinutes = Math.min(DRAG_SNAP_MINUTES, slotDuration);
      const minuteDelta = Math.round(deltaY / pxPerMinute / snapMinutes) * snapMinutes;

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
