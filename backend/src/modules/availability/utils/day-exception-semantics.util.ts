import {
  AvailabilityException,
  ExceptionType,
} from '../entities/availability-exception.entity';

/**
 * Semantica delle eccezioni di un giorno, in un posto solo.
 *
 * Prima del 2026-07-31 questa logica era ricopiata in 8 punti (calcolo
 * calendario, free-blocks V3, rebuild cache, check prenotazione fisio,
 * marcatura conflitti, rivalidazione conflitti, ricerca sostituti palestra).
 * Ogni nuova regola andava replicata a mano e bastava dimenticarne una
 * perché la disponibilità comparisse in una vista e non nell'altra. Con
 * l'aggiunta delle disponibilità straordinarie (EXTRA) il rischio è
 * diventato concreto: qui la regola è scritta una volta e importata.
 *
 * Le tre semantiche, in ordine di applicazione:
 *
 *  1. assenza a GIORNATA INTERA (tipo != modified/extra, senza orari)
 *     → il giorno non ha alcuna disponibilità, punto.
 *  2. MODIFIED con orari → SOSTITUISCE il template: l'operatore lavora
 *     solo dentro quella finestra.
 *  3. assenza a FASCIA (tipo != modified/extra, con orari) → SOTTRAE dalle
 *     bande, spezzandole (08–13 con assenza 10–11 → 08–10 + 11–13).
 *  4. EXTRA con orari → SI SOMMA alle bande (disponibilità straordinaria:
 *     l'operatore normalmente non lavorerebbe, quel giorno sì).
 *
 * Sulla sovrapposizione EXTRA/template: l'inserimento accetta la finestra
 * per intero come l'ha digitata l'utente (es. 14–18 con template 14–16) e
 * avvisa della parte già coperta. Nel calcolo, però, l'EXTRA contribuisce
 * solo con la porzione NON già disponibile (16–18): così non nascono bande
 * sovrapposte — che in `availability_cache` collidono sulla chiave
 * (operatorId, availableDate, startTime) — e il comportamento delle bande
 * template preesistenti resta identico a prima.
 */

/** Fascia oraria in minuti dalla mezzanotte. */
export interface DayBand {
  start: number;
  end: number;
  /** 'pattern' | 'exception' — informativo, esposto nello slot. */
  source?: string;
  sourceId?: string;
}

export interface DayExceptionClassification {
  /** Assenza a giornata intera: l'operatore non lavora. */
  wholeDayBlocked: boolean;
  /**
   * Cambio orario (MODIFIED): SOSTITUISCE il template del giorno.
   *
   * È una LISTA, non una sola finestra: un cambio orario può essere a turno
   * spezzato ("quel lunedì fa 07–15 e 16–20"). Fino al 2026-07 il codice
   * usava un `.find()` e onorava solo la prima riga, ignorando le altre
   * senza dirlo — con la UI di cambio orario sarebbe diventato un bug
   * quotidiano.
   */
  modifiedWindows: AvailabilityException[];
  /** Assenze a fascia oraria: sottraggono dalle bande. */
  blockWindows: AvailabilityException[];
  /** Disponibilità straordinarie: si sommano alle bande. */
  extraWindows: AvailabilityException[];
}

/** Normalizza "HH:MM:SS" / "H:M" a "HH:MM" per confronti omogenei. */
export function normalizeTime(time: string): string {
  const parts = time.split(':');
  return `${parts[0].padStart(2, '0')}:${(parts[1] ?? '00').padStart(2, '0')}`;
}

export function hhmmToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

export function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** True se [aStart,aEnd) e [bStart,bEnd) si sovrappongono (estremi esclusi). */
export function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return (
    normalizeTime(aStart) < normalizeTime(bEnd) &&
    normalizeTime(bStart) < normalizeTime(aEnd)
  );
}

/** Eccezione a giornata intera (nessun orario) di tipo bloccante. */
function isWholeDayBlock(ex: AvailabilityException): boolean {
  return (
    ex.exceptionType !== ExceptionType.MODIFIED &&
    ex.exceptionType !== ExceptionType.EXTRA &&
    (!ex.startTime || !ex.endTime)
  );
}

