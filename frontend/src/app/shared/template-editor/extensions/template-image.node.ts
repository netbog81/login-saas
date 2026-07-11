import { mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';

/**
 * Immagine libera nel corpo del documento (data-URL, viaggia col template
 * come il logo). Estende l'Image standard di TipTap con:
 *  - `widthPercent`: larghezza in % rispetto al foglio (10–100)
 *  - `layout`: posizione rispetto al testo
 *      'float-left'  → immagine a sinistra, testo che scorre a fianco
 *      'float-right' → immagine a destra, testo che scorre a fianco
 *      'block-left' | 'block-center' | 'block-right' → blocco a sé
 *
 * Lo stile è inline nel renderHTML: identico nell'editor e nella stampa
 * (docToHtml usa le stesse estensioni).
 */
export const TemplateImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widthPercent: { default: 50 },
      layout: { default: 'block-center' },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const width = Number(node.attrs['widthPercent']) || 50;
    const layout = String(node.attrs['layout'] ?? 'block-center');

    let style = `width:${width}%;height:auto;max-width:100%;`;
    switch (layout) {
      case 'float-left':
        style += 'float:left;margin:0 8mm 4mm 0;';
        break;
      case 'float-right':
        style += 'float:right;margin:0 0 4mm 8mm;';
        break;
      case 'block-left':
        style += 'display:block;margin:4mm auto 4mm 0;';
        break;
      case 'block-right':
        style += 'display:block;margin:4mm 0 4mm auto;';
        break;
      default: // block-center
        style += 'display:block;margin:4mm auto;';
    }

    return ['img', mergeAttributes(HTMLAttributes, { style })];
  },
});
