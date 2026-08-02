import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { NoShowEvent } from '../../models/no-show.model';
import { NoShowEventRowComponent } from '../no-show-event-row/no-show-event-row.component';

/**
 * Elenco piatto degli eventi, dal più recente (componente dumb).
 * È la vista "cronologica": utile quando si guarda la giornata o la
 * settimana, mentre l'albero serve a giudicare il singolo paziente.
 */
@Component({
  selector: 'app-no-show-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, NoShowEventRowComponent],
  template: `
    <div class="list">
      @for (event of events; track event.appointmentId) {
        <app-no-show-event-row
          [event]="event"
          [showPatient]="true"
          (reviewClick)="reviewClick.emit($event)" />
      } @empty {
        <div class="state-msg">Nessun evento nel periodo e nei filtri selezionati.</div>
      }
    </div>

    @if (events.length && events.length < total) {
      <div class="more">
        <span>{{ events.length }} di {{ total }}</span>
        <button mat-stroked-button (click)="loadMore.emit()">
          <mat-icon>expand_more</mat-icon> Carica altri
        </button>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .list {
      background: #fff; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px;
      overflow: hidden;
    }
    .state-msg { padding: 28px; text-align: center; color: rgba(0,0,0,0.5); }
    .more {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      padding: 12px; font-size: 12.5px; color: rgba(0,0,0,0.55);
    }
  `],
})
export class NoShowListComponent {
  @Input() events: NoShowEvent[] = [];
  @Input() total = 0;

  @Output() reviewClick = new EventEmitter<NoShowEvent>();
  @Output() loadMore = new EventEmitter<void>();
}
