import { MergeFieldDef, MergeFieldData } from '@curandis/template-editor';

/**
 * Catalogo dei campi dinamici disponibili nel template "Attestato di
 * presenza". Le chiavi sono il contratto tra editor (nodi mergeField) e
 * generazione (AttendanceCertificateService.buildMergeData): aggiungere
 * un campo qui E nella build dei dati.
 */
export const ATTENDANCE_MERGE_FIELDS: MergeFieldDef[] = [
  // Paziente
  { key: 'paziente.nomeCompleto', label: 'Nome e cognome paziente', group: 'Paziente', example: 'Mario Rossi' },
  { key: 'paziente.nome', label: 'Nome paziente', group: 'Paziente', example: 'Mario' },
  { key: 'paziente.cognome', label: 'Cognome paziente', group: 'Paziente', example: 'Rossi' },
  { key: 'paziente.codiceFiscale', label: 'Codice fiscale paziente', group: 'Paziente', example: 'RSSMRA80A01L219X' },
  { key: 'paziente.dataNascita', label: 'Data di nascita', group: 'Paziente', example: '01/01/1980' },
  { key: 'paziente.luogoNascita', label: 'Luogo di nascita', group: 'Paziente', example: 'Torino' },

  // Visita / trattamento
  { key: 'visita.data', label: 'Data della visita', group: 'Visita', example: '05/07/2026' },
  { key: 'visita.oraInizio', label: 'Ora inizio', group: 'Visita', example: '09:00' },
  { key: 'visita.oraFine', label: 'Ora fine', group: 'Visita', example: '10:00' },
  { key: 'visita.prestazioni', label: 'Prestazioni erogate', group: 'Visita', example: 'Seduta fisioterapica' },
  // Descrizione estesa del servizio a catalogo (Impostazioni → Servizi),
  // accanto al nome: sul certificato serve la dicitura per esteso
  // ("Prestazione sanitaria di Tecarterapia") dove il nome è una sigla.
  {
    key: 'visita.prestazioniDescrizione',
    label: 'Descrizione prestazioni erogate',
    group: 'Visita',
    example: 'Prestazione sanitaria di massoterapia',
  },

  // Professionista
  { key: 'professionista.nomeCompleto', label: 'Nome professionista', group: 'Professionista', example: 'Dott.ssa Anna Bianchi' },
  { key: 'professionista.titolo', label: 'Titolo / specializzazione', group: 'Professionista', example: 'Fisioterapista' },
  { key: 'professionista.albo', label: 'Iscrizione albo', group: 'Professionista', example: 'Albo FT n. 12345' },
  { key: 'professionista.codiceFiscale', label: 'CF professionista', group: 'Professionista', example: 'BNCNNA75B41L219K' },
  { key: 'professionista.partitaIva', label: 'P.IVA professionista', group: 'Professionista', example: '01234567890' },

  // Studio / sede
  { key: 'studio.nome', label: 'Nome studio', group: 'Studio', example: 'Studio principale' },
  { key: 'studio.indirizzo', label: 'Indirizzo studio', group: 'Studio', example: 'Via Roma 1, 10121 Torino' },

  // Documento
  { key: 'documento.dataEmissione', label: 'Data di emissione', group: 'Documento', example: '06/07/2026' },
];

/** Dati fittizi per l'anteprima di stampa dall'editor template. */
export function attendanceExampleData(): MergeFieldData {
  const data: MergeFieldData = {};
  for (const f of ATTENDANCE_MERGE_FIELDS) {
    data[f.key] = f.example ?? f.label;
  }
  return data;
}
