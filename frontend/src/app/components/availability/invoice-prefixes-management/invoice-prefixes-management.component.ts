import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ServiceInvoicePrefixService,
  ServiceInvoicePrefix,
} from '../../../services/service-invoice-prefix.service';

interface PrefixRow {
  macroCategory: string;
  label: string;
  savedPrefix: string;
  editingPrefix: string;
  saving: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  doctor: 'Medici',
  physiotherapist: 'Fisioterapisti',
  gym_instructor: 'Istruttori Palestra',
  other: 'Altro',
};

const CATEGORY_ORDER = ['doctor', 'physiotherapist', 'gym_instructor', 'other'];

/**
 * Gestione prefissi per descrizione auto-generata della riga fattura.
 *
 * Mostra una riga per ogni macro-categoria operatore con il prefisso
 * editabile. Il backend usa questi valori quando compone on-the-fly la
 * descrizione della riga fattura di ogni TreatmentService.
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
  ],
  template: `
    <section class="prefixes-section">
      <header class="header">
        <h2>Prefissi descrizione fattura per categoria operatore</h2>
        <p class="hint">
          Testo che precede la data nella descrizione auto-generata di ogni
          riga fattura. Esempio: <code>"Seduta fisioterapica del 22/04/2026 — Massoterapia — Dr. Rossi, Albo FT n. 12345"</code>.
        </p>
      </header>

      @if (loading) {
        <div class="loading">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Caricamento…</span>
        </div>
      } @else {
        <div class="rows">
          @for (row of rows; track row.macroCategory) {
            <div class="row">
              <div class="cat-label">{{ row.label }}</div>
              <mat-form-field appearance="outline" class="prefix-input">
                <mat-label>Prefisso</mat-label>
                <input
                  matInput
                  [(ngModel)]="row.editingPrefix"
                  maxlength="500"
                  [disabled]="row.saving" />
              </mat-form-field>
              <button
                mat-flat-button
                color="primary"
                [disabled]="row.saving || row.editingPrefix === row.savedPrefix"
                (click)="save(row)">
                <mat-icon>save</mat-icon>
                Salva
              </button>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .prefixes-section {
      margin-top: 32px;
      padding: 16px;
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
    .rows {
      display: flex; flex-direction: column; gap: 8px;
    }
    .row {
      display: flex; align-items: center; gap: 12px;
      flex-wrap: wrap;
    }
    .cat-label {
      min-width: 180px;
      font-weight: 500;
    }
    .prefix-input { flex: 1; min-width: 280px; }
  `],
})
export class InvoicePrefixesManagementComponent implements OnInit {
  rows: PrefixRow[] = [];
  loading = true;

  constructor(
    private service: ServiceInvoicePrefixService,
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
        this.snackBar.open('Errore nel caricamento prefissi', 'OK', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  save(row: PrefixRow): void {
    if (row.saving || row.editingPrefix === row.savedPrefix) return;
    row.saving = true;
    this.cdr.markForCheck();
    // Il backend accetta il valore enum in formato uppercase via GraphQL
    // (es. 'DOCTOR'), lo convertiamo qui per sicurezza anche se CATEGORY_ORDER
    // contiene già i valori nel formato GraphQL.
    this.service.upsert(row.macroCategory, row.editingPrefix).subscribe({
      next: (updated) => {
        row.savedPrefix = updated.prefix;
        row.editingPrefix = updated.prefix;
        row.saving = false;
        this.snackBar.open('Prefisso salvato', 'OK', { duration: 2000 });
        this.cdr.markForCheck();
      },
      error: (err) => {
        row.saving = false;
        this.snackBar.open(this.extractError(err), 'OK', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  private buildRows(prefixes: ServiceInvoicePrefix[]): PrefixRow[] {
    // Il backend ritorna macroCategory in uppercase GraphQL (es. 'DOCTOR').
    // Normalizziamo comparando case-insensitive: così funziona comunque se
    // il formato cambia in futuro.
    const byCategory = new Map(
      prefixes.map(p => [String(p.macroCategory).toLowerCase(), p]),
    );
    return CATEGORY_ORDER.map((cat) => {
      const existing = byCategory.get(cat.toLowerCase());
      return {
        // Il valore inviato al server nella mutation deve essere quello
        // formato GraphQL uppercase, quindi lo teniamo così.
        macroCategory: cat.toUpperCase(),
        label: CATEGORY_LABELS[cat] ?? cat,
        savedPrefix: existing?.prefix ?? '',
        editingPrefix: existing?.prefix ?? '',
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
