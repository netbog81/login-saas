import { TemplateDocument } from '@curandis/template-editor';

/**
 * Contenuto di partenza per un nuovo template "Conto operatore FE": lo
 * statement per l'operatore con periodo, tabella delle prestazioni FE
 * conteggiate (tabella dinamica su `conto.righe`) e blocco totali.
 * L'utente lo personalizza nell'editor.
 */

type Json = Record<string, unknown>;

const field = (key: string, label: string): Json => ({
  type: 'mergeField',
  attrs: { field: key, label },
});
const text = (t: string, marks?: Json[]): Json =>
  marks ? { type: 'text', text: t, marks } : { type: 'text', text: t };
const bold = [{ type: 'bold' }];
const p = (align: string, ...content: Json[]): Json => ({
  type: 'paragraph',
  attrs: { textAlign: align },
  content: content.length ? content : undefined,
});

const col = (
  fieldKey: string,
  label: string,
  width: number,
  align: 'left' | 'center' | 'right',
): Json => ({ field: fieldKey, label, width, align });

export function defaultSettlementFeTemplate(): TemplateDocument {
  return {
    type: 'doc',
    content: [
      p('center', text('CONTO OPERATORE FE', bold)),
      p('center',
        field('operatore.nome', 'Nome operatore'),
        text(' — percentuale su prestazioni: '),
        field('operatore.percentuale', 'Percentuale su prestazioni'),
      ),
      p('center',
        text('Periodo dal '),
        field('periodo.dal', 'Periodo dal'),
        text(' al '),
        field('periodo.al', 'Periodo al'),
        text(' — generato il '),
        field('documento.dataGenerazione', 'Data generazione conteggio'),
      ),
      p('left'),
      {
        type: 'dynamicTable',
        attrs: {
          collection: 'conto.righe',
          columns: [
            col('riga.data', 'Data', 11, 'left'),
            col('riga.paziente', 'Paziente', 17, 'left'),
            col('riga.descrizione', 'Descrizione', 24, 'left'),
            col('riga.prezzoFE', 'Prezzo FE (€)', 11, 'right'),
            col('riga.imponibile', 'Imponibile (€)', 11, 'right'),
            col('riga.compenso', 'Compenso (€)', 12, 'right'),
            col('riga.stato', 'Stato', 14, 'left'),
          ],
          headerBg: '#eeeeee',
          headerColor: '#1a1a1a',
          oddRowBg: null,
          evenRowBg: '#f3f4f6',
          borders: 'rows',
          borderColor: '#d1d5db',
          resolvedRows: null,
        },
      },
      p('left'),
      p('right',
        text('Prestazioni nel periodo: '),
        field('conteggi.totale', 'Prestazioni totali'),
      ),
      p('right',
        text('Totale prestazioni FE: '),
        field('totali.prestazioni', 'Totale prestazioni FE (€)'),
      ),
      p('right',
        text('Imponibile compenso: '),
        field('totali.imponibileCompenso', 'Imponibile compenso (€)'),
      ),
      p('right',
        text('Compenso operatore: ', bold),
        field('totali.compenso', 'Compenso operatore (€)'),
      ),
      p('right',
        text('Quota studio: '),
        field('totali.quotaStudio', 'Quota studio (€)'),
        text(' (di cui Extra studio FE '),
        field('totali.extraStudioFE', 'Totale Extra studio FE (€)'),
        text(')'),
      ),
      p('left'),
      p('left', text('Note: '), field('conto.note', 'Note del conteggio')),
      p('left'),
      p('right', text('Firma per accettazione', bold)),
      p('right'),
      p('right', text('___________________________')),
    ],
  };
}
