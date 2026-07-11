/**
 * Modelli del template-editor riusabile.
 *
 * NOTA RIUSABILITÀ: questa cartella (shared/template-editor) è
 * deliberatamente autocontenuta — dipende solo da Angular Material e
 * TipTap, MAI da servizi/modelli del clinico. Dopo il collaudo verrà
 * estratta in un pacchetto npm condiviso con accounting.
 */

/** Documento TipTap/ProseMirror in formato JSON. */
export type TemplateDocument = Record<string, unknown>;

/** Definizione di un campo dinamico inseribile nel template. */
export interface MergeFieldDef {
  /** Chiave usata nel nodo mergeField e nella mappa dati (es. "paziente.nomeCompleto"). */
  key: string;
  /** Etichetta mostrata nel chip dentro l'editor. */
  label: string;
  /** Gruppo di appartenenza per il pannello laterale (es. "Paziente"). */
  group: string;
  /** Valore di esempio usato nell'anteprima di stampa. */
  example?: string;
}

/** Valori con cui sostituire i campi dinamici alla generazione. */
export type MergeFieldData = Record<string, string | null | undefined>;

/** Impostazioni di pagina del documento (logo, colori, font, margini). */
export interface TemplatePageSettings {
  /** Logo come data-URL (viaggia dentro il template, nessuno storage esterno). */
  logoDataUrl?: string | null;
  /** Altezza logo in px (larghezza proporzionale). */
  logoHeight: number;
  /**
   * Posizione del logo: blocco a sé ('left'|'center'|'right', il testo va
   * sotto) oppure affiancato al testo ('float-left'|'float-right', il testo
   * scorre a fianco — layout carta intestata).
   */
  logoAlignment: 'left' | 'center' | 'right' | 'float-left' | 'float-right';
  /** Stack CSS del font. */
  fontFamily: string;
  /** Dimensione base del testo in pt. */
  fontSize: number;
  textColor: string;
  /** Colore di titoli/intestazioni. */
  accentColor: string;
  /** Colore di sfondo del foglio. */
  backgroundColor: string;
  /** Margini pagina in mm. */
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

export const DEFAULT_PAGE_SETTINGS: TemplatePageSettings = {
  logoDataUrl: null,
  logoHeight: 64,
  logoAlignment: 'left',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 11,
  textColor: '#1a1a1a',
  accentColor: '#1a1a1a',
  backgroundColor: '#ffffff',
  marginTop: 20,
  marginRight: 18,
  marginBottom: 20,
  marginLeft: 18,
};

export const TEMPLATE_FONT_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Arial / Helvetica', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
];
