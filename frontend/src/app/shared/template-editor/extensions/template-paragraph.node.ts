import { mergeAttributes } from '@tiptap/core';
import Paragraph from '@tiptap/extension-paragraph';

/**
 * Paragrafo con sfondo colorato a tutta larghezza ("banda", es. la fascia
 * verde di intestazione tabella in una fattura). `bgColor` null = paragrafo
 * normale senza sfondo.
 */
export const TemplateParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      bgColor: { default: null },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const bg = node.attrs['bgColor'] as string | null;
    const extra = bg
      ? { style: `background:${bg};padding:1.5mm 3mm;border-radius:1mm;` }
      : {};
    return ['p', mergeAttributes(HTMLAttributes, extra), 0];
  },
});
