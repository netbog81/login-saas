/**
 * Verifica della costruzione del piano di canali.
 * Esecuzione: npx ts-node scripts/verify/notification-plan.check.ts
 */
import {
  buildNotificationPlan, categoryOfMessage, ChannelSettingLike,
} from '../../src/modules/whatsapp/notifications/utils/notification-plan.util';
import {
  NotificationCategory as Cat, NotificationChannel as Ch,
} from '../../src/modules/whatsapp/notifications/entities/notification-channel-setting.entity';

let pass = 0, fail = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n       atteso ${e}\n       ottenuto ${a}`); }
};

const S = (
  channel: Ch, enabled: boolean, categories: Cat[], priority: number,
  extra: Partial<ChannelSettingLike> = {},
): ChannelSettingLike => ({ channel, enabled, categories, priority, ...extra });

const ALL = [Cat.CONFIRMATION, Cat.REMINDER, Cat.RESCHEDULE, Cat.CANCELLATION];

console.log('\n— stato di partenza: solo WhatsApp acceso');
{
  const s = [
    S(Ch.WHATSAPP, true, ALL, 1),
    S(Ch.EMAIL, false, [], 2),
    S(Ch.SMS, false, [], 3),
  ];
  check('promemoria', buildNotificationPlan(s, Cat.REMINDER, null)?.channels, ['whatsapp']);
  check('conferma', buildNotificationPlan(s, Cat.CONFIRMATION, null)?.channels, ['whatsapp']);
  check('preferenza per un canale spento viene ignorata',
    buildNotificationPlan(s, Cat.REMINDER, Ch.SMS)?.channels, ['whatsapp']);
}

console.log('\n— categorie diverse per canale (il caso chiesto da Marco)');
{
  // SMS costa: solo il promemoria. Email gratis: tutto tranne la conferma.
  const s = [
    S(Ch.WHATSAPP, true, ALL, 1),
    S(Ch.EMAIL, true, [Cat.REMINDER, Cat.RESCHEDULE, Cat.CANCELLATION], 2),
    S(Ch.SMS, true, [Cat.REMINDER], 3, { smsDriver: 'personal_gsm' }),
  ];
  check('promemoria: tutti e tre',
    buildNotificationPlan(s, Cat.REMINDER, null)?.channels, ['whatsapp', 'email', 'sms']);
  check('conferma: solo WhatsApp',
    buildNotificationPlan(s, Cat.CONFIRMATION, null)?.channels, ['whatsapp']);
  check('disdetta: niente SMS',
    buildNotificationPlan(s, Cat.CANCELLATION, null)?.channels, ['whatsapp', 'email']);
  check('il driver SMS viaggia col piano',
    buildNotificationPlan(s, Cat.REMINDER, null)?.smsDriver, 'personal_gsm');
  check('il driver NON viaggia se l\'SMS non è nel piano',
    buildNotificationPlan(s, Cat.CANCELLATION, null)?.smsDriver, undefined);
}

console.log('\n— preferenza del paziente');
{
  const s = [
    S(Ch.WHATSAPP, true, ALL, 1),
    S(Ch.EMAIL, true, ALL, 2, { emailFromName: 'Studio BDQ' }),
    S(Ch.SMS, true, ALL, 3),
  ];
  check('email preferita: va in testa, gli altri restano di riserva',
    buildNotificationPlan(s, Cat.REMINDER, Ch.EMAIL)?.channels, ['email', 'whatsapp', 'sms']);
  check('SMS preferito',
    buildNotificationPlan(s, Cat.REMINDER, Ch.SMS)?.channels, ['sms', 'whatsapp', 'email']);
  check('preferenza uguale al primo: ordine invariato',
    buildNotificationPlan(s, Cat.REMINDER, Ch.WHATSAPP)?.channels, ['whatsapp', 'email', 'sms']);
  check('nessuna preferenza: ordine dello studio',
    buildNotificationPlan(s, Cat.REMINDER, null)?.channels, ['whatsapp', 'email', 'sms']);
  check('nome mittente email nel piano',
    buildNotificationPlan(s, Cat.REMINDER, null)?.emailFromName, 'Studio BDQ');
}

console.log('\n— il paziente non vuole essere avvisato');
{
  const s = [S(Ch.WHATSAPP, true, ALL, 1)];
  check('preferenza "none": nessun piano', buildNotificationPlan(s, Cat.REMINDER, 'none'), null);
  check('vale per ogni categoria', buildNotificationPlan(s, Cat.CANCELLATION, 'none'), null);
}

console.log('\n— nessun canale utilizzabile');
{
  check('tutti spenti', buildNotificationPlan(
    [S(Ch.WHATSAPP, false, ALL, 1), S(Ch.EMAIL, false, ALL, 2)], Cat.REMINDER, null), null);
  check('acceso ma senza categorie', buildNotificationPlan(
    [S(Ch.WHATSAPP, true, [], 1)], Cat.REMINDER, null), null);
  check('elenco vuoto', buildNotificationPlan([], Cat.REMINDER, null), null);
  check('categorie assenti non fanno esplodere', buildNotificationPlan(
    [{ channel: Ch.WHATSAPP, enabled: true, priority: 1 } as any], Cat.REMINDER, null), null);
}

console.log('\n— la priorità decide, non l\'ordine in cui arrivano le righe');
{
  const s = [
    S(Ch.SMS, true, ALL, 3),
    S(Ch.WHATSAPP, true, ALL, 1),
    S(Ch.EMAIL, true, ALL, 2),
  ];
  check('riordino per priorità',
    buildNotificationPlan(s, Cat.REMINDER, null)?.channels, ['whatsapp', 'email', 'sms']);
}

console.log('\n— tipo tecnico → categoria configurabile');
{
  check('booking', categoryOfMessage('booking'), Cat.CONFIRMATION);
  check('reminder', categoryOfMessage('reminder'), Cat.REMINDER);
  check('update', categoryOfMessage('update'), Cat.RESCHEDULE);
  check('cancel', categoryOfMessage('cancel'), Cat.CANCELLATION);
}

console.log(`\n${pass} ok, ${fail} falliti\n`);
process.exit(fail ? 1 : 0);
