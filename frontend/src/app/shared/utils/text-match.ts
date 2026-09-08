/**
 * Confronto testuale tollerante per i filtri di ricerca.
 *
 * Il problema pratico: la segreteria cerca "riun" e vuole trovare "Riunione",
 * scrive "pausa pra" e vuole "Pausa pranzo", digita "perone" di fretta e
 * vorrebbe comunque trovare "Peroni". Un `includes()` sulla stringa intera
 * fallisce in tutti e tre i casi tranne il primo.
 *
 * Le regole, in ordine di severità:
 *  1. Si normalizza (minuscole, accenti via, punteggiatura via).
 *  2. Si spezza la ricerca in parole: TUTTE devono trovare posto nel testo,
 *     in qualsiasi ordine. Così "pranzo pausa" trova "Pausa pranzo".
 *  3. Ogni parola vale se è contenuta in una parola del testo (prefisso o
 *     pezzo interno: "riun" → "riunione").
 *  4. Solo se nemmeno questo basta, si accetta una parola quasi uguale, con
 *     una distanza di edit proporzionata alla lunghezza. Una tolleranza fissa
 *     renderebbe indistinguibili le parole corte: con 2 errori concessi
 *     "ana" pescherebbe mezzo dizionario.
 */

/** Minuscolo, senza accenti, con la punteggiatura ridotta a spazi. */
export function normalizeForSearch(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // toglie i segni diacritici
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Errori di battitura tollerati per una parola di quella lunghezza.
 * Fino a 4 lettere nessuno (troppo corta per distinguere un refuso da un'altra
 * parola), fino a 7 uno, oltre due.
 */
function allowedDistance(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

/**
 * Distanza di Levenshtein con uscita anticipata: appena supera `max` smette,
 * perché a quel punto la risposta è già "no".
 */
export function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  if (a === b) return true;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,        // cancellazione
        current[j - 1] + 1,     // inserimento
        previous[j - 1] + cost, // sostituzione
      );
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    // Tutta la riga è già oltre la soglia: nessun percorso può rientrare.
    if (rowMin > max) return false;
    previous = current;
  }
  return previous[b.length] <= max;
}

/**
 * Vero se `haystack` risponde alla ricerca `needle`.
 *
 * Una ricerca vuota risponde sempre sì: il filtro non deve nascondere niente
 * finché l'utente non ha scritto qualcosa.
 */
export function fuzzyMatches(haystack: string, needle: string): boolean {
  const query = normalizeForSearch(needle);
  if (!query) return true;

  const text = normalizeForSearch(haystack);
  if (!text) return false;

  const textWords = text.split(' ').filter(Boolean);

  return query.split(' ').filter(Boolean).every(term => {
    // Passaggio diretto: la parola cercata compare nel testo così com'è.
    if (text.includes(term)) return true;

    // Altrimenti si concede un refuso, confrontando parola per parola.
    const max = allowedDistance(term.length);
    if (max === 0) return false;
    return textWords.some(word => {
      // Confronto sul prefisso della parola: chi cerca "peron" non deve
      // essere penalizzato dalla coda di "peronispina" che non ha digitato.
      const candidate = word.length > term.length ? word.slice(0, term.length) : word;
      return editDistanceWithin(term, candidate, max);
    });
  });
}

/**
 * Vero se almeno uno dei campi risponde alla ricerca. Comodo quando la stessa
 * casella cerca in più posti (titolo, paziente, note).
 */
export function fuzzyMatchesAny(fields: (string | null | undefined)[], needle: string): boolean {
  const query = normalizeForSearch(needle);
  if (!query) return true;
  return fields.some(field => !!field && fuzzyMatches(field, needle));
}
