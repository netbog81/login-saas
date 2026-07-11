import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  TemplateDocument,
  TemplateEditorComponent,
  TemplatePageSettings,
  buildPrintHtml,
  docToHtml,
  printHtml,
  resolveMergeFields,
} from '../../../shared/template-editor';
import { DocumentTemplateService } from '../services/document-template.service';
import {
  ATTENDANCE_MERGE_FIELDS,
  attendanceExampleData,
} from '../models/attendance-merge-fields';
import { defaultAttendanceTemplate } from '../models/default-attendance-template';

/**
 * Container: creazione/modifica di un template "Attestato di presenza".
 * Route: /settings/document-templates/new | /settings/document-templates/:id
 */
@Component({
  selector: 'app-document-template-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TemplateEditorComponent,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <button mat-icon-button routerLink="/settings/document-templates" matTooltip="Torna all'elenco">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>{{ isNew() ? 'Nuovo template attestato' : 'Modifica template' }}</h1>
        <span class="spacer"></span>
        <button mat-stroked-button (click)="previewPrint()" matTooltip="Stampa di prova con dati fittizi">
          <mat-icon>print</mat-icon>
          Anteprima di stampa
        </button>
        <button mat-flat-button color="primary" [disabled]="saving() || !name.trim()" (click)="save()">
          <mat-icon>save</mat-icon>
          {{ saving() ? 'Salvataggio…' : 'Salva' }}
        </button>
      </div>

      @if (loading()) {
        <div class="center"><mat-spinner diameter="42"></mat-spinner></div>
      } @else {
        <div class="meta-row">
          <mat-form-field appearance="outline" class="name-field" subscriptSizing="dynamic">
            <mat-label>Nome del template</mat-label>
            <input matInput [(ngModel)]="name" maxlength="255"
                   placeholder="Es. Attestato di presenza standard" />
          </mat-form-field>
          <mat-slide-toggle [(ngModel)]="isDefault">
            Template predefinito
          </mat-slide-toggle>
        </div>

        <app-template-editor
          [content]="content()"
          [pageSettings]="pageSettings()"
          [mergeFields]="mergeFields"
          (contentChange)="onContentChange($event)"
          (pageSettingsChange)="onPageSettingsChange($event)">
        </app-template-editor>
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px 24px 32px; }
    .page-header {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    h1 { margin: 0; font-size: 20px; }
    .spacer { flex: 1; }
    .center { display: flex; justify-content: center; padding: 48px; }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .name-field { width: 360px; max-width: 100%; }
  `],
})
export class DocumentTemplateEditorContainer implements OnInit {
  readonly mergeFields = ATTENDANCE_MERGE_FIELDS;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly isNew = signal(true);
  readonly content = signal<TemplateDocument | null>(null);
  readonly pageSettings = signal<Partial<TemplatePageSettings> | null>(null);

  name = '';
  isDefault = false;

  private templateId: string | null = null;
  /** Ultimo stato dell'editor (per il salvataggio). */
  private currentContent: TemplateDocument | null = null;
  private currentSettings: Partial<TemplatePageSettings> | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly templateService: DocumentTemplateService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      this.isNew.set(true);
      this.name = 'Attestato di presenza';
      const doc = defaultAttendanceTemplate();
      this.content.set(doc);
      this.currentContent = doc;
      this.loading.set(false);
      return;
    }
    this.isNew.set(false);
    this.templateId = id;
    this.templateService.getById(id).subscribe({
      next: (template) => {
        if (!template) {
          this.snackBar.open('Template non trovato', 'OK', { duration: 5000 });
          this.router.navigate(['/settings/document-templates']);
          return;
        }
        this.name = template.name;
        this.isDefault = template.isDefault;
        this.content.set(template.content);
        this.pageSettings.set(template.pageSettings ?? null);
        this.currentContent = template.content;
        this.currentSettings = template.pageSettings ?? null;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open(`Errore nel caricamento: ${err.message}`, 'OK', {
          duration: 6000,
        });
      },
    });
  }

  onContentChange(doc: TemplateDocument): void {
    this.currentContent = doc;
  }

  onPageSettingsChange(settings: TemplatePageSettings): void {
    this.currentSettings = settings;
  }

  /** Stampa di prova con dati fittizi (stesso motore della generazione reale). */
  previewPrint(): void {
    if (!this.currentContent) return;
    const resolved = resolveMergeFields(this.currentContent, attendanceExampleData());
    const html = buildPrintHtml(
      docToHtml(resolved),
      this.currentSettings,
      this.name || 'Anteprima template',
    );
    printHtml(html);
  }

  save(): void {
    if (!this.currentContent || !this.name.trim()) return;
    this.saving.set(true);
    const done = () => this.saving.set(false);

    if (this.isNew()) {
      this.templateService
        .create({
          name: this.name.trim(),
          type: 'ATTENDANCE_CERTIFICATE',
          content: this.currentContent,
          pageSettings: this.currentSettings,
          isDefault: this.isDefault || undefined,
        })
        .subscribe({
          next: () => {
            done();
            this.snackBar.open('Template creato', 'OK', { duration: 3000 });
            this.router.navigate(['/settings/document-templates']);
          },
          error: (err) => {
            done();
            this.snackBar.open(`Errore nel salvataggio: ${err.message}`, 'OK', {
              duration: 6000,
            });
          },
        });
      return;
    }

    this.templateService
      .update(this.templateId!, {
        name: this.name.trim(),
        content: this.currentContent,
        pageSettings: this.currentSettings,
        isDefault: this.isDefault,
      })
      .subscribe({
        next: () => {
          done();
          this.snackBar.open('Template salvato', 'OK', { duration: 3000 });
        },
        error: (err) => {
          done();
          this.snackBar.open(`Errore nel salvataggio: ${err.message}`, 'OK', {
            duration: 6000,
          });
        },
      });
  }
}
