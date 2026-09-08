/**
 * Google Token Monitor Panel
 * Layer 1: Dumb Component
 *
 * Lo stato del collegamento con Google, nella dashboard di chi lo usa.
 *
 * Esiste per un problema preciso: finché l'app Curandis non è verificata da
 * Google, il permesso scade ogni 7 giorni e il calendario dell'operatore
 * smette di aggiornarsi SENZA dire niente. Gli appuntamenti vecchi restano al
 * loro posto, i nuovi non arrivano, e ci si accorge del guasto presentandosi
 * all'ora sbagliata.
 *
 * Per questo il riquadro conta i giorni invece di limitarsi a segnalare
 * l'errore: dire "scade domani" serve, dire "è scaduto ieri" è già tardi.
 *
 * Solo @Input/@Output, nessuna logica, nessun GraphQL.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { OperatorGoogleCalendarStatus } from '../../models/operator-google-calendar.model';

@Component({
  selector: 'app-google-token-monitor-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, MatIconModule, MatButtonModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    @if (loading) {
      <div class="gtm-card gtm-quiet">
        <mat-spinner diameter="22"></mat-spinner>
      </div>
    } @else if (readyToConnect) {
      <!-- L'amministratore ha inserito l'indirizzo Google ma la persona non ha
           ancora autorizzato. Il pulsante sta qui, nella SUA dashboard, perché
           è lei a doverlo premere: l'autorizzazione avviene sul suo account,
           e farla passare dalla segreteria significherebbe chiederle la
           password di Google. -->
      <div class="gtm-card gtm-invite">
        <div class="gtm-head">
          <mat-icon class="gtm-icon">link</mat-icon>
          <div class="gtm-titles">
            <span class="gtm-title">Collega il tuo Google Calendar</span>
            <span class="gtm-sub">
              I tuoi appuntamenti compariranno in un calendario dedicato dentro
              {{ status?.declaredEmail }}. Curandis non vede gli altri tuoi calendari.
            </span>
          </div>
          <button mat-flat-button color="primary" type="button"
                  [disabled]="working"
                  (click)="renew.emit()">
            <mat-icon>event_available</mat-icon>
            Collega
          </button>
        </div>
      </div>
    } @else if (status?.connected || status?.needsReconnect) {
      <div class="gtm-card" [ngClass]="'gtm-' + tone">
        <div class="gtm-head">
          <mat-icon class="gtm-icon">{{ icon }}</mat-icon>
          <div class="gtm-titles">
            <span class="gtm-title">{{ headline }}</span>
            <span class="gtm-sub">{{ detail }}</span>
          </div>
          @if (countdown) {
            <span class="gtm-countdown" [ngClass]="'gtm-badge-' + tone"
                  matTooltip="Scadenza prevista: {{ status?.expiresAt | date:'dd/MM/yyyy HH:mm' }}">
              {{ countdown }}
            </span>
          }
          <!-- Sempre disponibile, non solo quando urge: rinnovare in
               anticipo e' sempre lecito e non costa niente, e chi sta gia'
               guardando lo schermo e' il momento migliore per farlo. Cambia
               solo l'enfasi. -->
          <button mat-flat-button type="button"
                  [color]="needsAction ? 'primary' : undefined"
                  [disabled]="working"
                  (click)="renew.emit()">
            <mat-icon>autorenew</mat-icon>
            {{ needsAction ? 'Rinnova' : 'Rinnova ora' }}
          </button>
        </div>

        @if (canSendLink) {
          <div class="gtm-send">
            <span class="gtm-send-label">Ricevi il link per rinnovare:</span>
            <button mat-stroked-button type="button"
                    [disabled]="working || !status?.operatorPhone"
                    [matTooltip]="status?.operatorPhone || 'Nessun numero in scheda'"
                    (click)="sendLink.emit('whatsapp')">
              <mat-icon>chat</mat-icon> WhatsApp
            </button>
            <button mat-stroked-button type="button"
                    [disabled]="working || !status?.operatorEmail"
                    [matTooltip]="status?.operatorEmail || 'Nessuna email in scheda'"
                    (click)="sendLink.emit('email')">
              <mat-icon>mail</mat-icon> Email
            </button>
          </div>
        }

        <div class="gtm-alerts">
          <button mat-button type="button" class="gtm-unlink"
                  [disabled]="working"
                  [matTooltip]="unlinkHint"
                  (click)="disconnect.emit()">
            <mat-icon>link_off</mat-icon> Scollega
          </button>
          <span class="gtm-alerts-label">Avvisami prima che scada:</span>
          <mat-slide-toggle
            [checked]="!!status?.alertWhatsapp"
            [disabled]="working || !status?.operatorPhone"
            [matTooltip]="status?.operatorPhone ? '' : 'Serve un numero in scheda'"
            (change)="alertToggle.emit({ channel: 'whatsapp', enabled: $event.checked })">
            WhatsApp
          </mat-slide-toggle>
          <mat-slide-toggle
            [checked]="!!status?.alertEmail"
            [disabled]="working || !status?.operatorEmail"
            [matTooltip]="status?.operatorEmail ? '' : 'Serve un indirizzo email in scheda'"
            (change)="alertToggle.emit({ channel: 'email', enabled: $event.checked })">
            Email
          </mat-slide-toggle>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .gtm-card {
      border: 1px solid #e2e8f0;
      border-left-width: 4px;
      border-radius: 10px;
      background: #fff;
      padding: 14px;
      margin-bottom: 16px;
    }
    .gtm-quiet { display: flex; justify-content: center; }

    .gtm-ok { border-left-color: #16a34a; }
    .gtm-invite { border-left-color: #6366f1; background: #f5f3ff; }
    .gtm-invite .gtm-icon { color: #6366f1; }
    .gtm-unlink { color: #b91c1c; margin-left: auto; }
    .gtm-warn { border-left-color: #d97706; background: #fffbeb; }
    .gtm-bad { border-left-color: #dc2626; background: #fef2f2; }

    .gtm-head { display: flex; align-items: center; gap: 10px; }
    .gtm-icon { flex: 0 0 auto; }
    .gtm-ok .gtm-icon { color: #16a34a; }
    .gtm-warn .gtm-icon { color: #d97706; }
    .gtm-bad .gtm-icon { color: #dc2626; }

    .gtm-titles { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
    .gtm-title { font-weight: 600; color: #1e293b; }
    .gtm-sub { font-size: .78rem; color: #64748b; line-height: 1.4; }

    .gtm-send, .gtm-alerts {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      margin-top: 12px; padding-top: 12px; border-top: 1px solid #f1f5f9;
    }
    .gtm-send-label, .gtm-alerts-label { font-size: .78rem; color: #475569; }

    .gtm-countdown {
      flex: 0 0 auto;
      font-size: .74rem; font-weight: 600;
      padding: 3px 10px; border-radius: 999px; white-space: nowrap;
    }
    .gtm-badge-ok { background: #dcfce7; color: #166534; }
    .gtm-badge-warn { background: #fef3c7; color: #92400e; }
    .gtm-badge-bad { background: #fee2e2; color: #991b1b; }

    @media (max-width: 560px) {
      .gtm-head { flex-wrap: wrap; }
      .gtm-send, .gtm-alerts { gap: 8px; }
    }
  `],
})
export class GoogleTokenMonitorPanelComponent {
  @Input() status: OperatorGoogleCalendarStatus | null = null;
  @Input() loading = false;
  @Input() working = false;

  @Output() renew = new EventEmitter<void>();
  @Output() sendLink = new EventEmitter<'whatsapp' | 'email'>();
  @Output() alertToggle = new EventEmitter<{ channel: 'whatsapp' | 'email'; enabled: boolean }>();
  @Output() disconnect = new EventEmitter<void>();

  /**
   * Impostazione dello studio: il calendario sopravvive allo scollegamento?
   * Serve a dire alla persona cosa succederà, prima che decida.
   */
  @Input() keepCalendarOnDisconnect = true;

  /**
   * Indirizzo Google inserito dall'amministratore ma autorizzazione mai data.
   *
   * È il momento in cui la persona può agire e prima non poteva: senza
   * l'indirizzo in scheda il collegamento non parte nemmeno, e mostrare un
   * pulsante che fallisce sarebbe peggio che non mostrarlo.
   */
  get readyToConnect(): boolean {
    return !!this.status?.canConnect
      && !!this.status?.declaredEmail
      && !this.status?.connected
      && !this.status?.needsReconnect;
  }

  get unlinkHint(): string {
    return this.keepCalendarOnDisconnect
      ? 'Il calendario resta nel tuo Google con gli appuntamenti già presenti, ma smette di aggiornarsi.'
      : 'Il calendario verrà rimosso dal tuo Google. Gli appuntamenti restano nel gestionale.';
  }

  /**
   * Etichetta breve del conto alla rovescia, accanto al titolo.
   *
   * Esiste solo in fase di test: e' li' che la scadenza e' una data certa. A
   * verifica ottenuta sparisce, perche' contare i giorni verso una scadenza
   * che non c'e' sarebbe peggio che non contarli.
   */
  get countdown(): string | null {
    if (!this.status?.testingMode) return null;
    const days = this.status?.daysLeft;
    if (days === null || days === undefined) return null;
    if (this.status?.needsReconnect) return 'scaduto';
    if (days < 0) return 'scaduto';
    if (days === 0) return 'scade oggi';
    if (days === 1) return '1 giorno';
    return `${days} giorni`;
  }

  /** Il link si puo' mandare a se stessi in qualunque momento. */
  get canSendLink(): boolean {
    return !!this.status?.operatorPhone || !!this.status?.operatorEmail;
  }

  /** Serve un'azione: scaduto, oppure manca poco. */
  get needsAction(): boolean {
    return !!this.status?.needsReconnect || !!this.status?.expiringSoon;
  }

  get tone(): 'ok' | 'warn' | 'bad' {
    if (this.status?.needsReconnect) return 'bad';
    if (this.status?.expiringSoon) return 'warn';
    return 'ok';
  }

  get icon(): string {
    if (this.status?.needsReconnect) return 'sync_problem';
    if (this.status?.expiringSoon) return 'schedule';
    return 'event_available';
  }

  get headline(): string {
    if (this.status?.needsReconnect) return 'Il calendario Google non si aggiorna più';
    const days = this.status?.daysLeft;
    if (this.status?.expiringSoon) {
      if (days === null || days === undefined) return 'Il collegamento sta per scadere';
      if (days <= 0) return 'Il collegamento scade oggi';
      if (days === 1) return 'Il collegamento scade domani';
      return `Il collegamento scade fra ${days} giorni`;
    }
    return 'Calendario Google collegato';
  }

  get detail(): string {
    if (this.status?.needsReconnect) {
      return 'Gli appuntamenti nuovi e gli spostamenti non arrivano sul telefono '
        + 'finché non rinnovi il permesso.';
    }
    if (this.status?.expiringSoon) {
      return 'È una regola di Google per le app non ancora verificate, non un problema '
        + 'del tuo account. Rinnovando, tutto riprende da solo.';
    }
    // Il conto alla rovescia esiste solo finché l'app non è verificata: dopo,
    // parlarne sarebbe raccontare una scadenza che non c'è.
    if (this.status?.testingMode && this.status?.daysLeft != null) {
      return `${this.status.calendarName || 'Calendario'} — il permesso vale ancora `
        + `${this.status.daysLeft} giorni.`;
    }
    return this.status?.calendarName
      ? `Gli appuntamenti finiscono in "${this.status.calendarName}".`
      : 'Gli appuntamenti si aggiornano da soli.';
  }
}
