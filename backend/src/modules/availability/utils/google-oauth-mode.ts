/**
 * Stato dell'app Curandis presso Google, a livello di SaaS.
 *
 * Non e' un segreto e non e' una preferenza del singolo studio: e' una
 * proprieta' dell'applicazione, uguale per tutti i tenant. Sta in una
 * variabile d'ambiente e non in OpenBao proprio per questo — la cassaforte e'
 * per i segreti, e un interruttore operativo nascosto la' dentro sarebbe un
 * interruttore che nessuno trova.
 *
 * Cambia di rado (una verifica Google, o una da rifare), quindi il riavvio
 * del container che serve per applicarlo e' un costo accettabile. Quando
 * esistera' l'amministrazione della SaaS, questo valore si sposta li'.
 */

/** Vero finche' l'app Google e' in stato "Testing": i permessi scadono ogni 7 giorni. */
export function isGoogleOauthTestingMode(): boolean {
  // Default acceso: oggi l'app NON e' verificata, e sbagliare per eccesso di
  // avvisi e' molto meno grave che lasciare un'agenda ferma senza dirlo.
  const raw = (process.env.GOOGLE_OAUTH_TESTING_MODE ?? 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'off';
}

/** Vita del refresh token in fase di test. Google oggi dice 7 giorni. */
export function googleTokenLifetimeDays(): number {
  const parsed = Number.parseInt(process.env.GOOGLE_OAUTH_TOKEN_DAYS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

/** Quanti giorni prima della scadenza si avvisa la persona. */
export function googleAlertDaysBefore(): number {
  const parsed = Number.parseInt(process.env.GOOGLE_OAUTH_ALERT_DAYS_BEFORE ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}
