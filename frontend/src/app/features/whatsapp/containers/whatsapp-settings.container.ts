import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { WhatsappService } from '../services/whatsapp.service';
import {
  WhatsappConfig,
  WhatsappConfigInput,
  WhatsappTemplate,
  WhatsappTemplateInput,
  WhatsappTestResult,
} from '../models/whatsapp.models';
import { ConfigFormComponent } from '../components/config-form/config-form.component';
import { TemplateEditorComponent } from '../components/template-editor/template-editor.component';
import { QuickRepliesEditorComponent } from '../../whatsapp-chat/components/quick-replies-editor/quick-replies-editor.component';
import { QuickReply } from '../../whatsapp-chat/components/chat-composer/chat-composer.component';
import {
  WhatsappChatStateService,
  QUICK_REPLIES_SETTING_KEY,
} from '../../whatsapp-chat/services/whatsapp-chat-state.service';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-whatsapp-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    ConfigFormComponent,
    TemplateEditorComponent,
    QuickRepliesEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings-container">
      <mat-card class="settings-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>link</mat-icon>
          <mat-card-title>Connessione Gateway</mat-card-title>
          <mat-card-subtitle>Configurazione connessione al microservizio WhatsApp</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-config-form
            [config]="config"
            [saving]="savingConfig"
            [testing]="testingConnection"
            [testResult]="testResult"
            (save)="onSaveConfig($event)"
            (testConnection)="onTestConnection()">
          </app-config-form>
        </mat-card-content>
      </mat-card>

      <mat-card class="settings-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>science</mat-icon>
          <mat-card-title>Test Invio Messaggi</mat-card-title>
          <mat-card-subtitle>Testa l'invio dei messaggi WhatsApp tramite il gateway</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="test-form">
            <div class="test-fields">
              <mat-form-field appearance="outline">
                <mat-label>Numero di telefono</mat-label>
                <input matInput [(ngModel)]="testPhone"
                       placeholder="es. 393471234567" />
                <mat-hint>Formato internazionale senza +</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Nome paziente</mat-label>
                <input matInput [(ngModel)]="testName"
                       placeholder="es. Mario Rossi" />
              </mat-form-field>
            </div>

            <div class="test-buttons">
              <button mat-stroked-button
                      (click)="onTestDirect()"
                      [disabled]="testRunning || !testPhone || !testName"
                      class="test-btn">
                @if (testRunning === 'direct') {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>send</mat-icon>
                }
                Test Diretto
              </button>

              <button mat-stroked-button
                      (click)="onTestRecap()"
                      [disabled]="testRunning || !testPhone || !testName"
                      class="test-btn">
                @if (testRunning === 'recap') {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>summarize</mat-icon>
                }
                Test Recap Singolo
              </button>

              <button mat-stroked-button
                      (click)="onTestFullFlow()"
                      [disabled]="testRunning || !testPhone || !testName"
                      class="test-btn">
                @if (testRunning === 'full') {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>playlist_add_check</mat-icon>
                }
                Test Flusso Completo
              </button>
            </div>

            @if (lastTestResult) {
              <div class="test-result-box" [class.success]="lastTestResult.success" [class.error]="!lastTestResult.success">
                <mat-icon>{{ lastTestResult.success ? 'check_circle' : 'error' }}</mat-icon>
                <div class="test-result-content">
                  <div class="test-result-message">{{ lastTestResult.message }}</div>
                  @if (lastTestResult.data) {
                    <pre class="test-result-data">{{ lastTestResult.data | json }}</pre>
                  }
                </div>
              </div>
            }

            <div class="test-hints">
              <p><strong>Test Diretto:</strong> Invia un messaggio immediato, bypass della coda.</p>
              <p><strong>Test Recap Singolo:</strong> Simula 1 appuntamento → recap in 60s, reminder in 5min.</p>
              <p><strong>Test Flusso Completo:</strong> Simula 3 appuntamenti → recap aggregato in 60s, 3 reminder in 5/6/7min.</p>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="settings-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>message</mat-icon>
          <mat-card-title>Template Messaggi</mat-card-title>
          <mat-card-subtitle>Personalizza i messaggi inviati ai pazienti</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-template-editor
            [templates]="templates"
            [saving]="savingTemplate"
            (saveTemplate)="onSaveTemplate($event)">
          </app-template-editor>
        </mat-card-content>
      </mat-card>

      <mat-card class="settings-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>bolt</mat-icon>
          <mat-card-title>Risposte rapide chat</mat-card-title>
          <mat-card-subtitle>Testi pronti proposti nella chat WhatsApp</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-quick-replies-editor
            [quickReplies]="chatState.quickReplies()"
            [saving]="savingQuickReplies"
            (save)="onSaveQuickReplies($event)">
          </app-quick-replies-editor>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .settings-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      max-width: 800px;
    }

    .settings-card mat-card-header mat-icon {
      color: #25d366;
    }

    .test-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .test-fields {
      display: flex;
      gap: 16px;
    }

    .test-fields mat-form-field {
      flex: 1;
    }

    .test-buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .test-btn {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .test-result-box {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
    }

    .test-result-box.success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .test-result-box.error {
      background: #ffebee;
      color: #c62828;
    }

    .test-result-box mat-icon {
      margin-top: 2px;
      flex-shrink: 0;
    }

    .test-result-content {
      flex: 1;
      min-width: 0;
    }

    .test-result-message {
      font-weight: 500;
    }

    .test-result-data {
      margin: 8px 0 0;
      padding: 8px;
      background: rgba(0,0,0,0.05);
      border-radius: 4px;
      font-size: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .test-hints {
      padding: 8px 0;
    }

    .test-hints p {
      margin: 4px 0;
      font-size: 13px;
      color: #666;
    }

    @media (max-width: 768px) {
      .settings-container {
        gap: 16px;
      }

      .test-fields {
        flex-direction: column;
        gap: 0;
      }

      .test-buttons {
        flex-direction: column;
      }
    }
  `],
})
export class WhatsappSettingsContainer implements OnInit, OnDestroy {
  config: WhatsappConfig | null = null;
  templates: WhatsappTemplate[] = [];
  savingConfig = false;
  savingTemplate = false;
  savingQuickReplies = false;
  testingConnection = false;
  testResult: boolean | null = null;

  // Test section
  testPhone = '';
  testName = '';
  testRunning: 'direct' | 'recap' | 'full' | null = null;
  lastTestResult: WhatsappTestResult | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private whatsappService: WhatsappService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private settingsService: SettingsService,
    /** Pubblico: il template legge da qui le risposte rapide correnti. */
    public chatState: WhatsappChatStateService,
  ) {}

  /**
   * Salva le risposte rapide e le ricarica nello stato condiviso, così le
   * finestre di chat già aperte si allineano senza ricaricare la pagina.
   */
  onSaveQuickReplies(replies: QuickReply[]): void {
    this.savingQuickReplies = true;
    this.cdr.markForCheck();

    this.settingsService
      .upsertSetting(QUICK_REPLIES_SETTING_KEY, replies, {
        valueType: 'json',
        category: 'whatsapp',
        description: 'Risposte rapide proposte nella chat WhatsApp',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.savingQuickReplies = false;
            this.chatState.loadQuickReplies();
            this.snackBar.open('Risposte rapide salvate', 'OK', { duration: 3000 });
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.savingQuickReplies = false;
            this.snackBar.open(
              err?.message || 'Errore nel salvataggio delle risposte rapide',
              'OK',
              { duration: 5000 },
            );
            this.cdr.markForCheck();
          });
        },
      });
  }

  ngOnInit(): void {
    this.loadData();
    // Le risposte rapide vivono nello stato condiviso della chat: se
    // l'operatore arriva qui senza aver aperto nessuna chat, vanno caricate.
    this.chatState.loadQuickReplies();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSaveConfig(input: WhatsappConfigInput): void {
    this.savingConfig = true;
    this.cdr.markForCheck();

    this.whatsappService
      .upsertConfig(input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (config) => {
          this.ngZone.run(() => {
            this.config = config;
            this.savingConfig = false;
            this.snackBar.open('Configurazione salvata', 'OK', { duration: 3000 });
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('Error saving config:', err);
          this.ngZone.run(() => {
            this.savingConfig = false;
            const detail = err?.graphQLErrors?.[0]?.message || err?.message;
            this.snackBar.open(detail || 'Errore nel salvataggio', 'OK', { duration: 8000 });
            this.cdr.markForCheck();
          });
        },
      });
  }

  onTestConnection(): void {
    this.testingConnection = true;
    this.testResult = null;
    this.cdr.markForCheck();

    this.whatsappService
      .testConnection()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.ngZone.run(() => {
            this.testResult = result;
            this.testingConnection = false;
            this.cdr.markForCheck();
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.testResult = false;
            this.testingConnection = false;
            this.cdr.markForCheck();
          });
        },
      });
  }

  onTestDirect(): void {
    this.runTest('direct', this.whatsappService.testDirect(this.testPhone, this.testName));
  }

  onTestRecap(): void {
    this.runTest('recap', this.whatsappService.testRecap(this.testPhone, this.testName));
  }

  onTestFullFlow(): void {
    this.runTest('full', this.whatsappService.testFullFlow(this.testPhone, this.testName));
  }

  onSaveTemplate(input: WhatsappTemplateInput): void {
    this.savingTemplate = true;
    this.cdr.markForCheck();

    this.whatsappService
      .upsertTemplate(input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (template) => {
          this.ngZone.run(() => {
            const idx = this.templates.findIndex(
              (t) => t.templateType === template.templateType,
            );
            if (idx >= 0) {
              this.templates[idx] = template;
            } else {
              this.templates = [...this.templates, template];
            }
            this.savingTemplate = false;
            this.snackBar.open('Template salvato', 'OK', { duration: 3000 });
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('Error saving template:', err);
          this.ngZone.run(() => {
            this.savingTemplate = false;
            this.snackBar.open('Errore nel salvataggio template', 'OK', { duration: 3000 });
            this.cdr.markForCheck();
          });
        },
      });
  }

  private runTest(type: 'direct' | 'recap' | 'full', obs: import('rxjs').Observable<WhatsappTestResult>): void {
    this.testRunning = type;
    this.lastTestResult = null;
    this.cdr.markForCheck();

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.ngZone.run(() => {
          this.lastTestResult = result;
          this.testRunning = null;
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.lastTestResult = { success: false, message: err?.message || 'Errore durante il test' };
          this.testRunning = null;
          this.cdr.markForCheck();
        });
      },
    });
  }

  private loadData(): void {
    forkJoin({
      config: this.whatsappService.getConfig(),
      templates: this.whatsappService.getTemplates(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ config, templates }) => {
          this.ngZone.run(() => {
            this.config = config;
            this.templates = templates;
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('Error loading WhatsApp settings:', err);
        },
      });
  }
}
