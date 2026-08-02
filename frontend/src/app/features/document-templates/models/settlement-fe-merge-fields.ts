import {
  CollectionData,
  MergeFieldData,
  MergeFieldDef,
  TemplateCollectionDef,
} from '@curandis/template-editor';

/**
 * Catalogo dei campi dinamici del template "Conto operatore FE"
 * (Statistiche → Conti FE → stampa statement). Le chiavi sono il contratto
 * tra editor e generazione (OperatorFePrintService.buildRenderData):
 * aggiungere un campo qui E nella build dei dati.
 */
export const SETTLEMENT_FE_MERGE_FIELDS: MergeFieldDef[] = [
  // Operatore
  { key: 'operatore.nome', label: 'Nome operatore', group: 'Operatore', example: 'Anna Bianchi' },
  { key: 'operatore.percentuale', label: 'Percentuale su prestazioni', group: 'Operatore', example: '40%' },

  // Periodo
  { key: 'periodo.dal', label: 'Periodo dal', group: 'Periodo', example: '01/06/2026' },
  { key: 'periodo.al', label: 'Periodo al', group: 'Periodo', example: '30/06/2026' },
  { key: 'documento.dataGenerazione', label: 'Data generazione conteggio', group: 'Periodo', example: '12/07/2026' },

  // Conteggi
  { key: 'conteggi.totale', label: 'Prestazioni totali', group: 'Conteggi', example: '18' },
  { key: 'conteggi.incassate', label: 'Prestazioni incassate', group: 'Conteggi', example: '15' },
  { key: 'conteggi.daIncassare', label: 'Prestazioni da incassare', group: 'Conteggi', example: '2' },
  { key: 'conteggi.inCorso', label: 'Prestazioni in corso', group: 'Conteggi', example: '1' },

  // Totali
  { key: 'totali.prestazioni', label: 'Totale prestazioni FE (€)', group: 'Totali', example: '€ 720,00' },
  { key: 'totali.imponibileCompenso', label: 'Imponibile compenso (€)', group: 'Totali', example: '€ 360,00' },
  { key: 'totali.compenso', label: 'Compenso operatore (€)', group: 'Totali', example: '€ 144,00' },
  { key: 'totali.quotaStudio', label: 'Quota studio (€)', group: 'Totali', example: '€ 576,00' },
  { key: 'totali.extraStudioFE', label: 'Totale Extra studio FE (€)', group: 'Totali', example: '€ 360,00' },

  // Note
  { key: 'conto.note', label: 'Note del conteggio', group: 'Documento', example: '' },
];

/** Collezione delle prestazioni del conto (righe della tabella dinamica). */
export const SETTLEMENT_FE_COLLECTIONS: TemplateCollectionDef[] = [
  {
    key: 'conto.righe',
    label: 'Prestazioni del conto',
    fields: [
      { key: 'riga.data', label: 'Data', example: '05/06/2026' },
      { key: 'riga.paziente', label: 'Paziente', example: 'Mario Rossi' },
      { key: 'riga.descrizione', label: 'Descrizione', example: 'Seduta fisioterapica' },
      { key: 'riga.prezzoFE', label: 'Prezzo FE (€)', example: '€ 40,00' },
      { key: 'riga.extraStudioFE', label: 'Extra studio FE (€)', example: '€ 20,00' },
      { key: 'riga.imponibile', label: 'Imponibile (€)', example: '€ 20,00' },
      { key: 'riga.percentuale', label: 'Percentuale', example: '40%' },
      { key: 'riga.compenso', label: 'Compenso (€)', example: '€ 8,00' },
      { key: 'riga.quotaStudio', label: 'Quota studio (€)', example: '€ 32,00' },
      { key: 'riga.stato', label: 'Stato', example: 'Incassata' },
    ],
  },
];

/** Dati fittizi per l'anteprima di stampa dall'editor template. */
export function settlementFeExampleData(): {
  fields: MergeFieldData;
  collections: CollectionData;
} {
  const fields: MergeFieldData = {};
  for (const f of SETTLEMENT_FE_MERGE_FIELDS) {
    fields[f.key] = f.example ?? f.label;
  }
  const collections: CollectionData = {
    'conto.righe': [
      {
        'riga.data': '05/06/2026', 'riga.paziente': 'Mario Rossi',
        'riga.descrizione': 'Seduta fisioterapica', 'riga.prezzoFE': '€ 40,00',
        'riga.extraStudioFE': '€ 20,00', 'riga.imponibile': '€ 20,00',
        'riga.percentuale': '40%', 'riga.compenso': '€ 8,00',
        'riga.quotaStudio': '€ 32,00', 'riga.stato': 'Incassata',
      },
      {
        'riga.data': '12/06/2026', 'riga.paziente': 'Lucia Verdi',
        'riga.descrizione': 'Massoterapia', 'riga.prezzoFE': '€ 35,00',
        'riga.extraStudioFE': '€ 15,00', 'riga.imponibile': '€ 20,00',
        'riga.percentuale': '40%', 'riga.compenso': '€ 8,00',
        'riga.quotaStudio': '€ 27,00', 'riga.stato': 'Incassata',
      },
      {
        'riga.data': '19/06/2026', 'riga.paziente': 'Paolo Neri',
        'riga.descrizione': 'Rieducazione motoria', 'riga.prezzoFE': '€ 45,00',
        'riga.extraStudioFE': '€ 20,00', 'riga.imponibile': '€ 25,00',
        'riga.percentuale': '40%', 'riga.compenso': '€ 10,00',
        'riga.quotaStudio': '€ 35,00', 'riga.stato': 'Da incassare',
      },
    ],
  };
  return { fields, collections };
}
