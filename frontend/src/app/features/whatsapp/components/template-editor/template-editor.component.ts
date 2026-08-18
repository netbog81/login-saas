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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  WhatsappTemplate,
  WhatsappTemplateInput,
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
    MatProgressSpinnerModule,
  ],
  template: `
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

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Testo del messaggio</mat-label>
              <textarea matInput
                        [(ngModel)]="editingBodies[type]"
                        rows="5"
                        placeholder="Scrivi il testo del messaggio...">
              </textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Footer (opzionale)</mat-label>
              <input matInput [(ngModel)]="editingFooters[type]"
                     placeholder="Footer del messaggio" />
            </mat-form-field>

            <div class="template-actions">
              <mat-slide-toggle [(ngModel)]="editingActive[type]" color="primary">
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

            @if (editingBodies[type]) {
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

  templateTypes: WhatsappTemplateType[] = ['RECAP_SINGLE', 'RECAP_MULTI', 'REMINDER_24H', 'REMINDER_48H', 'CANCELLATION', 'UPDATE'];
  editingBodies: Record<string, string> = {};
  editingFooters: Record<string, string> = {};
  editingActive: Record<string, boolean> = {};
  savingType: WhatsappTemplateType | null = null;

  private previewVariables: Record<string, string> = {
    '{name}': 'Mario Rossi',
    '{date}': '15/03/2026',
    '{time}': '10:30',
    '{appointments}': '- 15/03 ore 10:30\n- 16/03 ore 14:00',
  };

  ngOnChanges(): void {
    if (this.templates?.length) {
      for (const t of this.templates) {
        this.editingBodies[t.templateType] = t.bodyTemplate;
        this.editingFooters[t.templateType] = t.footerTemplate || '';
        this.editingActive[t.templateType] = t.isActive;
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
    let text = this.editingBodies[type] || '';
    for (const [key, value] of Object.entries(this.previewVariables)) {
      text = text.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    return text;
  }

  onSave(type: WhatsappTemplateType): void {
    this.savingType = type;
    this.saveTemplate.emit({
      templateType: type,
      bodyTemplate: this.editingBodies[type] || '',
      footerTemplate: this.editingFooters[type] || undefined,
      isActive: this.editingActive[type] ?? true,
    });
  }

  onTabChange(index: number): void {
    // Track active tab if needed
  }
}
