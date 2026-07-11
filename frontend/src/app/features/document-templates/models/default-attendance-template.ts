import { TemplateDocument } from '../../../shared/template-editor';

/**
 * Contenuto di partenza per un nuovo template "Attestato di presenza":
 * il classico attestato per pazienti soggetti a controllo (visita fiscale
 * INPS / mutua) che devono giustificare l'assenza dal domicilio.
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

export function defaultAttendanceTemplate(): TemplateDocument {
  return {
    type: 'doc',
    content: [
      p('center', text('Oggetto: Attestazione di presenza', bold)),
      p('left'),
      p('left',
        text('Il/La sottoscritto/a Dott./Dott.ssa '),
        field('professionista.nomeCompleto', 'Nome professionista'),
      ),
      p('left',
        text('in qualità di '),
        field('professionista.titolo', 'Titolo / specializzazione'),
        text(' ('),
        field('professionista.albo', 'Iscrizione albo'),
        text(')'),
      ),
      p('left',
        text('con studio in '),
        field('studio.indirizzo', 'Indirizzo studio'),
      ),
      p('left',
        text('Codice Fiscale / P.IVA: '),
        field('professionista.codiceFiscale', 'CF professionista'),
        text(' / '),
        field('professionista.partitaIva', 'P.IVA professionista'),
      ),
      p('left'),
      p('center', text('ATTESTA CHE', bold)),
      p('left'),
      p('left',
        text('Il/La Sig./Sig.ra '),
        field('paziente.nomeCompleto', 'Nome e cognome paziente'),
        text(' (C.F. '),
        field('paziente.codiceFiscale', 'Codice fiscale paziente'),
        text(')'),
      ),
      p('left',
        text('nato/a a '),
        field('paziente.luogoNascita', 'Luogo di nascita'),
        text(' il '),
        field('paziente.dataNascita', 'Data di nascita'),
      ),
      p('left',
        text('si è recato/a presso questo studio in data '),
        field('visita.data', 'Data della visita'),
      ),
      p('left',
        text('dalle ore '),
        field('visita.oraInizio', 'Ora inizio'),
        text(' alle ore '),
        field('visita.oraFine', 'Ora fine'),
      ),
      p('left',
        text('per: '),
        field('visita.prestazioni', 'Prestazioni erogate'),
        text('.'),
      ),
      p('left'),
      p('left',
        text(
          "Il presente documento viene rilasciato su richiesta dell'interessato/a " +
          'per gli usi consentiti dalla legge (es. giustificazione per motivi di ' +
          'lavoro o studio).',
        ),
      ),
      p('left'),
      p('left',
        text('Luogo e data: '),
        field('studio.indirizzo', 'Indirizzo studio'),
        text(', '),
        field('documento.dataEmissione', 'Data di emissione'),
      ),
      p('left'),
      p('left'),
      p('right', text('Firma e timbro del professionista', bold)),
      p('right'),
      p('right', text('___________________________')),
    ],
  };
}
