import {
  NotificationCategory,
  NotificationChannel,
} from '../entities/notification-channel-setting.entity';

/**
 * Da "che messaggio è" e "chi lo riceve" a "quali canali si provano, in che
 * ordine".
 *
 * Funzione pura, separata dal servizio, perché è l'unico punto dove si
 * incrociano tre volontà diverse — quella dello studio (quali canali sono
 * accesi), quella del canale (quali categorie può portare) e quella del
 * paziente (come vuole essere avvisato) — ed è dove un errore non si vede: un
 * promemoria che parte dal canale sbagliato sembra funzionare.
 */

export interface ChannelSettingLike {
  channel: NotificationChannel;
  enabled: boolean;
  categories: NotificationCategory[];
  priority: number;
  smsDriver?: string | null;
  emailFromName?: string | null;
}

/**
 * Preferenza del paziente, dal registry.
 * `null`/assente = nessuna preferenza, decide lo studio.
 * `'none'` = non vuole essere avvisato.
 */
export type PatientChannelPreference = NotificationChannel | 'none' | null | undefined;

export interface NotificationPlan {
  /** Canali in ordine di tentativo: il primo che riesce vince. */
  channels: NotificationChannel[];
  smsDriver?: string;
  emailFromName?: string;
}

export function buildNotificationPlan(
  settings: ChannelSettingLike[],
  category: NotificationCategory,
  preference: PatientChannelPreference,
): NotificationPlan | null {
  // Il paziente ha chiesto di non essere avvisato: si ferma qui, prima di
  // qualunque altra considerazione. È l'unica volontà che non si negozia.
  if (preference === 'none') return null;

  const usable = settings
    .filter((s) => s.enabled && s.categories?.includes(category))
    .sort((a, b) => a.priority - b.priority);

  if (!usable.length) return null;

  let ordered = usable;

  // La preferenza del paziente sposta il suo canale in testa, non elimina gli
  // altri: restano come riserva se quello scelto fallisce.
  //
  // Se il canale preferito è spento o non porta questa categoria, la
  // preferenza viene ignorata e vale l'ordine dello studio. L'alternativa —
  // non mandare niente — trasformerebbe una preferenza in una disdetta
  // implicita che il paziente non ha mai chiesto.
  if (preference && usable.some((s) => s.channel === preference)) {
    ordered = [
      ...usable.filter((s) => s.channel === preference),
      ...usable.filter((s) => s.channel !== preference),
    ];
  }

  const smsSetting = ordered.find((s) => s.channel === NotificationChannel.SMS);
  const emailSetting = ordered.find((s) => s.channel === NotificationChannel.EMAIL);

  return {
    channels: ordered.map((s) => s.channel),
    ...(smsSetting?.smsDriver ? { smsDriver: smsSetting.smsDriver } : {}),
    ...(emailSetting?.emailFromName ? { emailFromName: emailSetting.emailFromName } : {}),
  };
}

/** Dal tipo tecnico del messaggio alla categoria che l'utente configura. */
export function categoryOfMessage(
  kind: 'booking' | 'reminder' | 'update' | 'cancel',
): NotificationCategory {
  switch (kind) {
    case 'reminder':
      return NotificationCategory.REMINDER;
    case 'update':
      return NotificationCategory.RESCHEDULE;
    case 'cancel':
      return NotificationCategory.CANCELLATION;
    default:
      return NotificationCategory.CONFIRMATION;
  }
}
