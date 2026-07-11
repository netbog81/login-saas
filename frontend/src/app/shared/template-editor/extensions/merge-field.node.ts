import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Nodo TipTap atomico per i campi dinamici ("merge field").
 *
 * Nel documento JSON viene salvato come
 * `{ type: 'mergeField', attrs: { field: 'paziente.nomeCompleto', label: 'Nome paziente' } }`.
 * Nell'editor è renderizzato come chip non editabile; alla generazione del
 * documento viene sostituito dal valore reale (vedi template-render.util).
 */
export const MergeFieldNode = Node.create({
  name: 'mergeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  // Il chip accetta i mark di formattazione (grassetto, dimensione,
  // colore): alla generazione vengono trasferiti sul valore risolto
  marks: '_',

  addAttributes() {
    return {
      field: { default: '' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-merge-field]',
        getAttrs: (el) => ({
          field: (el as HTMLElement).getAttribute('data-merge-field') ?? '',
          label: (el as HTMLElement).textContent ?? '',
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-merge-field': node.attrs['field'],
        class: 'merge-field-chip',
        contenteditable: 'false',
      }),
      `${node.attrs['label'] || node.attrs['field']}`,
    ];
  },
});
