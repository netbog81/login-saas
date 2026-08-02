import { Injectable } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';

import {
  TemplateRenderData,
  buildPrintHtml,
  docToPrintHtml,
  printHtml,
  resolveTemplate,
} from '@curandis/template-editor';
import { DocumentTemplateService } from '../../document-templates/services/document-template.service';
import {
  FE_STATE_LABELS,
  OperatorFeAnalysis,
  OperatorFeSettlement,
} from '../models/operator-fe-accounts.model';
import { OperatorFeAccountsService } from './operator-fe-accounts.service';

/** Lanciato quando non esiste alcun template "Conto operatore FE". */
export class NoSettlementFeTemplateError extends Error {
  constructor() {
    super(
      'Nessun template "Conto operatore FE" configurato. ' +
        'Creane uno in Configurazioni → Template documenti.',
    );
    this.name = 'NoSettlementFeTemplateError';
  }
}

const fmtCurrency = (n: number | null | undefined): string =>
  `€ ${new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0)}`;

const fmtPct = (n: number | null | undefined): string =>
  `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(n ?? 0)}%`;

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
const fmtDate = (iso?: string | null): string => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * CONTI FE — stampe client-side (stesso motore degli attestati di presenza):
 *  - statement per operatore dal template "Conto operatore FE" (tipo
 *    SETTLEMENT_FE, personalizzabile in Configurazioni → Template documenti);
 *  - analisi complessiva a layout fisso.
 * Contratto chiavi merge field: models/settlement-fe-merge-fields.ts.
 */
@Injectable({ providedIn: 'root' })
export class OperatorFePrintService {
  constructor(
    private readonly templateService: DocumentTemplateService,
    private readonly accountsService: OperatorFeAccountsService,
  ) {}

  /** Stampa lo statement di un conteggio salvato (carica righe + template). */
  printSettlement(settlementId: string): Observable<void> {
    return forkJoin({
      template: this.templateService.getDefault('SETTLEMENT_FE'),
      settlement: this.accountsService.settlementById(settlementId),
    }).pipe(
      map(({ template, settlement }) => {
        if (!template) throw new NoSettlementFeTemplateError();
        if (!settlement) throw new Error('Conteggio non trovato');
        const resolved = resolveTemplate(
          template.content,
          this.buildRenderData(settlement),
        );
        // docToPrintHtml: separa intestazione/piè di pagina ripetuti dal corpo.
        const html = docToPrintHtml(
          resolved,
          template.pageSettings,
          `Conto FE — ${settlement.operatorName}`,
        );
        printHtml(html);
        return void 0;
      }),
    );
  }

  private buildRenderData(s: OperatorFeSettlement): TemplateRenderData {
    const lines = s.lines ?? [];
    // La percentuale è snapshottata riga per riga (identica su tutte le
    // righe dello stesso conteggio).
    const percentage = lines[0]?.percentage ?? 0;
    return {
      fields: {
        'operatore.nome': s.operatorName,
        'operatore.percentuale': fmtPct(percentage),
        'periodo.dal': fmtDate(s.periodFrom),
        'periodo.al': fmtDate(s.periodTo),
        'documento.dataGenerazione': fmtDate(s.createdAt),
        'conteggi.totale': String(s.countTotal),
        'conteggi.incassate': String(s.countPaid),
        'conteggi.daIncassare': String(s.countUnpaid),
        'conteggi.inCorso': String(s.countOpen),
        'totali.prestazioni': fmtCurrency(s.grossAmount),
        'totali.imponibileCompenso': fmtCurrency(s.baseAmount),
        'totali.compenso': fmtCurrency(s.compensationAmount),
        'totali.quotaStudio': fmtCurrency(s.studioShareAmount),
        'totali.extraStudioFE': fmtCurrency(s.studioExtraAmount),
        'conto.note': s.notes ?? '',
      },
      collections: {
        'conto.righe': lines.map((l) => ({
          'riga.data': fmtDate(l.executionDate),
          'riga.paziente': l.patientName ?? '',
          'riga.descrizione': l.description,
          'riga.prezzoFE': fmtCurrency(l.unitPrice),
          'riga.extraStudioFE': fmtCurrency(l.studioExtraAmount),
          'riga.imponibile': fmtCurrency(l.baseAmount),
          'riga.percentuale': fmtPct(l.percentage),
          'riga.compenso': fmtCurrency(l.compensationAmount),
          'riga.quotaStudio': fmtCurrency(l.studioShareAmount),
          'riga.stato': FE_STATE_LABELS[l.state] ?? l.state,
        })),
      },
    };
  }

