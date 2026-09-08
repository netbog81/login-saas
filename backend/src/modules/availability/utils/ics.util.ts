/**
 * Generazione di un calendario iCalendar (RFC 5545).
 *
 * Funzione pura: entra una lista di eventi, esce il testo del .ics. Nessuna
 * dipendenza da Nest o dai repository, così le regole di formato — che sono
 * fiscali quanto un tracciato telematico, se sbagli una riga il calendario
 * dell'operatore semplicemente non si aggiorna — si possono provare da sole.
 *
 * FUSO ORARIO: gli appuntamenti sono ore locali italiane. Invece di dichiarare
 * un VTIMEZONE completo (che va tenuto allineato alle regole DST) si convertono
 * gli istanti in UTC e si usa il formato `...Z`, che ogni client interpreta
 * senza ambiguità. La conversione tiene conto dell'ora legale italiana.
 */

/** Un evento del feed, con i dati già decisi da chi lo compone. */
export interface IcsEvent {
  /** Identificatore stabile nel tempo: lo stesso appuntamento deve avere sempre lo stesso UID. */
  uid: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:mm' */
  startTime: string;
  /** 'HH:mm' */
  endTime: string;
  summary: string;
  description?: string;
  location?: string;
  /** Ultima modifica dell'appuntamento: i client la usano per capire cosa è cambiato. */
  lastModified?: Date;
  /** Incrementa a ogni modifica dell'evento (RFC 5545 §3.8.7.4). */
  sequence?: number;
  /** `true` per un appuntamento disdetto: resta nel feed ma sparisce dal calendario. */
  cancelled?: boolean;
}

export interface IcsCalendarOptions {
  /** Nome del calendario mostrato dal client al momento della sottoscrizione. */
  calendarName: string;
  /** Dominio usato per gli UID: deve restare stabile nel tempo. */
  uidDomain: string;
  /**
   * Suggerimento di frequenza di aggiornamento. I client lo trattano come tale
   * e non come un obbligo: iOS ricontrolla ogni 15-60 minuti, Google può
   * arrivare a 24 ore. Va detto all'utente, non promesso.
   */
  refreshIntervalMinutes?: number;
}

/** Regole DST europee: ultima domenica di marzo → ultima domenica di ottobre. */
function lastSundayUtc(year: number, month: number, hourUtc: number): number {
  // month è 0-based. Giorno 0 del mese successivo = ultimo giorno del mese.
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const shiftToSunday = lastDay.getUTCDay();
  return Date.UTC(year, month + 1, 0 - shiftToSunday, hourUtc, 0, 0);
}

/**
 * Offset dell'ora italiana rispetto a UTC, in minuti, per un dato istante
 * locale: +120 in ora legale, +60 altrimenti.
 *
 * Il confronto avviene sull'istante UTC che corrisponderebbe all'ora legale
 * (CEST): è il criterio con cui si decide da che parte del cambio si sta,
 * senza dover interrogare il database dei fusi.
 */
function romeOffsetMinutes(year: number, month: number, day: number, hour: number, minute: number): number {
  const asCest = Date.UTC(year, month - 1, day, hour - 2, minute);
  const dstStart = lastSundayUtc(year, 2, 1);  // ultima domenica di marzo, 01:00 UTC
  const dstEnd = lastSundayUtc(year, 9, 1);    // ultima domenica di ottobre, 01:00 UTC
  return asCest >= dstStart && asCest < dstEnd ? 120 : 60;
}

/** Da data+ora locale italiana al formato UTC di iCalendar (`20260819T083000Z`). */
export function toIcsUtcStamp(date: string, time: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const [hh, mm] = time.slice(0, 5).split(':').map(Number);
  const offset = romeOffsetMinutes(y, m, d, hh, mm);
  const utc = new Date(Date.UTC(y, m - 1, d, hh, mm) - offset * 60_000);
  return formatUtc(utc);
}

/** Da Date assoluta al formato UTC di iCalendar. */
export function formatUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Escape del testo secondo RFC 5545 §3.3.11: backslash, punto e virgola,
 * virgola e a capo hanno significato nel formato e vanno protetti. Senza
 * questo, una nota che contiene una virgola spezza l'evento in due campi e il
 * client scarta l'intero calendario.
 */
export function escapeIcsText(value: string): string {
  return (value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Piega le righe a 75 ottetti (RFC 5545 §3.1). I client tolleranti reggono
 * righe lunghe, altri no: una descrizione lunga è il modo più comune di
 * ritrovarsi con un feed che "non si vede" senza spiegazioni.
 *
 * Il taglio è sugli ottetti UTF-8, non sui caratteri: spezzare in mezzo a una
 * lettera accentata produrrebbe byte invalidi.
 */
export function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Arretra finché non si è su un confine di carattere UTF-8.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74; // le righe di continuazione iniziano con uno spazio
  }
  return parts.join('\r\n ');
}

/** Compone il testo completo del calendario. */
export function buildIcsCalendar(events: IcsEvent[], options: IcsCalendarOptions): string {
  const now = formatUtc(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Curandis//Agenda Operatore//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
    'X-WR-TIMEZONE:Europe/Rome',
  ];

  if (options.refreshIntervalMinutes) {
    // Due nomi per la stessa cosa: REFRESH-INTERVAL è lo standard (RFC 7986),
    // X-PUBLISHED-TTL è quello che guardano Outlook e diversi client.
    lines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${options.refreshIntervalMinutes}M`);
    lines.push(`X-PUBLISHED-TTL:PT${options.refreshIntervalMinutes}M`);
  }

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}@${options.uidDomain}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${toIcsUtcStamp(event.date, event.startTime)}`);
    lines.push(`DTEND:${toIcsUtcStamp(event.date, event.endTime)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    lines.push(`SEQUENCE:${event.sequence ?? 0}`);
    // Un appuntamento disdetto resta nel feed come CANCELLED invece di
    // sparire: se sparisse e basta, i client che aggiornano per differenza
    // continuerebbero a mostrarlo all'operatore.
    lines.push(`STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`);
    if (event.lastModified) lines.push(`LAST-MODIFIED:${formatUtc(event.lastModified)}`);
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // CRLF fra le righe: la RFC lo impone e alcuni client rifiutano il resto.
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
