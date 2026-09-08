/**
 * Calendar Sync Settings Panel
 * Layer 1: Dumb Component
 *
 * Le due scelte dello studio su cosa il calendario esterno debba rispecchiare.
 *
 * Valgono per tutti gli operatori e per entrambi i canali (Google e feed ICS).
 * Il testo ripete due volte che il gestionale non viene toccato, perché è la
 * cosa che chi legge "cancella" teme davvero — e temerla porta a non usare
 * l'impostazione, o peggio a usarla credendo di aver cancellato lo storico.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CalendarSyncSettings } from '../../../operator-google-calendar/models/operator-google-calendar.model';

@Component({
  selector: 'app-calendar-sync-settings-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatSlideToggleModule, MatProgressSpinnerModule],
  template: `
    <div class="css-panel">
      <div class="css-head">
        <mat-icon class="css-icon">history</mat-icon>
        <div>
          <span class="css-title">Cosa tenere nel calendario esterno</span>
          <span class="css-sub">Vale per tutti gli operatori, su Google e sul feed ICS</span>
        </div>
      </div>

      @if (loading) {
        <div class="css-state"><mat-spinner diameter="22"></mat-spinner></div>
      } @else {
        <div class="css-row">
          <mat-slide-toggle
            [checked]="!!settings?.keepPastAppointments"
            [disabled]="saving"
            (change)="keepPast.emit($event.checked)">
            Mantieni gli appuntamenti passati
          </mat-slide-toggle>
          <span class="css-hint">
            {{ settings?.keepPastAppointments
                ? 'Il calendario conserva gli appuntamenti dal giorno del collegamento a oggi.'
                : 'Il calendario mostra solo da oggi in avanti: i passati vengono rimossi da Google.' }}
          </span>
        </div>

        <div class="css-row">
          <mat-slide-toggle
            [checked]="!!settings?.keepCalendarOnDisconnect"
            [disabled]="saving"
            (change)="keepCalendar.emit($event.checked)">
            Lascia il calendario quando l'operatore si scollega
          </mat-slide-toggle>
          <span class="css-hint">
            {{ settings?.keepCalendarOnDisconnect
                ? 'Resta nel suo Google come copia ferma, senza più aggiornarsi.'
                : 'Viene cancellato dal suo Google insieme al collegamento.' }}
          </span>
        </div>

        <p class="css-note">
          <mat-icon>inventory_2</mat-icon>
          <span>
            <strong>Il gestionale non viene mai toccato.</strong> Queste scelte riguardano
            solo la copia sul calendario del telefono: qui dentro gli appuntamenti
            restano tutti, passati e futuri, perché sono lo storico dello studio.
          </span>
        </p>

        <p class="css-note css-note-soft">
          <mat-icon>info</mat-icon>
          <span>
            Se un permesso Google scade senza che l'operatore si scolleghi, il suo
            calendario resta dov'è: senza autorizzazione non abbiamo più modo di
            rimuoverlo. Sparisce solo con uno scollegamento volontario.
          </span>
        </p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .css-panel {
      border: 1px solid #e2e8f0; border-radius: 10px; background: #fff;
      padding: 12px 14px; margin-bottom: 10px;
    }
    .css-head { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 12px; }
    .css-icon { color: #0284c7; flex: 0 0 auto; }
    .css-title { display: block; font-weight: 600; color: #1e293b; }
    .css-sub { display: block; font-size: .78rem; color: #64748b; }
    .css-state { display: flex; justify-content: center; padding: 12px; }
    .css-row { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; }
    .css-hint { font-size: .74rem; color: #64748b; padding-left: 2px; }
    .css-note {
      display: flex; gap: 6px; align-items: flex-start;
      font-size: .76rem; color: #475569; background: #f1f5f9;
      border-radius: 6px; padding: 8px 10px; margin: 0 0 8px;
    }
    .css-note-soft { background: #fff7ed; color: #7c2d12; margin-bottom: 0; }
    .css-note mat-icon { font-size: 17px; width: 17px; height: 17px; flex: 0 0 auto; }
  `],
})
export class CalendarSyncSettingsPanelComponent {
  @Input() settings: CalendarSyncSettings | null = null;
  @Input() loading = false;
  @Input() saving = false;

  @Output() keepPast = new EventEmitter<boolean>();
  @Output() keepCalendar = new EventEmitter<boolean>();
}
