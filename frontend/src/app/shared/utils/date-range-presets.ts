/**
 * Periodi predefiniti per i filtri a intervallo di date.
 *
 * Le date sono stringhe 'YYYY-MM-DD' costruite dalle parti locali: le stesse
 * che il backend si aspetta nelle query per range e che TypeORM scrive nelle
 * colonne `date`. Niente `toISOString()`, che in Italia sposta la mezzanotte
 * al giorno prima.
 */

export interface DateRange {
  from: string;
  /**
   * Fine dell'intervallo, oppure stringa vuota per un intervallo APERTO:
   * "da `from` in poi", senza limite. È la convenzione già in uso nella
   * ricerca per paziente, e il backend la accetta omettendo `endDate`.
   */
  to: string;
}

/** Chiavi dei periodi offerti come pulsanti rapidi. */
export type DateRangePreset =
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'nextMonth'
  | 'next30Days'
  /** Intervallo aperto: da oggi in avanti, senza data di fine. */
  | 'fromToday';

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Oggi',
  thisWeek: 'Questa settimana',
  thisMonth: 'Questo mese',
  nextMonth: 'Prossimo mese',
  next30Days: 'Prossimi 30 giorni',
  fromToday: 'Da oggi in poi',
};

/** 'YYYY-MM-DD' dalle parti locali della data. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Intervallo corrispondente al periodo scelto.
 *
 * @param today iniettabile per rendere il calcolo verificabile.
 */
export function resolveDateRangePreset(
  preset: DateRangePreset,
  today: Date = new Date(),
): DateRange {
  switch (preset) {
    case 'today': {
      const iso = toIsoDate(today);
      return { from: iso, to: iso };
    }
    case 'thisWeek': {
      // Settimana italiana: lunedì → domenica.
      const dow = today.getDay(); // 0=Dom..6=Sab
      const monday = new Date(today);
      monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: toIsoDate(monday), to: toIsoDate(sunday) };
    }
    case 'thisMonth': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toIsoDate(first), to: toIsoDate(last) };
    }
    case 'nextMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return { from: toIsoDate(first), to: toIsoDate(last) };
    }
    case 'next30Days': {
      const end = new Date(today);
      end.setDate(today.getDate() + 30);
      return { from: toIsoDate(today), to: toIsoDate(end) };
    }
    case 'fromToday': {
      // Nessuna fine: mettere una data lontana ma finita (fra un anno, fra
      // cinque) taglierebbe in silenzio proprio gli appuntamenti che si
      // stanno cercando quando si chiede "tutto quello che resta".
      return { from: toIsoDate(today), to: '' };
    }
  }
}
