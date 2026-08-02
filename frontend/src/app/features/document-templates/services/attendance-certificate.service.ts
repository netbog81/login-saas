import { Injectable, Injector } from '@angular/core';
import { Observable, forkJoin, map, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  MergeFieldData,
  docToPrintHtml,
  printHtml,
  resolveMergeFields,
} from '@curandis/template-editor';
import { DocumentTemplate } from '../models/document-template.model';
import { DocumentTemplateService } from './document-template.service';
import { GET_TREATMENT_FOR_CERTIFICATE } from '../graphql/document-templates.operations';

/** Lanciato quando non esiste alcun template di attestato configurato. */
export class NoTemplateError extends Error {
  constructor() {
    super(
      'Nessun template "Attestato di presenza" configurato. ' +
        'Creane uno in Configurazioni → Template documenti.',
    );
    this.name = 'NoTemplateError';
  }
}

interface TreatmentForCertificate {
  id: string;
  appointment?: {
    appointmentDate: string;
    startTime: string;
    endTime: string;
  } | null;
  operator?: {
    name: string;
    surname?: string | null;
    professionalTitle?: string | null;
    professionalRegistration?: string | null;
    taxCode?: string | null;
    vatNumber?: string | null;
  } | null;
  site?: { name: string; address?: string | null } | null;
  patient?: {
    id: string;
    subject?: {
      firstName?: string | null;
      lastName?: string | null;
      taxCode?: string | null;
      birthDate?: string | null;
      birthPlace?: string | null;
    } | null;
  } | null;
  treatmentServices?: Array<{ service?: { name: string } | null }> | null;
}

/**
 * Genera l'attestato di presenza per un trattamento: carica il template
 * predefinito + i dati del trattamento (paziente dal registry, orari
 * dall'appuntamento, professionista, sede), risolve i merge field e apre
 * il dialog di stampa del browser (stampa o salvataggio come PDF).
 */
@Injectable({ providedIn: 'root' })
export class AttendanceCertificateService extends BaseGraphQLService {
  constructor(
    injector: Injector,
    private readonly templateService: DocumentTemplateService,
  ) {
    super(injector);
  }

  generateForTreatment(treatmentId: string): Observable<void> {
    return forkJoin({
      template: this.templateService.getDefault('ATTENDANCE_CERTIFICATE'),
      treatment: this.query<{ treatment: TreatmentForCertificate | null }>(
        GET_TREATMENT_FOR_CERTIFICATE,
        { id: treatmentId },
      ).pipe(map((r) => r.treatment)),
    }).pipe(
      switchMap(({ template, treatment }) => {
        if (!template) return throwError(() => new NoTemplateError());
        if (!treatment) {
          return throwError(() => new Error('Trattamento non trovato'));
        }
        this.print(template, treatment);
        return [void 0];
      }),
    );
  }

  private print(template: DocumentTemplate, treatment: TreatmentForCertificate): void {
    const data = this.buildMergeData(treatment);
    const resolved = resolveMergeFields(template.content, data);
    const html = docToPrintHtml(
      resolved,
      template.pageSettings,
      'Attestato di presenza',
    );
    printHtml(html);
  }

  /** Contratto chiavi: vedi models/attendance-merge-fields.ts */
  private buildMergeData(t: TreatmentForCertificate): MergeFieldData {
    const subject = t.patient?.subject;
    const op = t.operator;
    const services = (t.treatmentServices ?? [])
      .map((ts) => ts.service?.name)
      .filter((n): n is string => !!n)
      .join(', ');

    const patientFullName = [subject?.firstName, subject?.lastName]
      .filter(Boolean)
      .join(' ');
    const operatorFullName = [op?.name, op?.surname].filter(Boolean).join(' ');

    return {
      'paziente.nomeCompleto': patientFullName,
      'paziente.nome': subject?.firstName,
      'paziente.cognome': subject?.lastName,
      'paziente.codiceFiscale': subject?.taxCode,
      'paziente.dataNascita': this.formatDate(subject?.birthDate),
      'paziente.luogoNascita': subject?.birthPlace,

      'visita.data': this.formatDate(t.appointment?.appointmentDate),
      'visita.oraInizio': this.formatTime(t.appointment?.startTime),
      'visita.oraFine': this.formatTime(t.appointment?.endTime),
      'visita.prestazioni': services,

      'professionista.nomeCompleto': operatorFullName,
      'professionista.titolo': op?.professionalTitle,
      'professionista.albo': op?.professionalRegistration,
      'professionista.codiceFiscale': op?.taxCode,
      'professionista.partitaIva': op?.vatNumber,

      'studio.nome': t.site?.name,
      'studio.indirizzo': t.site?.address,

      'documento.dataEmissione': this.formatDate(new Date().toISOString().slice(0, 10)),
    };
  }

  /** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
  private formatDate(iso?: string | null): string | undefined {
    if (!iso) return undefined;
    const [y, m, d] = iso.slice(0, 10).split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  /** 'HH:MM(:SS)' → 'HH:MM' */
  private formatTime(time?: string | null): string | undefined {
    if (!time) return undefined;
    return time.slice(0, 5);
  }
}
