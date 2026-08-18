/**
 * True se [startTime, endTime] (HH:mm o HH:mm:ss) è interamente coperto
 * dalle fasce (espresse in minuti dalla mezzanotte). Le fasce
 * contigue/sovrapposte vengono fuse prima del confronto, come nel guard
 * assertWithinAvailability.
 *
 * Usata sia dalla revalidazione (per RIMUOVERE i flag TEMPLATE_CHANGE non
 * più reali) sia dalla detection (per AGGIUNGERE i flag mancanti): i due
 * lati devono usare lo stesso predicato, altrimenti un appuntamento può
 * oscillare tra marcato e non marcato.
 */
export function isIntervalCovered(
  startTime: string,
  endTime: string,
  bands: { start: number; end: number }[],
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const start = toMin(startTime);
  const end = toMin(endTime);
  if (end <= start || bands.length === 0) return false;

  const sorted = [...bands].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const b of sorted) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) {
      last.end = Math.max(last.end, b.end);
    } else {
      merged.push({ ...b });
    }
  }
  return merged.some((r) => r.start <= start && r.end >= end);
}