/**
 * Divide le eccezioni di un giorno nelle quattro categorie semantiche.
 * Le righe EXTRA senza orari vengono ignorate: una disponibilità
 * straordinaria senza estremi non ha significato (il service ne impedisce
 * la creazione, questo è il presidio sui dati legacy).
 */
export function classifyDayExceptions(
  dayExceptions: AvailabilityException[],
): DayExceptionClassification {
  return {
    wholeDayBlocked: dayExceptions.some(isWholeDayBlock),
    modifiedWindows: dayExceptions.filter(
      (e) => e.exceptionType === ExceptionType.MODIFIED && e.startTime && e.endTime,
    ),
    blockWindows: dayExceptions.filter(
      (e) =>
        e.exceptionType !== ExceptionType.MODIFIED &&
        e.exceptionType !== ExceptionType.EXTRA &&
        e.startTime &&
        e.endTime,
    ),
    extraWindows: dayExceptions.filter(
      (e) => e.exceptionType === ExceptionType.EXTRA && e.startTime && e.endTime,
    ),
  };
}

/**
 * Sottrae un intervallo da un elenco di fasce, spezzandole se l'intervallo
 * cade in mezzo. I metadati della fascia (source/sourceId) si propagano ai
 * segmenti risultanti.
 */
export function subtractWindow<T extends DayBand>(
  bands: T[],
  window: { start: number; end: number },
): T[] {
  const result: T[] = [];
  for (const band of bands) {
    if (window.end <= band.start || window.start >= band.end) {
      result.push(band);
      continue;
    }
    if (window.start > band.start) {
      result.push({ ...band, end: window.start });
    }
    if (window.end < band.end) {
      result.push({ ...band, start: window.end });
    }
  }
  return result;
}

export function subtractWindows<T extends DayBand>(
  bands: T[],
  windows: { start: number; end: number }[],
): T[] {
  let result = bands;
  for (const w of windows) {
    result = subtractWindow(result, w);
  }
  return result;
}

/** Converte le finestre-eccezione in intervalli di minuti (scarta le incomplete). */
export function toMinuteWindows(
  exceptions: AvailabilityException[],
): { start: number; end: number }[] {
  return exceptions
    .filter((e) => e.startTime && e.endTime)
    .map((e) => ({
      start: hhmmToMinutes(e.startTime!),
      end: hhmmToMinutes(e.endTime!),
    }));
}

/**
 * Unisce intervalli sovrapposti o contigui in un elenco ordinato e disgiunto.
 * Le fasce ADIACENTI si fondono (07–15 e 15–20 → 07–20): senza questo, un
 * appuntamento a cavallo delle 15 risulterebbe scoperto pur essendo dentro
 * l'orario continuo dell'operatore.
 */
