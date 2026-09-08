/**
 * Operator Google Calendar Panel
 * Layer 1: Dumb Component
 *
 * Pannello "Google Calendar" nella scheda operatore: indirizzo Google
 * dichiarato, collegamento, stato e scollegamento.
 *
 * Sta accanto al pannello del feed ICS e non lo sostituisce: l'ICS copre iOS
 * e Outlook e regge anche quando l'autorizzazione Google scade, questo dà
 * l'aggiornamento immediato su Google.
 *
 * Solo @Input/@Output, nessuna logica, nessun GraphQL.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OperatorGoogleCalendarStatus } from '../../models/operator-google-calendar.model';
import {
  CollapsibleCardComponent, CollapsibleCardTone,
} from '../../../../shared/components/collapsible-card/collapsible-card.component';

@Component({
  selector: 'app-operator-google-calendar-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule,
    CollapsibleCardComponent,
  ],
  template: `
    <app-collapsible-card icon="sync"
                          title="Account Google"
                          subtitle="Aggiornamento immediato, senza attendere il rinfresco del telefono"
                          [badge]="badgeText"
                          [tone]="badgeTone"
                          [expanded]="!!status?.connected">
     <div class="gcal-panel">

      @if (loading) {
        <div class="gcal-state"><mat-spinner diameter="24"></mat-spinner></div>
      } @else if (error) {
        <!-- Distinto dallo stato "nessun utente collegato": un errore di
             caricamento raccontato come diagnosi manda a cercare il problema
             dalla parte sbagliata. -->
        <p class="gcal-warning">
          <mat-icon>error_outline</mat-icon>
          <span>
            Impossibile leggere lo stato del collegamento.
            <br><small>{{ error }}</small>
          </span>
        </p>
      } @else if (!status?.canConnect) {
        <p class="gcal-blocked">
          <mat-icon>info</mat-icon>
          <span>
            Questo operatore non ha un utente del gestionale collegato. Senza account
            non può autorizzare Google: collegalo prima dalla gestione utenti.
          </span>
        </p>
      } @else {
        <!-- Indirizzo dichiarato: serve a proporre l'account giusto e a
             verificare che sia quello che autorizza davvero. -->
        <div class="gcal-email-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="gcal-email-field">
            <mat-label>Indirizzo Google dell'operatore</mat-label>
            <input matInput
                   type="email"
                   [(ngModel)]="emailDraft"
                   [disabled]="!!status?.connected"
                   placeholder="nome.cognome@gmail.com"
                   autocomplete="off">
          </mat-form-field>
          <button mat-stroked-button type="button"
                  [disabled]="!!status?.connected || emailDraft === (status?.declaredEmail ?? '')"
                  (click)="saveEmail.emit(emailDraft)">
            Salva
          </button>
        </div>

        @if (!status?.connected) {
          <p class="gcal-explain">
            L'operatore autorizzerà Curandis a creare un calendario dedicato dentro il
            suo account Google. Curandis <strong>non vede</strong> gli altri suoi
            calendari: può gestire solo quello che crea.
          </p>
          <!-- Il nome si sceglie PRIMA: è quello che l'operatore vedrà nella
               lista dei suoi calendari, accanto a quelli personali. -->
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="gcal-name-field">
            <mat-label>Nome del calendario da creare</mat-label>
            <input matInput
                   [(ngModel)]="calendarNameDraft"
                   placeholder="Es: Studio BDQ"
                   maxlength="80"
                   autocomplete="off">
            <mat-hint>Comparirà così nella lista dei calendari dell'operatore</mat-hint>
          </mat-form-field>

          <button mat-flat-button color="primary" type="button"
                  class="gcal-connect-btn"
                  [disabled]="!status?.declaredEmail || !calendarNameDraft.trim()"
                  [matTooltip]="!status?.declaredEmail ? 'Indica prima l\\'indirizzo Google' : ''"
                  (click)="connect.emit(calendarNameDraft.trim())">
            <mat-icon>link</mat-icon>
            Collega Google Calendar
          </button>
        } @else {
          <div class="gcal-connected">
            <mat-icon class="ok-icon">check_circle</mat-icon>
            <div class="gcal-connected-text">
              <span>Collegato a <strong>{{ status?.googleEmail }}</strong></span>
              @if (status?.calendarName) {
                <span class="gcal-cal">Calendario: {{ status?.calendarName }}</span>
              }
              @if (status?.lastSyncAt) {
                <span class="gcal-meta">Ultima sincronizzazione: {{ formatDate(status!.lastSyncAt!) }}</span>
              } @else {
                <span class="gcal-meta">Nessuna sincronizzazione ancora eseguita</span>
              }
            </div>
          </div>

          <!-- Rinomina: il nome si sceglie prima di vedere il risultato dentro
               Google, quindi deve poter cambiare senza rifare tutto. -->
          <div class="gcal-rename-row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="gcal-name-field">
              <mat-label>Nome del calendario</mat-label>
              <input matInput [(ngModel)]="calendarNameDraft" maxlength="80" autocomplete="off">
            </mat-form-field>
            <button mat-stroked-button type="button"
                    [disabled]="!calendarNameDraft.trim() || calendarNameDraft.trim() === (status?.calendarName ?? '')"
                    (click)="renameCalendar.emit(calendarNameDraft.trim())">
              Rinomina
            </button>
          </div>

          <div class="gcal-actions">
            <button mat-flat-button color="primary" type="button" (click)="syncNow.emit()">
              <mat-icon>sync</mat-icon>
              Sincronizza adesso
            </button>
            <button mat-stroked-button color="warn" type="button" (click)="disconnect.emit()">
              <mat-icon>link_off</mat-icon>
              Scollega
            </button>
          </div>
          <p class="gcal-hint">
            Gli appuntamenti si allineano da soli a ogni modifica, e comunque ogni
            10 minuti. Questo pulsante serve a portarli subito.
          </p>
        }

        @if (status?.needsReconnect) {
          <p class="gcal-warning">
            <mat-icon>warning</mat-icon>
            <span>
              L'autorizzazione non è più valida: il calendario ha smesso di aggiornarsi.
              Finché l'app Google è in fase di verifica questo succede ogni 7 giorni.
              Premi di nuovo "Collega" per rinnovarla.
            </span>
          </p>
        } @else if (status?.lastErrorMessage) {
          <p class="gcal-warning">
            <mat-icon>error_outline</mat-icon>
            <span>{{ status?.lastErrorMessage }}</span>
          </p>
        }
      }
     </div>
    </app-collapsible-card>
  `,
  styles: [`
    :host { display: block; }
    /* Cornice, sfondo e intestazione li mette app-collapsible-card. */
    .gcal-panel { display: block; }
    .gcal-header { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; }
    .gcal-icon { color: #4285f4; }
    .gcal-title { display: flex; flex-direction: column; }
    .gcal-name { font-weight: 600; color: #1e293b; }
    .gcal-sub { font-size: 0.78rem; color: #64748b; }
    .gcal-state { display: flex; justify-content: center; padding: 16px; }

    .gcal-email-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .gcal-email-field { flex: 1; }

    .gcal-explain { font-size: 0.82rem; color: #475569; margin: 0 0 10px; }
    .gcal-name-field { width: 100%; max-width: 340px; }
    .gcal-connect-btn { margin-top: 14px; display: block; }
    .gcal-rename-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; }

    .gcal-blocked, .gcal-warning {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 0.78rem;
      border-radius: 6px;
      padding: 8px 10px;
      margin: 10px 0 0;
    }
    .gcal-blocked { color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; }
    .gcal-warning { color: #92400e; background: #fffbeb; border: 1px solid #fde68a; }
    .gcal-blocked mat-icon, .gcal-warning mat-icon {
      font-size: 17px; width: 17px; height: 17px; flex: 0 0 auto;
    }

    .gcal-connected {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 10px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    .ok-icon { color: #047857; font-size: 20px; width: 20px; height: 20px; }
    .gcal-connected-text { display: flex; flex-direction: column; font-size: 0.82rem; color: #065f46; }
    .gcal-cal { font-size: 0.78rem; }
    .gcal-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
    .gcal-hint { font-size: 0.74rem; color: #64748b; margin: 0 0 4px; }
    .gcal-meta { font-size: 0.72rem; color: #64748b; margin-top: 2px; }
  `],
})
export class OperatorGoogleCalendarPanelComponent {
  /**
   * Stato del collegamento a riquadro chiuso.
   *
   * "Da ricollegare" e' separato da "Non collegato" perche' sono due problemi
   * diversi: nel primo caso il calendario esiste ma ha smesso di aggiornarsi,
   * ed e' proprio quello che non si nota finche' qualcuno non lo dice.
   */
  get badgeText(): string | null {
    if (this.loading) return null;
    if (this.error) return 'Errore';
    if (!this.status?.canConnect) return 'Non disponibile';
    if (this.status?.needsReconnect) return 'Da ricollegare';
    return this.status?.connected ? 'Collegato' : 'Non collegato';
  }

  get badgeTone(): CollapsibleCardTone {
    if (this.error) return 'error';
    if (!this.status?.canConnect) return 'off';
    if (this.status?.needsReconnect) return 'warn';
    return this.status?.connected ? 'on' : 'off';
  }

  @Input() set status(value: OperatorGoogleCalendarStatus | null) {
    this._status = value;
    // Il campo si riallinea a ogni stato nuovo, così dopo un salvataggio
    // mostra ciò che è stato davvero persistito e non la bozza precedente.
    this.emailDraft = value?.declaredEmail ?? '';
    // Collegato: il nome vero. Non collegato: quello proposto, che lo studio
    // può cambiare prima di procedere.
    this.calendarNameDraft = value?.calendarName ?? value?.suggestedCalendarName ?? '';
  }
  get status(): OperatorGoogleCalendarStatus | null {
    return this._status;
  }
  private _status: OperatorGoogleCalendarStatus | null = null;

  @Input() loading = false;
  /** Messaggio di errore del caricamento, distinto dagli stati normali. */
  @Input() error: string | null = null;

  @Output() connect = new EventEmitter<string>();
  @Output() disconnect = new EventEmitter<void>();
  @Output() saveEmail = new EventEmitter<string>();
  @Output() renameCalendar = new EventEmitter<string>();
  @Output() syncNow = new EventEmitter<void>();

  emailDraft = '';
  calendarNameDraft = '';

  formatDate(value: string): string {
    return new Date(value).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
