/**
 * Patient Document Upload Dialog — Layer 1: Dumb Component
 *
 * Dialog di upload multi-file per la scheda paziente:
 *  - drop-zone drag & drop + file picker
 *  - associazione opzionale a cascata: percorso → trattamento
 *    (tutti i file del batch condividono l'associazione; per associazioni
 *    diverse si fanno upload separati)
 *  - categoria clinica per singolo file (default modificabile)
 *  - progress bar e retry per singolo file
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
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  PatientDocumentCategory,
  UploadFileItem,
  CATEGORY_LABELS,
  formatFileSize,
} from '../../models/patient-document.model';
import { PathOption, TreatmentOption } from '../patient-documents-tab/patient-documents-tab.component';

export interface StartUploadRequest {
  therapeuticPathId?: string;
  treatmentId?: string;
  notes?: string;
}

@Component({
  selector: 'app-patient-document-upload-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="dialog-backdrop" (click)="onBackdropClick()">
      <div class="dialog-panel" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h2>
            <mat-icon>upload_file</mat-icon>
            Carica documenti
          </h2>
          <button mat-icon-button (click)="closed.emit()" [disabled]="uploading">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="dialog-body">
          <!-- Associazione (condivisa dal batch) -->
          <div class="association-row">
            <mat-form-field appearance="outline">
              <mat-label>Percorso terapeutico (opzionale)</mat-label>
              <mat-select [(ngModel)]="selectedPathId" (selectionChange)="onPathChange()"
                          [disabled]="uploading">
                <mat-option value="">Nessuno — documento generale</mat-option>
                @for (p of paths; track p.id) {
                  <mat-option [value]="p.id">{{ p.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Trattamento (opzionale)</mat-label>
              <mat-select [(ngModel)]="selectedTreatmentId"
                          [disabled]="uploading || !selectedPathId || treatmentOptions.length === 0">
                <mat-option value="">Nessuno — tutto il percorso</mat-option>
                @for (t of treatmentOptions; track t.id) {
                  <mat-option [value]="t.id">{{ t.label }}</mat-option>
                }
              </mat-select>
              @if (selectedPathId && treatmentOptions.length === 0) {
                <mat-hint>Nessun trattamento nel percorso</mat-hint>
              }
            </mat-form-field>
          </div>

          <div class="association-row">
            <mat-form-field appearance="outline" class="default-category">
              <mat-label>Categoria predefinita</mat-label>
              <mat-select [(ngModel)]="defaultCategory" (selectionChange)="onDefaultCategoryChange()"
                          [disabled]="uploading">
                @for (c of categoryOptions; track c.value) {
                  <mat-option [value]="c.value">{{ c.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="notes-field">
              <mat-label>Note (opzionali, per tutti i file)</mat-label>
              <input matInput [(ngModel)]="notes" [disabled]="uploading" maxlength="2000" />
            </mat-form-field>
          </div>

          <!-- Drop zone -->
          <div
            class="drop-zone"
            [class.drag-over]="dragOver"
            [class.disabled]="uploading"
            (dragover)="onDragOver($event)"
            (dragleave)="dragOver = false"
            (drop)="onDrop($event)"
            (click)="!uploading && fileInput.click()">
            <mat-icon>cloud_upload</mat-icon>
            <p>Trascina qui i file oppure <span class="link">sfoglia</span></p>
            <span class="hint">Più file consentiti — max {{ maxFileMb }}MB per file</span>
            <input #fileInput type="file" multiple hidden (change)="onFilesPicked($event)" />
          </div>

          <!-- Lista file -->
          @if (items.length > 0) {
            <div class="files-list">
              @for (item of items; track $index) {
                <div class="file-row" [class.error]="item.status === 'error'">
                  <mat-icon class="file-icon">
                    @switch (item.status) {
                      @case ('done') { check_circle }
                      @case ('error') { error }
                      @case ('uploading') { hourglass_top }
                      @default { insert_drive_file }
                    }
                  </mat-icon>

                  <div class="file-info">
                    <span class="file-name">{{ item.file.name }}</span>
                    <span class="file-size">{{ getFileSize(item.file.size) }}</span>
                    @if (item.status === 'uploading') {
                      <mat-progress-bar
                        [mode]="item.progress >= 0 ? 'determinate' : 'indeterminate'"
                        [value]="item.progress">
                      </mat-progress-bar>
                    }
                    @if (item.status === 'error') {
                      <span class="file-error">{{ item.error || 'Errore di caricamento' }}</span>
                    }
                  </div>

                  <mat-form-field appearance="outline" class="file-category">
                    <mat-select
                      [ngModel]="item.category"
                      (ngModelChange)="itemCategoryChange.emit({ index: $index, category: $event })"
                      [disabled]="item.status === 'uploading' || item.status === 'done'">
                      @for (c of categoryOptions; track c.value) {
                        <mat-option [value]="c.value">{{ c.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <div class="file-actions">
                    @if (item.status === 'error') {
                      <button mat-icon-button matTooltip="Riprova"
                              (click)="retryItem.emit($index)">
                        <mat-icon>refresh</mat-icon>
                      </button>
                    }
                    @if (item.status === 'pending' || item.status === 'error') {
                      <button mat-icon-button matTooltip="Rimuovi"
                              (click)="removeItem.emit($index)">
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <div class="dialog-footer">
          <span class="summary">
            @if (doneCount > 0) { {{ doneCount }} caricati }
            @if (errorCount > 0) { · {{ errorCount }} falliti }
          </span>
          <div class="footer-actions">
            <button mat-button (click)="closed.emit()" [disabled]="uploading">
              {{ doneCount > 0 ? 'Chiudi' : 'Annulla' }}
            </button>
            <button mat-flat-button color="primary"
                    (click)="onStart()"
                    [disabled]="uploading || pendingCount === 0">
              <mat-icon>upload</mat-icon>
              Carica {{ pendingCount > 0 ? pendingCount : '' }} file
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .dialog-panel {
      background: white;
      border-radius: 16px;
      width: min(720px, calc(100vw - 32px));
      max-height: calc(100vh - 64px);
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;

      h2 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
        font-size: 1.125rem;
        color: #1e293b;

        mat-icon {
          color: #667eea;
        }
      }
    }

    .dialog-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    .association-row {
      display: flex;
      gap: 12px;

      mat-form-field {
        flex: 1;
      }

      .notes-field {
        flex: 2;
      }
    }

    .drop-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
      color: #64748b;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: #94a3b8;
        margin-bottom: 8px;
      }

      p {
        margin: 0 0 4px;
        font-weight: 500;

        .link {
          color: #667eea;
          text-decoration: underline;
        }
      }

      .hint {
        font-size: 0.75rem;
        color: #94a3b8;
      }

      &:hover:not(.disabled), &.drag-over {
        border-color: #667eea;
        background: #eef2ff;
      }

      &.disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
    }

    .files-list {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .file-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      background: #f8fafc;
      border-radius: 10px;

      &.error {
        background: #fef2f2;
      }

      .file-icon {
        color: #94a3b8;
        flex-shrink: 0;
      }

      .file-info {
        flex: 1;
        min-width: 0;

        .file-name {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-size {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .file-error {
          display: block;
          font-size: 0.75rem;
          color: #dc2626;
        }

        mat-progress-bar {
          margin-top: 6px;
        }
      }

      .file-category {
        width: 160px;

        ::ng-deep .mat-mdc-form-field-subscript-wrapper {
          display: none;
        }
      }

      .file-actions {
        display: flex;
        flex-shrink: 0;
      }
    }

    .dialog-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;

      .summary {
        font-size: 0.8125rem;
        color: #64748b;
      }

      .footer-actions {
        display: flex;
        gap: 8px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientDocumentUploadDialogComponent {
  @Input() paths: PathOption[] = [];
  @Input() treatments: TreatmentOption[] = [];
  @Input() items: UploadFileItem[] = [];
  @Input() uploading = false;
  @Input() maxFileMb = 500;

  /** Percorso preselezionato (es. il percorso aperto nella scheda). */
  @Input() set defaultPathId(value: string | null | undefined) {
    if (value && !this.pathTouched) {
      this.selectedPathId = value;
    }
  }

  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() removeItem = new EventEmitter<number>();
  @Output() retryItem = new EventEmitter<number>();
  @Output() itemCategoryChange = new EventEmitter<{
    index: number;
    category: PatientDocumentCategory;
  }>();
  @Output() startUpload = new EventEmitter<StartUploadRequest>();
  @Output() defaultCategoryChange = new EventEmitter<PatientDocumentCategory>();
  @Output() closed = new EventEmitter<void>();

  // Stato UI locale
  selectedPathId = '';
  selectedTreatmentId = '';
  defaultCategory: PatientDocumentCategory = 'other';
  notes = '';
  dragOver = false;
  private pathTouched = false;

  readonly categoryOptions = (Object.entries(CATEGORY_LABELS) as [PatientDocumentCategory, string][])
    .map(([value, label]) => ({ value, label }));

  get treatmentOptions(): TreatmentOption[] {
    if (!this.selectedPathId) return [];
    return this.treatments.filter((t) => t.therapeuticPathId === this.selectedPathId);
  }

  get pendingCount(): number {
    return this.items.filter((i) => i.status === 'pending').length;
  }

  get doneCount(): number {
    return this.items.filter((i) => i.status === 'done').length;
  }

  get errorCount(): number {
    return this.items.filter((i) => i.status === 'error').length;
  }

  onPathChange(): void {
    this.pathTouched = true;
    // Cambiando percorso il trattamento selezionato non è più valido
    this.selectedTreatmentId = '';
  }

  onDefaultCategoryChange(): void {
    this.defaultCategoryChange.emit(this.defaultCategory);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.uploading) this.dragOver = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    if (this.uploading) return;
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length > 0) this.filesSelected.emit(files);
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length > 0) this.filesSelected.emit(files);
    input.value = '';
  }

  onStart(): void {
    this.startUpload.emit({
      therapeuticPathId: this.selectedPathId || undefined,
      treatmentId: this.selectedTreatmentId || undefined,
      notes: this.notes.trim() || undefined,
    });
  }

  onBackdropClick(): void {
    if (!this.uploading) this.closed.emit();
  }

  getFileSize(bytes: number): string {
    return formatFileSize(bytes);
  }
}
