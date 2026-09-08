import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OpenbaoTokenProvider } from '../../../infrastructure/openbao/openbao-token.provider';
import {
  readGoogleOAuthConfig, GoogleOAuthConfig,
} from '../../../infrastructure/openbao/google-oauth-kv-config';

/** Esito dello scambio del codice di autorizzazione. */
export interface GoogleTokenExchange {
  refreshToken: string;
  accessToken: string;
  expiresInSeconds: number;
  scope: string;
  /** Indirizzo dell'account che ha autorizzato, dall'id_token. */
  email?: string;
}

/**
 * Evento nella forma attesa da Google.
 *
 * Orari come data-ora locale + `timeZone`: Google fa la conversione da sé, e
 * si evita l'aritmetica sui fusi che nel feed ICS è stata la parte più
 * delicata (là serviva perché il formato vuole UTC).
 */
export interface GoogleEventBody {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

/** Errore che richiede una NUOVA autorizzazione dell'utente. */
export class GoogleAuthorizationExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthorizationExpiredError';
  }
}

/**
 * Dialogo con le API di Google (OAuth e Calendar).
 *
 * SCOPE RICHIESTI:
 *  - `calendar.app.created` — creare e gestire SOLO i calendari creati da
 *    questa app. Non dà accesso all'agenda personale dell'operatore, ed è la
 *    ragione per cui si crea un calendario dedicato invece di scrivere nel
 *    principale.
 *  - `openid` + `email` — servono a sapere CHI ha autorizzato. Senza, non si
 *    potrebbe verificare che l'operatore abbia usato l'account giusto, e i
 *    suoi appuntamenti potrebbero finire nel calendario di un'altra persona
 *    senza che nessuno se ne accorga. Sono scope non sensibili: non
 *    complicano la verifica Google.
 */
@Injectable()
export class GoogleCalendarApiService {
  private readonly logger = new Logger(GoogleCalendarApiService.name);

  static readonly SCOPES = [
    'openid',
    'email',
    'https://www.googleapis.com/auth/calendar.app.created',
  ];

  private static readonly AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  private static readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private static readonly REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
  private static readonly CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

  constructor(private readonly tokenProvider: OpenbaoTokenProvider) {}

  private config(): Promise<GoogleOAuthConfig> {
    return readGoogleOAuthConfig(this.tokenProvider);
  }

  // ==================== QUOTA ====================

  /**
   * Distanza minima fra due chiamate al Calendar API.
   *
   * Google conta le richieste al minuto, e un ciclo `for` che scrive
   * duecento eventi uno dietro l'altro le manda tutte nei primi trenta
   * secondi: la quota finisce a meta' riversata e il resto degli
   * appuntamenti non arriva. 150 ms fra una e l'altra tengono il ritmo
   * intorno alle sei al secondo, che sta largamente sotto il limite e per un
   * lavoro di sfondo non costa niente — una riversata da duecento eventi
   * passa da "il piu' in fretta possibile, e fallisce" a mezzo minuto, che
   * non guarda nessuno.
   */
  private static readonly MIN_INTERVAL_MS = 150;

  /** Tentativi in caso di quota esaurita, prima di arrendersi al chiamante. */
  private static readonly RATE_LIMIT_ATTEMPTS = 4;

