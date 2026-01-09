/**
 * Documents Tab Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare lista documenti del percorso
 * - Raggruppare per categoria
 * - Gestire upload e apertura
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { PathDocument, formatFileSize, getDocumentTypeIcon } from '../../../../models/therapeutic-path.model';

@Component({
  selector: 'app-documents-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="documents-tab">
      <!-- Header con upload -->
      <div class="documents-header">
        <span class="count">{{ documents.length }} documenti</span>
        <button mat-flat-button color="primary" (click)="onUpload()">
          <mat-icon>upload</mat-icon>
          Carica Documento
        </button>
      </div>

      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Caricamento documenti...</span>
        </div>
      } @else if (documents.length === 0) {
        <div class="empty-state">
          <mat-icon>folder_open</mat-icon>
          <p>Nessun documento caricato</p>
          <span>Carica referti, radiografie e altri documenti</span>
        </div>
      } @else {
        <div class="documents-content">
          @for (group of groupedDocuments; track group.category) {
            <div class="category-group">
              <h4 class="category-title">
                <mat-icon>{{ getCategoryIcon(group.category) }}</mat-icon>
                {{ group.category }}
                <span class="category-count">{{ group.documents.length }}</span>
              </h4>

              <div class="documents-list">
                @for (doc of group.documents; track doc.id) {
                  <div class="document-item" (click)="onDocumentOpen(doc)">
                    <div class="document-icon" [class]="'type-' + doc.type">
                      <mat-icon>{{ getDocIcon(doc.type) }}</mat-icon>
                    </div>

                    <div class="document-info">
                      <span class="document-name">{{ doc.name }}</span>
                      <div class="document-meta">
                        <span class="size">{{ getFileSize(doc.sizeBytes) }}</span>
                        <span class="date">{{ formatDate(doc.uploadedAt) }}</span>
                      </div>
                    </div>

                    <div class="document-actions">
                      <button mat-icon-button matTooltip="Scarica" (click)="onDownload(doc); $event.stopPropagation()">
                        <mat-icon>download</mat-icon>
                      </button>
                      <button mat-icon-button matTooltip="Elimina" (click)="onDelete(doc); $event.stopPropagation()">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .documents-tab {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .documents-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      margin-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;

      .count {
        font-size: 0.875rem;
        color: #64748b;
      }
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: #64748b;
      flex: 1;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #cbd5e1;
        margin-bottom: 16px;
      }

      p {
        margin: 0 0 4px;
        font-weight: 500;
      }

      span {
        font-size: 0.8125rem;
        color: #94a3b8;
      }
    }

    .documents-content {
      flex: 1;
      overflow-y: auto;
    }

    .category-group {
      margin-bottom: 24px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .category-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #667eea;
      }

      .category-count {
        background: #e2e8f0;
        color: #64748b;
        font-size: 0.6875rem;
        padding: 2px 6px;
        border-radius: 8px;
      }
    }

    .documents-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .document-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #f1f5f9;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

        .document-actions {
          opacity: 1;
        }
      }
    }

    .document-icon {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
        color: white;
      }

      &.type-pdf {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      }

      &.type-image {
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      }

      &.type-video {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      }

      &.type-other {
        background: linear-gradient(135deg, #64748b 0%, #475569 100%);
      }
    }

    .document-info {
      flex: 1;
      min-width: 0;

      .document-name {
        display: block;
        font-size: 0.9375rem;
        font-weight: 500;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .document-meta {
        display: flex;
        gap: 12px;
        margin-top: 4px;
        font-size: 0.75rem;
        color: #94a3b8;
      }
    }

    .document-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;

      button {
        color: #64748b;

        &:hover {
          color: #334155;
        }
      }
    }

    /* Responsive */
    @media (max-width: 599px) {
      .document-actions {
        opacity: 1;
      }

      .document-item {
        flex-wrap: wrap;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentsTabComponent {
  @Input() documents: PathDocument[] = [];
  @Input() loading = false;

  @Output() documentOpen = new EventEmitter<PathDocument>();
  @Output() documentUpload = new EventEmitter<void>();
  @Output() documentDownload = new EventEmitter<PathDocument>();
  @Output() documentDelete = new EventEmitter<PathDocument>();

  get groupedDocuments(): { category: string; documents: PathDocument[] }[] {
    const groups = new Map<string, PathDocument[]>();

    this.documents.forEach(doc => {
      const category = doc.category || 'Altro';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(doc);
    });

    return Array.from(groups.entries())
      .map(([category, documents]) => ({ category, documents }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }

  onDocumentOpen(doc: PathDocument): void {
    this.documentOpen.emit(doc);
  }

  onUpload(): void {
    this.documentUpload.emit();
  }

  onDownload(doc: PathDocument): void {
    this.documentDownload.emit(doc);
  }

  onDelete(doc: PathDocument): void {
    this.documentDelete.emit(doc);
  }

  getDocIcon(type: string): string {
    const icons: Record<string, string> = {
      pdf: 'picture_as_pdf',
      image: 'image',
      video: 'videocam',
      other: 'insert_drive_file'
    };
    return icons[type] || 'insert_drive_file';
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Radiografie': 'radio_button_checked',
      'Referti': 'description',
      'Consensi': 'verified_user',
      'Esami': 'science',
      'Altro': 'folder'
    };
    return icons[category] || 'folder';
  }

  getFileSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
}
