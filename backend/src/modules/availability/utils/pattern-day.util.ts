/**
 * Giorno-nel-pattern per una data, dato l'inizio e la durata del ciclo.
 *
 * Copia estratta dalla logica già presente in AvailabilityService e
 * GymPatternGroupService: serviva anche fuori da quelle classi (validazione
 * delle disponibilità straordinarie, che deve sapere quali fasce l'operatore
 * ha già da template e in palestra). Le due copie storiche restano dove sono
 * — allinearle è un refactor a sé — ma il comportamento è identico e va
 * tenuto tale.
 *
 * Convenzione dei pattern: 0 = Lunedì … 6 = Domenica.
 */
export function getPatternDay(
  date: Date,
  patternStart: Date,
  patternDuration: number,
): number {
  // Pattern settimanale: il giorno della settimana basta e si garantisce che
  // il Lunedì del template cada sempre di Lunedì nel calendario.
  if (patternDuration === 7) {
    const jsDayOfWeek = date.getDay(); // 0=Dom, 1=Lun, …, 6=Sab
    return jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
  }

  const normalizedPatternStart = new Date(
    patternStart.getFullYear(),
    patternStart.getMonth(),
    patternStart.getDate(),
  );
  const normalizedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  // Offset del giorno della settimana della patternStartDate, così una data
  // di inizio di mercoledì mappa sul mercoledì della prima settimana.
  const startDayOfWeek = patternStart.getDay();
  const startPatternDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const diffDays = Math.floor(
    (normalizedDate.getTime() - normalizedPatternStart.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return (
    (((diffDays + startPatternDay) % patternDuration) + patternDuration) %
    patternDuration
  );
}
