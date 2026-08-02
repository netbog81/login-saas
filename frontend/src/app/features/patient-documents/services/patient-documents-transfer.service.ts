import { Injectable } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseRestService } from '../../../core/http/base-rest.service';
import {
  PatientDocument,
  PatientDocumentCategory,
  UploadDocumentMeta,
} from '../models/patient-document.model';

/** Evento di avanzamento upload per la barra di progresso. */
export interface UploadProgressEvent {
  /** 0..100; -1 se la dimensione totale non è nota */
  progress: number;
  /** Presente solo all'evento finale (response del backend) */
  document?: PatientDocument;
}

/**
 * Trasferimento binario documenti paziente (Layer 3 — REST).
 *
 * Il backend cifra in streaming (envelope encryption) e scrive su S3:
 * qui parte il multipart e si riceve il progress; i metadati CRUD
 * restano su PatientDocumentsService (GraphQL).
 */
@Injectable({ providedIn: 'root' })
export class PatientDocumentsTransferService extends BaseRestService {
  /**
   * Upload di un singolo file con progress.
   * Ogni file del batch viaggia con un POST separato (DEK, progress e
   * retry indipendenti per file).
   */
  uploadDocument(
    subjectId: string,
    file: File,
    category: PatientDocumentCategory,
    meta: UploadDocumentMeta,
  ): Observable<UploadProgressEvent> {
    const fd = new FormData();
    // I campi testo PRIMA del file: busboy li riceve prima di aprire lo stream
    if (meta.therapeuticPathId) fd.append('therapeuticPathId', meta.therapeuticPathId);
    if (meta.treatmentId) fd.append('treatmentId', meta.treatmentId);
    fd.append('category', category);
    if (meta.notes) fd.append('notes', meta.notes);
    if (meta.externalDoctorName) fd.append('externalDoctorName', meta.externalDoctorName);
    fd.append('file', file, file.name);

    return new Observable<UploadProgressEvent>((subscriber) => {
      const sub = this.uploadWithProgress<PatientDocument>(
        `api/patient-documents/subjects/${subjectId}`,
        fd,
      ).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = event.total
              ? Math.round((event.loaded / event.total) * 100)
              : -1;
            subscriber.next({ progress });
          } else if (event.type === HttpEventType.Response) {
            subscriber.next({ progress: 100, document: event.body ?? undefined });
            subscriber.complete();
          }
        },
        error: (err) => subscriber.error(err),
      });
      return () => sub.unsubscribe();
    });
  }

  /** Download del documento decifrato come Blob. */
  downloadDocument(documentId: string): Observable<Blob> {
    return this.downloadBlob(`api/patient-documents/${documentId}/download`);
  }
}
