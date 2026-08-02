/**
 * Patient Documents Upload Dialog — Layer 2: Smart Container
 *
 * Orchestrazione dell'upload multi-file:
 *  - coda con concorrenza limitata (2 upload paralleli)
 *  - stato per file (pending/uploading/done/error) con progress
 *  - retry del singolo file fallito
 *  - i file del batch condividono l'associazione percorso/trattamento
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  PatientDocumentUploadDialogComponent,
  StartUploadRequest,
} from '../components/patient-document-upload-dialog/patient-document-upload-dialog.component';
import {
  PathOption,
  TreatmentOption,
} from '../components/patient-documents-tab/patient-documents-tab.component';
import {
  PatientDocumentCategory,
  UploadFileItem,
} from '../models/patient-document.model';
import { PatientDocumentsTransferService } from '../services/patient-documents-transfer.service';

const UPLOAD_CONCURRENCY = 2;

@Component({
  selector: 'app-patient-documents-upload-dialog-container',
  standalone: true,
  imports: [CommonModule, PatientDocumentUploadDialogComponent],
  template: `
    <app-patient-document-upload-dialog
      [paths]="paths"
      [treatments]="treatments"
      [items]="items"
      [uploading]="uploading"
      [defaultPathId]="defaultPathId"
      (filesSelected)="onFilesSelected($event)"
      (removeItem)="onRemoveItem($event)"
      (retryItem)="onRetryItem($event)"
      (itemCategoryChange)="onItemCategoryChange($event)"
      (defaultCategoryChange)="onDefaultCategoryChange($event)"
      (startUpload)="onStartUpload($event)"
      (closed)="onClosed()">
    </app-patient-document-upload-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientDocumentsUploadDialogContainer {
  @Input({ required: true }) subjectId!: string;
  @Input() paths: PathOption[] = [];
  @Input() treatments: TreatmentOption[] = [];
  @Input() defaultPathId: string | null = null;

  @Output() closed = new EventEmitter<void>();
  /** Emesso alla chiusura se almeno un upload è andato a buon fine. */
  @Output() uploaded = new EventEmitter<void>();

  items: UploadFileItem[] = [];
  uploading = false;

  private defaultCategory: PatientDocumentCategory = 'other';
  private anyUploaded = false;

  constructor(
    private readonly transfer: PatientDocumentsTransferService,
    private readonly snackBar: MatSnackBar,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  onFilesSelected(files: File[]): void {
    const newItems: UploadFileItem[] = files.map((file) => ({
      file,
      category: this.defaultCategory,
      status: 'pending',
      progress: 0,
    }));
    this.items = [...this.items, ...newItems];
  }

  onRemoveItem(index: number): void {
    this.items = this.items.filter((_, i) => i !== index);
  }

  onItemCategoryChange(event: { index: number; category: PatientDocumentCategory }): void {
    this.items = this.items.map((item, i) =>
      i === event.index ? { ...item, category: event.category } : item,
    );
  }

  onDefaultCategoryChange(category: PatientDocumentCategory): void {
    this.defaultCategory = category;
    // Applica il nuovo default ai file non ancora caricati
    this.items = this.items.map((item) =>
      item.status === 'pending' ? { ...item, category } : item,
    );
  }

  async onStartUpload(request: StartUploadRequest): Promise<void> {
    if (this.uploading) return;
    const queue = this.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status === 'pending');
    if (queue.length === 0) return;

    this.uploading = true;
    this.cdr.markForCheck();

    // Coda con concorrenza limitata: UPLOAD_CONCURRENCY worker che
    // consumano la stessa lista, ogni file è un POST indipendente.
    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(UPLOAD_CONCURRENCY, queue.length) },
      async () => {
        while (cursor < queue.length) {
          const { index } = queue[cursor++];
          await this.uploadSingle(index, request);
        }
      },
    );
    await Promise.all(workers);

    this.uploading = false;
    const failed = this.items.filter((i) => i.status === 'error').length;
    if (failed > 0) {
      this.snackBar.open(
        `${failed} file non caricati — puoi riprovare dal dialog`,
        'OK',
        { duration: 5000 },
      );
    }
    this.cdr.markForCheck();
  }

  async onRetryItem(index: number): Promise<void> {
    // Retry del singolo file con l'ultima associazione usata? No:
    // l'associazione è nel dialog e può essere cambiata — il retry
    // ripassa da startUpload implicito con i valori correnti del form.
    // Per semplicità qui rimettiamo il file in pending: l'utente
    // ripreme "Carica" (che riprende solo i pending).
    this.patchItem(index, { status: 'pending', progress: 0, error: undefined });
  }

  onClosed(): void {
    if (this.uploading) return;
    if (this.anyUploaded) this.uploaded.emit();
    this.closed.emit();
  }

  private uploadSingle(index: number, request: StartUploadRequest): Promise<void> {
    const item = this.items[index];
    this.patchItem(index, { status: 'uploading', progress: 0, error: undefined });

    return new Promise<void>((resolve) => {
      this.transfer
        .uploadDocument(this.subjectId, item.file, item.category, {
          therapeuticPathId: request.therapeuticPathId,
          treatmentId: request.treatmentId,
          notes: request.notes,
        })
        .subscribe({
          next: (event) => {
            if (event.document) {
              this.anyUploaded = true;
              this.patchItem(index, {
                status: 'done',
                progress: 100,
                result: event.document,
              });
            } else {
              this.patchItem(index, { progress: event.progress });
            }
          },
          error: (err) => {
            const message =
              err?.error?.message || err?.message || 'Errore di caricamento';
            this.patchItem(index, { status: 'error', error: message });
            resolve();
          },
          complete: () => resolve(),
        });
    });
  }

  private patchItem(index: number, patch: Partial<UploadFileItem>): void {
    this.items = this.items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    this.cdr.markForCheck();
  }
}
