/**
 * Patient Documents Tab — Layer 1: Dumb Component
 *
 * Elenco documenti della SCHEDA PAZIENTE (tutti i livelli: generali,
 * di percorso, di trattamento) con:
 *  - filtro scope: Tutti / Generali / Percorso (con select) / Trattamento
 *  - filtro categoria clinica + tipo contenuto + ricerca testuale
 *  - chip di contesto su ogni riga (Generale / nome percorso / trattamento)
 *  - raggruppamento per categoria, icone per tipo contenuto
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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  PatientDocument,
  PatientDocumentCategory,
  PatientDocumentKind,
  CATEGORY_LABELS,
  KIND_LABELS,
  categoryIcon,
  kindIcon,
  documentScope,
  formatFileSize,
} from '../../models/patient-document.model';

export interface PathOption {
  id: string;
  name: string;
}

export interface TreatmentOption {
  id: string;
  label: string;
  therapeuticPathId: string;
}

type ScopeFilter = 'all' | 'general' | 'path' | 'treatment';

@Component({
  selector: 'app-patient-documents-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="documents-tab">
      <!-- Header con upload -->
      <div class="documents-header">
        <span class="count">{{ filteredDocuments.length }} di {{ documents.length }} documenti</span>
        <button mat-flat-button color="primary" (click)="upload.emit()">
          <mat-icon>upload</mat-icon>
          Carica Documenti
        </button>
      </div>

      <!-- Barra filtri -->
      <div class="filters-bar">
        <mat-button-toggle-group
          class="scope-toggle"
          [value]="scopeFilter"
          (change)="onScopeChange($event.value)"
          hideSingleSelectionIndicator>
          <mat-button-toggle value="all">
            Tutti
          </mat-button-toggle>
          <mat-button-toggle value="general">
            Generali
            @if (generalCount > 0) { <span class="toggle-badge">{{ generalCount }}</span> }
          </mat-button-toggle>
          <mat-button-toggle value="path">
            Percorso
            @if (pathScopedCount > 0) { <span class="toggle-badge">{{ pathScopedCount }}</span> }
          </mat-button-toggle>
          <mat-button-toggle value="treatment">
            Trattamento
            @if (treatmentScopedCount > 0) { <span class="toggle-badge">{{ treatmentScopedCount }}</span> }
          </mat-button-toggle>
        </mat-button-toggle-group>

        @if (scopeFilter === 'path' || scopeFilter === 'treatment') {
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Percorso</mat-label>
            <mat-select [(ngModel)]="selectedPathId">
              <mat-option value="">Tutti i percorsi</mat-option>
              @for (p of paths; track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        @if (scopeFilter === 'treatment' && treatmentOptionsForPath.length > 0) {
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Trattamento</mat-label>
            <mat-select [(ngModel)]="selectedTreatmentId">
              <mat-option value="">Tutti i trattamenti</mat-option>
              @for (t of treatmentOptionsForPath; track t.id) {
                <mat-option [value]="t.id">{{ t.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Categoria</mat-label>
          <mat-select [(ngModel)]="categoryFilter">
            <mat-option value="">Tutte</mat-option>
            @for (c of categoryOptions; track c.value) {
              <mat-option [value]="c.value">{{ c.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Tipo</mat-label>
          <mat-select [(ngModel)]="kindFilter">
            <mat-option value="">Tutti</mat-option>
            @for (k of kindOptions; track k.value) {
              <mat-option [value]="k.value">{{ k.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field search-field">
          <mat-label>Cerca</mat-label>
          <input matInput [(ngModel)]="searchTerm" placeholder="Nome file, note..." />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
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
          <span>Carica referti, radiografie e altri documenti della scheda paziente</span>
        </div>
      } @else if (filteredDocuments.length === 0) {
        <div class="empty-state">
          <mat-icon>filter_alt_off</mat-icon>
          <p>Nessun documento corrisponde ai filtri</p>
        </div>
      } @else {
        <div class="documents-content">
          @for (group of groupedDocuments; track group.category) {
            <div class="category-group">
              <h4 class="category-title">
                <mat-icon>{{ getCategoryIcon(group.category) }}</mat-icon>
                {{ getCategoryLabel(group.category) }}
                <span class="category-count">{{ group.documents.length }}</span>
              </h4>

              <div class="documents-list">
                @for (doc of group.documents; track doc.id) {
                  <div class="document-item" (click)="open.emit(doc)">
                    <div class="document-icon" [class]="'kind-' + doc.contentKind">
                      <mat-icon>{{ getKindIcon(doc.contentKind) }}</mat-icon>
                    </div>

                    <div class="document-info">
                      <span class="document-name">{{ doc.originalFileName }}</span>
                      <div class="document-meta">
                        <span class="scope-chip" [class]="'scope-' + getScope(doc)"
                              [matTooltip]="getScopeTooltip(doc)">
                          {{ getScopeLabel(doc) }}
                        </span>
                        <span class="size">{{ getFileSize(doc.fileSize) }}</span>
                        <span class="date">{{ formatDate(doc.uploadedAt) }}</span>
                        @if (doc.notes) {
                          <mat-icon class="notes-icon" [matTooltip]="doc.notes">sticky_note_2</mat-icon>
                        }
                      </div>
                    </div>

                    <div class="document-actions">
                      <button mat-icon-button matTooltip="Scarica"
                              (click)="download.emit(doc); $event.stopPropagation()">
                        <mat-icon>download</mat-icon>
                      </button>
                      <button mat-icon-button matTooltip="Elimina (nel cestino)"
                              (click)="delete.emit(doc); $event.stopPropagation()">
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
      margin-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;

      .count {
        font-size: 0.875rem;
        color: #64748b;
      }
    }

    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;

      .scope-toggle {
        height: 40px;
        align-items: center;

        .toggle-badge {
          background: #e2e8f0;
          color: #475569;
          font-size: 0.6875rem;
          padding: 1px 6px;
          border-radius: 8px;
          margin-left: 6px;
        }
      }

      .filter-field {
        width: 170px;

        ::ng-deep .mat-mdc-form-field-subscript-wrapper {
          display: none;
        }
      }

      .search-field {
        flex: 1;
        min-width: 180px;
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

      &.kind-pdf { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
      &.kind-image { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
      &.kind-video { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
      &.kind-audio { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
      &.kind-spreadsheet { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
      &.kind-document { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
      &.kind-other { background: linear-gradient(135deg, #64748b 0%, #475569 100%); }
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
        align-items: center;
        gap: 12px;
        margin-top: 4px;
        font-size: 0.75rem;
        color: #94a3b8;

        .notes-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #cbd5e1;
        }
      }
    }

    .scope-chip {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;

      &.scope-general {
        background: #f1f5f9;
        color: #64748b;
      }

      &.scope-path {
        background: #e0e7ff;
        color: #4338ca;
      }

      &.scope-treatment {
        background: #dcfce7;
        color: #15803d;
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

      .filters-bar .filter-field {
        width: 100%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientDocumentsTabComponent {
  @Input() documents: PatientDocument[] = [];
  @Input() loading = false;
  @Input() paths: PathOption[] = [];
  @Input() treatments: TreatmentOption[] = [];
  @Input() currentPathId: string | null = null;

  @Output() upload = new EventEmitter<void>();
  @Output() open = new EventEmitter<PatientDocument>();
  @Output() download = new EventEmitter<PatientDocument>();
  @Output() delete = new EventEmitter<PatientDocument>();

  // Stato UI dei filtri (locale al dumb component)
  scopeFilter: ScopeFilter = 'all';
  selectedPathId = '';
  selectedTreatmentId = '';
  categoryFilter: PatientDocumentCategory | '' = '';
  kindFilter: PatientDocumentKind | '' = '';
  searchTerm = '';

  readonly categoryOptions = (Object.entries(CATEGORY_LABELS) as [PatientDocumentCategory, string][])
    .map(([value, label]) => ({ value, label }));

  readonly kindOptions = (Object.entries(KIND_LABELS) as [PatientDocumentKind, string][])
    .map(([value, label]) => ({ value, label }));

  onScopeChange(scope: ScopeFilter): void {
    this.scopeFilter = scope;
    if (scope !== 'path' && scope !== 'treatment') {
      this.selectedPathId = '';
    } else if (!this.selectedPathId && this.currentPathId) {
      // Default comodo: il percorso attualmente selezionato nella scheda
      this.selectedPathId = this.currentPathId;
    }
    this.selectedTreatmentId = '';
  }

  get treatmentOptionsForPath(): TreatmentOption[] {
    if (!this.selectedPathId) return this.treatments;
    return this.treatments.filter((t) => t.therapeuticPathId === this.selectedPathId);
  }

  get generalCount(): number {
    return this.documents.filter((d) => documentScope(d) === 'general').length;
  }

  get pathScopedCount(): number {
    return this.documents.filter((d) => documentScope(d) === 'path').length;
  }

  get treatmentScopedCount(): number {
    return this.documents.filter((d) => documentScope(d) === 'treatment').length;
  }

  get filteredDocuments(): PatientDocument[] {
    return this.documents.filter((doc) => {
      const scope = documentScope(doc);

      if (this.scopeFilter === 'general' && scope !== 'general') return false;
      if (this.scopeFilter === 'path') {
        // Vista percorso: include anche i documenti dei trattamenti del percorso
        if (!doc.therapeuticPathId) return false;
        if (this.selectedPathId && doc.therapeuticPathId !== this.selectedPathId) return false;
      }
      if (this.scopeFilter === 'treatment') {
        if (scope !== 'treatment') return false;
        if (this.selectedPathId && doc.therapeuticPathId !== this.selectedPathId) return false;
        if (this.selectedTreatmentId && doc.treatmentId !== this.selectedTreatmentId) return false;
      }

      if (this.categoryFilter && doc.category !== this.categoryFilter) return false;
      if (this.kindFilter && doc.contentKind !== this.kindFilter) return false;

      const search = this.searchTerm.trim().toLowerCase();
      if (search) {
        const haystack = [doc.originalFileName, doc.notes, doc.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }

  get groupedDocuments(): { category: PatientDocumentCategory; documents: PatientDocument[] }[] {
    const groups = new Map<PatientDocumentCategory, PatientDocument[]>();
    for (const doc of this.filteredDocuments) {
      const category = doc.category || 'other';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(doc);
    }
    return Array.from(groups.entries())
      .map(([category, documents]) => ({ category, documents }))
      .sort((a, b) => this.getCategoryLabel(a.category).localeCompare(this.getCategoryLabel(b.category)));
  }

  getScope(doc: PatientDocument): string {
    return documentScope(doc);
  }

  getScopeLabel(doc: PatientDocument): string {
    const scope = documentScope(doc);
    if (scope === 'general') return 'Generale';
    if (scope === 'treatment') {
      const treatment = this.treatments.find((t) => t.id === doc.treatmentId);
      return treatment ? treatment.label : 'Trattamento';
    }
    const path = this.paths.find((p) => p.id === doc.therapeuticPathId);
    return path ? path.name : 'Percorso';
  }

  getScopeTooltip(doc: PatientDocument): string {
    const scope = documentScope(doc);
    if (scope === 'general') return 'Documento generale della scheda paziente';
    const path = this.paths.find((p) => p.id === doc.therapeuticPathId);
    const pathName = path ? path.name : 'percorso';
    if (scope === 'treatment') return `Trattamento del percorso "${pathName}"`;
    return `Percorso "${pathName}"`;
  }

  getCategoryLabel(category: PatientDocumentCategory): string {
    return CATEGORY_LABELS[category] || 'Altro';
  }

  getCategoryIcon(category: PatientDocumentCategory): string {
    return categoryIcon(category);
  }

  getKindIcon(kind: PatientDocumentKind): string {
    return kindIcon(kind);
  }

  getFileSize(bytes: string): string {
    return formatFileSize(bytes);
  }

  formatDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
