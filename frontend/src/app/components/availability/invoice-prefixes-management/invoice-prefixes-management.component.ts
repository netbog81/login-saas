import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { forkJoin } from 'rxjs';
import {
  ServiceInvoicePrefixService,
  ServiceInvoicePrefix,
  OperatorCategoryInvoiceConfig,
} from '../../../services/service-invoice-prefix.service';
import { ServiceService } from '../../../services/service.service';
import { OperatorService } from '../../../services/operator.service';

interface PrefixRow {
  macroCategory: string;
  label: string;
  savedPrefix: string;
  editingPrefix: string;
  savedTemplate: string;
  editingTemplate: string;
  saving: boolean;
}

/** Riga di config per singola categoria operatore (toggle sottocategorie). */
interface CategoryPrefixRow {
  categoryId: string;
  macroCategory: string;
  label: string;
  macroLabel: string;
  invoiceLineDescription: string;
  savedPrefix: string;
  editingPrefix: string;
  savedTemplate: string;
  editingTemplate: string;
  saving: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  doctor: 'Medici',
  physiotherapist: 'Fisioterapisti',
  gym_instructor: 'Istruttori Palestra',
  other: 'Altro',
};

const CATEGORY_ORDER = ['doctor', 'physiotherapist', 'gym_instructor', 'other'];

/** Segnaposto disponibili nel template (devono combaciare col backend). */
const PLACEHOLDERS: { token: string; label: string }[] = [
  { token: '{prefisso}', label: 'Prefisso' },
  { token: '{data}', label: 'Data' },
  { token: '{codice_servizio}', label: 'Codice servizio' },
  { token: '{nome_servizio}', label: 'Nome servizio' },
  { token: '{descrizione_servizio}', label: 'Descrizione servizio' },
  { token: '{descrizione_fattura_sottocategoria}', label: 'Descr. fattura sottocategoria' },
  { token: '{operatore}', label: 'Operatore' },
  { token: '{albo}', label: 'Albo' },
  { token: '{descrizione_fattura_categoria}', label: 'Descr. fattura categoria operatore' },
  { token: '{strumenti}', label: 'Strumenti' },
];

/** Valori d'esempio per l'anteprima (solo UI). */
const SAMPLE_VALUES: Record<string, string> = {
  data: '03/07/2026',
  codice_servizio: 'ser003',
  nome_servizio: 'FISIO',
  descrizione_servizio: 'Trattamento fisioterapico',
  descrizione_fattura_sottocategoria: 'Riabilitazione motoria',
  operatore: 'Mario Rossi',
  albo: 'Albo FT n. 12345',
  descrizione_fattura_categoria: 'Seduta fisioterapica',
  strumenti: 'Tecar',
};

/**
 * Sezione impostazioni "Descrizione righe servizi".
 *
 * Per ogni macro-categoria (servizi ↔ operatori, stesso enum) si configura:
 *  - il prefisso (usato dalla composizione legacy e dal segnaposto {prefisso});
 *  - il template componibile della descrizione riga fattura, con segnaposto
 *    cliccabili e anteprima live. Template vuoto → composizione legacy
 *    "{prefisso} {data} — {servizio} — {operatore}, {albo}".
 *
 * "Copia su tutte" propaga il TEMPLATE della riga alle altre categorie e
 * salva: i segnaposto si adattano da soli ai dati di ogni categoria.
 */
