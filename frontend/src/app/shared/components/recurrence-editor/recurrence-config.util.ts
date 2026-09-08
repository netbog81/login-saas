/**
 * Utilità della configurazione di ricorrenza, condivise fra il dialog
 * operatori e il dialog palestra.
 *
 * PERCHÉ QUI E NON DENTRO IL COMPONENTE: la conversione verso il payload
 * GraphQL non è una responsabilità di un dumb component (che non conosce il
 * backend), ma nemmeno di un solo dialog — la fanno entrambi, allo stesso
 * modo, sul DTO `RepeatConfigInput` che il backend condivide già fra i due
 * flussi. Duplicarla significherebbe reintrodurre da capo il disallineamento
 * che questa estrazione serve a chiudere.
 */

import {
  RepeatConfig,
  MonthlyRule,
  RecurringType,
  RecurringEndType,
  MonthlyMode,
} from '../../../models/appointment.model';

/** Configurazione di partenza, identica nei due dialog. */
export const DEFAULT_REPEAT_CONFIG: RepeatConfig = {
  type: 'weekly',
  interval: 1,
  selectedDays: [],
  endType: 'after',
  occurrences: 4,
  untilDate: '',
  monthlyMode: 'day_of_month',
  monthlyRules: [],
};

/** Posizioni selezionabili per una fascia mensile. */
export const MONTHLY_ORDINALS: { value: MonthlyRule['ordinal']; label: string }[] = [
  { value: 1, label: 'Primo' },
  { value: 2, label: 'Secondo' },
  { value: 3, label: 'Terzo' },
  { value: 4, label: 'Quarto' },
  { value: -1, label: 'Ultimo' },
];

/** Giorni per le fasce mensili: lunedì per primo, come in agenda. */
export const MONTHLY_WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'lunedì' },
  { value: 2, label: 'martedì' },
  { value: 3, label: 'mercoledì' },
  { value: 4, label: 'giovedì' },
  { value: 5, label: 'venerdì' },
  { value: 6, label: 'sabato' },
  { value: 0, label: 'domenica' },
];

/** Etichette dei pulsanti giorno della settimana (indice = getDay()). */
export const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

/**
 * 'YYYY-MM-DD' → Date locale (null se vuota o non valida).
 *
 * Con l'orario esplicito: `new Date('2026-08-29')` è mezzanotte UTC, che in
 * fuso negativo mostra il giorno prima. Le date della ricorrenza sono giorni
 * di calendario, non istanti.
 */
export function parseLocalDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Vero quando la mensile è impostata "per giorno della settimana". */
export function isMonthlyByWeekday(config: RepeatConfig): boolean {
  return config.type === 'monthly' && config.monthlyMode === 'day_of_week';
}

/**
 * Fascia mensile che descrive una data: es. il 5 agosto 2026 → "primo
 * mercoledì". Serve a proporre qualcosa di sensato quando l'utente passa
 * alla modalità "per giorno della settimana" partendo da un elenco vuoto.
 */
export function ruleFromDate(date: Date): MonthlyRule {
  const weekday = date.getDay();
  // Quante volte quel giorno della settimana è già passato nel mese.
  const ordinalIndex = Math.floor((date.getDate() - 1) / 7) + 1;
  const ordinal = (ordinalIndex >= 1 && ordinalIndex <= 4 ? ordinalIndex : -1) as MonthlyRule['ordinal'];
  return { ordinal, weekday };
}

/** Descrizione leggibile di una fascia mensile, per l'anteprima. */
export function describeMonthlyRule(rule: MonthlyRule): string {
  const ordinal = MONTHLY_ORDINALS.find(o => o.value === rule.ordinal)?.label ?? '';
  const weekday = MONTHLY_WEEKDAYS.find(w => w.value === rule.weekday)?.label ?? '';
  return `${ordinal.toLowerCase()} ${weekday}`;
}

/** Singolare/plurale dell'unità di intervallo. */
export function intervalLabel(config: RepeatConfig): string {
  switch (config.type) {
    case 'daily': return config.interval === 1 ? 'giorno' : 'giorni';
    case 'weekly': return config.interval === 1 ? 'settimana' : 'settimane';
    case 'monthly': return config.interval === 1 ? 'mese' : 'mesi';
    default: return '';
  }
}

/**
 * Stima di quante occorrenze genererà la regola, in italiano.
 *
 * È volutamente una STIMA ("circa N"): il conteggio esatto lo fa il backend
 * quando genera il piano, tenendo conto di festività e mesi corti. Qui serve
 * solo a far capire l'ordine di grandezza prima di confermare — che quattro
 * settimane sono quattro appuntamenti e non quaranta.
 */
export function occurrencesPreview(config: RepeatConfig, baseDate: string | null): string {
  let count = 0;
  const rules = config.monthlyRules ?? [];

  switch (config.endType) {
    case 'after':
      count = config.occurrences || 1;
      break;
    case 'until':
      if (config.untilDate && baseDate) {
        const start = new Date(baseDate);
        const end = new Date(config.untilDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        switch (config.type) {
          case 'daily':
            count = Math.ceil(days / config.interval);
            break;
          case 'weekly': {
            const weeks = Math.ceil(days / 7);
            count = Math.ceil(weeks / config.interval) * (config.selectedDays?.length || 1);
            break;
          }
          case 'monthly':
            count = Math.ceil(days / 30 / config.interval)
              * (isMonthlyByWeekday(config) ? Math.max(1, rules.length) : 1);
            break;
        }
      }
      break;
    case 'never':
      count = 52;
      break;
  }

  if (count <= 0) return '';

  // Con più fasce mensili il conteggio da solo non basta: l'utente deve
  // rileggere le regole impostate prima di salvare una serie lunga.
  if (isMonthlyByWeekday(config) && rules.length > 0) {
    const described = rules.map(describeMonthlyRule).join(', ');
    const ogni = config.interval === 1 ? 'ogni mese' : `ogni ${config.interval} mesi`;
    return `${described} ${ogni} (circa ${count} appuntamenti)`;
  }

  return `(circa ${count} appuntamenti)`;
}

/**
 * Da configurazione UI a payload GraphQL.
 *
 * Gli enum del backend viaggiano col NOME in maiuscolo, non col valore: è la
 * conversione che i due dialog facevano ciascuno per conto proprio.
 */
export function buildRepeatConfigPayload(config: RepeatConfig): RepeatConfig {
  const monthlyByWeekday = isMonthlyByWeekday(config) && (config.monthlyRules?.length ?? 0) > 0;

  return {
    type: config.type.toUpperCase() as RecurringType,
    interval: config.interval,
    selectedDays: config.type === 'weekly' ? config.selectedDays : undefined,
    endType: config.endType.toUpperCase() as RecurringEndType,
    occurrences: config.endType === 'after' ? config.occurrences : undefined,
    untilDate: config.endType === 'until' ? config.untilDate : undefined,
    monthlyMode: monthlyByWeekday ? ('DAY_OF_WEEK' as MonthlyMode) : undefined,
    monthlyRules: monthlyByWeekday ? config.monthlyRules : undefined,
  };
}
