import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';

import {
  DOCUMENT_TEMPLATE_TYPE_LABELS,
  DocumentTemplate,
} from '../models/document-template.model';
import { DocumentTemplateService } from '../services/document-template.service';
import { ConfirmMatDialogComponent } from '../../../shared/components/confirm-mat-dialog/confirm-mat-dialog.component';

/**
 * Container: elenco dei template documenti (Configurazioni → Template
 * documenti). Delega il CRUD a DocumentTemplateService.
 */
@Component({
  selector: 'app-document-templates-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatMenuModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>
            <mat-icon>description</mat-icon>
            Template documenti
          </h1>
          <p class="subtitle">
            Modelli personalizzabili per i documenti generati dal gestionale
            (attestati di presenza, conti operatore FE). Il template
            <strong>predefinito</strong> di ogni tipo è quello usato
            dall'azione rapida corrispondente.
          </p>
        </div>
        <button mat-flat-button color="primary" [matMenuTriggerFor]="newMenu">
          <mat-icon>add</mat-icon>
          Nuovo template
        </button>
        <mat-menu #newMenu="matMenu">
          <button mat-menu-item routerLink="new" [queryParams]="{ type: 'ATTENDANCE_CERTIFICATE' }">
            <mat-icon>badge</mat-icon>
            Attestato di presenza
          </button>
          <button mat-menu-item routerLink="new" [queryParams]="{ type: 'SETTLEMENT_FE' }">
            <mat-icon>groups</mat-icon>
            Conto operatore FE
          </button>
        </mat-menu>
      </div>

      @if (loading()) {
        <div class="center"><mat-spinner diameter="42"></mat-spinner></div>
      } @else if (templates().length === 0) {
        <mat-card class="empty-card">
          <mat-card-content>
            <mat-icon class="empty-icon">post_add</mat-icon>
            <p>Nessun template ancora creato.</p>
            <p class="subtitle">
              Crea il primo template di attestato di presenza: partirai da un
              modello già impostato, da personalizzare con logo e colori.
            </p>
            <button mat-flat-button color="primary" routerLink="new"
                    [queryParams]="{ type: 'ATTENDANCE_CERTIFICATE' }">
              <mat-icon>add</mat-icon>
              Crea il primo template
            </button>
          </mat-card-content>
        </mat-card>
      } @else {
        <div class="template-grid">
          @for (t of templates(); track t.id) {
            <mat-card class="template-card">
              <mat-card-header>
                <mat-card-title>
                  {{ t.name }}
                  @if (t.isDefault) {
                    <span class="default-badge" matTooltip="Usato dall'azione 'Genera attestato' nei trattamenti">
                      Predefinito
                    </span>
                  }
                </mat-card-title>
                <mat-card-subtitle>
                  {{ typeLabels[t.type] || t.type }} · aggiornato il {{ t.updatedAt | date:'dd/MM/yyyy HH:mm' }}
                </mat-card-subtitle>
              </mat-card-header>
              <mat-card-actions align="end">
                @if (!t.isDefault) {
                  <button mat-button (click)="setDefault(t)">
                    <mat-icon>star</mat-icon>
                    Predefinito
                  </button>
                }
                <button mat-button [routerLink]="[t.id]">
                  <mat-icon>edit</mat-icon>
                  Modifica
                </button>
                <button mat-button color="warn" (click)="remove(t)">
                  <mat-icon>delete</mat-icon>
                  Elimina
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1100px; margin: 0 auto; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    h1 { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font-size: 22px; }
    .subtitle { color: rgba(0,0,0,0.6); font-size: 13px; margin: 0; max-width: 640px; }
    .center { display: flex; justify-content: center; padding: 48px; }
    .empty-card { text-align: center; padding: 24px; }
    .empty-icon { font-size: 48px; width: 48px; height: 48px; color: rgba(0,0,0,0.3); }
    .template-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .default-badge {
      background: #3f51b5;
      color: white;
      font-size: 11px;
      font-weight: 500;
      border-radius: 10px;
      padding: 2px 8px;
      margin-left: 8px;
      vertical-align: middle;
    }
  `],
})
export class DocumentTemplatesPageContainer implements OnInit {
  readonly templates = signal<DocumentTemplate[]>([]);
  readonly loading = signal(true);
  readonly typeLabels = DOCUMENT_TEMPLATE_TYPE_LABELS;

  constructor(
    private readonly templateService: DocumentTemplateService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.templateService.getAll().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open(
          `Errore nel caricamento dei template: ${err.message}`,
          'OK',
          { duration: 6000 },
        );
      },
    });
  }

  setDefault(template: DocumentTemplate): void {
    this.templateService.update(template.id, { isDefault: true }).subscribe({
      next: () => this.reload(),
      error: (err) =>
        this.snackBar.open(`Errore: ${err.message}`, 'OK', { duration: 6000 }),
    });
  }

  remove(template: DocumentTemplate): void {
    const ref = this.dialog.open(ConfirmMatDialogComponent, {
      data: {
        title: 'Elimina template',
        message: `Eliminare definitivamente il template "${template.name}"?`,
        confirmText: 'Elimina',
        cancelText: 'Annulla',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.templateService.delete(template.id).subscribe({
        next: () => this.reload(),
        error: (err) =>
          this.snackBar.open(`Errore: ${err.message}`, 'OK', { duration: 6000 }),
      });
    });
  }
}
