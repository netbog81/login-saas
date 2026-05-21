/**
 * Utility pura per verificare se un appuntamento cade dentro la
 * disponibilita' dell'operatore, usando i dati gia' presenti in
 * OperatorGridData (nessuna query aggiuntiva).
 *
 * Usata dai container del calendario (v2 e v3) per decidere se un
 * drag/resize/salvataggio finisce su orario non disponibile e va
 * quindi sottoposto a conferma di forzatura.
 */

import { OperatorGridData } from '../models/calendar-v2.model';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Verifica se l'intervallo [startTime, endTime) per un dato operatore e
 * data e' interamente coperto dalla disponibilita' visibile in gridData.
 *
 * Ricostruisce gli intervalli realmente disponibili dalle celle della
 * colonna: ogni cella `available` espone una porzione libera
 * [slotStart + topPct, slotEnd - bottomPct]; le porzioni contigue di
 * celle adiacenti vengono fuse. L'appuntamento e' "dentro disponibilita'"
 * se un singolo intervallo fuso lo contiene per intero.
 *
 * Ritorna `true` (permissivo) se mancano i dati necessari per decidere
 * (colonna assente, nessuno slot): in quel caso il blocco non scatta e
 * resta la validazione backend come rete di sicurezza.
 *
 * `excludeRange`: intervallo originale dell'appuntamento che si sta
 * spostando. La disponibilita' in gridData ha gia' sottratto TUTTI gli
 * appuntamenti, incluso quello in movimento; senza questo parametro lo
 * spazio che l'appuntamento occupava risulterebbe "non disponibile per
 * se stesso" → falso positivo. Passandolo, quell'intervallo viene
 * riconsiderato disponibile.
 */
export function isAppointmentWithinAvailability(
  gridData: OperatorGridData | null,
  operatorId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeRange?: { startTime: string; endTime: string },
): boolean {
  if (!gridData || gridData.timeSlots.length === 0) return true;

  const column = gridData.columns.find(
    c => c.operatorId === operatorId && c.date === date,
  );
  if (!column) return true;

  const slots = gridData.timeSlots;
  const slotDuration =
    slots.length > 1
      ? timeToMinutes(slots[1].time) - timeToMinutes(slots[0].time)
      : 45;

  // Costruisce gli intervalli disponibili (in minuti) dalle celle.
  const availableRanges: { s: number; e: number }[] = [];
  for (let i = 0; i < slots.length; i++) {
    const cell = column.cells[i];
    if (!cell || !cell.available) continue;

    const slotStart = timeToMinutes(slots[i].time);
    const slotEnd = slotStart + slotDuration;
    // unavailableTopPct/BottomPct: percentuale dello slot non coperta.
    const availStart = slotStart + (cell.unavailableTopPct / 100) * slotDuration;
    const availEnd = slotEnd - (cell.unavailableBottomPct / 100) * slotDuration;
    if (availEnd > availStart) {
      availableRanges.push({ s: availStart, e: availEnd });
    }
  }

  // L'intervallo gia' occupato dall'appuntamento in movimento conta come
  // disponibile per se stesso (vedi excludeRange in jsdoc).
  if (excludeRange) {
    const s = timeToMinutes(excludeRange.startTime);
    const e = timeToMinutes(excludeRange.endTime);
    if (e > s) availableRanges.push({ s, e });
  }

  if (availableRanges.length === 0) return false;

  // Fonde gli intervalli contigui/sovrapposti.
  availableRanges.sort((a, b) => a.s - b.s);
  const merged: { s: number; e: number }[] = [];
  for (const r of availableRanges) {
    const last = merged[merged.length - 1];
    // Tolleranza 0.5 min per assorbire arrotondamenti dei pct.
    if (last && r.s <= last.e + 0.5) {
      last.e = Math.max(last.e, r.e);
    } else {
      merged.push({ ...r });
    }
  }

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  if (endMin <= startMin) return false;

  return merged.some(r => r.s - 0.5 <= startMin && r.e + 0.5 >= endMin);
}
