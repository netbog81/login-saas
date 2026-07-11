import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';

import { MergeFieldNode } from './extensions/merge-field.node';
import { TemplateImage } from './extensions/template-image.node';
import { TemplateRule } from './extensions/template-rule.node';
import { TemplateParagraph } from './extensions/template-paragraph.node';
import {
  DEFAULT_PAGE_SETTINGS,
  MergeFieldData,
  TemplateDocument,
  TemplatePageSettings,
} from './models/template-editor.model';

/**
 * Utility pure di rendering: dal documento TipTap JSON all'HTML di stampa.
 * Stesso motore per anteprima editor e documento finale → fedeltà 1:1.
 */

/** Estensioni condivise tra editor e rendering statico. */
export function templateExtensions() {
  return [
    // horizontalRule e paragraph sono sostituiti dalle varianti custom
    // (linea colorata/spessa, paragrafo con sfondo a banda)
    StarterKit.configure({ link: false, horizontalRule: false, paragraph: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    // Stili per selezione: dimensione carattere, colore, evidenziazione
    // (span inline con style → identici in editor e stampa)
    TextStyleKit,
    TemplateParagraph,
    TemplateRule,
    MergeFieldNode,
    TemplateImage,
  ];
}

interface TiptapJsonNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapJsonNode[];
  marks?: unknown[];
  [key: string]: unknown;
}

/**
 * Sostituisce i nodi mergeField con nodi testo contenenti il valore reale.
 * Se il valore manca, usa "—" (il documento resta leggibile e segnala il
 * dato assente senza rompere il layout).
 */
export function resolveMergeFields(
  doc: TemplateDocument,
  data: MergeFieldData,
): TemplateDocument {
  const walk = (node: TiptapJsonNode): TiptapJsonNode => {
    if (node.type === 'mergeField') {
      const field = String(node.attrs?.['field'] ?? '');
      const value = data[field];
      return {
        type: 'text',
        text: value != null && String(value).trim() !== '' ? String(value) : '—',
        // Il chip eredita grassetto/dimensione/colore applicati nell'editor:
        // il valore risolto li mantiene
        ...(node.marks?.length ? { marks: node.marks } : {}),
      };
    }
    if (Array.isArray(node.content)) {
      return { ...node, content: node.content.map(walk) };
    }
    return { ...node };
  };
  return walk(doc as TiptapJsonNode) as TemplateDocument;
}

/** Converte il documento TipTap JSON in HTML (body del documento). */
export function docToHtml(doc: TemplateDocument): string {
  return generateHTML(doc as never, templateExtensions());
}

/**
 * Reset della pagina di stampa.
 *
 * L'editor vive dentro l'app Angular e parte quindi da `styles.scss`
 * (Tailwind Preflight + `* { margin:0; padding:0; box-sizing:border-box }`).
 * La pagina di stampa è un `about:blank` in iframe: parte dalla sola
 * stylesheet dello user-agent. Senza questo reset le due superfici partono
 * da basi diverse e divergono su tutto ciò che il CSS condiviso non tocca
 * (margini/peso degli heading, rientro delle liste, display delle immagini…).
 */
const PRINT_RESET_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  h1, h2, h3, h4, h5, h6,
  p, blockquote, figure, pre, ul, ol, dl, dd, hr { margin: 0; padding: 0; }
  h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
  ul, ol { list-style: none; }
  img, svg { display: block; max-width: 100%; height: auto; }
  b, strong { font-weight: bolder; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1em; }
`;

/**
 * Regole di contenuto del documento: **unica fonte di verità**, condivisa tra
 * la superficie di editing (scope `.tpl-page`) e la pagina di stampa
 * (scope `body`). Ogni proprietà che influenza il layout è dichiarata
 * esplicitamente: nulla è lasciato ai default dell'user-agent o di Preflight,
 * perché le due superfici non li condividono.
 *
 * Usa `em` e `var(--tpl-accent)` — mai valori risolti — così la stessa
 * stringa vale per entrambe.
 */
export function templateContentCss(scope: string): string {
  const S = scope;
  return `
  ${S} { word-wrap: break-word; font-variant-ligatures: none; font-feature-settings: "liga" 0; }

  /* Parità con il CSS che TipTap inietta su .ProseMirror: senza \`break-spaces\`
     gli spazi multipli e gli allineamenti fatti a spazi collassano in stampa.
     Solo sui blocchi di testo: sullo scope colpirebbe anche gli a-capo del
     markup fra logo e corpo, rendendoli righe vuote. */
  ${S} p, ${S} h1, ${S} h2, ${S} h3,
  ${S} ul, ${S} ol, ${S} li, ${S} blockquote { white-space: break-spaces; }

  ${S} p { margin: 0 0 0.6em 0; }
  /* Paragrafo vuoto = riga vuota, come nell'editor (dove prosemirror-view
     inserisce un <br class="ProseMirror-trailingBreak">). Senza questo in
     stampa <p></p> ha altezza zero e il ritmo verticale si comprime. */
  ${S} p:empty::before { content: '\\200b'; }

  /* font-weight/margin ereditati, non i default UA (bold + margine 1em):
     nell'editor un "Titolo" cambia solo dimensione e colore, e la stampa
     deve mostrare esattamente quello. */
  ${S} h1, ${S} h2, ${S} h3 {
    color: var(--tpl-accent);
    line-height: 1.25;
    font-weight: inherit;
    margin: 0;
  }
  ${S} h1 { font-size: 1.7em; }
  ${S} h2 { font-size: 1.4em; }
  ${S} h3 { font-size: 1.2em; }

  ${S} ul { list-style: disc; }
  ${S} ol { list-style: decimal; }
  ${S} ul, ${S} ol { margin: 0 0 0.6em 0; padding-left: 1.6em; }
  ${S} li { margin: 0; }
  ${S} li > p { margin: 0; }

  ${S} blockquote {
    border-left: 3px solid var(--tpl-accent);
    margin: 0.6em 0;
    padding: 0 0 0 10px;
  }
  ${S} hr {
    height: 0;
    border: none;
    border-top: 1px solid var(--tpl-accent);
    margin: 1em 0;
  }
  ${S} pre { margin: 0 0 0.6em 0; }
  ${S} img { display: block; max-width: 100%; height: auto; }
  ${S} strong, ${S} b { font-weight: bolder; }

  /* Chip visibili solo nell'anteprima template (nel documento finale i
     merge field sono già sostituiti dal valore reale) */
  ${S} .merge-field-chip {
    background: #e8eaf6;
    border: 1px solid #9fa8da;
    border-radius: 10px;
    padding: 0 6px;
    white-space: nowrap;
  }
`;
}

/** Dichiarazioni del foglio (font, colori, variabili) — comuni alle due superfici. */
export function templateSheetCss(s: TemplatePageSettings): string {
  return `
    --tpl-accent: ${s.accentColor};
    font-family: ${s.fontFamily};
    font-size: ${s.fontSize}pt;
    color: ${s.textColor};
    line-height: 1.5;
  `;
}

/** `justify-content` corrispondente all'allineamento non-float del logo. */
export const LOGO_JUSTIFY: Record<string, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

/**
 * Stile del blocco logo. Condiviso con l'editor (`logoBlockStyle`).
 * Allineamento via flex e non via `text-align`: l'`<img>` è `display:block`
 * (vedi templateContentCss), quindi `text-align` non lo sposterebbe.
 */
export function logoBlockCss(s: TemplatePageSettings): Record<string, string> {
  if (s.logoAlignment === 'float-left') return { float: 'left', margin: '0 8mm 4mm 0' };
  if (s.logoAlignment === 'float-right') return { float: 'right', margin: '0 0 4mm 8mm' };
  return {
    display: 'flex',
    'justify-content': LOGO_JUSTIFY[s.logoAlignment] ?? 'flex-start',
    'margin-bottom': '8mm',
  };
}

/** Blocco logo (se presente) per la pagina di stampa. */
function logoHtml(s: TemplatePageSettings): string {
  if (!s.logoDataUrl) return '';
  const style = Object.entries(logoBlockCss(s))
    .map(([k, v]) => `${k}:${v};`)
    .join('');
  return `<div style="${style}"><img src="${s.logoDataUrl}" alt="" style="height:${s.logoHeight}px;max-width:100%;" /></div>`;
}

/**
 * Costruisce la pagina HTML completa pronta per la stampa (A4).
 * `bodyHtml` è l'output di docToHtml (con i merge field già risolti per il
 * documento finale, o come chip per l'anteprima template).
 */
export function buildPrintHtml(
  bodyHtml: string,
  settings: Partial<TemplatePageSettings> | null | undefined,
  title: string,
): string {
  const s: TemplatePageSettings = { ...DEFAULT_PAGE_SETTINGS, ...(settings ?? {}) };
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page {
    size: A4;
    margin: ${s.marginTop}mm ${s.marginRight}mm ${s.marginBottom}mm ${s.marginLeft}mm;
  }
${PRINT_RESET_CSS}
  html, body {
    margin: 0;
    padding: 0;
    background: ${s.backgroundColor};
    /* Senza questo il browser non stampa sfondi: sparirebbero le bande
       colorate dei paragrafi, le evidenziazioni e il fondo del foglio. */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body { ${templateSheetCss(s)} }
${templateContentCss('body')}
</style>
</head>
<body>
${logoHtml(s)}
${bodyHtml}
</body>
</html>`;
}

/**
 * Stampa un HTML completo tramite iframe nascosto (niente popup blocker).
 * Il browser apre il dialog di stampa: l'utente stampa o salva come PDF.
 */
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const cleanup = () => {
    // Rimozione ritardata: alcuni browser annullano la stampa se l'iframe
    // viene staccato mentre il dialog è ancora aperto.
    setTimeout(() => iframe.remove(), 60_000);
  };

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('Impossibile preparare il documento per la stampa');
  }
  doc.open();
  doc.write(html);
  doc.close();

  // Attende il caricamento delle risorse (logo data-URL è immediato, ma
  // load garantisce layout completo prima del print)
  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      cleanup();
    }
  };
  if (doc.readyState === 'complete') {
    setTimeout(triggerPrint, 50);
  } else {
    win.addEventListener('load', () => setTimeout(triggerPrint, 50));
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
