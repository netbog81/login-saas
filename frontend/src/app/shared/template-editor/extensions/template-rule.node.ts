import { mergeAttributes } from '@tiptap/core';
import HorizontalRule from '@tiptap/extension-horizontal-rule';

/**
 * Linea separatrice con colore e spessore personalizzabili (es. le righe
 * colorate di una carta intestata/fattura). Senza attributi espliciti
 * eredita il colore "Titoli" del foglio via CSS (editor e stampa hanno la
 * stessa regola hr).
 */
export const TemplateRule = HorizontalRule.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      /** Colore linea (null = colore Titoli del foglio). */
      color: { default: null },
      /** Spessore in px. */
      thickness: { default: 1 },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const thickness = Number(node.attrs['thickness']) || 1;
    const color = node.attrs['color'] as string | null;
    // NB: niente `border:none` inline — azzererebbe anche il colore di
    // default che arriva dal CSS del foglio. Il reset è nel CSS.
    let style = `border-top-style:solid;border-top-width:${thickness}px;`;
    if (color) style += `border-top-color:${color};`;
    return ['hr', mergeAttributes(HTMLAttributes, { style })];
  },
});
