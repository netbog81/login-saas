/**
 * Matching testuale "a token" per i filtri client-side.
 *
 * Regola unica in tutto il sistema (registry, accounting, clinico): la query
 * viene spezzata in parole e OGNI parola deve comparire nell'haystack, in
 * qualunque ordine. Così "mario rossi" e "rossi mario" trovano entrambi
 * Mario Rossi, e i parziali continuano a funzionare ("ros mar").
 *
 * Prima ogni filtro faceva `nome.includes(query) || cognome.includes(query)`
 * con la query INTERA: con due parole non matchava mai nulla, e nei componenti
 * che ri-filtrano i risultati della ricerca remota azzerava anche le risposte
 * corrette del registry.
 */

/** Minuscole, no diacritici, punteggiatura → spazio, spazi compattati. */
export function normalizeForMatch(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Spezza la query in parole normalizzate. */
export function tokenizeQuery(query: string | undefined | null): string[] {
  const normalized = normalizeForMatch(query);
  return normalized ? normalized.split(' ') : [];
}

/**
 * `true` se OGNI token compare in almeno uno dei pezzi passati.
 *
 * I pezzi vengono concatenati in un unico haystack (nome + cognome + telefono
 * + …), così un token può matchare un pezzo e un altro token un pezzo diverso.
 * Il confronto è tentato anche sulla forma "incollata" (senza spazi né
 * apostrofi), per i cognomi tipo "D'Angelo"/"De Luca" digitati "dangelo"/
 * "deluca" e per i numeri di telefono scritti con spazi in anagrafica.
 */
export function matchesAllTokens(
  parts: Array<string | undefined | null>,
  tokens: string[],
): boolean {
  if (tokens.length === 0) return true;
  const haystack = normalizeForMatch(parts.filter(Boolean).join(' '));
  if (!haystack) return false;
  const glued = haystack.replace(/ /g, '');
  return tokens.every((t) => haystack.includes(t) || glued.includes(t));
}

/** Scorciatoia: tokenizza la query e verifica il match in un colpo solo. */
export function matchesSearch(
  parts: Array<string | undefined | null>,
  query: string | undefined | null,
): boolean {
  return matchesAllTokens(parts, tokenizeQuery(query));
}