  /**
   * Coda delle chiamate al Calendar API.
   *
   * Una alla volta e distanziate: e' il ritmo che conta, non il parallelismo.
   * La coda e' del processo, quindi vale anche quando piu' operatori vengono
   * riversati nello stesso giro — che e' esattamente il momento in cui la
   * quota andava a fuoco.
   */
  private queue: Promise<unknown> = Promise.resolve();
  private lastCallAt = 0;

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = GoogleCalendarApiService.MIN_INTERVAL_MS - (Date.now() - this.lastCallAt);
      if (wait > 0) await GoogleCalendarApiService.sleep(wait);
      try {
        return await fn();
      } finally {
        this.lastCallAt = Date.now();
      }
    });
    // Si incatena l'ESITO, non il valore: senza il `catch` una chiamata
    // fallita spezzerebbe la coda e tutte le successive verrebbero rifiutate
    // con lo stesso errore, senza nemmeno essere tentate.
    this.queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Chiamata al Calendar API: in coda, e ritentata quando Google dice di
   * rallentare.
   *
   * La quota esaurita non e' un errore dell'appuntamento — e' una richiesta
   * di aspettare. Trattarla come un fallimento definitivo significava
   * perdere l'evento fino al giro successivo, ed e' cosi' che decine di
   * appuntamenti restavano indietro sul telefono degli operatori.
   *
   * Attesa raddoppiata a ogni tentativo, con un po' di casualita': se a
   * sbattere contro il limite sono piu' richieste insieme, riprovare tutte
   * nello stesso istante ricrea il problema che si sta cercando di
   * smaltire.
   */
  private async calendarFetch(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      const resp = await this.schedule(() => fetch(url, init));
      if (attempt >= GoogleCalendarApiService.RATE_LIMIT_ATTEMPTS) return resp;
      if (!(await this.shouldBackOff(resp))) return resp;

      // La risposta che stiamo scartando va chiusa: `shouldBackOff` ne ha
      // letta una copia, ma il corpo originale resterebbe aperto a occupare
      // la connessione fino al garbage collector.
      await resp.body?.cancel().catch(() => undefined);

      const pause = 500 * 2 ** attempt + Math.random() * 250;
      this.logger.warn(
        `Google chiede di rallentare (${resp.status}): nuovo tentativo fra ${Math.round(pause)}ms`,
      );
      await GoogleCalendarApiService.sleep(pause);
    }
  }

  /**
   * Se convenga riprovare.
   *
   * Il 403 e' ambiguo: puo' essere "troppe richieste" oppure "non hai il
   * permesso", e ritentare il secondo e' tempo buttato. Li distingue il
   * campo `reason` del corpo — letto su una COPIA, perche' il corpo di una
   * Response si consuma una volta sola e al chiamante serve intatto.
   */
  private async shouldBackOff(resp: Response): Promise<boolean> {
    if (resp.ok) return false;
    if (resp.status === 429) return true;
    if (resp.status >= 500) return true;
    if (resp.status !== 403) return false;

    try {
      const json = (await resp.clone().json()) as Record<string, any>;
      const reason = String(json?.error?.errors?.[0]?.reason ?? '');
      const message = String(json?.error?.message ?? '');
      return /rateLimitExceeded|userRateLimitExceeded/i.test(reason)
        || /rate limit/i.test(message);
    } catch {
      return false;
    }
  }

  /**
   * URI di reindirizzamento. Deve coincidere **carattere per carattere** con
   * quello registrato nella console Google: una barra finale di troppo o
   * `http` al posto di `https` e il flusso si ferma con `redirect_uri_mismatch`.
   */
  redirectUri(): string {
    return (
      process.env.GOOGLE_OAUTH_REDIRECT_URI
      || 'https://api.curandis.cloud/integrations/google-calendar/callback'
    );
  }

  /**
   * URL a cui mandare l'utente per autorizzare.
   *
   * `access_type=offline` + `prompt=consent` sono entrambi necessari per
   * ottenere un refresh token: senza il secondo Google lo restituisce solo
   * alla primissima autorizzazione, e chi riautorizza dopo una revoca si
   * ritroverebbe un collegamento senza token, funzionante per un'ora e poi
   * morto.
   */
  async buildAuthorizationUrl(state: string, loginHint?: string): Promise<string> {
    const { clientId } = await this.config();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: GoogleCalendarApiService.SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    // Propone l'account giusto a chi ne ha più d'uno aperto nel browser.
    if (loginHint) params.set('login_hint', loginHint);
    return `${GoogleCalendarApiService.AUTH_URL}?${params.toString()}`;
  }

  /** Scambia il codice di autorizzazione con i token. */
  async exchangeCode(code: string): Promise<GoogleTokenExchange> {
    const { clientId, clientSecret } = await this.config();
    const resp = await fetch(GoogleCalendarApiService.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
      }),
    });

    const json = (await resp.json().catch(() => ({}))) as Record<string, any>;
    if (!resp.ok) {
      throw new BadRequestException(
        `Google ha rifiutato lo scambio del codice: ${json.error ?? resp.status} ` +
          `${json.error_description ?? ''}`.trim(),
      );
    }
    if (!json.refresh_token) {
      // Succede se l'utente aveva già autorizzato e Google non ripropone il
      // consenso: senza refresh token il collegamento morirebbe dopo un'ora.
      throw new BadRequestException(
        'Google non ha restituito un refresh token. Revoca l\'accesso a Curandis ' +
          'dalle impostazioni del tuo account Google e riprova.',
      );
    }

    return {
      refreshToken: json.refresh_token,
      accessToken: json.access_token,
      expiresInSeconds: json.expires_in ?? 3600,
      scope: json.scope ?? '',
      email: this.emailFromIdToken(json.id_token),
    };
  }

  /**
   * Access token fresco a partire dal refresh token.
   *
   * `invalid_grant` significa che il refresh token non vale più — revocato
   * dall'utente lato Google, oppure scaduto perché l'app è ancora in
   * "Testing" (in quello stato Google li fa scadere dopo 7 giorni). È un caso
   * distinto da un errore di rete: richiede una nuova autorizzazione, e la UI
   * deve dirlo invece di riprovare all'infinito.
   */
  async getAccessToken(refreshToken: string): Promise<string> {
    const { clientId, clientSecret } = await this.config();
    const resp = await fetch(GoogleCalendarApiService.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    const json = (await resp.json().catch(() => ({}))) as Record<string, any>;
    if (!resp.ok) {
      if (json.error === 'invalid_grant') {
        throw new GoogleAuthorizationExpiredError(
          'Autorizzazione Google non più valida: serve ricollegare il calendario.',
        );
      }
      throw new Error(`Rinnovo token Google fallito: ${json.error ?? resp.status}`);
    }
    return json.access_token;
  }

  /**
   * Crea il calendario dedicato dentro l'account dell'utente.
   *
   * Un calendario separato invece del principale: l'operatore lo nasconde o
   * lo colora a parte, e revocando sparisce tutto in un colpo. Compare
   * comunque nella stessa vista giornaliera del suo, quindi non perde nulla.
   */
  async createCalendar(accessToken: string, name: string): Promise<string> {
    const resp = await this.calendarFetch(`${GoogleCalendarApiService.CALENDAR_API}/calendars`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ summary: name, timeZone: 'Europe/Rome' }),
    });

    const json = (await resp.json().catch(() => ({}))) as Record<string, any>;
    if (!resp.ok) {
      throw new Error(
        `Creazione calendario Google fallita: ${json.error?.message ?? resp.status}`,
      );
    }
    return json.id;
  }

  /**
   * Rinomina il calendario dedicato.
   *
   * Permesso anche con `calendar.app.created`: lo scope consente di gestire
   * i calendari creati dall'app, e questo è uno di quelli. Non tocca nulla
   * degli altri calendari dell'utente.
   */
  async renameCalendar(accessToken: string, calendarId: string, name: string): Promise<void> {
    const resp = await this.calendarFetch(
      `${GoogleCalendarApiService.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summary: name }),
      },
    );
    if (!resp.ok) {
      const json = (await resp.json().catch(() => ({}))) as Record<string, any>;
      throw new Error(
        `Rinomina del calendario fallita: ${json.error?.message ?? resp.status}`,
      );
    }
  }

  /**
   * Crea o aggiorna un evento con un id deciso da noi.
   *
   * L'id è l'UUID dell'appuntamento senza trattini: 32 caratteri esadecimali,
   * tutti dentro l'alfabeto base32hex che Google richiede (0-9, a-v). Così
   * NON serve una tabella di corrispondenza fra appuntamenti ed eventi —
   * niente da tenere allineato, niente da riparare se si disallinea, e
   * risincronizzare due volte lo stesso appuntamento non crea un doppione.
   *
   * `PUT` aggiorna; se l'evento non c'è ancora Google risponde 404 e si passa
   * a `POST` con l'id nel corpo.
   */
  async upsertEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: GoogleEventBody,
  ): Promise<void> {
    const base = `${GoogleCalendarApiService.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const updated = await this.calendarFetch(`${base}/${eventId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(event),
    });
    if (updated.ok) return;

    // 404: non esiste ancora. 410: era stato cancellato — Google non lascia
    // riscrivere quell'id con PUT, ma la POST lo ricrea.
    if (updated.status === 404 || updated.status === 410) {
      const created = await this.calendarFetch(base, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...event, id: eventId }),
      });
      if (created.ok) return;
      // 409: creato nel frattempo da un'altra sincronizzazione. Non è un
      // errore: l'evento c'è, ed è quello che volevamo.
      if (created.status === 409) return;
      throw new Error(await this.errorMessage(created, 'Creazione evento'));
    }

    throw new Error(await this.errorMessage(updated, 'Aggiornamento evento'));
  }

  /**
   * Gli id degli eventi che abbiamo scritto NOI in una finestra di tempo.
   *
   * Serve a trovare gli strascichi: eventi rimasti sul calendario di un
   * operatore per appuntamenti che non sono più suoi. Il caso tipico è la
   * riassegnazione — l'appuntamento passa a un collega, viene scritto sul
   * calendario nuovo, e su quello vecchio non lo cancella nessuno perché
   * ormai non risulta più da nessuna parte che ci fosse finito.
   *
   * FILTRO SULL'ID, non sull'organizzatore: il calendario è dell'operatore e
   * lui può aggiungerci i propri impegni a mano. I nostri eventi hanno per id
   * un UUID senza trattini — 32 cifre esadecimali — e un id generato da
   * Google non ha quella forma. Senza questo filtro la pulizia degli
   * strascichi cancellerebbe le cose sue, il che sarebbe molto peggio del
   * problema che risolve.
   */
  async listOwnEventIds(
    accessToken: string,
    calendarId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<string[]> {
    const base = `${GoogleCalendarApiService.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
    const ids: string[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: '2500',
        showDeleted: 'false',
        // Niente espansione delle ricorrenze: noi scriviamo eventi singoli,
        // uno per appuntamento, e l'espansione moltiplicherebbe le pagine
        // senza aggiungere un solo id che ci interessi.
        singleEvents: 'false',
        // Solo gli id: la lista serve a confrontare, non a leggere. Senza
        // questo Google rispedisce indietro l'intero contenuto di centinaia
        // di eventi, nomi dei pazienti compresi.
        fields: 'items(id),nextPageToken',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const resp = await this.calendarFetch(`${base}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) throw new Error(await this.errorMessage(resp, 'Elenco eventi'));

      const json = (await resp.json()) as Record<string, any>;
      for (const item of json.items ?? []) {
        if (typeof item?.id === 'string' && /^[0-9a-f]{32}$/.test(item.id)) {
          ids.push(item.id);
        }
      }
      pageToken = json.nextPageToken;
    } while (pageToken);

    return ids;
  }

  /**
   * Rimuove un evento. Un evento già assente non è un errore.
   *
   * Restituisce `true` solo se c'era e l'abbiamo tolto. La distinzione conta
   * nei log: contare anche i 404 faceva dire "3 passati rimossi" a una
   * potatura che non stava rimuovendo niente, e il numero rassicurante ha
   * nascosto il guasto per due cicli.
   */
  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<boolean> {
    const resp = await this.calendarFetch(
      `${GoogleCalendarApiService.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (resp.status === 404 || resp.status === 410) return false;
    if (resp.ok) return true;
    throw new Error(await this.errorMessage(resp, 'Cancellazione evento'));
  }

  private async errorMessage(resp: Response, azione: string): Promise<string> {
    const json = (await resp.json().catch(() => ({}))) as Record<string, any>;
    return `${azione} fallito su Google: ${json.error?.message ?? resp.status}`;
  }

  /**
   * Cancella il calendario creato da noi.
   *
   * Solo quello: lo scope `calendar.app.created` non da' accesso agli altri
   * calendari della persona, quindi non c'e' modo — nemmeno per errore — di
   * toccare la sua agenda personale.
   */
  async deleteCalendar(accessToken: string, calendarId: string): Promise<void> {
    const resp = await this.calendarFetch(
      `${GoogleCalendarApiService.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
    );
    // 404: gia' cancellato dall'utente. E' l'esito voluto, non un errore.
    if (!resp.ok && resp.status !== 404) {
      throw new Error(await this.errorMessage(resp, 'Cancellazione del calendario'));
    }
  }

  /** Verifica che il calendario esista ancora (l'utente può averlo cancellato). */
  async calendarExists(accessToken: string, calendarId: string): Promise<boolean> {
    const resp = await this.calendarFetch(
      `${GoogleCalendarApiService.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return resp.ok;
  }

  /** Revoca l'autorizzazione lato Google, non solo da noi. */
  async revoke(refreshToken: string): Promise<void> {
    try {
      await fetch(GoogleCalendarApiService.REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
      });
    } catch (err) {
      // Best-effort: se Google non risponde, il collegamento va comunque
      // rimosso da noi. Il token resta valido lato Google finché non scade,
      // ma noi non lo abbiamo più.
      this.logger.warn(`Revoca lato Google fallita: ${(err as Error).message}`);
    }
  }

  /**
   * Email dall'`id_token` (JWT non verificato).
   *
   * La firma non si controlla di proposito: il token arriva dal canale
   * server-to-server con Google, su TLS, in risposta a una richiesta
   * autenticata col client secret. Non è un token che ci ha passato il
   * browser dell'utente, quindi non c'è nulla da cui difendersi qui — serve
   * solo a sapere quale account ha autorizzato.
   */
  private emailFromIdToken(idToken?: string): string | undefined {
    if (!idToken) return undefined;
    try {
      const payload = idToken.split('.')[1];
      const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return typeof json.email === 'string' ? json.email : undefined;
    } catch {
      return undefined;
    }
  }
}
