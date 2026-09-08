import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  WhatsappTemplate,
  WhatsappTemplateInput,
  TemplateChannel,
  WhatsappTemplateType,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_VARIABLES,
} from '../../models/whatsapp.models';

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <!-- Il canale sta SOPRA i tipi di messaggio, non dentro: si sceglie prima
         dove scrive, poi cosa scrive. L'ordine inverso avrebbe moltiplicato le
         schede per tre e reso illeggibile la fila. -->
    <div class="channel-bar">
      <mat-button-toggle-group [value]="channel"
                               (change)="onChannelChange($event.value)"
                               hideSingleSelectionIndicator>
        @for (c of channels; track c.value) {
          <mat-button-toggle [value]="c.value">
            <mat-icon>{{ c.icon }}</mat-icon> {{ c.label }}
          </mat-button-toggle>
        }
      </mat-button-toggle-group>

      @if (channel !== 'WHATSAPP') {
        <p class="channel-note">
          <mat-icon>info</mat-icon>
          <span>
            Testi propri di questo canale. Lasciarli vuoti non è un errore:
            si usa il testo di WhatsApp. Serve solo dove vuoi scrivere diverso.
          </span>
        </p>
      }
    </div>

    <mat-tab-group (selectedIndexChange)="onTabChange($event)">
      @for (type of templateTypes; track type; let i = $index) {
        <mat-tab [label]="getTypeLabel(type)">
          <div class="template-tab-content">
            <div class="variables-hint">
              <span class="hint-label">Variabili disponibili:</span>
              @for (v of getVariables(type); track v) {
                <mat-chip-option [selectable]="false"
                                 (click)="insertVariable(v)">
                  {{ v }}
                </mat-chip-option>
              }
            </div>

            @if (showsSubject(type)) {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Oggetto dell'email</mat-label>
                <input matInput [(ngModel)]="editingSubjects[key(type)]"
                       placeholder="Oggetto che il paziente vede in posta" />
              </mat-form-field>
            }

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Testo del messaggio</mat-label>
              <textarea matInput
                        [(ngModel)]="editingBodies[key(type)]"
                        rows="5"
                        placeholder="Scrivi il testo del messaggio...">
              </textarea>
              @if (channel === 'SMS') {
                <mat-hint [class.sms-over]="smsParts(type) > 1">
                  {{ smsLength(type) }} caratteri —
                  {{ smsParts(type) === 0
                      ? 'vuoto: userà il testo di WhatsApp'
                      : smsParts(type) === 1
                        ? 'un solo SMS'
                        : smsParts(type) + ' SMS, e li paghi tutti' }}
                </mat-hint>
              }
              @if (channel !== 'WHATSAPP' && !editingBodies[key(type)]) {
                <mat-hint>Vuoto: si userà il testo di WhatsApp</mat-hint>
              }
            </mat-form-field>

            @if (!isEmail(type) && channel === 'WHATSAPP') {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Footer (opzionale)</mat-label>
                <input matInput [(ngModel)]="editingFooters[key(type)]"
                       placeholder="Footer del messaggio" />
              </mat-form-field>
            }

            <div class="template-actions">
              <mat-slide-toggle [(ngModel)]="editingActive[key(type)]" color="primary">
                Template attivo
              </mat-slide-toggle>

              <span class="spacer"></span>

              <button mat-raised-button color="primary"
                      (click)="onSave(type)"
                      [disabled]="saving">
                @if (saving && savingType === type) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>save</mat-icon>
                }
                Salva Template
              </button>
            </div>

            @if (editingBodies[key(type)]) {
              <div class="preview-section">
                <h4>Anteprima</h4>
                <div class="preview-box">
                  {{ getPreview(type) }}
                </div>
              </div>
            }
          </div>
        </mat-tab>
      }
    </mat-tab-group>
  `,
  styles: [`
    .channel-bar { padding: 12px 0 4px; }
    .channel-note {
      display: flex; gap: 6px; align-items: flex-start;
      font-size: .78rem; color: #475569; background: #f1f5f9;
      border-radius: 8px; padding: 8px 10px; margin: 10px 0 0;
    }
    .channel-note mat-icon { font-size: 17px; width: 17px; height: 17px; flex: 0 0 auto; }
    .sms-over { color: #d97706; font-weight: 600; }

    .template-tab-content {
      padding: 16px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .variables-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .hint-label {
      font-size: 13px;
      color: #666;
      font-weight: 500;
    }

    .full-width {
      width: 100%;
    }

    .template-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .spacer {
      flex: 1;
    }

    .preview-section h4 {
      margin: 8px 0;
      font-size: 13px;
      font-weight: 500;
      color: #666;
    }

    .preview-box {
      background: #e8f5e9;
      border-left: 4px solid #25d366;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 14px;
      white-space: pre-wrap;
      line-height: 1.5;
    }
  `],
})
export class TemplateEditorComponent {
  @Input() templates: WhatsappTemplate[] = [];
  @Input() saving = false;
  @Output() saveTemplate = new EventEmitter<WhatsappTemplateInput>();

  // Ordine di lettura: prima le conferme, poi i promemoria, infine cosa
  // succede quando un appuntamento si muove o salta. Le varianti multiple
  // stanno accanto alla propria singola.
  templateTypes: WhatsappTemplateType[] = [
    'RECAP_SINGLE',
    'RECAP_MULTI',
    'REMINDER_24H',
    'REMINDER_48H',
    'UPDATE',
    'UPDATE_MULTI',
    'CANCELLATION',
    'CANCELLATION_MULTI',
    'CALENDAR_INVITE_EMAIL',
  ];
  editingBodies: Record<string, string> = {};
  editingFooters: Record<string, string> = {};
  editingSubjects: Record<string, string> = {};
  editingActive: Record<string, boolean> = {};
  savingType: WhatsappTemplateType | null = null;

  private previewVariables: Record<string, string> = {
    '{name}': 'Mario Rossi',
    '{date}': '15/03/2026',
    '{time}': '10:30',
    '{appointments}': '- 15/03 ore 10:30\n- 16/03 ore 14:00',
    '{oldDate}': '08/03/2026',
    '{oldTime}': '09:00',
    '{link}': 'https://api.curandis.cloud/calendar-feed/patient/setup/…',
    '{unsubscribe}': 'https://api.curandis.cloud/calendar-feed/patient/unsubscribe/…',
  };

  /** Canale attualmente in modifica. */
  channel: TemplateChannel = 'WHATSAPP';

  readonly channels: { value: TemplateChannel; label: string; icon: string }[] = [
    { value: 'WHATSAPP', label: 'WhatsApp', icon: 'chat' },
    { value: 'EMAIL', label: 'Email', icon: 'mail' },
    { value: 'SMS', label: 'SMS', icon: 'sms' },
  ];

  /**
   * Chiave delle mappe di modifica.
   *
   * Include il canale: senza, passando da una scheda all'altra si
   * sovrascriverebbero i testi di canali diversi credendo di modificarne uno.
   */
  key(type: WhatsappTemplateType): string {
    return `${this.channel}:${type}`;
  }

  /**
   * Ha un oggetto chi viaggia per posta: tutto il canale email, e l'invito al
   * calendario che è un'email anche quando lo si guarda fra i testi WhatsApp.
   * Su un messaggio WhatsApp o un SMS il campo confonderebbe e basta.
   */
  showsSubject(type: WhatsappTemplateType): boolean {
    return this.channel === 'EMAIL' || type === 'CALENDAR_INVITE_EMAIL';
  }

  /** Compatibilità: usato altrove per capire se il tipo è di posta. */
  isEmail(type: WhatsappTemplateType): boolean {
    return type === 'CALENDAR_INVITE_EMAIL';
  }

  /**
   * Quanti SMS costerà questo testo.
   *
   * Un SMS sono 160 caratteri; oltre, l'operatore ne conta due o più e li
   * fattura tutti. È il tipo di cosa che si scopre dalla bolletta se non si
   * vede mentre si scrive.
   */
  smsParts(type: WhatsappTemplateType): number {
    const len = (this.editingBodies[this.key(type)] || '').length;
    return len === 0 ? 0 : Math.ceil(len / 160);
  }

  smsLength(type: WhatsappTemplateType): number {
    return (this.editingBodies[this.key(type)] || '').length;
  }

  onChannelChange(channel: TemplateChannel): void {
    this.channel = channel;
  }

  ngOnChanges(): void {
    if (this.templates?.length) {
      for (const t of this.templates) {
        this.editingBodies[t.channel + ':' + t.templateType] = t.bodyTemplate;
        this.editingFooters[t.channel + ':' + t.templateType] = t.footerTemplate || '';
        this.editingSubjects[t.channel + ':' + t.templateType] = t.subjectTemplate || '';
        this.editingActive[t.channel + ':' + t.templateType] = t.isActive;
      }
    }
  }

  getTypeLabel(type: WhatsappTemplateType): string {
    return TEMPLATE_TYPE_LABELS[type] || type;
  }

  getVariables(type: WhatsappTemplateType): string[] {
    return TEMPLATE_VARIABLES[type] || [];
  }

  insertVariable(variable: string): void {
    // Simple variable insertion hint - the user copies from the chip
  }

  getPreview(type: WhatsappTemplateType): string {
    let text = this.editingBodies[this.key(type)] || '';
    for (const [key, value] of Object.entries(this.previewVariables)) {
      text = text.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    return text;
  }

  onSave(type: WhatsappTemplateType): void {
    this.savingType = type;
    this.saveTemplate.emit({
      templateType: type,
      channel: this.channel,
      bodyTemplate: this.editingBodies[this.key(type)] || '',
      footerTemplate: this.editingFooters[this.key(type)] || undefined,
      subjectTemplate: this.editingSubjects[this.key(type)] || undefined,
      isActive: this.editingActive[this.key(type)] ?? true,
    });
  }

  onTabChange(index: number): void {
    // Track active tab if needed
  }
}
