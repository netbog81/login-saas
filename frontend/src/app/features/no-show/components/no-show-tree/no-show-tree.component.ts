import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  NoShowEvent,
  NoShowPatientGroup,
  NoShowSummary,
  patientSeverity,
  severityLabel,
} from '../../models/no-show.model';
import { NoShowEventRowComponent } from '../no-show-event-row/no-show-event-row.component';

/**
 * Vista ad albero: un nodo per paziente, espandibile sui singoli eventi
 * (componente dumb).
 *
 * Accanto ai conteggi del periodo filtrato mostra sempre le due finestre
 * SCORREVOLI (ultimi N giorni e ultimi 12 mesi): è la differenza tra "due
 * assenze in un anno", che capita, e "due assenze in un mese", che è un
 * problema. L'anno solare, che è come aggrega il log storico, non lo
 * distingue.
 *
 * Niente `mat-tree`: in tutta l'app non è mai usato, e per due soli livelli
 * righe espandibili sono più leggere e più coerenti col resto.
 */
@Component({
  selector: 'app-no-show-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    NoShowEventRowComponent,
  ],
  template: `
    <div class="tree">
      @for (group of groups; track group.patientId || group.patientName) {
        <div class="group" [class.expanded]="isExpanded(group)">
          <button class="group-header" (click)="toggle(group)">
            <mat-icon class="chevron">
              {{ isExpanded(group) ? 'expand_more' : 'chevron_right' }}
            </mat-icon>

            <span class="patient-name">{{ group.patientName }}</span>

            <span class="severity" [attr.data-severity]="severity(group)">
              {{ severityText(group) }}
            </span>

            <span class="counts">
              @if (group.counts.noShow) {
                <span class="count no-show" matTooltip="Non presentato">
                  <mat-icon>person_off</mat-icon> {{ group.counts.noShow }}
                </span>
              }
              @if (group.counts.cancelledLate) {
                <span class="count late" matTooltip="Disdetta tardiva">
                  <mat-icon>event_busy</mat-icon> {{ group.counts.cancelledLate }}
                </span>
              }
              @if (group.counts.cancelledUnknown) {
                <span class="count unknown" matTooltip="Disdetta storica, preavviso ignoto">
                  <mat-icon>help_outline</mat-icon> {{ group.counts.cancelledUnknown }}
                </span>
              }
              @if (group.counts.cancelledEarly) {
                <span class="count early" matTooltip="Disdetta con preavviso: nessuna penalità">
                  <mat-icon>event_available</mat-icon> {{ group.counts.cancelledEarly }}
                </span>
              }
              @if (group.counts.lateArrival) {
                <span class="count arrival" matTooltip="Arrivato in ritardo">
                  <mat-icon>schedule</mat-icon> {{ group.counts.lateArrival }}
                </span>
              }
            </span>

            <span class="windows">
              <span
                class="window"
                [class.hot]="group.recent.unjustified >= 2"
                [matTooltip]="'Assenze ingiustificate negli ultimi ' + recentWindowDays + ' giorni'">
                {{ group.recent.unjustified }} <em>/ {{ recentWindowDays }}gg</em>
              </span>
              <span
                class="window"
                [class.hot]="group.rollingYear.unjustified >= 4"
                matTooltip="Assenze ingiustificate negli ultimi 12 mesi scorrevoli">
                {{ group.rollingYear.unjustified }} <em>/ 12 mesi</em>
              </span>
            </span>

            @if (group.pendingReviews) {
              <span class="pending" matTooltip="Eventi ancora da valutare">
                {{ group.pendingReviews }} da valutare
              </span>
            }

            <span class="last-event">
              ultimo: {{ group.lastEventDate | date: 'dd/MM/yy' }}
            </span>
          </button>

          @if (isExpanded(group)) {
            <div class="group-events">
              @for (event of group.events; track event.appointmentId) {
                <app-no-show-event-row
                  [event]="event"
                  [showPatient]="false"
                  (reviewClick)="reviewClick.emit($event)" />
              }
            </div>
          }
        </div>
      } @empty {
        <div class="state-msg">Nessun paziente con assenze nel periodo e nei filtri selezionati.</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .tree {
      background: #fff; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px;
      overflow: hidden;
    }
    .group + .group { border-top: 1px solid rgba(0,0,0,0.09); }
    .group.expanded { background: #fcfcfd; }

    .group-header {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 9px 12px; background: none; border: 0; cursor: pointer;
      text-align: left; font: inherit; font-size: 13.5px;
    }
    .group-header:hover { background: #f5f5f5; }
    .chevron { color: rgba(0,0,0,0.4); font-size: 20px; width: 20px; height: 20px; }

    .patient-name { font-weight: 600; min-width: 180px; }

    .severity {
      font-size: 11px; padding: 2px 8px; border-radius: 10px; white-space: nowrap;
      background: #eee; color: rgba(0,0,0,0.6);
    }
    .severity[data-severity="watch"] { background: #fff3e0; color: #e65100; }
    .severity[data-severity="alert"] { background: #ffebee; color: #c62828; font-weight: 600; }

    .counts { display: flex; gap: 6px; }
    .count {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 1px 7px; border-radius: 10px; font-size: 12px; background: #f0f0f0;
    }
    .count mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .count.no-show { background: #ffebee; color: #c62828; }
    .count.late { background: #fff3e0; color: #e65100; }
    .count.unknown { background: #f3e5f5; color: #6a1b9a; }
    .count.early { background: #e8f5e9; color: #2e7d32; }
    .count.arrival { background: #e3f2fd; color: #1565c0; }

    .windows { display: flex; gap: 6px; margin-left: auto; }
    .window {
      font-size: 12px; padding: 2px 8px; border-radius: 4px;
      background: #f5f5f5; color: rgba(0,0,0,0.65); white-space: nowrap;
    }
    .window em { font-style: normal; color: rgba(0,0,0,0.4); font-size: 11px; }
    .window.hot { background: #ffebee; color: #c62828; font-weight: 600; }

    .pending {
      font-size: 11.5px; padding: 2px 8px; border-radius: 10px;
      background: #fff3e0; color: #e65100; white-space: nowrap;
    }
    .last-event { font-size: 11.5px; color: rgba(0,0,0,0.45); white-space: nowrap; }

    .group-events { padding-left: 30px; padding-bottom: 4px; }
    .state-msg { padding: 28px; text-align: center; color: rgba(0,0,0,0.5); }
  `],
})
export class NoShowTreeComponent {
  @Input() groups: NoShowPatientGroup[] = [];
  @Input() summary: NoShowSummary | null = null;

  @Output() reviewClick = new EventEmitter<NoShowEvent>();

  private readonly expanded = new Set<string>();

  get recentWindowDays(): number {
    return this.summary?.recentWindowDays ?? 30;
  }

  severity = patientSeverity;

  severityText(group: NoShowPatientGroup): string {
    return severityLabel(patientSeverity(group));
  }

  isExpanded(group: NoShowPatientGroup): boolean {
    return this.expanded.has(NoShowTreeComponent.key(group));
  }

  toggle(group: NoShowPatientGroup): void {
    const key = NoShowTreeComponent.key(group);
    if (this.expanded.has(key)) this.expanded.delete(key);
    else this.expanded.add(key);
  }

  private static key(group: NoShowPatientGroup): string {
    return group.patientId ?? group.patientName;
  }
}
