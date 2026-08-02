import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WhatsappConfig, WhatsappConfigInput } from '../../models/whatsapp.models';

const MIN_SECRET_LENGTH = 16;

@Component({
  selector: 'app-config-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="config-form">
      <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
        <mat-label>URL Gateway</mat-label>
        <input matInput [(ngModel)]="gatewayUrl"
               placeholder="http://message_gateway:3000" />
        <mat-hint>URL del microservizio WhatsApp Gateway</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
        <mat-label>Tenant ID</mat-label>
        <input matInput [(ngModel)]="tenantApiId"
               placeholder="es. bdq" />
        <mat-hint>Deve corrispondere al nome istanza Evolution API</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
        <mat-label>API Key</mat-label>
        <input matInput [(ngModel)]="apiKey"
               [name]="apiKeyFieldName"
               autocomplete="new-password"
               [type]="showApiKey ? 'text' : 'password'"
               [placeholder]="config?.maskedApiKey || 'Inserisci API key'" />
        <button mat-icon-button matSuffix (click)="showApiKey = !showApiKey">
          <mat-icon>{{ showApiKey ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-hint [class.warn]="apiKey.length > 0">{{ apiKeyHint }}</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
        <mat-label>Webhook Secret</mat-label>
        <input matInput [(ngModel)]="webhookSecret"
               [name]="webhookSecretFieldName"
               autocomplete="new-password"
               [type]="showSecret ? 'text' : 'password'"
               placeholder="Secret per validare webhook HMAC" />
        <button mat-icon-button matSuffix (click)="showSecret = !showSecret">
          <mat-icon>{{ showSecret ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-hint [class.warn]="webhookSecret.length > 0">{{ webhookSecretHint }}</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
        <mat-label>API Key Evolution</mat-label>
        <input matInput [(ngModel)]="evolutionApiKey"
               [name]="evolutionApiKeyFieldName"
               autocomplete="new-password"
               [type]="showEvolutionKey ? 'text' : 'password'"
               placeholder="Chiave istanza Evolution (solo per rotazione)" />
        <button mat-icon-button matSuffix (click)="showEvolutionKey = !showEvolutionKey">
          <mat-icon>{{ showEvolutionKey ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-hint [class.warn]="evolutionApiKey.length > 0">{{ evolutionApiKeyHint }}</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
        <mat-label>Finestra recap (secondi)</mat-label>
        <input matInput type="number" [(ngModel)]="recapBufferSeconds"
               min="30" max="600" />
        <mat-hint [class.warn]="!isRecapBufferValid">{{ recapBufferHint }}</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
        <mat-label>Giorni di conservazione log</mat-label>
        <input matInput type="number" [(ngModel)]="retentionDays"
               min="30" max="3650" />
        <mat-hint>Dopo questo periodo i log possono essere anonimizzati (default: 730 giorni = 2 anni)</mat-hint>
      </mat-form-field>

      <div class="toggle-row">
        <mat-slide-toggle [(ngModel)]="isActive" color="primary">
          Invio messaggi WhatsApp abilitato
        </mat-slide-toggle>
        <div class="toggle-hint">
          Disattiva per modalità formazione/test: nessun messaggio verrà inviato ai pazienti.
          Le configurazioni e le chiavi restano salvate.
        </div>
      </div>

      <div class="toggle-row">
        <mat-slide-toggle [(ngModel)]="sendCancelNotification" color="primary">
          Invia notifica di cancellazione
        </mat-slide-toggle>
        <div class="toggle-hint">Invia un messaggio WhatsApp al paziente quando un appuntamento viene cancellato</div>
      </div>

      <div class="toggle-row">
        <mat-slide-toggle [(ngModel)]="sendUpdateNotification" color="primary">
          Invia notifica di spostamento
        </mat-slide-toggle>
        <div class="toggle-hint">
          Invia un messaggio WhatsApp al paziente quando cambia data o ora dell'appuntamento.
          Il promemoria 24h viene comunque riprogrammato sul nuovo orario.
        </div>
      </div>

      <div class="form-actions">
        <button mat-stroked-button
                (click)="onTestConnection()"
                [disabled]="testing || !gatewayUrl">
          @if (testing) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>wifi</mat-icon>
          }
          Testa Connessione
        </button>

        @if (testResult !== null) {
          <span class="test-result" [class.success]="testResult" [class.error]="!testResult">
            <mat-icon>{{ testResult ? 'check_circle' : 'error' }}</mat-icon>
            {{ testResult ? 'Connessione OK' : 'Connessione fallita' }}
          </span>
        }

        <span class="spacer"></span>

        <button mat-raised-button color="primary"
                (click)="onSave()"
                [disabled]="saving || !gatewayUrl || !tenantApiId">
          @if (saving) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          Salva Configurazione
        </button>
      </div>
    </div>
  `,
  styles: [`
    .config-form {
      display: flex;
      flex-direction: column;
      /* 16px e non 8: con subscriptSizing="dynamic" gli hint occupano spazio
         reale e su più righe finivano a ridosso del campo successivo. */
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .toggle-row {
      padding: 8px 0 16px;
    }

    .toggle-hint {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }

    .form-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .spacer {
      flex: 1;
    }

    .test-result {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
    }

    .test-result.success {
      color: #2e7d32;
    }

    .test-result.error {
      color: #c62828;
    }

    .test-result mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    ::ng-deep mat-hint.warn {
      color: #c62828;
      font-weight: 500;
    }
  `],
})
export class ConfigFormComponent {
  @Input() config: WhatsappConfig | null = null;
  @Input() saving = false;
  @Input() testing = false;
  @Input() testResult: boolean | null = null;
  @Output() save = new EventEmitter<WhatsappConfigInput>();
  @Output() testConnection = new EventEmitter<void>();

  gatewayUrl = '';
  tenantApiId = '';
  apiKey = '';
  webhookSecret = '';
  evolutionApiKey = '';
  isActive = false;
  sendCancelNotification = false;
  sendUpdateNotification = true;
  recapBufferSeconds = 60;
  retentionDays = 730;
  showApiKey = false;
  showSecret = false;
  showEvolutionKey = false;

  // Randomized name attributes per evitare che il browser auto-completi
  // questi campi password con credenziali salvate per il dominio.
  readonly apiKeyFieldName = `wa-cfg-${Math.random().toString(36).slice(2, 10)}`;
  readonly webhookSecretFieldName = `wa-cfg-${Math.random().toString(36).slice(2, 10)}`;
  readonly evolutionApiKeyFieldName = `wa-cfg-${Math.random().toString(36).slice(2, 10)}`;

  ngOnChanges(): void {
    if (this.config) {
      this.gatewayUrl = this.config.gatewayUrl || '';
      this.tenantApiId = this.config.tenantApiId || '';
      this.isActive = this.config.isActive || false;
      this.sendCancelNotification = this.config.sendCancelNotification || false;
      this.sendUpdateNotification = this.config.sendUpdateNotification ?? true;
      this.recapBufferSeconds = this.config.recapBufferSeconds ?? 60;
      this.retentionDays = this.config.retentionDays ?? 730;
      // Don't set apiKey/webhookSecret from config (they're masked)
    }
  }

  get apiKeyHint(): string {
    if (this.apiKey.length === 0) {
      return this.config?.maskedApiKey
        ? `✓ API key configurata (${this.config.maskedApiKey}) — lascia vuoto per mantenerla`
        : 'Cifrata a riposo nel database';
    }
    if (this.apiKey.length < MIN_SECRET_LENGTH) {
      return `⚠ Troppo corta (min ${MIN_SECRET_LENGTH} caratteri). Forse autofill del browser: cancella e reinserisci la chiave reale.`;
    }
    return '⚠ Verrà sovrascritta la API key attualmente salvata';
  }

  get webhookSecretHint(): string {
    if (this.webhookSecret.length === 0) {
      return 'Usato per validare la firma HMAC dei webhook. Lascia vuoto per mantenere quello salvato.';
    }
    if (this.webhookSecret.length < MIN_SECRET_LENGTH) {
      return `⚠ Troppo corto (min ${MIN_SECRET_LENGTH} caratteri). Forse autofill del browser: cancella e reinserisci il secret reale.`;
    }
    return '⚠ Verrà sovrascritto il webhook secret attualmente salvato';
  }

  get evolutionApiKeyHint(): string {
    if (this.evolutionApiKey.length === 0) {
      return 'Chiave con cui il gateway parla con Evolution: viene scritta in OpenBao, non nel database. Lascia vuoto per non modificarla.';
    }
    if (this.evolutionApiKey.length < MIN_SECRET_LENGTH) {
      return `⚠ Troppo corta (min ${MIN_SECRET_LENGTH} caratteri). Forse autofill del browser: cancella e reinserisci la chiave reale.`;
    }
    return '⚠ Verrà aggiornata in OpenBao e la cache del gateway sarà svuotata subito';
  }

  get isRecapBufferValid(): boolean {
    return this.recapBufferSeconds >= 30 && this.recapBufferSeconds <= 600;
  }

  get recapBufferHint(): string {
    if (!this.isRecapBufferValid) {
      return '⚠ Valore ammesso: da 30 a 600 secondi';
    }
    // Tetto allo slittamento: min(5 × finestra, 15 min), come nel gateway.
    const capMinutes = Math.min(this.recapBufferSeconds * 5, 900) / 60;
    const cap = Number.isInteger(capMinutes) ? `${capMinutes}` : capMinutes.toFixed(1).replace('.', ',');
    return (
      `Appuntamenti presi per lo stesso paziente entro ${this.recapBufferSeconds}s finiscono in un unico ` +
      `messaggio, e il conteggio riparte a ogni nuovo appuntamento. Il recap parte comunque entro ${cap} ` +
      'minuti dal primo (default: 60s)'
    );
  }

  get hasInvalidSecretLength(): boolean {
    return (
      (this.apiKey.length > 0 && this.apiKey.length < MIN_SECRET_LENGTH) ||
      (this.webhookSecret.length > 0 && this.webhookSecret.length < MIN_SECRET_LENGTH) ||
      (this.evolutionApiKey.length > 0 && this.evolutionApiKey.length < MIN_SECRET_LENGTH)
    );
  }

  onSave(): void {
    if (this.hasInvalidSecretLength || !this.isRecapBufferValid) return;
    const input: WhatsappConfigInput = {
      gatewayUrl: this.gatewayUrl,
      tenantApiId: this.tenantApiId,
      isActive: this.isActive,
      sendCancelNotification: this.sendCancelNotification,
      sendUpdateNotification: this.sendUpdateNotification,
      recapBufferSeconds: this.recapBufferSeconds,
      retentionDays: this.retentionDays,
    };
    if (this.apiKey) input.apiKey = this.apiKey;
    if (this.webhookSecret) input.webhookSecret = this.webhookSecret;
    if (this.evolutionApiKey) input.evolutionApiKey = this.evolutionApiKey;
    this.save.emit(input);
  }

  onTestConnection(): void {
    this.testConnection.emit();
  }
}