@Component({
  selector: 'app-invoice-prefixes-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  template: `
    <section class="prefixes-section">
      <header class="header">
        <h2>Descrizione righe servizi</h2>
        <p class="hint">
          Componi la descrizione delle righe fattura per ogni macro-categoria:
          clicca i campi disponibili per inserirli nel template. Se il template
          è vuoto viene usata la composizione standard
          <code>"Prefisso data — Servizio — Operatore, Albo"</code>.
        </p>
        <div class="subcat-toggle">
          <mat-slide-toggle
            [checked]="useOperatorCategories"
            [disabled]="savingToggle || loading"
            (change)="onToggleChange($event.checked)">
            Abilita sottocategorie operatori
          </mat-slide-toggle>
          <span class="hint toggle-hint">
            Attivo: la descrizione si compone col prefisso/template della
            categoria dell'operatore che esegue il trattamento (es.
            Massofisioterapisti vs Fisioterapisti). Le macro-categorie
            restano come fallback per le categorie non configurate.
          </span>
        </div>
      </header>

      @if (loading) {
        <div class="loading">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Caricamento…</span>
        </div>
      } @else {
        @if (useOperatorCategories) {
          <h3 class="section-title">Macro-categorie (fallback)</h3>
        }
        <div class="rows">
          @for (row of rows; track row.macroCategory) {
            <div class="row-card">
              <div class="row-head">
                <span class="cat-label">{{ row.label }}</span>
                <span class="row-actions">
                  <button mat-stroked-button
                          matTooltip="Copia questo template su tutte le categorie e salva"
                          [disabled]="row.saving || !row.editingTemplate.trim()"
                          (click)="copyToAll(row)">
                    <mat-icon>content_copy</mat-icon>
                    Copia su tutte
                  </button>
                  <button mat-flat-button color="primary"
                          [disabled]="row.saving || !isDirty(row)"
                          (click)="save(row)">
                    <mat-icon>save</mat-icon>
                    Salva
                  </button>
                </span>
              </div>

              <mat-form-field appearance="outline" class="prefix-input">
                <mat-label>Prefisso ({{ '{' }}prefisso{{ '}' }})</mat-label>
                <input matInput
                       [(ngModel)]="row.editingPrefix"
                       maxlength="500"
                       [disabled]="row.saving" />
              </mat-form-field>

              <div class="placeholder-chips">
                @for (ph of placeholders; track ph.token) {
                  <button type="button" class="chip"
                          [matTooltip]="ph.token"
                          (click)="insertPlaceholder(row, ph.token)">
                    {{ ph.label }}
                  </button>
                }
              </div>

              <mat-form-field appearance="outline" class="template-input">
                <mat-label>Template descrizione riga fattura</mat-label>
                <textarea matInput rows="2"
                          [(ngModel)]="row.editingTemplate"
                          maxlength="1000"
                          [disabled]="row.saving"
                          [attr.data-template-cat]="row.macroCategory"
                          placeholder="es: {{ '{' }}prefisso{{ '}' }} {{ '{' }}data{{ '}' }} — {{ '{' }}nome_servizio{{ '}' }} — {{ '{' }}operatore{{ '}' }}"></textarea>
              </mat-form-field>

              <div class="preview">
                <mat-icon class="preview-icon">visibility</mat-icon>
                <span class="preview-text">{{ buildPreview(row) }}</span>
              </div>
            </div>
          }
        </div>

        <!-- Config per categoria operatore (visibile solo con toggle attivo):
             stesso meccanismo prefisso+template delle macro-categorie. -->
        @if (useOperatorCategories) {
          <h3 class="section-title">Sottocategorie operatori</h3>
          @if (catRows.length === 0) {
            <p class="hint">
              Nessuna categoria operatore attiva: creale nella scheda
              "Categorie Operatori" per configurare qui prefisso e template.
            </p>
          }
          <div class="rows cat-rows">
            @for (row of catRows; track row.categoryId) {
              <div class="row-card">
                <div class="row-head">
                  <span class="cat-label">
                    {{ row.label }}
                    <span class="macro-chip">{{ row.macroLabel }}</span>
                  </span>
                  <span class="row-actions">
                    <button mat-flat-button color="primary"
                            [disabled]="row.saving || !isCatDirty(row)"
                            (click)="saveCat(row)">
                      <mat-icon>save</mat-icon>
                      Salva
                    </button>
                  </span>
                </div>

                <mat-form-field appearance="outline" class="prefix-input">
                  <mat-label>Prefisso ({{ '{' }}prefisso{{ '}' }}) — vuoto: eredita dalla macro-categoria</mat-label>
                  <input matInput
                         [(ngModel)]="row.editingPrefix"
                         maxlength="500"
                         [disabled]="row.saving" />
                </mat-form-field>

                <div class="placeholder-chips">
                  @for (ph of placeholders; track ph.token) {
                    <button type="button" class="chip"
                            [matTooltip]="ph.token"
                            (click)="insertCatPlaceholder(row, ph.token)">
                      {{ ph.label }}
                    </button>
                  }
                </div>

                <mat-form-field appearance="outline" class="template-input">
                  <mat-label>Template descrizione riga fattura</mat-label>
                  <textarea matInput rows="2"
                            [(ngModel)]="row.editingTemplate"
                            maxlength="1000"
                            [disabled]="row.saving"
                            [attr.data-template-cat]="'cat-' + row.categoryId"
                            placeholder="es: {{ '{' }}prefisso{{ '}' }} {{ '{' }}data{{ '}' }} — {{ '{' }}nome_servizio{{ '}' }} — {{ '{' }}operatore{{ '}' }}"></textarea>
                </mat-form-field>

                <div class="preview">
                  <mat-icon class="preview-icon">visibility</mat-icon>
                  <span class="preview-text">{{ buildCatPreview(row) }}</span>
                </div>
              </div>
            }
          </div>
        }

        <!-- Anteprima su dati REALI: scegli servizio (e operatore) e vedi la
             riga fattura come verrebbe generata col template corrente. -->
        <div class="real-preview-card">
          <h3>
            <mat-icon>preview</mat-icon>
            Prova con un servizio reale
          </h3>
          <p class="hint">
            Seleziona un servizio (e un operatore) del tuo catalogo per vedere
            come verrebbe la riga fattura con il template della sua categoria
            (usa il testo che stai modificando sopra, anche se non ancora salvato).
          </p>
          <div class="real-preview-controls">
            <mat-form-field appearance="outline" class="sel">
              <mat-label>Servizio</mat-label>
              <mat-select [(ngModel)]="selectedServiceId" (selectionChange)="onPreviewServiceChange()">
                @for (s of services; track s.id) {
                  <mat-option [value]="s.id">{{ s.serviceCode ? s.serviceCode + ' — ' : '' }}{{ s.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="sel">
              <mat-label>Operatore</mat-label>
              <mat-select [(ngModel)]="selectedOperatorId">
                @for (o of previewOperators; track o.id) {
                  <mat-option [value]="o.id">{{ o.name }} {{ o.surname || '' }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
          @if (selectedServiceId) {
            <div class="preview real-preview">
              <mat-icon class="preview-icon">receipt_long</mat-icon>
              <span class="preview-text">{{ buildRealPreview() }}</span>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    /* La tab-content della dashboard Configurazioni è a altezza fissa con
       overflow hidden: ogni scheda scrolla per conto suo (stesso pattern
       delle altre tab, es. .operators-container). */
    :host {
      display: block;
      height: 100%;
    }
    .prefixes-section {
      height: 100%;
      overflow-y: auto;
      box-sizing: border-box;
      padding: 16px;
      padding-bottom: 60px; /* aria in fondo, oltre l'ultima card */
      background: #fafafa;
      border-radius: 8px;
    }
    .header h2 { margin: 0 0 4px; font-size: 1.1rem; }
    .hint {
      margin: 0 0 16px;
      color: rgba(0,0,0,0.6);
      font-size: 0.85rem;
    }
    .hint code {
      background: rgba(0,0,0,0.06);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.8rem;
    }
    .loading {
      display: flex; align-items: center; gap: 8px;
      color: rgba(0,0,0,0.6);
    }
    .rows { display: flex; flex-direction: column; gap: 16px; }
    .subcat-toggle {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      margin: 4px 0 12px;
    }
    .toggle-hint { margin: 0; max-width: 640px; }
    .section-title {
      margin: 20px 0 8px;
      font-size: 0.95rem;
      font-weight: 600;
      color: #334155;
    }
    .cat-rows { margin-bottom: 4px; }
    .macro-chip {
      display: inline-block;
      margin-left: 8px;
      padding: 1px 8px;
      border-radius: 10px;
      background: #e0e7ff;
      color: #3730a3;
      font-size: 0.7rem;
      font-weight: 500;
      vertical-align: middle;
    }
    .row-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .row-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; flex-wrap: wrap; margin-bottom: 4px;
    }
    .cat-label { font-weight: 600; }
    .row-actions { display: flex; gap: 8px; }
    .prefix-input { max-width: 420px; }
    .template-input { width: 100%; }
    .placeholder-chips {
      display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;
    }
    .chip {
      border: 1px solid #cbd5e1;
      background: #f1f5f9;
      border-radius: 14px;
      padding: 3px 10px;
      font-size: 0.75rem;
      cursor: pointer;
      color: #334155;
    }
    .chip:hover { background: #e2e8f0; }
    .preview {
      display: flex; align-items: flex-start; gap: 8px;
      background: #f0f9ff;
      border: 1px dashed #7dd3fc;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 0.85rem;
      color: #0c4a6e;
    }
    .preview-icon { font-size: 18px; width: 18px; height: 18px; margin-top: 1px; }
    .real-preview-card {
      margin-top: 20px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
    }
    .real-preview-card h3 {
      display: flex; align-items: center; gap: 8px;
      margin: 0 0 4px; font-size: 1rem;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .real-preview-controls {
      display: flex; gap: 12px; flex-wrap: wrap;
    }
    .real-preview-controls .sel { min-width: 260px; }
    .real-preview {
      background: #f0fdf4;
      border-color: #86efac;
      color: #14532d;
    }
  `],
})
export class InvoicePrefixesManagementComponent implements OnInit {
  rows: PrefixRow[] = [];
  catRows: CategoryPrefixRow[] = [];
  loading = true;
  placeholders = PLACEHOLDERS;

  // Toggle "abilita sottocategorie operatori" (impostazione globale tenant)
  useOperatorCategories = false;
  savingToggle = false;

  // Anteprima su dati reali
  services: any[] = [];
  operators: any[] = [];
  selectedServiceId: string | null = null;
  selectedOperatorId: string | null = null;

  constructor(
    private service: ServiceInvoicePrefixService,
    private catalogService: ServiceService,
    private operatorService: OperatorService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.service.getAll().subscribe({
      next: (prefixes) => {
        this.rows = this.buildRows(prefixes);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Errore nel caricamento', 'OK', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });

    // Toggle globale + config per categoria operatore.
    this.service.getSettings().subscribe({
      next: (settings) => {
        this.useOperatorCategories = settings.useOperatorCategories;
        this.cdr.markForCheck();
      },
      error: () => { /* toggle resta off finché la migration non è applicata */ },
    });
    this.service.getOperatorCategoriesForConfig().subscribe({
      next: (categories) => {
        this.catRows = this.buildCatRows(categories || []);
        this.cdr.markForCheck();
      },
      error: () => { /* sezione categorie opzionale */ },
    });

    // Catalogo per l'anteprima reale (non blocca la sezione se fallisce).
    this.catalogService.getServicesOnce().subscribe({
      next: (services) => {
        this.services = (services || []).filter((s: any) => s.isActive);
        this.cdr.markForCheck();
      },
      error: () => { /* anteprima opzionale */ },
    });
    this.operatorService.getOperators(undefined, undefined, true).subscribe({
      next: (operators) => {
        this.operators = operators || [];
        this.cdr.markForCheck();
      },
      error: () => { /* anteprima opzionale */ },
    });
  }

  /** Operatori proposti nel select: prima quelli della categoria del servizio scelto. */
  get previewOperators(): any[] {
    const svc = this.services.find(s => s.id === this.selectedServiceId);
    if (!svc?.macroCategory) return this.operators;
    const matching = this.operators.filter(
      o => String(o.macroCategory).toLowerCase() === String(svc.macroCategory).toLowerCase(),
    );
    return matching.length > 0 ? matching : this.operators;
  }

  onPreviewServiceChange(): void {
    // Se l'operatore selezionato non è della categoria del servizio, riallinea.
    const candidates = this.previewOperators;
    if (!candidates.some(o => o.id === this.selectedOperatorId)) {
      this.selectedOperatorId = candidates[0]?.id ?? null;
    }
    this.cdr.markForCheck();
  }

  /** Anteprima con i dati REALI del servizio/operatore selezionati. */
  buildRealPreview(): string {
    const svc = this.services.find(s => s.id === this.selectedServiceId);
    if (!svc) return '';
    const op = this.operators.find(o => o.id === this.selectedOperatorId);
    const category = String(svc.macroCategory ?? op?.macroCategory ?? 'OTHER').toUpperCase();
    const macroRow = this.rows.find(r => r.macroCategory === category);

    // Toggle sottocategorie: config dalla categoria dell'operatore, con
    // fallback alla macro (stesse regole del backend resolveConfig).
    const catRow = this.useOperatorCategories && op?.category?.id
      ? this.catRows.find(c => c.categoryId === op.category.id)
      : undefined;
    const catConfigured = !!catRow && !!(catRow.editingPrefix.trim() || catRow.editingTemplate.trim());
    const row = catConfigured
      ? {
          editingPrefix: catRow!.editingPrefix.trim() || macroRow?.editingPrefix || '',
          editingTemplate: catRow!.editingTemplate,
        }
      : macroRow;

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');

    const values: Record<string, string> = {
      prefisso: row?.editingPrefix || 'Prestazione del',
      data: `${dd}/${mm}/${today.getFullYear()}`,
      codice_servizio: svc.serviceCode ?? '',
      nome_servizio: svc.name ?? '',
      descrizione_servizio: svc.description ?? '',
      descrizione_fattura_sottocategoria: svc.subcategory?.invoiceLineDescription ?? '',
      operatore: op ? [op.name, op.surname].filter(Boolean).join(' ') : '',
      albo: op?.professionalRegistration ?? '',
      descrizione_fattura_categoria: op?.category?.invoiceLineDescription ?? '',
      strumenti: '',
    };

    const template = row?.editingTemplate.trim() ?? '';
    if (!template) {
      const albo = values['albo'] ? `, ${values['albo']}` : '';
      const operatorePart = values['operatore'] ? ` — ${values['operatore']}${albo}` : '';
      return `${values['prefisso']} ${values['data']} — ${values['nome_servizio']}${operatorePart}`;
    }
    return this.renderTemplate(template, values) || '(template vuoto)';
  }

  isDirty(row: PrefixRow): boolean {
    return row.editingPrefix !== row.savedPrefix
      || row.editingTemplate !== row.savedTemplate;
  }

  /** Inserisce il segnaposto alla posizione del cursore nella textarea della riga. */
  insertPlaceholder(row: PrefixRow, token: string): void {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      `textarea[data-template-cat="${row.macroCategory}"]`,
    );
    if (textarea && document.activeElement === textarea) {
      const start = textarea.selectionStart ?? row.editingTemplate.length;
      const end = textarea.selectionEnd ?? start;
      row.editingTemplate =
        row.editingTemplate.slice(0, start) + token + row.editingTemplate.slice(end);
    } else {
      // Textarea non focalizzata: appende in coda con spazio separatore.
      row.editingTemplate = (row.editingTemplate + ' ' + token).trimStart();
    }
    this.cdr.markForCheck();
  }

  /** Anteprima live con valori d'esempio (stessa logica di render del backend). */
  buildPreview(row: PrefixRow): string {
    const values: Record<string, string> = {
      ...SAMPLE_VALUES,
      prefisso: row.editingPrefix || 'Prestazione del',
    };
    const template = row.editingTemplate.trim();
    if (!template) {
      // Composizione legacy
      return `${values['prefisso']} ${values['data']} — ${values['nome_servizio']} (${values['strumenti']}) — ${values['operatore']}, ${values['albo']}`;
    }
    return this.renderTemplate(template, values) || '(template vuoto)';
  }

  /** Stessa logica di render/pulizia del backend (solo per anteprima UI). */
  private renderTemplate(template: string, values: Record<string, string>): string {
    let out = template.replace(/\{([a-z_]+)\}/g, (_m, key: string) => values[key] ?? '');
    out = out
      .replace(/\(\s*\)/g, '')
      .replace(/\s*—(\s*—)+\s*/g, ' — ')
      .replace(/,\s*(,\s*)+/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s—,]+/, '')
      .replace(/[\s—,]+$/, '')
      .trim();
    return out;
  }

  save(row: PrefixRow): void {
    if (row.saving || !this.isDirty(row)) return;
    row.saving = true;
    this.cdr.markForCheck();
    this.service.upsert(row.macroCategory, row.editingPrefix, row.editingTemplate.trim() || null).subscribe({
      next: (updated) => {
        row.savedPrefix = updated.prefix;
        row.editingPrefix = updated.prefix;
        row.savedTemplate = updated.template ?? '';
        row.editingTemplate = updated.template ?? '';
        row.saving = false;
        this.snackBar.open('Salvato', 'OK', { duration: 2000 });
        this.cdr.markForCheck();
      },
      error: (err) => {
        row.saving = false;
        this.snackBar.open(this.extractError(err), 'OK', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Copia il template di questa riga su TUTTE le categorie e salva.
   * Il prefisso resta quello di ogni categoria: il segnaposto {prefisso}
   * si adatta da solo.
   */
  copyToAll(source: PrefixRow): void {
    const template = source.editingTemplate.trim();
    if (!template) return;
    if (!confirm(`Copiare questo template su tutte le categorie?\n\n${template}`)) return;

    this.rows.forEach(r => { r.editingTemplate = template; r.saving = true; });
    this.cdr.markForCheck();

    forkJoin(
      this.rows.map(r =>
        this.service.upsert(r.macroCategory, r.editingPrefix, template),
      ),
    ).subscribe({
      next: (updated) => {
        updated.forEach((u) => {
          const row = this.rows.find(r => r.macroCategory === String(u.macroCategory).toUpperCase());
          if (row) {
            row.savedPrefix = u.prefix;
            row.editingPrefix = u.prefix;
            row.savedTemplate = u.template ?? '';
            row.editingTemplate = u.template ?? '';
          }
        });
        this.rows.forEach(r => (r.saving = false));
        this.snackBar.open('Template copiato su tutte le categorie', 'OK', { duration: 2500 });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.rows.forEach(r => (r.saving = false));
        this.snackBar.open(this.extractError(err), 'OK', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  onToggleChange(checked: boolean): void {
    this.savingToggle = true;
    this.cdr.markForCheck();
    this.service.setUseOperatorCategories(checked).subscribe({
      next: (settings) => {
        this.useOperatorCategories = settings.useOperatorCategories;
        this.savingToggle = false;
        this.snackBar.open(
          settings.useOperatorCategories
            ? 'Sottocategorie operatori abilitate'
            : 'Sottocategorie operatori disabilitate',
          'OK',
          { duration: 2500 },
        );
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingToggle = false;
        this.snackBar.open(this.extractError(err), 'OK', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  isCatDirty(row: CategoryPrefixRow): boolean {
    return row.editingPrefix !== row.savedPrefix
      || row.editingTemplate !== row.savedTemplate;
  }

  /** Come insertPlaceholder, ma sulla textarea della riga categoria. */
  insertCatPlaceholder(row: CategoryPrefixRow, token: string): void {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      `textarea[data-template-cat="cat-${row.categoryId}"]`,
    );
    if (textarea && document.activeElement === textarea) {
      const start = textarea.selectionStart ?? row.editingTemplate.length;
      const end = textarea.selectionEnd ?? start;
      row.editingTemplate =
        row.editingTemplate.slice(0, start) + token + row.editingTemplate.slice(end);
    } else {
      row.editingTemplate = (row.editingTemplate + ' ' + token).trimStart();
    }
    this.cdr.markForCheck();
  }

  /**
   * Anteprima riga categoria: stesse regole del backend (resolveConfig) —
   * prefisso vuoto eredita dalla macro; nessun campo configurato →
   * fallback completo alla macro-categoria.
   */
  buildCatPreview(row: CategoryPrefixRow): string {
    const macroRow = this.rows.find(r => r.macroCategory === row.macroCategory);
    const hasPrefix = !!row.editingPrefix.trim();
    const template = row.editingTemplate.trim();
    if (!hasPrefix && !template) {
      return `Non configurata — si usa la macro-categoria "${macroRow?.label ?? row.macroLabel}": ${macroRow ? this.buildPreview(macroRow) : ''}`;
    }
    const prefix = row.editingPrefix.trim() || macroRow?.editingPrefix || 'Prestazione del';
    const values: Record<string, string> = {
      ...SAMPLE_VALUES,
      prefisso: prefix,
      descrizione_fattura_categoria:
        row.invoiceLineDescription || SAMPLE_VALUES['descrizione_fattura_categoria'],
    };
    if (!template) {
      return `${prefix} ${values['data']} — ${values['nome_servizio']} (${values['strumenti']}) — ${values['operatore']}, ${values['albo']}`;
    }
    return this.renderTemplate(template, values) || '(template vuoto)';
  }

  saveCat(row: CategoryPrefixRow): void {
    if (row.saving || !this.isCatDirty(row)) return;
    row.saving = true;
    this.cdr.markForCheck();
    this.service.updateOperatorCategoryConfig(
      row.categoryId,
      row.editingPrefix.trim() || null,
      row.editingTemplate.trim() || null,
    ).subscribe({
      next: (updated) => {
        row.savedPrefix = updated.invoicePrefix ?? '';
        row.editingPrefix = updated.invoicePrefix ?? '';
        row.savedTemplate = updated.invoiceTemplate ?? '';
        row.editingTemplate = updated.invoiceTemplate ?? '';
        row.saving = false;
        this.snackBar.open('Salvato', 'OK', { duration: 2000 });
        this.cdr.markForCheck();
      },
      error: (err) => {
        row.saving = false;
        this.snackBar.open(this.extractError(err), 'OK', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  private buildCatRows(categories: OperatorCategoryInvoiceConfig[]): CategoryPrefixRow[] {
    return categories
      .filter(c => c.isActive)
      .map(c => {
        const macroKey = String(c.macroCategory).toLowerCase();
        return {
          categoryId: c.id,
          macroCategory: String(c.macroCategory).toUpperCase(),
          label: c.name,
          macroLabel: CATEGORY_LABELS[macroKey] ?? macroKey,
          invoiceLineDescription: c.invoiceLineDescription ?? '',
          savedPrefix: c.invoicePrefix ?? '',
          editingPrefix: c.invoicePrefix ?? '',
          savedTemplate: c.invoiceTemplate ?? '',
          editingTemplate: c.invoiceTemplate ?? '',
          saving: false,
        };
      })
      .sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a.macroCategory.toLowerCase());
        const ib = CATEGORY_ORDER.indexOf(b.macroCategory.toLowerCase());
        if (ia !== ib) return ia - ib;
        return a.label.localeCompare(b.label);
      });
  }

  private buildRows(prefixes: ServiceInvoicePrefix[]): PrefixRow[] {
    const byCategory = new Map(
      prefixes.map(p => [String(p.macroCategory).toLowerCase(), p]),
    );
    return CATEGORY_ORDER.map((cat) => {
      const existing = byCategory.get(cat.toLowerCase());
      return {
        macroCategory: cat.toUpperCase(),
        label: CATEGORY_LABELS[cat] ?? cat,
        savedPrefix: existing?.prefix ?? '',
        editingPrefix: existing?.prefix ?? '',
        savedTemplate: existing?.template ?? '',
        editingTemplate: existing?.template ?? '',
        saving: false,
      };
    });
  }

  private extractError(err: any): string {
    if (err?.graphQLErrors?.length > 0) {
      return err.graphQLErrors.map((e: any) => e.message).join(', ');
    }
    return err?.message || 'Errore sconosciuto';
  }
}
