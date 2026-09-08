/**
 * Recurrence Editor
 * Layer 1: Dumb Component (presentazionale, OnPush)
 *
 * L'editor della regola di ricorrenza: tipo, intervallo, giorni della
 * settimana, mensile per data o per posizione ("il primo mercoledì"), fine
 * della serie, anteprima.
 *
 * CONDIVISO FRA DIALOG OPERATORI E PALESTRA, di proposito. Non contiene
 * logica di dominio: non sa cosa sia un operatore, una sala, una
 * disponibilità o un conflitto. Riceve una `RepeatConfig` e ne emette una
 * modificata — "ogni 2 settimane il lunedì e il mercoledì fino al 30/09"
 * significa la stessa identica cosa nelle due viste, tanto che il backend
 * usa un solo DTO per entrambi i flussi.
 *
 * Ciò che invece è diverso fra le due viste — dove cercare uno slot
 * alternativo quando un'occorrenza è in conflitto: un altro operatore o
 * un'altra sala — sta FUORI di qui, nei rispettivi pannelli di risoluzione.
 * È il confine che tiene questo componente privo di flag di modalità.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RepeatConfig, MonthlyRule } from '../../../models/appointment.model';
import {
  DEFAULT_REPEAT_CONFIG,
  MONTHLY_ORDINALS,
  MONTHLY_WEEKDAYS,
  WEEKDAY_LABELS,
  isMonthlyByWeekday,
  ruleFromDate,
  intervalLabel,
  occurrencesPreview,
  parseLocalDate,
} from './recurrence-config.util';

@Component({
  selector: 'app-recurrence-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatDatepickerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="recurring-section">
      <mat-slide-toggle [ngModel]="enabled" [disabled]="disabled"
                        (ngModelChange)="onToggle($event)">
        <mat-icon>repeat</mat-icon>
        {{ toggleLabel }}
      </mat-slide-toggle>

      @if (hint && enabled) {
        <div class="recurring-hint">{{ hint }}</div>
      }

      @if (enabled) {
        <div class="recurring-config">
          <div class="form-row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Ripeti</mat-label>
              <mat-select [ngModel]="config.type" [disabled]="disabled"
                          (ngModelChange)="patch({ type: $event })">
                <mat-option value="daily">Ogni giorno</mat-option>
                <mat-option value="weekly">Ogni settimana</mat-option>
                <mat-option value="monthly">Ogni mese</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="interval-field">
              <mat-label>Intervallo</mat-label>
              <input matInput type="number" min="1" max="12"
                     [ngModel]="config.interval" [disabled]="disabled"
                     (ngModelChange)="patch({ interval: +$event || 1 })">
              <span matTextSuffix>{{ intervalUnit }}</span>
            </mat-form-field>
          </div>

          <!-- Mensile: per data del mese oppure per posizione nella settimana
               (il primo mercoledì, l'ultimo lunedì...). La seconda ammette
               più fasce nello stesso mese. -->
          @if (config.type === 'monthly') {
            <div class="monthly-selector">
              <mat-radio-group [ngModel]="config.monthlyMode" [disabled]="disabled"
                               (ngModelChange)="onMonthlyModeChange($event)"
                               class="monthly-mode-options">
                <mat-radio-button value="day_of_month">Stesso giorno del mese</mat-radio-button>
                <mat-radio-button value="day_of_week">Giorno della settimana</mat-radio-button>
              </mat-radio-group>

              @if (byWeekday) {
                <div class="monthly-rules">
                  @for (rule of rules; track $index) {
                    <div class="monthly-rule">
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ordinal-field">
                        <mat-label>Posizione</mat-label>
                        <mat-select [ngModel]="rule.ordinal" [disabled]="disabled"
                                    (ngModelChange)="updateRule($index, { ordinal: $event })">
                          @for (o of ordinals; track o.value) {
                            <mat-option [value]="o.value">{{ o.label }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>

                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="weekday-field">
                        <mat-label>Giorno</mat-label>
                        <mat-select [ngModel]="rule.weekday" [disabled]="disabled"
                                    (ngModelChange)="updateRule($index, { weekday: $event })">
                          @for (w of weekdayOptions; track w.value) {
                            <mat-option [value]="w.value">{{ w.label }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>

                      <button mat-icon-button type="button" class="remove-rule"
                              [disabled]="disabled || rules.length <= 1"
                              matTooltip="Rimuovi questa fascia"
                              (click)="removeRule($index)">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  }

                  <button mat-stroked-button type="button" class="add-rule"
                          [disabled]="disabled" (click)="addRule()">
                    <mat-icon>add</mat-icon>
                    Aggiungi fascia
                  </button>
                </div>
              }
            </div>
          }

          <!-- Giorni della settimana (solo weekly) -->
          @if (config.type === 'weekly') {
            <div class="weekday-selector">
              <label>Giorni della settimana</label>
              <div class="weekday-buttons">
                @for (day of weekdayLabels; track $index) {
                  <button mat-mini-fab type="button"
                          [color]="isDaySelected($index) ? 'primary' : ''"
                          [disabled]="disabled"
                          (click)="toggleDay($index)">
                    {{ day }}
                  </button>
                }
              </div>
            </div>
          }

          <!-- Fine ricorrenza -->
          <div class="end-config">
            <label>Termina</label>
            <mat-radio-group [ngModel]="config.endType" [disabled]="disabled"
                             (ngModelChange)="patch({ endType: $event })"
                             class="end-options-inline">
              <div class="end-option">
                <mat-radio-button value="after">Dopo</mat-radio-button>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="occurrences-field">
                  <input matInput type="number" min="1" max="52"
                         [ngModel]="config.occurrences"
                         [disabled]="disabled || config.endType !== 'after'"
                         (ngModelChange)="patch({ occurrences: +$event || 1 })">
                </mat-form-field>
                <span>volte</span>
              </div>

              <div class="end-option">
                <mat-radio-button value="until">Fino al</mat-radio-button>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="until-field">
                  <input matInput [matDatepicker]="untilPicker"
                         [ngModel]="untilDateValue"
                         [disabled]="disabled || config.endType !== 'until'"
                         (dateChange)="onUntilChange($event.value)">
                  <mat-datepicker-toggle matIconSuffix [for]="untilPicker"
                                         [disabled]="disabled || config.endType !== 'until'">
                  </mat-datepicker-toggle>
                  <mat-datepicker #untilPicker></mat-datepicker>
                </mat-form-field>
              </div>
            </mat-radio-group>
          </div>

          @if (preview) {
            <div class="recurring-preview">
              <mat-icon>info</mat-icon>
              <span>{{ preview }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .recurring-section {
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
    }

    .recurring-section mat-slide-toggle mat-icon {
      font-size: 18px; width: 18px; height: 18px;
      vertical-align: middle; margin-right: 4px;
    }

    .recurring-hint {
      margin-top: 8px;
      font-size: 0.8125rem;
      line-height: 1.4;
      color: #475569;
    }

    .recurring-config {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .form-row mat-form-field { flex: 1 1 150px; min-width: 0; }
    .interval-field { flex: 0 1 150px; }

    .monthly-mode-options {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 20px;
    }

    .monthly-rules {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .monthly-rule {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .ordinal-field { flex: 1 1 130px; min-width: 0; }
    .weekday-field { flex: 1 1 130px; min-width: 0; }
    .add-rule { align-self: flex-start; }

    .weekday-selector label,
    .end-config label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #64748b;
      margin-bottom: 8px;
    }

    .weekday-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    /* I mini-fab di Material sono 40px: sette in fila sfondano un dialog da
       520px. Ridotti a 36px stanno su una riga sola fino a ~380px utili. */
    .weekday-buttons button {
      width: 36px;
      height: 36px;
      line-height: 36px;
      font-size: 0.6875rem;
    }

    .end-options-inline {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 24px;
    }

    .end-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .occurrences-field { width: 72px; }
    .until-field { width: 170px; }

    .recurring-preview {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 0.8125rem;
    }

    .recurring-preview mat-icon {
      font-size: 18px; width: 18px; height: 18px;
    }

    @media (max-width: 599px) {
      .end-option { flex: 1 1 100%; }
      .until-field { flex: 1 1 auto; width: auto; }
    }
  `],
})
export class RecurrenceEditorComponent {
  /** Ricorrenza attiva. Two-way: `[(enabled)]`. */
  @Input() enabled = false;
  @Output() enabledChange = new EventEmitter<boolean>();

  /** Configurazione corrente. Two-way: `[(config)]`. */
  @Input() config: RepeatConfig = { ...DEFAULT_REPEAT_CONFIG };
  @Output() configChange = new EventEmitter<RepeatConfig>();

  /**
   * Data di partenza della serie (YYYY-MM-DD). Serve a due cose: preselezionare
   * il giorno della settimana all'attivazione e proporre la prima fascia
   * mensile coerente con la data scelta.
   */
  @Input() baseDate: string | null = null;

  /** Etichetta del toggle: cambia fra creazione e "rendi ricorrente". */
  @Input() toggleLabel = 'Appuntamento ricorrente';

  /** Testo esplicativo mostrato sotto il toggle quando è attivo. */
  @Input() hint: string | null = null;

  @Input() disabled = false;

  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly ordinals = MONTHLY_ORDINALS;
  readonly weekdayOptions = MONTHLY_WEEKDAYS;

  get byWeekday(): boolean {
    return isMonthlyByWeekday(this.config);
  }

  get rules(): MonthlyRule[] {
    return this.config.monthlyRules ?? [];
  }

  get intervalUnit(): string {
    return intervalLabel(this.config);
  }

  get preview(): string {
    return this.enabled ? occurrencesPreview(this.config, this.baseDate) : '';
  }

  /**
   * Modello Date del datepicker "Fino al", MEMOIZZATO sulla stringa in config.
   *
   * La memoizzazione non è un'ottimizzazione, è la correttezza: il getter è
   * letto a ogni ciclo di change detection e `[ngModel]` confronta per
   * RIFERIMENTO. Restituendo un `new Date` a ogni lettura, NgModel vede un
   * valore sempre "cambiato" → ngOnChanges → setValue in un microtask →
   * Zone rilancia il ciclo → nuovo Date → ... loop infinito che inchioda il
   * browser nell'istante in cui si sceglie una data (finché il campo è vuoto
   * il getter torna null e non si nota nulla).
   */
  private untilCacheKey: string | null = null;
  private untilCacheValue: Date | null = null;

  get untilDateValue(): Date | null {
    const raw = this.config.untilDate ?? '';
    if (raw !== this.untilCacheKey) {
      this.untilCacheKey = raw;
      this.untilCacheValue = parseLocalDate(raw);
    }
    return this.untilCacheValue;
  }

  onToggle(enabled: boolean): void {
    this.enabled = enabled;
    this.enabledChange.emit(enabled);

    if (!enabled) {
      this.emitConfig({ ...DEFAULT_REPEAT_CONFIG });
      return;
    }
    // All'attivazione la settimanale parte dal giorno dell'appuntamento:
    // è quasi sempre quello che si vuole, e lasciare l'elenco vuoto
    // produrrebbe una serie che non genera nessuna data.
    this.emitConfig({ ...this.config, selectedDays: [this.baseWeekday()] });
  }

  patch(partial: Partial<RepeatConfig>): void {
    this.emitConfig({ ...this.config, ...partial });
  }

  isDaySelected(dayIndex: number): boolean {
    return this.config.selectedDays?.includes(dayIndex) ?? false;
  }

  toggleDay(dayIndex: number): void {
    const days = [...(this.config.selectedDays ?? [])];
    const i = days.indexOf(dayIndex);
    if (i === -1) days.push(dayIndex);
    else days.splice(i, 1);
    days.sort();
    this.emitConfig({ ...this.config, selectedDays: days });
  }

  onMonthlyModeChange(mode: RepeatConfig['monthlyMode']): void {
    const next: RepeatConfig = { ...this.config, monthlyMode: mode };
    // Entrando in "per giorno della settimana" senza fasce, se ne propone una
    // che ricalca la data scelta: l'utente parte da qualcosa di sensato
    // invece che da un elenco vuoto.
    if (mode === 'day_of_week' && (next.monthlyRules?.length ?? 0) === 0) {
      next.monthlyRules = [ruleFromDate(this.baseDateObject())];
    }
    this.emitConfig(next);
  }

  addRule(): void {
    this.emitConfig({
      ...this.config,
      monthlyRules: [...this.rules, ruleFromDate(this.baseDateObject())],
    });
  }

  removeRule(index: number): void {
    this.emitConfig({
      ...this.config,
      monthlyRules: this.rules.filter((_, i) => i !== index),
    });
  }

  updateRule(index: number, patch: Partial<MonthlyRule>): void {
    this.emitConfig({
      ...this.config,
      monthlyRules: this.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  }

  onUntilChange(date: Date | null): void {
    this.emitConfig({ ...this.config, untilDate: this.toDateString(date) });
  }

  /**
   * Emette SEMPRE un oggetto nuovo, mai una mutazione di quello ricevuto:
   * i due dialog che ospitano l'editor sono OnPush e con una mutazione in
   * place non si accorgerebbero del cambiamento.
   */
  private emitConfig(next: RepeatConfig): void {
    this.config = next;
    this.configChange.emit(next);
  }

  private baseDateObject(): Date {
    return parseLocalDate(this.baseDate) ?? new Date();
  }

  private baseWeekday(): number {
    return this.baseDateObject().getDay();
  }

  /** Data locale in 'YYYY-MM-DD': mai via toISOString (sposta di un giorno). */
  private toDateString(d: Date | null): string {
    if (!d) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
