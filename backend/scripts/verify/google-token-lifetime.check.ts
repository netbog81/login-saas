/**
 * Verifica della previsione di scadenza del token Google.
 * Esecuzione: npx ts-node scripts/verify/google-token-lifetime.check.ts
 */
import {
  computeTokenLifetime,
} from '../../src/modules/availability/utils/google-token-lifetime.util';

let pass = 0, fail = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n       atteso ${e}\n       ottenuto ${a}`); }
};

const NOW = new Date('2026-08-21T10:00:00Z');
const at = (isoDaysAgo: number) => new Date(NOW.getTime() - isoDaysAgo * 86400_000);
const call = (connectedAt: any, over: Record<string, any> = {}) =>
  computeTokenLifetime({
    connectedAt, testingMode: true, lifetimeDays: 7, warnDaysBefore: 2, now: NOW, ...over,
  });

console.log('\n— fase di test: la previsione vale');
check('collegato oggi: 7 giorni', call(at(0)).daysLeft, 7);
check('collegato 5 giorni fa: ne restano 2', call(at(5)).daysLeft, 2);
check('collegato 6 giorni fa: ne resta 1', call(at(6)).daysLeft, 1);
check('scaduto ieri: negativo', call(at(8)).daysLeft, -1);
check('data di scadenza', call(at(0)).expiresAt?.toISOString(), '2026-08-28T10:00:00.000Z');

console.log('\n— soglia di avviso (2 giorni prima)');
check('4 giorni fa: non ancora', call(at(4)).expiringSoon, false);
check('5 giorni fa: in scadenza', call(at(5)).expiringSoon, true);
check('gia scaduto: resta "in scadenza"', call(at(9)).expiringSoon, true);

console.log('\n— arrotondamento per difetto');
{
  // 30 ore residue: dire "manca 1 giorno" e' una rassicurazione sbagliata? No:
  // 30h SONO piu' di un giorno. Il floor deve dare 1, non 2.
  const connected = new Date(NOW.getTime() - (7 * 86400_000 - 30 * 3600_000));
  check('30 ore residue → 1 giorno, non 2', call(connected).daysLeft, 1);
  // 20 ore residue: meno di un giorno pieno → 0, cioe' "oggi".
  const connected2 = new Date(NOW.getTime() - (7 * 86400_000 - 20 * 3600_000));
  check('20 ore residue → 0 (oggi)', call(connected2).daysLeft, 0);
}

console.log('\n— app verificata: la previsione si spegne');
check('testingMode falso', call(at(3), { testingMode: false }),
  { predictable: false, expiringSoon: false });
check('niente conto alla rovescia', call(at(3), { testingMode: false }).daysLeft, undefined);

console.log('\n— dati mancanti o corrotti');
check('mai collegato', call(null), { predictable: false, expiringSoon: false });
check('data non valida', call('non-una-data'), { predictable: false, expiringSoon: false });
check('stringa ISO accettata', call(at(2).toISOString()).daysLeft, 5);

console.log('\n— vita diversa da 7 giorni (se Google cambiasse)');
check('30 giorni', call(at(10), { lifetimeDays: 30 }).daysLeft, 20);

console.log(`\n${pass} ok, ${fail} falliti\n`);
process.exit(fail ? 1 : 0);
