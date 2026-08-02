import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  NoShowEvent,
  arrivalSourceLabel,
  decisionLabel,
  eventTypeIcon,
  eventTypeLabel,
} from '../../models/no-show.model';

/**
 * Riga di un singolo evento (componente dumb), condivisa da vista ad albero
 * ed elenco piatto.
 *
 * Mostra sempre l'operatore/istruttore di riferimento: è la domanda che lo
 * staff si fa subito ("chi è rimasto con lo slot vuoto?"), ed è anche il
 * modo per accorgersi che l'assenza è caduta su un sostituto.
 */
@Component({
  selector: 'app-no-show-event-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    @if (event; as ev) {
      <div class="event-row" [class.compact]="compact">
        <span class="type" [attr.data-type]="ev.eventType" [matTooltip]="typeTooltip(ev)">
          <mat-icon>{{ icon(ev.eventType) }}</mat-icon>
          {{ label(ev.eventType) }}
        </span>

        <span class="when">
          {{ ev.appointmentDate | date: 'EEE dd/MM/yyyy' }}
          <b>{{ ev.startTime }}</b>
        </span>

        @if (showPatient) {
          <span class="patient">{{ ev.patientName }}</span>
        }

        <span class="operator">
          <mat-icon>{{ ev.appointmentType === 'gym' ? 'fitness_center' : 'medical_services' }}</mat-icon>
          {{ ev.operatorName || 'Senza operatore' }}
          @if (ev.isSubstitution && ev.originalOperatorName) {
            <em class="sub" [matTooltip]="'Sostituiva ' + ev.originalOperatorName">(sost.)</em>
          }
          @if (ev.gymRoomName) {
            <em class="room">· {{ ev.gymRoomName }}</em>
          }
        </span>

        @if (ev.serviceNames.length) {
          <span class="services" [matTooltip]="ev.serviceNames.join(', ')">
            {{ ev.serviceNames[0] }}@if (ev.serviceNames.length > 1) { <em>+{{ ev.serviceNames.length - 1 }}</em> }
          </span>
        }

        <span class="detail">
          @if (ev.cancellationHoursNotice != null) {
            <span [matTooltip]="ev.cancellationReason || 'Nessun motivo indicato'">
              preavviso {{ ev.cancellationHoursNotice | number: '1.0-1' }}h
            </span>
          }
          @if (ev.lateMinutes != null) {
            <span [matTooltip]="arrivalSource(ev.arrivalSource)">
              +{{ ev.lateMinutes }} min
            </span>
          }
          @if (ev.wasNoShowReverted) {
            <span class="reverted" matTooltip="Era stato segnato non presentato, poi si è presentato">
              recuperato
            </span>
          }
        </span>

        <span class="review" [attr.data-decision]="ev.review?.decision || 'PENDING'">
          {{ decision(ev) }}
        </span>

        <button
          mat-button
          class="review-btn"
          matTooltip="Decidi se addebitare la seduta"
          (click)="reviewClick.emit(ev)">
          <mat-icon>gavel</mat-icon>
        </button>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .event-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 7px 10px; border-top: 1px solid rgba(0,0,0,0.06);
      font-size: 13px;
    }
    .event-row:hover { background: #fafafa; }

    .type {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 12px; font-size: 12px; white-space: nowrap;
      background: #eee; color: rgba(0,0,0,0.7);
    }
    .type mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .type[data-type="NO_SHOW"] { background: #ffebee; color: #c62828; }
    .type[data-type="CANCELLED_LATE"] { background: #fff3e0; color: #e65100; }
    .type[data-type="CANCELLED_UNKNOWN"] { background: #f3e5f5; color: #6a1b9a; }
    .type[data-type="CANCELLED_EARLY"] { background: #e8f5e9; color: #2e7d32; }
    .type[data-type="LATE_ARRIVAL"] { background: #e3f2fd; color: #1565c0; }

    .when { white-space: nowrap; color: rgba(0,0,0,0.75); min-width: 150px; }
    .patient { font-weight: 500; min-width: 150px; }
    .operator {
      display: inline-flex; align-items: center; gap: 4px;
      color: rgba(0,0,0,0.7); white-space: nowrap;
    }
    .operator mat-icon { font-size: 15px; width: 15px; height: 15px; color: rgba(0,0,0,0.4); }
    .operator .sub, .operator .room { font-style: normal; color: rgba(0,0,0,0.45); font-size: 12px; }
    .services {
      color: rgba(0,0,0,0.55); font-size: 12px; max-width: 180px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .detail { display: flex; gap: 8px; color: rgba(0,0,0,0.55); font-size: 12px; margin-left: auto; }
    .detail .reverted { color: #1565c0; }

    .review {
      font-size: 11.5px; padding: 2px 8px; border-radius: 10px;
      background: #f0f0f0; color: rgba(0,0,0,0.6); white-space: nowrap;
    }
    .review[data-decision="PENDING"] { background: #fff3e0; color: #e65100; }
    .review[data-decision="TO_CHARGE"] { background: #ffebee; color: #c62828; }
    .review[data-decision="WAIVED"] { background: #e8f5e9; color: #2e7d32; }
    .review[data-decision="JUSTIFIED"] { background: #e3f2fd; color: #1565c0; }

    .review-btn { min-width: 0; padding: 0 6px; }
    .review-btn mat-icon { font-size: 17px; width: 17px; height: 17px; }
  `],
})
export class NoShowEventRowComponent {
  @Input({ required: true }) event!: NoShowEvent;
  /** Nell'albero il paziente è già nell'intestazione del gruppo. */
  @Input() showPatient = true;
  @Input() compact = false;

  @Output() reviewClick = new EventEmitter<NoShowEvent>();

  label = eventTypeLabel;
  icon = eventTypeIcon;
  arrivalSource = arrivalSourceLabel;

  decision(event: NoShowEvent): string {
    return decisionLabel(event.review?.decision ?? 'PENDING');
  }

  typeTooltip(event: NoShowEvent): string {
    if (event.cancellationReason) return event.cancellationReason;
    if (event.eventType === 'CANCELLED_UNKNOWN') {
      return 'Disdetta storica: il preavviso non è stato calcolato';
    }
    return eventTypeLabel(event.eventType);
  }
}
