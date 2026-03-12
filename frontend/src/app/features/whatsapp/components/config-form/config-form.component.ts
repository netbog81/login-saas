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
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>URL Gateway</mat-label>
        <input matInput [(ngModel)]="gatewayUrl"
               placeholder="http://message_gateway:3000" />
        <mat-hint>URL del microservizio WhatsApp Gateway</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Tenant ID</mat-label>
        <input matInput [(ngModel)]="tenantApiId"
               placeholder="es. bdq" />
        <mat-hint>Deve corrispondere al nome istanza Evolution API</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>API Key</mat-label>
        <input matInput [(ngModel)]="apiKey"
               [type]="showApiKey ? 'text' : 'password'"
               [placeholder]="config?.maskedApiKey || 'Inserisci API key'" />
        <button mat-icon-button matSuffix (click)="showApiKey = !showApiKey">
          <mat-icon>{{ showApiKey ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-hint>Cifrata a riposo nel database</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Webhook Secret</mat-label>
        <input matInput [(ngModel)]="webhookSecret"
               [type]="showSecret ? 'text' : 'password'"
               placeholder="Secret per validare webhook HMAC" />
        <button mat-icon-button matSuffix (click)="showSecret = !showSecret">
          <mat-icon>{{ showSecret ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-hint>Usato per validare la firma HMAC dei webhook</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Giorni di conservazione log</mat-label>
        <input matInput type="number" [(ngModel)]="retentionDays"
               min="30" max="3650" />
        <mat-hint>Dopo questo periodo i log possono essere anonimizzati (default: 730 giorni = 2 anni)</mat-hint>
      </mat-form-field>

      <div class="toggle-row">
        <mat-slide-toggle [(ngModel)]="isActive" color="primary">
          Gateway Attivo
        </mat-slide-toggle>
      </div>

      <div class="toggle-row">
        <mat-slide-toggle [(ngModel)]="sendCancelNotification" color="primary">
          Invia notifica di cancellazione
        </mat-slide-toggle>
        <div class="toggle-hint">Invia un messaggio WhatsApp al paziente quando un appuntamento viene cancellato</div>
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
      gap: 8px;
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
  isActive = false;
  sendCancelNotification = false;
  retentionDays = 730;
  showApiKey = false;
  showSecret = false;

  ngOnChanges(): void {
    if (this.config) {
      this.gatewayUrl = this.config.gatewayUrl || '';
      this.tenantApiId = this.config.tenantApiId || '';
      this.isActive = this.config.isActive || false;
      this.sendCancelNotification = this.config.sendCancelNotification || false;
      this.retentionDays = this.config.retentionDays ?? 730;
      // Don't set apiKey/webhookSecret from config (they're masked)
    }
  }

  onSave(): void {
    const input: WhatsappConfigInput = {
      gatewayUrl: this.gatewayUrl,
      tenantApiId: this.tenantApiId,
      isActive: this.isActive,
      sendCancelNotification: this.sendCancelNotification,
      retentionDays: this.retentionDays,
    };
    if (this.apiKey) input.apiKey = this.apiKey;
    if (this.webhookSecret) input.webhookSecret = this.webhookSecret;
    this.save.emit(input);
  }

  onTestConnection(): void {
    this.testConnection.emit();
  }
}
