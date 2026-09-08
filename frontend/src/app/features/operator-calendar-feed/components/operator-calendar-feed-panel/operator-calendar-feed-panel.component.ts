/**
 * Operator Calendar Feed Panel
 * Layer 1: Dumb Component
 *
 * Pannello "Sincronizzazione agenda" nella scheda operatore: genera, copia e
 * revoca il link .ics, e regola se il nome del paziente compare nel feed.
 *
 * Le istruzioni per iOS e Google sono nel pannello di proposito. Chi legge
 * "ecco il link" e basta non sa cosa farne: la sottoscrizione a un calendario
 * remoto è una funzione che quasi nessuno ha mai usato, e sta in punti diversi
 * dei due sistemi.
 *
 * Solo @Input/@Output, nessuna logica, nessun GraphQL.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { OperatorCalendarFeedStatus } from '../../models/operator-calendar-feed.model';
import {
  CollapsibleCardComponent, CollapsibleCardTone,
} from '../../../../shared/components/collapsible-card/collapsible-card.component';

@Component({
  selector: 'app-operator-calendar-feed-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatTooltipModule,
    MatSlideToggleModule, MatProgressSpinnerModule, MatExpansionModule,
    MatButtonToggleModule, MatFormFieldModule, MatInputModule, FormsModule,
    CollapsibleCardComponent,
  ],
  template: `
    <app-collapsible-card icon="rss_feed"
                          title="Abbonamento al calendario (ICS)"
                          subtitle="Funziona su iPhone, Android e Outlook. Sola lettura."
                          [badge]="badgeText"
                          [tone]="badgeTone"
                          [expanded]="!!status?.enabled">
     <div class="feed-panel">

      @if (loading) {
        <div class="feed-state"><mat-spinner diameter="24"></mat-spinner></div>
      } @else if (error) {
        <!-- Un errore di caricamento non deve somigliare a "feed non ancora
             attivo": chi lo legge cercherebbe il problema dalla parte sbagliata. -->
        <p class="feed-warning">
          <mat-icon>error_outline</mat-icon>
          <span>
            Impossibile leggere lo stato del feed.
            <br><small>{{ error }}</small>
          </span>
        </p>
      } @else if (!status?.enabled) {
        <div class="feed-inactive">
          <p class="feed-explain">
            Genera un link personale da sottoscrivere in <strong>Calendario di iOS</strong>,
            <strong>Google Calendar</strong> o Outlook. La sincronizzazione è a senso unico:
            gli appuntamenti arrivano sul telefono, ma quello che l'operatore scrive nel
            proprio calendario non torna qui.
          </p>
          <button mat-flat-button color="primary" type="button" (click)="generate.emit()">
            <mat-icon>link</mat-icon>
            Genera il link
          </button>
        </div>
      } @else {
        <div class="feed-active">
          <div class="feed-url-row">
            <code class="feed-url">{{ status?.feedUrl }}</code>
            <button mat-icon-button type="button"
                    (click)="copy.emit()"
                    [matTooltip]="copied ? 'Copiato' : 'Copia il link'">
              <mat-icon>{{ copied ? 'check' : 'content_copy' }}</mat-icon>
            </button>
          </div>

          <p class="feed-warning">
            <mat-icon>schedule</mat-icon>
            <span>
              L'aggiornamento lo decide il telefono, non noi: iOS ricontrolla ogni
              15-60 minuti, Google può metterci fino a 24 ore. Per un cambio urgente
              avvisa l'operatore, non aspettare che lo veda dal calendario.
            </span>
          </p>

          <!-- Invio del link all'operatore.
               Il messaggio NON contiene l'indirizzo del feed ma un link
               temporaneo e monouso: la conversazione non deve conservare per
               sempre una credenziale sull'agenda. -->
          <div class="feed-send">
            <div class="send-head">
              <mat-icon>send</mat-icon>
              <span>Manda il link all'operatore</span>
            </div>
            <p class="send-hint">
              Riceve un link che apre direttamente la sottoscrizione: non deve entrare
              nelle impostazioni del calendario. Vale 30 minuti e una volta sola.
            </p>

            <mat-button-toggle-group class="send-channel"
                                     [value]="sendChannel"
                                     (change)="onChannelChange($event.value)"
                                     hideSingleSelectionIndicator>
              <mat-button-toggle value="whatsapp">
                <mat-icon>chat</mat-icon> WhatsApp
              </mat-button-toggle>
              <mat-button-toggle value="email">
                <mat-icon>mail</mat-icon> Email
              </mat-button-toggle>
            </mat-button-toggle-group>

            <div class="send-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="send-field">
                <mat-label>{{ sendChannel === 'email' ? 'Indirizzo email' : 'Numero WhatsApp' }}</mat-label>
                <input matInput
                       [(ngModel)]="recipientDraft"
                       [placeholder]="sendChannel === 'email' ? 'nome@esempio.it' : '+39 333 1234567'"
                       autocomplete="off">
              </mat-form-field>
              <button mat-flat-button color="primary" type="button"
                      [disabled]="!recipientDraft.trim() || sending"
                      (click)="sendLink.emit({ channel: sendChannel, recipient: recipientDraft.trim() })">
                {{ sending ? 'Invio…' : 'Invia' }}
              </button>
            </div>
          </div>

          <mat-expansion-panel class="feed-howto">
            <mat-expansion-panel-header>
              <mat-panel-title>Come si sottoscrive</mat-panel-title>
            </mat-expansion-panel-header>
            <div class="howto-block">
              <strong>iPhone / iPad</strong>
              <ol>
                <li>Impostazioni → Calendario → Account → Aggiungi account</li>
                <li>Altro → Aggiungi calendario sottoscritto</li>
                <li>Incolla il link e conferma</li>
              </ol>
            </div>
            <div class="howto-block">
              <strong>Google Calendar</strong> (da computer)
              <ol>
                <li>calendar.google.com → Altri calendari → <em>+</em></li>
                <li>Da URL</li>
                <li>Incolla il link e aggiungi</li>
              </ol>
              <p class="howto-warn">
                Dall'<em>app</em> Google Calendar non si può: non prevede
                l'aggiunta da link. Si può però fare dal <strong>browser del
                telefono in modalità desktop</strong> — la pagina che riceve
                l'operatore col link glielo spiega passo per passo, compreso
                l'ultimo passaggio nell'app per attivare la sincronizzazione.
              </p>
            </div>
            <div class="howto-block">
              <strong>Outlook</strong>
              <ol>
                <li>Calendario → Aggiungi calendario → Sottoscrivi dal Web</li>
                <li>Incolla il link, dai un nome e importa</li>
              </ol>
            </div>
          </mat-expansion-panel>

          <div class="feed-meta">
            @if (status?.createdAt) {
              <span>Creato il {{ formatDate(status!.createdAt!) }}</span>
            }
            @if (status?.lastAccessAt) {
              <span>· Ultimo aggiornamento scaricato il {{ formatDate(status!.lastAccessAt!) }}</span>
            } @else {
              <span class="feed-never">· Non ancora scaricato da nessun calendario</span>
            }
          </div>

          <div class="feed-actions">
            <button mat-stroked-button type="button" (click)="regenerate.emit()"
                    matTooltip="Crea un link nuovo: il precedente smette di funzionare">
              <mat-icon>autorenew</mat-icon>
              Rigenera
            </button>
            <button mat-stroked-button color="warn" type="button" (click)="revoke.emit()"
                    matTooltip="Disattiva il feed: il link smette di rispondere">
              <mat-icon>link_off</mat-icon>
              Revoca
            </button>
          </div>
        </div>
      }
     </div>
    </app-collapsible-card>
  `,
  styles: [`
    :host { display: block; }
    /* Cornice, sfondo e intestazione li mette app-collapsible-card. */
    .feed-panel { display: block; }
    .feed-sub { font-size: 0.78rem; color: #64748b; }
    .feed-state { display: flex; justify-content: center; padding: 16px; }
    .feed-explain { font-size: 0.82rem; color: #475569; margin: 0 0 10px; }

    .feed-url-row {
      display: flex;
      align-items: center;
      gap: 6px;
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px 4px 4px 10px;
      margin-bottom: 10px;
    }
    .feed-url {
      flex: 1;
      min-width: 0;
      font-size: 0.74rem;
      color: #334155;
      word-break: break-all;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .feed-warning {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 0.76rem;
      color: #92400e;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 8px 10px;
      margin: 0 0 10px;
    }
    .feed-warning mat-icon { font-size: 17px; width: 17px; height: 17px; flex: 0 0 auto; }

    .feed-toggle-row { display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; }
    .feed-toggle-hint { font-size: 0.74rem; color: #64748b; padding-left: 2px; }

    .feed-howto { box-shadow: none !important; border: 1px solid #e2e8f0; margin-bottom: 10px; }
    .howto-block { font-size: 0.78rem; color: #475569; margin-bottom: 8px; }
    .howto-block ol { margin: 4px 0 0 18px; padding: 0; }
    .howto-warn {
      margin: 6px 0 0;
      font-size: 0.74rem;
      color: #92400e;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 5px;
      padding: 6px 8px;
    }
    .howto-block li { margin-bottom: 2px; }

    .feed-send {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 10px;
      background: white;
    }
    .send-head {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 0.84rem;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .send-head mat-icon { font-size: 17px; width: 17px; height: 17px; color: #0284c7; }
    .send-hint { font-size: 0.76rem; color: #64748b; margin: 0 0 8px; }
    .send-channel { height: 30px; margin-bottom: 8px; }
    ::ng-deep .send-channel .mat-button-toggle-label-content {
      line-height: 28px; font-size: 0.76rem; padding: 0 10px;
    }
    ::ng-deep .send-channel .mat-icon {
      font-size: 15px; width: 15px; height: 15px; margin-right: 3px; vertical-align: middle;
    }
    .send-row { display: flex; align-items: center; gap: 8px; }
    .send-field { flex: 1; }

    .feed-meta { font-size: 0.72rem; color: #94a3b8; margin-bottom: 8px; }
    .feed-never { font-style: italic; }
    .feed-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .feed-actions button { font-size: 0.78rem; }
    .feed-actions .mat-icon { font-size: 17px; width: 17px; height: 17px; margin-right: 4px; }
  `],
})
export class OperatorCalendarFeedPanelComponent {
  /**
   * Cosa dice la pastiglia a riquadro chiuso.
   *
   * Chiuso, questa riga e' tutto cio' che si legge: deve bastare a sapere se
   * l'operatore riceve gli appuntamenti sul telefono, senza aprire nulla.
   */
  get badgeText(): string | null {
    if (this.loading) return null;
    if (this.error) return 'Errore';
    return this.status?.enabled ? 'Attivo' : 'Non attivo';
  }

  get badgeTone(): CollapsibleCardTone {
    if (this.error) return 'error';
    return this.status?.enabled ? 'on' : 'off';
  }

  @Input() status: OperatorCalendarFeedStatus | null = null;
  @Input() loading = false;
  /** Feedback momentaneo del pulsante copia. */
  @Input() copied = false;
  /** Messaggio di errore del caricamento, distinto dagli stati normali. */
  @Input() error: string | null = null;

  @Output() generate = new EventEmitter<void>();
  @Output() regenerate = new EventEmitter<void>();
  @Output() revoke = new EventEmitter<void>();
  @Output() copy = new EventEmitter<void>();
  @Output() sendLink = new EventEmitter<{ channel: 'whatsapp' | 'email'; recipient: string }>();

  /** Canale scelto per l'invio del link. */
  sendChannel: 'whatsapp' | 'email' = 'whatsapp';
  recipientDraft = '';

  /** Recapiti noti dell'operatore, per precompilare il campo. */
  @Input() operatorPhone: string | null = null;
  @Input() operatorEmail: string | null = null;
  /** Invio in corso: il pulsante si spegne per non mandare due link. */
  @Input() sending = false;

  onChannelChange(channel: 'whatsapp' | 'email'): void {
    this.sendChannel = channel;
    // Precompila col recapito noto del canale scelto: quello che manca lo
    // scrive la segreteria, senza doverlo prima censire in anagrafica.
    this.recipientDraft =
      (channel === 'email' ? this.operatorEmail : this.operatorPhone) ?? '';
  }


  formatDate(value: string): string {
    return new Date(value).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
