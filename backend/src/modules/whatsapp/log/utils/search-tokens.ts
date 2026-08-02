/**
 * Tokenizzazione per la ricerca sul nome paziente nei log WhatsApp.
 *
 * `patientName` è denormalizzato come "Cognome Nome": un ILIKE sulla stringa
 * intera trova solo chi digita nell'ordine giusto. Spezzando in parole e
 * richiedendole tutte (AND) la ricerca diventa ordine-indipendente, coerente
 * col resto del sistema (registry global-search, anagrafiche accounting).
 *
 * I token contengono solo caratteri alfanumerici: ogni altro carattere è un
 * separatore, quindi `%` e `_` non possono finire nel pattern come wildcard.
 */
export function tokenizeSearch(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);
}

/**
 * Espressione SQL che "incolla" una colonna testuale togliendo separatori e
 * punteggiatura ("d'angelo luca" → "dangeloluca"), per far matchare i cognomi
 * con apostrofo o composti digitati tutti attaccati.
 */
export function gluedColumnSql(column: string): string {
  return `regexp_replace(${column}, '[^[:alnum:]]', '', 'g')`;
}
