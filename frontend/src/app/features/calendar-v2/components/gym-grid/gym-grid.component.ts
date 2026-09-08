/**
 * Gym Grid Component
 * Layer 1: Dumb Component
 *
 * Griglia palestra: colonne = gym room (per ogni data in weekly).
 * Daily: 1 set di colonne room. Weekly: N set (1 per giorno) orizzontali.
 * Ogni cella mostra: operatore, capacita' (N/M), mini-chip appuntamenti.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { GymSlotInfo, GymAppointment } from '../../../../services/gym-room.service';
import { TimeSlot } from '../../models/calendar-v2.model';
import { ConflictBadgeComponent } from '../../../conflicts/components/conflict-badge/conflict-badge.component';
import { conflictReasonLabel } from '../../../conflicts/models/conflict.model';

export interface GymRoom {
  id: string;
  name: string;
  color?: string;
  maxCapacity: number;
}

export interface GymSlotClickEvent {
  gymRoom: GymRoom;
  date: string;
  startTime: string;
  endTime: string;
  slotInfo: GymSlotInfo;
  mouseEvent: MouseEvent;
}

/**
 * Click su un mini-chip appuntamento dentro uno slot palestra.
 *
 * Porta con se' anche il contesto dello slot (room / data / orario / slotInfo):
 * il dialog di modifica ne ha bisogno per l'intestazione e per caricare i
 * servizi dell'operatore, esattamente come per la creazione.
 */
export interface GymAppointmentClickEvent {
  appointment: GymAppointment;
  gymRoom: GymRoom;
  date: string;
  startTime: string;
  endTime: string;
  slotInfo: GymSlotInfo;
  mouseEvent: MouseEvent;
}

/** Colonna pre-calcolata: 1 room in 1 giorno */
interface GymColumn {
  room: GymRoom;
  date: string;
  dateLabel: string;
}

