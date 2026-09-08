/**
 * Come lo studio raggiunge i pazienti: un record per canale.
 *
 * Le credenziali (SMTP, provider SMS) NON stanno qui né in nessuna schermata:
 * vivono in OpenBao e le legge il gateway. Queste sono solo preferenze.
 */

/**
 * Attenzione ai NOMI: GraphQL espone le enum con le loro chiavi in MAIUSCOLO
 * (`WHATSAPP`), non con i valori salvati a database (`whatsapp`). Usare i
 * valori qui produceva una tabella vuota — le etichette non si trovavano e le
 * mutation venivano rifiutate — senza nessun errore visibile.
 */
export type NotificationChannel = 'WHATSAPP' | 'EMAIL' | 'SMS';

export type NotificationCategory =
  | 'CONFIRMATION'
  | 'REMINDER'
  | 'RESCHEDULE'
  | 'CANCELLATION';

export interface NotificationChannelSetting {
  id: string;
  channel: NotificationChannel;
  enabled: boolean;
  categories: NotificationCategory[];
  /** Più basso = si prova prima. */
  priority: number;
  /** Solo per SMS. */
  smsDriver?: string | null;
  /** Solo per email: il nome che il paziente vede come mittente. */
  emailFromName?: string | null;
}

export interface NotificationChannelSettingInput {
  channel: NotificationChannel;
  enabled?: boolean;
  categories?: NotificationCategory[];
  priority?: number;
  smsDriver?: string | null;
  emailFromName?: string | null;
}

/** Etichette dei canali, con la ragione per cui uno sceglierebbe quello. */
export const CHANNEL_LABELS: Record<NotificationChannel, {
  name: string; icon: string; hint: string;
}> = {
  WHATSAPP: {
    name: 'WhatsApp',
    icon: 'chat',
    hint: 'Non costa nulla e il paziente lo legge subito. Richiede che il numero sia su WhatsApp.',
  },
  EMAIL: {
    name: 'Email',
    icon: 'mail',
    hint: "Non costa nulla e regge testi lunghi. Serve l'indirizzo in anagrafica.",
  },
  SMS: {
    name: 'SMS',
    icon: 'sms',
    hint: 'Arriva su qualunque telefono, anche senza rete dati. Ogni messaggio ha un costo.',
  },
};

/** Le categorie come le pensa chi configura, non i tipi tecnici. */
export const CATEGORY_LABELS: Record<NotificationCategory, {
  name: string; hint: string;
}> = {
  CONFIRMATION: {
    name: 'Conferma prenotazione',
    hint: 'Subito dopo aver fissato l\'appuntamento',
  },
  REMINDER: {
    name: 'Promemoria',
    hint: 'Il giorno prima. È il messaggio che riduce le assenze',
  },
  RESCHEDULE: {
    name: 'Spostamento',
    hint: 'Quando data o ora cambiano',
  },
  CANCELLATION: {
    name: 'Disdetta',
    hint: "Quando l'appuntamento viene annullato",
  },
};

export const ALL_CATEGORIES: NotificationCategory[] = [
  'CONFIRMATION', 'REMINDER', 'RESCHEDULE', 'CANCELLATION',
];

export const SMS_DRIVERS = [
  { value: 'personal_gsm', label: 'Gateway GSM (apparato proprio)' },
  { value: 'skebby', label: 'Skebby (provider commerciale)' },
];

/**
 * La catena di canali che porta davvero una categoria, in ordine di tentativo.
 *
 * Serve perché l'ordine è UNO ma le categorie sono per canale: una lista
 * ordinata WhatsApp → SMS non dice che per le conferme l'SMS non viene mai
 * usato, se sull'SMS quella casella è spenta. È la differenza fra "come sono
 * messi i canali" e "cosa riceverà il paziente", e finora si vedeva solo la
 * prima — un blackout come quello del 21/08/2026, con tutti i canali spenti,
 * dalla tabella non si notava affatto.
 */
export interface CategoryCoverage {
  category: NotificationCategory;
  /** Vuoto = nessun canale porta questa categoria: quei messaggi non partono. */
  channels: NotificationChannel[];
}

/**
 * Stessa regola di `buildNotificationPlan` lato backend: acceso, porta la
 * categoria, ordinato per priorità. Duplicata qui — e non condivisa — perché
 * questa è una descrizione di cosa succederà, non la decisione: il piano vero
 * lo costruisce il backend al momento dell'invio, e una libreria in comune
 * legherebbe una schermata a una scelta di runtime che deve poter cambiare.
 */
export function categoryCoverage(
  settings: NotificationChannelSetting[],
): CategoryCoverage[] {
  const attivi = [...settings]
    .filter(s => s.enabled)
    .sort((a, b) => a.priority - b.priority);

  return ALL_CATEGORIES.map(category => ({
    category,
    channels: attivi
      .filter(s => (s.categories || []).includes(category))
      .map(s => s.channel),
  }));
}

/** Le categorie che oggi non partirebbero da nessun canale. */
export function uncoveredCategories(
  settings: NotificationChannelSetting[],
): NotificationCategory[] {
  return categoryCoverage(settings)
    .filter(c => !c.channels.length)
    .map(c => c.category);
}

/**
 * Cosa resterebbe scoperto spegnendo un canale — o togliendogli delle
 * categorie — prima di farlo davvero.
 *
 * Si calcola sulla proiezione e non sullo stato attuale perché la domanda che
 * conta è "cosa succede se confermo", e chiederla dopo il salvataggio
 * significherebbe averlo già rotto.
 */
export function uncoveredAfter(
  settings: NotificationChannelSetting[],
  change: { channel: NotificationChannel; enabled?: boolean; categories?: NotificationCategory[] },
): NotificationCategory[] {
  const proiezione = settings.map(s =>
    s.channel === change.channel ? { ...s, ...change } : s,
  );
  const prima = uncoveredCategories(settings);
  // Solo le categorie che questa modifica scopre: quelle già scoperte non
  // sono colpa sua, e ripeterle a ogni salvataggio trasformerebbe l'avviso
  // in rumore che si impara a saltare.
  return uncoveredCategories(proiezione).filter(c => !prima.includes(c));
}
