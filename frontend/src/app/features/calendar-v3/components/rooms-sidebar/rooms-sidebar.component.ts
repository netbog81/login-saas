import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Room } from '../../../../services/room.service';
import { LegendOperator, RoomsViewPeriod } from '../../models/rooms-view.model';

/**
 * Pannello laterale della vista calendario "Studi" (visibile solo in quella
 * modalità): selettore del periodo mostrato (auto = ciclo massimo dei
 * template applicati, oppure 1-4 settimane forzate) e abilita/disabilita dei
 * singoli studi, stile pannello operatori.
 */
@Component({
  selector: 'app-rooms-sidebar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rooms-sidebar">
      <!-- Periodo (solo vista settimanale) -->
      <div class="panel-section" *ngIf="showPeriod">
        <div class="section-title">Periodo</div>
        <div class="period-buttons">
          <button
            class="period-btn"
            [class.active]="period === 'auto'"
            (click)="periodChange.emit('auto')"
            [title]="'Automatico: ciclo più lungo tra i template applicati (' + autoWeeks + ' sett.)'"
          >
            Auto ({{ autoWeeks }})
          </button>
          <button
            *ngFor="let w of [1, 2, 3, 4]"
            class="period-btn"
            [class.active]="period === w"
            (click)="periodChange.emit(w)"
          >
            {{ w }} sett.
          </button>
        </div>
      </div>

      <!-- Studi -->
      <div class="panel-section">
        <div class="section-title">
          Studi
          <span class="section-actions">
            <button class="link-btn" (click)="setAll.emit(true)">tutti</button>
            <button class="link-btn" (click)="setAll.emit(false)">nessuno</button>
          </span>
        </div>
        <label class="room-row" *ngFor="let room of rooms">
          <input
            type="checkbox"
            [checked]="selectedIds.has(room.id)"
            (change)="toggleRoom.emit(room.id)"
          />
          <span class="room-dot" [style.background]="room.color || '#4A90E2'"></span>
          <span class="room-name">{{ room.name }}</span>
        </label>
        <p class="no-rooms" *ngIf="rooms.length === 0">
          Nessuno studio attivo configurato.
        </p>
      </div>

      <!-- Legenda colori operatori (dalle occupazioni nel periodo caricato) -->
      <div class="panel-section" *ngIf="legendOperators.length > 0">
        <div class="section-title">Operatori</div>
        <div class="legend-row" *ngFor="let op of legendOperators">
          <span class="room-dot" [style.background]="op.color"></span>
          <span class="room-name">{{ op.name }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .rooms-sidebar {
      width: 220px;
      flex-shrink: 0;
      background: white;
      border-right: 1px solid #e2e8f0;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .panel-section {
      .section-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
        margin-bottom: 8px;
      }

      .section-actions {
        display: flex;
        gap: 6px;
        text-transform: none;
      }

      .link-btn {
        border: none;
        background: transparent;
        color: #007bff;
        font-size: 11px;
        cursor: pointer;
        padding: 0;

        &:hover { text-decoration: underline; }
      }
    }

    .period-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;

      .period-btn {
        border: 1px solid #cbd5e1;
        background: white;
        border-radius: 14px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        color: #475569;
        cursor: pointer;

        &.active {
          background: #007bff;
          border-color: #007bff;
          color: white;
        }
      }
    }

    .room-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 4px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      color: #1e293b;

      &:hover { background: #f1f5f9; }

      input[type='checkbox'] {
        width: 15px;
        height: 15px;
      }

      .room-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .room-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .no-rooms {
      font-size: 13px;
      color: #94a3b8;
      font-style: italic;
    }

    .legend-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 4px;
      font-size: 13px;
      color: #334155;

      .room-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .room-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  `],
})
export class RoomsSidebarComponent {
  @Input() rooms: Room[] = [];
  @Input() selectedIds = new Set<string>();
  @Input() period: RoomsViewPeriod = 'auto';
  @Input() autoWeeks = 1;
  /** false in vista giornaliera: il periodo non si applica. */
  @Input() showPeriod = true;
  /** Legenda colori operatori (solo vista Studi). */
  @Input() legendOperators: LegendOperator[] = [];

  @Output() toggleRoom = new EventEmitter<string>();
  @Output() setAll = new EventEmitter<boolean>();
  @Output() periodChange = new EventEmitter<RoomsViewPeriod>();
}