@Component({
  selector: 'app-gym-grid-v2',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatTooltipModule, MatIconModule, ConflictBadgeComponent],
  template: `
    <!-- Day group headers (weekly) -->
    @if (isWeekly) {
      <div class="day-headers-row" [style.margin-left.px]="timeColumnWidth">
        @for (date of dates; track date) {
          <div class="day-group-header" [style.flex-basis.%]="100 / dates.length">
            <div class="day-label">{{ formatDateShort(date) }}</div>
          </div>
        }
      </div>
    }

    <!-- Column headers (room names) -->
    <div class="grid-header-row">
      <div class="time-corner" [style.width.px]="timeColumnWidth"></div>
      <div class="header-columns" #headerRef>
        @for (col of columns; track col.room.id + col.date) {
          <div class="room-header"
               [style.min-width.px]="compactMode ? 0 : columnWidth"
               [class.flex-col]="compactMode"
               [style.background]="col.room.color || '#10b981'"
               [matTooltip]="compactMode ? col.room.name + (isWeekly ? ' - ' + col.dateLabel : '') : ''">
            @if (!compactMode) {
              <span class="room-name">{{ col.room.name }}</span>
            }
          </div>
        }
      </div>
    </div>

    <!-- Grid body -->
    <div class="grid-body" #gridBodyRef>
      <!-- Time column -->
      <div class="time-column" [style.width.px]="timeColumnWidth">
        @for (slot of timeSlots; track slot.index) {
          <div class="time-label" [style.height.px]="slotHeight">{{ slot.time }}</div>
        }
      </div>

      <!-- Room columns -->
      @for (col of columns; track col.room.id + col.date) {
        <div class="room-column"
             [style.min-width.px]="compactMode ? 0 : columnWidth"
             [class.flex-col]="compactMode"
             [class.day-separator]="isFirstRoomOfDay(col)">
          @for (slot of timeSlots; track slot.index) {
            @let slotInfo = getSlotInfo(col.room.id, col.date, slot.time);
            <div class="gym-slot"
                 [class.slot-available]="slotInfo?.isAvailable"
                 [class.slot-full]="slotInfo && !slotInfo.isAvailable && !slotInfo.isClosed"
                 [class.slot-closed]="slotInfo?.isClosed"
                 [class.slot-no-template]="!slotInfo"
                 [class.slot-has-conflict]="hasConflictInSlot(col.room.id, col.date, slot.time)"
                 [style.height.px]="slotHeight"
                 [style.border-left-color]="slotInfo?.operator?.color || 'transparent'"
                 (click)="onSlotClick(col.room, col.date, slot, slotInfo, $event)"
                 (dblclick)="onSlotDblClick(col.room, col.date, slot, slotInfo, $event)">

              @if (slotInfo) {
                <div class="slot-header">
                  <span class="slot-operator" [matTooltip]="getOperatorFullName(slotInfo)">
                    {{ slotInfo.operator?.name || '' }}
                  </span>
                  <span class="slot-capacity"
                        [class.cap-available]="slotInfo.isAvailable"
                        [class.cap-full]="!slotInfo.isAvailable">
                    {{ slotInfo.currentCount }}/{{ slotInfo.maxCapacity }}
                  </span>
                </div>
                @for (apt of getSlotAppointments(col.room.id, col.date, slot.time); track apt.id) {
                  <div class="mini-apt"
                       [class.apt-conflict]="apt.hasConflict"
                       [matTooltip]="appointmentTooltip(apt)"
                       (click)="onAppointmentClick(apt, col.room, col.date, slot, slotInfo, $event)">
                    <!-- Il triangolo apre il chip: in palestra i mini-chip
                         sono impilati e larghi quanto la colonna, quindi il
                         nome viene troncato da destra e un badge in coda
                         sparirebbe proprio dove serve. -->
                    @if (apt.hasConflict) {
                      <app-conflict-badge
                        [conflict]="{ hasConflict: true, reason: apt.conflictReason, detectedAt: apt.conflictDetectedAt }"
                        size="sm">
                      </app-conflict-badge>
                    }
                    {{ apt.clientName }}
                    @if (apt.isRecurring) {
                      <mat-icon class="recurring-badge">repeat</mat-icon>
                    }
                  </div>
                }
              } @else {
                <div class="no-template">-</div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    /* ===== DAY HEADERS (weekly) ===== */
    .day-headers-row {
      display: flex;
      flex-shrink: 0;
      background: white;
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

    /* ===== HEADER ===== */
    .grid-header-row {
      display: flex;
      flex-shrink: 0;
      background: white;
      border-bottom: 1px solid #e2e8f0;
    }

    .time-corner {
      flex-shrink: 0;
      border-right: 1px solid #cbd5e1;
    }

    .header-columns {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .room-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-right: 1px solid rgba(255,255,255,0.3);
      color: white;
      text-align: center;
      min-height: 14px;
    }

    .room-header.flex-col { flex: 1; min-width: 0; }

    .room-name {
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    /* ===== BODY ===== */
    .grid-body {
      display: flex;
      flex: 1;
      overflow: auto;
      min-height: 0;
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
      box-sizing: border-box;
    }

    /* ===== ROOM COLUMNS ===== */
    .room-column {
      border-right: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .room-column.flex-col { flex: 1; min-width: 0; }
    .room-column.day-separator { border-left: 2px solid #cbd5e1; }

    /* ===== SLOTS ===== */
    .gym-slot {
      position: relative;
      border-bottom: 1px solid #f1f5f9;
      border-left: 3px solid transparent;
      box-sizing: border-box;
      padding: 2px 4px;
      cursor: pointer;
      overflow: hidden;
      font-size: 0.7rem;
      &:hover { background: rgba(0, 0, 0, 0.02); }
    }

    .slot-available { background: #f0fdf4; }
    .slot-full { background: #fef2f2; }
    .slot-closed { background: #f1f5f9; cursor: default; }
    .slot-no-template { background: #fafafa; cursor: default; }

    .slot-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 4px;
    }

    .slot-operator {
      font-size: 0.65rem;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .slot-capacity {
      font-size: 0.6rem;
      font-weight: 600;
      padding: 0 4px;
      border-radius: 8px;
      white-space: nowrap;
    }

    .cap-available { background: #dcfce7; color: #15803d; }
    .cap-full { background: #fee2e2; color: #dc2626; }

    .mini-apt {
      font-size: 0.6rem;
      color: #334155;
      padding: 1px 4px;
      margin-top: 1px;
      background: rgba(99, 102, 241, 0.08);
      border-radius: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      &:hover { background: rgba(99, 102, 241, 0.15); }
    }

    /* Prenotazione in conflitto: fondo e bordo rossi in aggiunta al
       triangolo. Il mini-chip è alto ~12px, troppo poco perché un'icona da
       sola si noti scorrendo una griglia settimanale. */
    .mini-apt.apt-conflict {
      background: #fee2e2;
      box-shadow: inset 0 0 0 1px #fca5a5;
      color: #7f1d1d;
      &:hover { background: #fecaca; }
    }

    .mini-apt app-conflict-badge {
      display: inline-flex;
      vertical-align: middle;
      margin-right: 2px;
    }

    /* Slot che contiene almeno una prenotazione in conflitto: marcatore sul
       bordo della cella, per trovarla senza dover leggere i singoli chip. */
    .gym-slot.slot-has-conflict {
      box-shadow: inset 3px 0 0 #dc2626;
    }

    .recurring-badge {
      font-size: 10px;
      width: 10px;
      height: 10px;
      vertical-align: middle;
      color: #e65100;
    }

    .no-template {
      color: #cbd5e1;
      text-align: center;
      padding-top: 4px;
    }
  `],
})
export class GymGridComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gridBodyRef') gridBodyRef?: ElementRef<HTMLDivElement>;
  @ViewChild('headerRef') headerRef?: ElementRef<HTMLDivElement>;

  @Input() timeSlots: TimeSlot[] = [];
  @Input() gymRooms: GymRoom[] = [];
  @Input() dates: string[] = [];
  @Input() allSlotsInfo: Map<string, Map<string, any[]>> = new Map();
  @Input() allAppointments: Map<string, Map<string, any[]>> = new Map();
  @Input() slotHeight = 60;
  @Input() timeColumnWidth = 56;
  @Input() columnWidth = 200;
  @Input() compactMode = true;
  @Input() isWeekly = false;

  @Output() slotClick = new EventEmitter<GymSlotClickEvent>();
  @Output() slotDblClick = new EventEmitter<GymSlotClickEvent>();
  @Output() appointmentClick = new EventEmitter<GymAppointmentClickEvent>();

  private scrollListener?: () => void;

  /** Colonne pre-calcolate: daily = 1 room per colonna, weekly = room × date */
  get columns(): GymColumn[] {
    const cols: GymColumn[] = [];
    for (const date of this.dates) {
      for (const room of this.gymRooms) {
        cols.push({ room, date, dateLabel: this.formatDateShort(date) });
      }
    }
    return cols;
  }

  isFirstRoomOfDay(col: GymColumn): boolean {
    if (!this.isWeekly) return false;
    return this.gymRooms.length > 0 && col.room.id === this.gymRooms[0].id;
  }

  ngAfterViewInit(): void {
    if (this.gridBodyRef?.nativeElement) {
      this.scrollListener = () => {
        if (this.headerRef?.nativeElement && this.gridBodyRef?.nativeElement) {
          this.headerRef.nativeElement.scrollLeft = this.gridBodyRef.nativeElement.scrollLeft;
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

  getSlotInfo(roomId: string, date: string, time: string): GymSlotInfo | undefined {
    const dateMap = this.allSlotsInfo.get(date);
    const slots = dateMap?.get(roomId);
    return slots?.find((s: any) => s.startTime === time);
  }

  getSlotAppointments(roomId: string, date: string, time: string): GymAppointment[] {
    const dateMap = this.allAppointments.get(date);
    const apts = dateMap?.get(roomId);
    return apts?.filter((a: any) => a.startTime === time) || [];
  }

  /** True se lo slot contiene almeno una prenotazione in conflitto. */
  hasConflictInSlot(roomId: string, date: string, time: string): boolean {
    return this.getSlotAppointments(roomId, date, time).some((a) => a.hasConflict);
  }

  /**
   * Tooltip del mini-chip. Il motivo entra qui e non solo nel badge: il
   * triangolo qui è da 12px, e su una griglia settimanale puntarlo è
   * scomodo — il chip invece è tutto bersaglio.
   */
  appointmentTooltip(apt: GymAppointment): string {
    const base = apt.clientName + (apt.notes ? ` - ${apt.notes}` : '');
    return apt.hasConflict
      ? `${base}\n⚠ ${conflictReasonLabel(apt.conflictReason)}`
      : base;
  }

  getOperatorFullName(slotInfo: GymSlotInfo): string {
    if (!slotInfo.operator) return '';
    return `${slotInfo.operator.name}${slotInfo.operator.surname ? ' ' + slotInfo.operator.surname : ''}`;
  }

  formatDateShort(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  onSlotClick(room: GymRoom, date: string, slot: TimeSlot, slotInfo: GymSlotInfo | undefined, event: MouseEvent): void {
    if (!slotInfo) return;
    this.slotClick.emit({
      gymRoom: room, date, startTime: slot.time,
      endTime: slotInfo.endTime || slot.time,
      slotInfo, mouseEvent: event,
    });
  }

  onSlotDblClick(room: GymRoom, date: string, slot: TimeSlot, slotInfo: GymSlotInfo | undefined, event: MouseEvent): void {
    event.preventDefault();
    if (!slotInfo || !slotInfo.isAvailable) return;
    this.slotDblClick.emit({
      gymRoom: room, date, startTime: slot.time,
      endTime: slotInfo.endTime || slot.time,
      slotInfo, mouseEvent: event,
    });
  }

  /**
   * Click sul mini-chip di un appuntamento: NON deve propagare allo slot
   * (che significherebbe "prenota"), ma deve portare al container il contesto
   * completo dello slot per aprire la scheda dell'appuntamento cliccato.
   */
  onAppointmentClick(
    apt: GymAppointment,
    room: GymRoom,
    date: string,
    slot: TimeSlot,
    slotInfo: GymSlotInfo | undefined,
    event: MouseEvent,
  ): void {
    event.stopPropagation();
    if (!slotInfo) return;
    this.appointmentClick.emit({
      appointment: apt,
      gymRoom: room,
      date,
      startTime: slot.time,
      endTime: slotInfo.endTime || slot.time,
      slotInfo,
      mouseEvent: event,
    });
  }
}
