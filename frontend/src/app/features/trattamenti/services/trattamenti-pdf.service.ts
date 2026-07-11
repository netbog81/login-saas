import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Trattamento,
  TrattamentiFilters,
  TreatmentStatus,
} from '../models/trattamento.model';

/**
 * Contesto per l'export PDF dell'elenco trattamenti.
 * `operatorLabel`/`patientLabel` sono i nomi leggibili risolti dal container
 * (necessari per titolo + nome file). Se il relativo filtro non è attivo
 * restano null e nel nome file compaiono i placeholder `alloperator`/`allpatients`.
 */
export interface TrattamentiPdfContext {
  treatments: Trattamento[];
  filters: TrattamentiFilters;
  operatorLabel?: string | null;
  patientLabel?: string | null;
}

const STATUS_LABEL: Record<TreatmentStatus, string> = {
  [TreatmentStatus.WAITING]: 'In attesa',
  [TreatmentStatus.IN_PROGRESS]: 'In corso',
  [TreatmentStatus.OPERATOR_COMPLETED]: 'Chiuso da operatore',
  [TreatmentStatus.CLOSED]: 'Chiuso da segreteria',
};

/**
 * Genera un PDF (A4 orizzontale) con l'elenco dei trattamenti risultante dai
 * filtri correnti e lo scarica. Il nome file segue la convenzione:
 *   elenco-trattamenti-<operatore>-<paziente>-<dal>-<al>.pdf
 * con i placeholder alloperator / allpatients / periodocompleto quando i
 * rispettivi filtri non sono impostati.
 */
@Injectable({ providedIn: 'root' })
export class TrattamentiPdfService {
  export(ctx: TrattamentiPdfContext): void {
    const { treatments, filters, operatorLabel, patientLabel } = ctx;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // ── Intestazione ────────────────────────────────────────────────
    doc.setFontSize(15);
    doc.text('Elenco Trattamenti', 40, 42);

    const operatorText = filters.operatorId ? (operatorLabel || '—') : 'Tutti';
    const patientText = filters.patientId ? (patientLabel || '—') : 'Tutti';
    const periodText = filters.dateFrom && filters.dateTo
      ? `${this.itDate(filters.dateFrom)} – ${this.itDate(filters.dateTo)}`
      : 'completo';

    doc.setFontSize(10);
    doc.text(
      `Operatore: ${operatorText}     Paziente: ${patientText}     Periodo: ${periodText}`,
      40,
      60,
    );
    doc.text(`Trattamenti: ${treatments.length}`, 40, 74);

    // ── Tabella ─────────────────────────────────────────────────────
    const body = treatments.map((t) => [
      this.formatDateTime(t),
      t.patient ? `${t.patient.nome} ${t.patient.cognome}` : '—',
      `${t.operator?.name ?? ''} ${t.operator?.surname ?? ''}`.trim() || '—',
      STATUS_LABEL[t.status] ?? t.status,
      this.euro(t.accountingTotalAmount ?? t.price ?? 0),
      t.isPaid ? 'Sì' : 'No',
    ]);

    const total = treatments.reduce(
      (sum, t) => sum + (t.accountingTotalAmount ?? t.price ?? 0),
      0,
    );

    autoTable(doc, {
      startY: 88,
      head: [['Data', 'Paziente', 'Operatore', 'Stato', 'Importo', 'Pagato']],
      body,
      foot: [['', '', '', 'Totale', this.euro(total), '']],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [63, 81, 181] },
      footStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: 'bold' },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'center' },
      },
    });

    doc.save(this.buildFilename(filters, operatorLabel, patientLabel));
  }

  /** Nome file secondo la convenzione richiesta dal cliente. */
  private buildFilename(
    filters: TrattamentiFilters,
    operatorLabel?: string | null,
    patientLabel?: string | null,
  ): string {
    const operatorPart = filters.operatorId ? this.slug(operatorLabel) : 'alloperator';
    const patientPart = filters.patientId ? this.slug(patientLabel) : 'allpatients';
    const datePart = filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom}-${filters.dateTo}`
      : 'periodocompleto';
    return `elenco-trattamenti-${operatorPart}-${patientPart}-${datePart}.pdf`;
  }

  /** "YYYY-MM-DD" + eventuale ora → cella tabella. */
  private formatDateTime(t: Trattamento): string {
    const date = this.itDate(t.appointment?.appointmentDate);
    const time = t.appointment?.startTime ? ` ${t.appointment.startTime}` : '';
    return `${date}${time}`.trim() || '—';
  }

  /** "YYYY-MM-DD" → "DD/MM/YYYY". */
  private itDate(iso?: string | null): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return d && m && y ? `${d}/${m}/${y}` : iso;
  }

  private euro(amount: number): string {
    return `€ ${amount.toFixed(2)}`;
  }

  /**
   * Slug sicuro per nome file: toglie accenti, spazi e caratteri speciali,
   * minuscolo. "Mario Rossi" → "mariorossi". Fallback se label vuota.
   */
  private slug(label?: string | null): string {
    if (!label) return 'na';
    // U+0300–U+036F = combining diacritical marks (rimossi dopo NFD).
    const diacritics = new RegExp('[\\u0300-\\u036f]', 'g');
    const normalized = label
      .normalize('NFD')
      .replace(diacritics, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return normalized || 'na';
  }
}
