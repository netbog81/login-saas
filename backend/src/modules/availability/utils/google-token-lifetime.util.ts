/**
 * Quanto vive l'autorizzazione Google, e quanto le resta.
 *
 * Google NON comunica la scadenza di un refresh token: nella risposta non
 * c'e', e non esiste modo di chiederla. Quello che sappiamo e' che per le app
 * in stato "Testing" la vita e' fissa — 7 giorni dal rilascio — e la data di
 * rilascio ce l'abbiamo (`connectedAt`).
 *
 * Quindi questa e' una PREVISIONE, non un dato: vale finche' vale la regola
 * dei 7 giorni. Quando l'app viene verificata la regola cade e il conto alla
 * rovescia direbbe il falso, per questo si spegne da configurazione invece di
 * essere cancellato — le verifiche Google si possono dover rifare, e un
 * interruttore gia' pronto vale piu' di codice da riscrivere.
 *
 * Il rilevamento REALE (lo stato EXPIRED quando una sincronizzazione fallisce)
 * resta valido sempre e non dipende da niente di tutto questo.
 */

export interface TokenLifetime {
  /** La previsione ha senso: l'app e' ancora in fase di test. */
  predictable: boolean;
  /** Scadenza attesa. Assente se non prevedibile. */
  expiresAt?: Date;
  /** Giorni interi rimasti; negativo se la scadenza e' passata. Assente se non prevedibile. */
  daysLeft?: number;
  /** Vero quando conviene avvisare la persona che deve riautorizzare. */
  expiringSoon: boolean;
}

export function computeTokenLifetime(params: {
  connectedAt?: Date | string | null;
  /** L'app Google e' ancora in "Testing". */
  testingMode: boolean;
  /** Vita del refresh token in fase di test. */
  lifetimeDays: number;
  /** Da quanti giorni prima considerarla in scadenza. */
  warnDaysBefore: number;
  now?: Date;
}): TokenLifetime {
  const { connectedAt, testingMode, lifetimeDays, warnDaysBefore } = params;
  const now = params.now ?? new Date();

  if (!testingMode || !connectedAt) {
    return { predictable: false, expiringSoon: false };
  }

  const issued = connectedAt instanceof Date ? connectedAt : new Date(connectedAt);
  if (Number.isNaN(issued.getTime())) {
    return { predictable: false, expiringSoon: false };
  }

  const expiresAt = new Date(issued.getTime() + lifetimeDays * 86400_000);
  const msLeft = expiresAt.getTime() - now.getTime();

  // Arrotondato per DIFETTO: "manca 1 giorno" con 30 ore residue e' una
  // rassicurazione sbagliata. Meglio dire meno di quanto ce n'e'.
  const daysLeft = Math.floor(msLeft / 86400_000);

  return {
    predictable: true,
    expiresAt,
    daysLeft,
    expiringSoon: msLeft <= warnDaysBefore * 86400_000,
  };
}