  /**
   * Stampa l'analisi complessiva (una riga per operatore + totale) con
   * layout fisso, come la stampa analisi dell'accounting.
   */
  printAnalysis(from: string, to: string, analysis: OperatorFeAnalysis[]): void {
    if (!analysis.length) return;
    const tot = analysis.reduce(
      (acc, a) => ({
        count: acc.count + a.counts.total,
        gross: acc.gross + a.totals.gross,
        compensation: acc.compensation + a.totals.compensation,
        studioShare: acc.studioShare + a.totals.studioShare,
        studioExtra: acc.studioExtra + a.totals.studioExtra,
      }),
      { count: 0, gross: 0, compensation: 0, studioShare: 0, studioExtra: 0 },
    );

    const th = (label: string, right = false) =>
      `<th style="text-align:${right ? 'right' : 'left'};border-bottom:1px solid #999;padding:4px 6px;font-size:10px;text-transform:uppercase;">${label}</th>`;
    const td = (value: string, right = false, boldCell = false) =>
      `<td style="text-align:${right ? 'right' : 'left'};border-bottom:1px solid #ddd;padding:4px 6px;${boldCell ? 'font-weight:700;' : ''}">${value}</td>`;

    const rows = analysis
      .map(
        (a) => `<tr>
          ${td(escapeHtml(a.operatorName) + (a.hasOperator ? ` (${fmtPct(a.royaltyPercentage)})` : ' — senza scheda operatore'))}
          ${td(String(a.counts.total), true)}
          ${td(String(a.counts.paid), true)}
          ${td(String(a.counts.unpaid), true)}
          ${td(String(a.counts.open), true)}
          ${td(fmtCurrency(a.totals.gross), true)}
          ${td(fmtCurrency(a.totals.compensation), true, true)}
          ${td(fmtCurrency(a.totals.studioShare), true)}
          ${td(fmtCurrency(a.totals.studioExtra), true)}
        </tr>`,
      )
      .join('');

    const body = `
      <h1 style="font-size:16px;text-align:center;margin:0 0 2mm;">ANALISI CONTI FE</h1>
      <p style="text-align:center;margin:0 0 6mm;">Periodo dal ${fmtDate(from)} al ${fmtDate(to)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr>
          ${th('Operatore')}${th('Prestazioni', true)}${th('Incassate', true)}${th('Da incassare', true)}${th('In corso', true)}
          ${th('Totale FE', true)}${th('Compenso', true)}${th('Quota studio', true)}${th('Extra studio FE', true)}
        </tr></thead>
        <tbody>
          ${rows}
          <tr>
            ${td('TOTALE', false, true)}
            ${td(String(tot.count), true, true)}${td('', true)}${td('', true)}${td('', true)}
            ${td(fmtCurrency(tot.gross), true, true)}
            ${td(fmtCurrency(tot.compensation), true, true)}
            ${td(fmtCurrency(tot.studioShare), true, true)}
            ${td(fmtCurrency(tot.studioExtra), true, true)}
          </tr>
        </tbody>
      </table>
      <p style="font-size:9px;color:#666;margin-top:4mm;">
        Compensi calcolati come percentuale operatore su (prezzo praticato FE − Extra studio FE),
        sui soli trattamenti con sconto FE.
      </p>`;

    printHtml(buildPrintHtml(body, null, 'Analisi Conti FE'));
  }
}
