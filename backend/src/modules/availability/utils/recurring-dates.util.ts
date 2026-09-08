/**
 * Calcolo delle date di una serie ricorrente.
 *
 * Funzione pura, estratta dal service perché è la parte che vale la pena
 * ragionare (e provare) da sola: niente repository, niente Nest, solo
 * stringhe 'YYYY-MM-DD'.
 *
 * ARITMETICA SULLE DATE — perché non si usa `new Date(...)` con i setter
 * locali: `new Date('2026-01-15')` è mezzanotte UTC, che in Italia è l'una
 * (o le due in ora legale) del mattino. Sommare mesi con `setMonth` lavora
 * in ora locale, quindi attraversando il cambio d'ora l'istante può tornare
 * al giorno precedente in UTC e `toISOString()` restituire una data sbagliata
 * di un giorno. Qui si lavora su interi anno/mese/giorno e si usa `Date.UTC`
 * solo per ricavare il giorno della settimana, che è immune al fuso.
 */

/** Ricorrenza come la riceve il backend (enum già normalizzati a minuscolo). */
export interface RecurrenceConfig {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  /** Giorni della settimana per la ricorrenza settimanale (0=Dom..6=Sab). */
  selectedDays?: number[];
  endType: 'never' | 'after' | 'until';
  occurrences?: number;
  /** 'YYYY-MM-DD' */
  untilDate?: string;
  /** Solo per type='monthly'. Assente = 'day_of_month' (comportamento storico). */
  monthlyMode?: 'day_of_month' | 'day_of_week';
  /** Fasce mensili, es. [{ordinal:1,weekday:3},{ordinal:-1,weekday:1}]. */
  monthlyRules?: { ordinal: number; weekday: number }[];
}

/** Tetto di sicurezza sulle occorrenze quando la serie non ha un "dopo N volte". */
export const MAX_RECURRING_OCCURRENCES = 52;

/** Orizzonte massimo: nessuna serie viene materializzata oltre due anni. */
const HORIZON_YEARS = 2;

interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

function parseYmd(dateStr: string): Ymd {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

function toKey({ y, m, d }: Ymd): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Giorno della settimana (0=Dom..6=Sab), calcolato in UTC per non dipendere dal fuso. */
function weekdayOf({ y, m, d }: Ymd): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addDays(date: Ymd, days: number): Ymd {
  const shifted = new Date(Date.UTC(date.y, date.m - 1, date.d + days));
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  };
}

/**
 * Somma mesi mantenendo il giorno del mese, con clamp all'ultimo giorno
 * disponibile: il 31 gennaio + 1 mese è il 28 (o 29) febbraio, non il 3 marzo
 * come farebbe l'overflow naturale di `Date`.
 *
 * Va sempre applicata al giorno di partenza, non al risultato precedente:
 * altrimenti il clamp si accumula e il 31 gennaio diventa 28 febbraio,
 * 28 marzo, 28 aprile invece di tornare al 31 dove il mese lo permette.
 */
function addMonthsClamped(date: Ymd, months: number): Ymd {
  const total = (date.y * 12 + (date.m - 1)) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) };
}

/**
 * Giorno del mese corrispondente a "l'<ordinal> <weekday> di <y>/<m>".
 * `ordinal` 1..4 conta dall'inizio, -1 indica l'ultimo del mese (che nei mesi
 * con cinque occorrenze NON coincide con il quarto). Restituisce null quando
 * la posizione non esiste in quel mese.
 */
export function nthWeekdayOfMonth(
  y: number,
  m: number,
  ordinal: number,
  weekday: number,
): number | null {
  const total = daysInMonth(y, m);

  if (ordinal === -1) {
    const lastWeekday = weekdayOf({ y, m, d: total });
    return total - ((lastWeekday - weekday + 7) % 7);
  }

  if (ordinal < 1 || ordinal > 4) return null;
  const firstWeekday = weekdayOf({ y, m, d: 1 });
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (ordinal - 1) * 7;
  return day <= total ? day : null;
}

/**
 * Date della serie, in ordine cronologico, `startDate` inclusa.
 *
 * La data di partenza è SEMPRE la prima occorrenza, anche quando non
 * corrisponde a nessuna fascia mensile: è lo slot che l'utente ha scelto
 * cliccando sul calendario, non un effetto collaterale della regola.
 *
 * @param today usato solo per l'orizzonte di due anni; iniettabile per prove.
 */