export function mergeIntervals(
  intervals: { start: number; end: number }[],
): { start: number; end: number }[] {
  const sorted = [...intervals]
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/** True se [start,end] sta interamente dentro uno degli intervalli. */
function isContainedIn(
  intervals: { start: number; end: number }[],
  start: number,
  end: number,
): boolean {
  return mergeIntervals(intervals).some((i) => start >= i.start && end <= i.end);
}

/**
 * Applica a un giorno l'intera semantica delle eccezioni.
 *
 * `baseBands` sono le fasce da template (già filtrate sul giorno). Il
 * risultato è l'elenco definitivo delle fasce disponibili, ordinato per
 * orario di inizio e privo di sovrapposizioni.
 */
export function applyDayExceptions(
  baseBands: DayBand[],
  cls: DayExceptionClassification,
): DayBand[] {
  if (cls.wholeDayBlocked) return [];

  const blockMinutes = toMinuteWindows(cls.blockWindows);

  // 1. Bande di partenza: un cambio orario SOSTITUISCE il template del
  //    giorno. Più righe = turno spezzato, tutte valide insieme.
  let bands: DayBand[] =
    cls.modifiedWindows.length > 0
      ? cls.modifiedWindows.map((m) => ({
          start: hhmmToMinutes(m.startTime!),
          end: hhmmToMinutes(m.endTime!),
          source: 'exception',
          sourceId: m.id,
        }))
      : [...baseBands];

  // 2. Sottrae le assenze a fascia.
  bands = subtractWindows(bands, blockMinutes);

  // 3. Somma le disponibilità straordinarie, ciascuna decurtata di quanto
  //    è già disponibile (template/MODIFIED o EXTRA precedenti) e delle
  //    assenze a fascia. Le EXTRA sono ordinate per orario così il risultato
  //    non dipende dall'ordine di inserimento a DB.
  const extras = [...cls.extraWindows].sort((a, b) =>
    normalizeTime(a.startTime!).localeCompare(normalizeTime(b.startTime!)),
  );
  for (const extra of extras) {
    let segments: DayBand[] = [
      {
        start: hhmmToMinutes(extra.startTime!),
        end: hhmmToMinutes(extra.endTime!),
        source: 'exception',
        sourceId: extra.id,
      },
    ];
    segments = subtractWindows(segments, blockMinutes);
    segments = subtractWindows(
      segments,
      bands.map((b) => ({ start: b.start, end: b.end })),
    );
    bands.push(...segments);
  }

  return bands
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
}

/**
 * Prima eccezione che mette in conflitto un appuntamento, o null.
 *
 * Predicato condiviso da marcatura conflitti, rivalidazione e check di
 * prenotazione. Una disponibilità straordinaria che copre interamente
 * l'appuntamento lo mette al riparo: è il caso "mercoledì pomeriggio
 * normalmente libero, oggi l'operatore c'è". Non serve confrontarla con le
 * assenze, perché l'inserimento di una EXTRA sovrapposta a un'assenza è
 * già rifiutato a monte.
 */
export function findBlockingException(
  exceptions: AvailabilityException[],
  startTime: string,
  endTime: string,
): AvailabilityException | null {
  if (isCoveredByExtraAvailability(exceptions, startTime, endTime)) return null;

  // 1. Assenze: giornata intera, oppure fascia che tocca l'appuntamento.
  //    Vanno valutate PRIMA del cambio orario — se l'operatore è in ferie
  //    quello è il motivo da riportare, non "fuori dal nuovo orario".
  const absence = exceptions.find((ex) => {
    if (
      ex.exceptionType === ExceptionType.EXTRA ||
      ex.exceptionType === ExceptionType.MODIFIED
    ) {
      return false;
    }
    if (!ex.startTime || !ex.endTime) return true;
    return timesOverlap(startTime, endTime, ex.startTime, ex.endTime);
  });
  if (absence) return absence;

  // 2. Cambio orario: l'operatore lavora SOLO dentro le nuove fasce, quindi
  //    l'appuntamento deve stare per intero in una di esse. Con turno
  //    spezzato (07–15 + 16–20) un appuntamento a cavallo del buco è in
  //    conflitto, ed è corretto: alle 15:30 non c'è.
  const modifiedWindows = exceptions.filter(
    (ex) => ex.exceptionType === ExceptionType.MODIFIED && ex.startTime && ex.endTime,
  );
  if (modifiedWindows.length > 0) {
    const fits = isContainedIn(
      toMinuteWindows(modifiedWindows),
      hhmmToMinutes(startTime),
      hhmmToMinutes(endTime),
    );
    if (!fits) return modifiedWindows[0];
  }

  return null;
}

/**
 * True se l'intervallo è interamente coperto dalle fasce disponibili del
 * giorno. Serve a stabilire se un appuntamento perde copertura quando si
 * rimuove un'eccezione (si confrontano le bande prima e dopo).
 */
export function isCoveredByBands(
  bands: { start: number; end: number }[],
  startMinutes: number,
  endMinutes: number,
): boolean {
  return isContainedIn(bands, startMinutes, endMinutes);
}

/**
 * True se l'appuntamento ricade interamente dentro una disponibilità
 * straordinaria: in quel caso il check sul template va saltato, altrimenti
 * il giorno verrebbe rifiutato come "non lavorativo".
 */
export function isCoveredByExtraAvailability(
  exceptions: AvailabilityException[],
  startTime: string,
  endTime: string,
): boolean {
  const aptStart = normalizeTime(startTime);
  const aptEnd = normalizeTime(endTime);
  return exceptions.some(
    (ex) =>
      ex.exceptionType === ExceptionType.EXTRA &&
      ex.startTime &&
      ex.endTime &&
      aptStart >= normalizeTime(ex.startTime) &&
      aptEnd <= normalizeTime(ex.endTime),
  );
}
