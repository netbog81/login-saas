/**
 * Notification Channels Panel
 * Layer 1: Dumb Component
 *
 * Quali messaggi escono da quale canale, e in che ordine si prova.
 *
 * La forma è una matrice — canali in righe, categorie in colonne — perché la
 * domanda vera non è "l'SMS è acceso?" ma "il promemoria da dove esce?", e
 * quella si legge solo vedendo i canali uno accanto all'altro.
 *
 * Sotto la matrice c'è però la risposta esplicita, categoria per categoria,
 * perché la matrice da sola non basta: l'ordine è UNO e le categorie sono per
 * canale, quindi "WhatsApp, poi SMS" può voler dire che per le conferme non
 * c'è nessuna riserva. Senza quel riepilogo, il 21/08/2026 tutti e tre i
 * canali sono rimasti spenti per tre giorni senza che si notasse.
 *
 * Righe su griglia CSS e non su `<table>`: ogni riga deve essere UN elemento
 * trascinabile, e le celle di una tabella perdono la larghezza appena il
 * browser le stacca dal flusso per il drag.
 *
 * Solo @Input/@Output, nessuna logica, nessun GraphQL. Anche la conferma di
 * uno spegnimento pericoloso è del container: qui si emette e basta.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop, DragDropModule, moveItemInArray,
} from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ALL_CATEGORIES, CATEGORY_LABELS, CHANNEL_LABELS, SMS_DRIVERS,
  CategoryCoverage, categoryCoverage,
  NotificationCategory, NotificationChannel, NotificationChannelSetting,
} from '../../models/notification-channel.model';

export interface ChannelChange {
  channel: NotificationChannel;
  enabled?: boolean;
  priority?: number;
  categories?: NotificationCategory[];
  smsDriver?: string | null;
  emailFromName?: string | null;
}

@Component({
  selector: 'app-notification-channels-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, DragDropModule, MatIconModule, MatButtonModule,
    MatCheckboxModule, MatSlideToggleModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="nc-wrap">
      <div class="nc-head">
        <mat-icon class="nc-icon">campaign</mat-icon>
        <div>
          <h3 class="nc-title">Come avvisiamo i pazienti</h3>
          <p class="nc-sub">
            Per ogni canale, quali messaggi può portare. Si prova nell'ordine in cui
            sono elencati: se il primo non riesce, tocca al successivo.
            Trascina una riga per cambiare l'ordine.
          </p>
        </div>
      </div>

      @if (loading) {
        <div class="nc-state"><mat-spinner diameter="28"></mat-spinner></div>
      } @else if (error) {
        <p class="nc-error">
          <mat-icon>error_outline</mat-icon>
          <span>Impossibile leggere le impostazioni.<br><small>{{ error }}</small></span>
        </p>
      } @else {
        <div class="nc-scroll">
          <div class="nc-grid">
            <!-- Intestazione: stesse colonne delle righe, così restano allineate
                 anche quando la griglia scorre in orizzontale. -->
            <div class="nc-row nc-header">
              <span class="cell-drag"></span>
              <span class="cell-channel">Canale</span>
              @for (cat of categories; track cat) {
                <span class="cell-cat" [matTooltip]="categoryLabels[cat].hint">
                  {{ categoryLabels[cat].name }}
                </span>
              }
            </div>

            <div cdkDropList
                 [cdkDropListDisabled]="saving"
                 (cdkDropListDropped)="onDrop($event)">
              @for (s of settings; track s.channel) {
                <div class="nc-row nc-item" cdkDrag [class.row-off]="!s.enabled">
                  <!-- Il resto della riga è pieno di interruttori e caselle:
                       senza una maniglia dedicata ogni clic rischia di
                       diventare un trascinamento. -->
                  <span class="cell-drag" cdkDragHandle
                        matTooltip="Trascina per cambiare l'ordine">
                    <mat-icon>drag_indicator</mat-icon>
                  </span>

                  <span class="cell-channel">
                    <mat-slide-toggle
                      [checked]="s.enabled"
                      [disabled]="saving"
                      [matTooltip]="s.enabled ? 'Spegni questo canale' : 'Accendi questo canale'"
                      (change)="toggleChannel(s, $event.checked)">
                    </mat-slide-toggle>

                    <span class="ch-text">
                      <span class="ch-name">
                        <mat-icon class="ch-icon">{{ channelLabels[s.channel].icon }}</mat-icon>
                        {{ channelLabels[s.channel].name }}
                        @if (isDefault(s)) {
                          <span class="ch-badge" matTooltip="È il primo che si prova">
                            Predefinito
                          </span>
                        }
                      </span>
                      <span class="ch-hint">{{ channelLabels[s.channel].hint }}</span>

                      <!-- Promuovere costa un clic; portarlo in cima
                           trascinando ne costerebbe uno lungo e preciso. -->
                      @if (s.enabled && !isDefault(s)) {
                        <button mat-button class="ch-promote"
                                [disabled]="saving"
                                (click)="makeDefault.emit(s.channel)">
                          <mat-icon>vertical_align_top</mat-icon>
                          Rendi predefinito
                        </button>
                      }
                    </span>
                  </span>

                  @for (cat of categories; track cat) {
                    <span class="cell-cat">
                      <mat-checkbox
                        [checked]="(s.categories || []).includes(cat)"
                        [disabled]="!s.enabled || saving"
                        (change)="toggleCategory(s, cat, $event.checked)">
                      </mat-checkbox>
                    </span>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Cosa succede davvero. La matrice dice com'è configurato, questo
             dice cosa riceverà il paziente: sono due cose diverse ogni volta
             che un canale acceso non porta tutte le categorie. -->
        <div class="nc-effect">
          <h4 class="eff-title">
            <mat-icon>alt_route</mat-icon>
            Cosa riceve il paziente
          </h4>
          @for (row of coverage; track row.category) {
            <div class="eff-row" [class.eff-empty]="!row.channels.length">
              <span class="eff-cat">{{ categoryLabels[row.category].name }}</span>
              @if (row.channels.length) {
                <span class="eff-chain">
                  @for (c of row.channels; track c; let last = $last) {
                    <span class="eff-ch">{{ channelLabels[c].name }}</span>
                    @if (!last) { <mat-icon class="eff-arrow">east</mat-icon> }
                  }
                </span>
              } @else {
                <span class="eff-chain">
                  <mat-icon class="eff-warn">warning</mat-icon>
                  Nessun canale: questi messaggi non partono
                </span>
              }
            </div>
          }
        </div>

        <!-- Opzioni proprie dei canali accesi. Fuori dalla matrice perché
             riguardano un canale solo e dentro le righe romperebbero
             l'allineamento delle colonne durante il trascinamento. -->
        @for (s of settings; track s.channel) {
          @if (s.enabled && s.channel === 'SMS') {
            <div class="nc-extra">
              <h4 class="extra-title">
                <mat-icon>sms</mat-icon> Opzioni SMS
              </h4>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="extra-field">
                <mat-label>Come si mandano gli SMS</mat-label>
                <mat-select [value]="s.smsDriver || 'personal_gsm'"
                            [disabled]="saving"
                            (selectionChange)="change.emit({ channel: s.channel, smsDriver: $event.value })">
                  @for (d of smsDrivers; track d.value) {
                    <mat-option [value]="d.value">{{ d.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <p class="extra-note extra-warn">
                <mat-icon>euro</mat-icon>
                Ogni SMS si paga e <strong>non esiste ancora un contatore</strong>:
                acceso come riserva, la spesa non ha un tetto. Tienilo sulle sole
                categorie che ti servono davvero.
              </p>
              <p class="extra-note">
                <mat-icon>key</mat-icon>
                Le credenziali dell'apparato o del provider non si inseriscono qui:
                stanno nella cassaforte dei segreti, separate dalle impostazioni.
              </p>
            </div>
          }

          @if (s.enabled && s.channel === 'EMAIL') {
            <div class="nc-extra">
              <h4 class="extra-title">
                <mat-icon>mail</mat-icon> Opzioni email
              </h4>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="extra-field">
                <mat-label>Nome del mittente</mat-label>
                <input matInput
                       [ngModel]="s.emailFromName || ''"
                       [disabled]="saving"
                       maxlength="120"
                       placeholder="es. Studio BDQ"
                       (ngModelChange)="fromNameDraft = $event"
                       (blur)="commitFromName(s)">
              </mat-form-field>
              <p class="extra-note">
                <mat-icon>info</mat-icon>
                È il nome che il paziente vede nella casella di posta. L'indirizzo
                di partenza resta quello configurato per la posta.
              </p>
            </div>
          }
        }

        <p class="nc-foot">
          <mat-icon>person_pin</mat-icon>
          <span>
            Se un paziente ha indicato un canale preferito in anagrafica, per lui si
            parte da quello e questi restano come riserva.
          </span>
        </p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .nc-wrap { border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; padding: 16px; }
    .nc-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 14px; }
    .nc-icon { color: #0284c7; flex: 0 0 auto; }
    .nc-title { margin: 0; font-size: 1rem; font-weight: 600; color: #0f172a; }
    .nc-sub { margin: 2px 0 0; font-size: .82rem; color: #64748b; line-height: 1.45; }
    .nc-state { display: flex; justify-content: center; padding: 24px; }
    .nc-error, .nc-foot {
      display: flex; gap: 8px; align-items: flex-start;
      font-size: .8rem; border-radius: 8px; padding: 10px 12px; margin: 12px 0 0;
    }
    .nc-error { color: #991b1b; background: #fee2e2; }
    .nc-foot { color: #475569; background: #f1f5f9; }
    .nc-error mat-icon, .nc-foot mat-icon { font-size: 18px; width: 18px; height: 18px; flex: 0 0 auto; }

    /* La griglia non deve mai allargare la pagina: scorre nel proprio riquadro. */
    .nc-scroll { overflow-x: auto; }
    .nc-grid { min-width: 660px; }

    /* Le stesse colonne per intestazione e righe: la maniglia, il canale, e
       una colonna per categoria. */
    .nc-row {
      display: grid;
      grid-template-columns: 32px minmax(230px, 1fr) repeat(4, minmax(84px, 96px));
      align-items: center;
      gap: 4px;
    }
    .nc-header {
      font-size: .74rem; font-weight: 600; color: #475569; text-transform: uppercase;
      letter-spacing: .02em; padding: 8px 6px; border-bottom: 2px solid #e2e8f0;
    }
    .nc-header .cell-cat { text-align: center; line-height: 1.25; }

    .nc-item {
      padding: 10px 6px; border-bottom: 1px solid #f1f5f9; background: #fff;
    }
    .row-off { background: #fafafa; }
    .row-off .ch-name { color: #94a3b8; }

    .cell-drag { display: flex; justify-content: center; color: #cbd5e1; cursor: grab; }
    .cell-drag mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .cell-drag:active { cursor: grabbing; }
    .cell-channel { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
    .cell-cat { display: flex; justify-content: center; }

    .ch-text { display: flex; flex-direction: column; min-width: 0; }
    .ch-name { display: flex; align-items: center; gap: 5px; font-weight: 600; color: #1e293b; }
    .ch-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
    .ch-hint { font-size: .74rem; color: #64748b; line-height: 1.35; }
    .ch-badge {
      font-size: .64rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em;
      color: #b45309; background: #fef3c7; border-radius: 999px; padding: 2px 7px;
    }
    .ch-promote {
      align-self: flex-start; margin-top: 2px; font-size: .74rem;
      line-height: 1.6; min-height: 26px; padding: 0 6px; color: #0284c7;
    }
    .ch-promote mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 2px; }

    /* Anteprima e segnaposto del trascinamento. */
    .cdk-drag-preview {
      box-shadow: 0 6px 18px rgba(15, 23, 42, .18);
      border-radius: 8px; background: #fff; opacity: .96;
    }
    .cdk-drag-placeholder { opacity: .35; background: #e0f2fe; }
    .cdk-drag-animating { transition: transform 180ms cubic-bezier(0, 0, .2, 1); }

    .nc-effect { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    .eff-title {
      display: flex; align-items: center; gap: 6px; margin: 0 0 8px;
      font-size: .8rem; font-weight: 600; color: #334155;
    }
    .eff-title mat-icon { font-size: 17px; width: 17px; height: 17px; color: #0284c7; }
    .eff-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 5px 8px; border-radius: 6px; font-size: .8rem;
    }
    .eff-row:nth-child(even) { background: #f8fafc; }
    .eff-cat { min-width: 160px; color: #475569; }
    .eff-chain { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; color: #0f172a; }
    .eff-ch { font-weight: 600; }
    .eff-arrow { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
    .eff-empty { background: #fee2e2 !important; }
    .eff-empty .eff-chain { color: #991b1b; font-weight: 600; }
    .eff-warn { font-size: 16px; width: 16px; height: 16px; color: #dc2626; }

    .nc-extra {
      margin-top: 12px; background: #f8fafc; border-radius: 8px; padding: 12px;
    }
    .extra-title {
      display: flex; align-items: center; gap: 6px; margin: 0 0 8px;
      font-size: .8rem; font-weight: 600; color: #334155;
    }
    .extra-title mat-icon { font-size: 17px; width: 17px; height: 17px; color: #64748b; }
    .extra-field { max-width: 340px; width: 100%; }
    .extra-note {
      display: flex; gap: 6px; align-items: flex-start;
      font-size: .74rem; color: #64748b; margin: 8px 0 0; line-height: 1.45;
    }
    .extra-note mat-icon { font-size: 15px; width: 15px; height: 15px; flex: 0 0 auto; }
    .extra-warn { color: #92400e; background: #fffbeb; border-radius: 6px; padding: 8px 10px; }

    @media (max-width: 600px) {
      .nc-wrap { padding: 12px; }
      .ch-hint { display: none; }
      .eff-cat { min-width: 120px; }
    }
  `],
})
export class NotificationChannelsPanelComponent {
  @Input() settings: NotificationChannelSetting[] = [];
  @Input() loading = false;
  @Input() saving = false;
  @Input() error: string | null = null;

  @Output() change = new EventEmitter<ChannelChange>();
  /** Il canale da portare in cima. Il container ne ricava l'ordine completo. */
  @Output() makeDefault = new EventEmitter<NotificationChannel>();
  /** Nuovo ordine completo dopo un trascinamento. */
  @Output() reorder = new EventEmitter<NotificationChannel[]>();

  readonly categories = ALL_CATEGORIES;
  readonly categoryLabels = CATEGORY_LABELS;
  readonly channelLabels = CHANNEL_LABELS;
  readonly smsDrivers = SMS_DRIVERS;

  fromNameDraft: string | null = null;

  /** Ricalcolata a ogni giro di change detection: OnPush la ferma comunque. */
  get coverage(): CategoryCoverage[] {
    return categoryCoverage(this.settings);
  }

  /**
   * Il predefinito è il primo acceso nell'ordine corrente.
   *
   * Si guarda la posizione nella lista e non la priorità: durante un
   * trascinamento la lista è già nell'ordine nuovo mentre le priorità sono
   * ancora quelle vecchie, e il badge salterebbe sulla riga sbagliata.
   */
  isDefault(setting: NotificationChannelSetting): boolean {
    return this.settings.find(s => s.enabled)?.channel === setting.channel;
  }

  /**
   * Accendere un canale che non porta niente non manda niente: gli si danno
   * tutte le categorie, che è quasi sempre l'intenzione. Toglierne una dopo
   * costa un clic; scoprire fra un mese che i promemoria non partivano no.
   */
  toggleChannel(setting: NotificationChannelSetting, enabled: boolean): void {
    this.change.emit({
      channel: setting.channel,
      enabled,
      ...(enabled && !setting.categories.length ? { categories: [...ALL_CATEGORIES] } : {}),
    });
  }

  toggleCategory(
    setting: NotificationChannelSetting,
    category: NotificationCategory,
    checked: boolean,
  ): void {
    const categories = checked
      ? [...setting.categories, category]
      : setting.categories.filter(c => c !== category);
    this.change.emit({ channel: setting.channel, categories });
  }

  /**
   * L'ordine si calcola su una copia: se il salvataggio non passa, il
   * container ricarica e la lista in schermo non è mai stata alterata.
   */
  onDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    const ordine = this.settings.map(s => s.channel);
    moveItemInArray(ordine, event.previousIndex, event.currentIndex);
    this.reorder.emit(ordine);
  }

  /** Si salva quando il campo perde il fuoco, non a ogni tasto premuto. */
  commitFromName(setting: NotificationChannelSetting): void {
    if (this.fromNameDraft === null) return;
    const value = this.fromNameDraft.trim();
    this.fromNameDraft = null;
    if (value === (setting.emailFromName ?? '')) return;
    this.change.emit({ channel: setting.channel, emailFromName: value || null });
  }
}