export function calculateRecurringDates(
  startDate: string,
  config: RecurrenceConfig,
  today: Date = new Date(),
): string[] {
  const start = parseYmd(startDate);
  const startKey = toKey(start);
  const interval = Math.max(1, config.interval || 1);

  const maxOccurrences =
    config.endType === 'after'
      ? Math.max(1, config.occurrences || 1)
      : MAX_RECURRING_OCCURRENCES;
  const untilKey =
    config.endType === 'until' && config.untilDate
      ? String(config.untilDate).slice(0, 10)
      : null;
  const horizonKey = toKey({
    y: today.getFullYear() + HORIZON_YEARS,
    m: today.getMonth() + 1,
    d: today.getDate(),
  });

  const useMonthlyRules =
    config.type === 'monthly' &&
    config.monthlyMode === 'day_of_week' &&
    (config.monthlyRules?.length ?? 0) > 0;

  return useMonthlyRules
    ? monthlyByWeekday(start, startKey, interval, config, maxOccurrences, untilKey, horizonKey)
    : sequential(start, interval, config, maxOccurrences, untilKey, horizonKey);
}

/**
 * Ricorrenza mensile "per giorno della settimana", una o più fasce per mese
 * (es. primo lunedì + ultimo mercoledì). Le fasce di uno stesso mese escono
 * in ordine di data, non nell'ordine in cui l'utente le ha inserite.
 */
function monthlyByWeekday(
  start: Ymd,
  startKey: string,
  interval: number,
  config: RecurrenceConfig,
  maxOccurrences: number,
  untilKey: string | null,
  horizonKey: string,
): string[] {
  // La data cliccata è sempre la prima occorrenza; le regole aggiungono le
  // successive. Il Set evita il doppione quando la data cliccata coincide già
  // con una delle fasce.
  const dates: string[] = [startKey];
  const seen = new Set<string>(dates);

  let cursor = { y: start.y, m: start.m };

  while (dates.length < maxOccurrences) {
    const daysThisMonth = (config.monthlyRules ?? [])
      .map(rule => nthWeekdayOfMonth(cursor.y, cursor.m, rule.ordinal, rule.weekday))
      .filter((day): day is number => day !== null)
      .sort((a, b) => a - b);

    for (const day of daysThisMonth) {
      const dayKey = toKey({ y: cursor.y, m: cursor.m, d: day });
      // Il mese di partenza contiene anche fasce già passate rispetto allo
      // slot scelto: la serie parte da lì in avanti, non retroattivamente.
      if (dayKey <= startKey) continue;
      if (untilKey && dayKey > untilKey) return dates;
      if (dayKey > horizonKey) return dates;
      if (seen.has(dayKey)) continue;

      dates.push(dayKey);
      seen.add(dayKey);
      if (dates.length >= maxOccurrences) return dates;
    }

    const next = addMonthsClamped({ ...cursor, d: 1 }, interval);
    cursor = { y: next.y, m: next.m };
    if (toKey({ ...cursor, d: 1 }) > horizonKey) break;
    if (untilKey && toKey({ ...cursor, d: 1 }) > untilKey) break;
  }

  return dates;
}

/**
 * Ricorrenza giornaliera, settimanale e mensile "stesso giorno del mese".
 * Riproduce la semantica storica del service (compreso il modo in cui la
 * settimanale con giorni selezionati applica l'intervallo), con l'aritmetica
 * resa immune al fuso orario e l'aggiunta di mesi che non sborda più nel mese
 * successivo per i giorni 29-31.
 */
function sequential(
  start: Ymd,
  interval: number,
  config: RecurrenceConfig,
  maxOccurrences: number,
  untilKey: string | null,
  horizonKey: string,
): string[] {
  const dates: string[] = [];
  const startWeekday = weekdayOf(start);
  let current = start;
  let count = 0;
  // La mensile conta i passi dall'ancora invece di sommare un mese alla
  // volta: altrimenti il clamp si accumula e una serie partita il 31 gennaio
  // diventerebbe 28 febbraio, 28 marzo, 28 aprile...
  let monthStep = 0;

  while (count < maxOccurrences) {
    const currentKey = toKey(current);
    if (untilKey && currentKey > untilKey) break;

    const weeklyWithDays =
      config.type === 'weekly' && (config.selectedDays?.length ?? 0) > 0;

    if (!weeklyWithDays || config.selectedDays!.includes(weekdayOf(current))) {
      dates.push(currentKey);
      count++;
    }

    switch (config.type) {
      case 'daily':
        current = addDays(current, interval);
        break;
      case 'weekly':
        if (weeklyWithDays) {
          // Un giorno alla volta per intercettare i giorni selezionati; al
          // ritorno sul giorno di partenza si saltano le settimane
          // dell'intervallo.
          current = addDays(current, 1);
          if (weekdayOf(current) === startWeekday && count > 0) {
            current = addDays(current, (interval - 1) * 7);
          }
        } else {
          current = addDays(current, interval * 7);
        }
        break;
      case 'monthly':
        monthStep++;
        current = addMonthsClamped(start, interval * monthStep);
        break;
    }

    if (toKey(current) > horizonKey) break;
  }

  return dates;
}
