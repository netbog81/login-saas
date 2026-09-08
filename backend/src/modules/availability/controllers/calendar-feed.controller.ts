import { Controller, Get, Post, Param, Req, Res, Logger, Headers } from '@nestjs/common';
import { Request, Response } from 'express';
import { TenantResolverService } from '@curandis/auth-core';
import { TenantContextService, TenantDataSourceManager } from '@curandis/tenant-datasource';
import { randomUUID } from 'crypto';
import { OperatorCalendarFeedService } from '../services/operator-calendar-feed.service';
import { GoogleTokenAlertService } from '../services/google-token-alert.service';
import { escapeHtml, subscribePageHtml, wrapFeedPageHtml } from '../utils/calendar-feed-page.util';

/**
 * Feed ICS dell'agenda operatore, sottoscrivibile da iOS Calendar, Google
 * Calendar e Outlook.
 *
 * ROTTA NON AUTENTICATA, per necessità: un'app di calendario che sottoscrive
 * un URL non sa fare OAuth né mandare un Bearer. L'unica credenziale è il
 * token nell'URL — 32 byte casuali, revocabile, rigenerabile.
 *
 * Di conseguenza questa rotta è ESCLUSA da CurandisTenantContextMiddleware
 * (che pretende un JWT valido) e si costruisce il contesto tenant a mano,
 * come fa il controller dei webhook.
 *
 * IL TENANT STA NEL PATH, non nel sottodominio. In produzione tutti i tenant
 * parlano con lo STESSO backend, `api.curandis.cloud`: quell'host non contiene
 * nessun tenant e normalmente lo si ricava dal JWT, che qui non c'è. Un primo
 * tentativo generava URL su `clinico.{tenant}.curandis.cloud` — host che non
 * esiste nemmeno nel DNS: il feed era irraggiungibile da Google e da iOS pur
 * funzionando perfettamente in locale forzando l'header Host.
 *
 * Il token da solo non basterebbe comunque: deve essere quello giusto NEL
 * tenant giusto. Cercarlo senza quel vincolo significherebbe interrogare tutti
 * i database dell'installazione a ogni richiesta anonima. L'alias non è un
 * segreto — compare in ogni altro URL del sistema.
 */
@Controller('calendar-feed')
export class CalendarFeedController {
  private readonly logger = new Logger(CalendarFeedController.name);

  constructor(
    private readonly feedService: OperatorCalendarFeedService,
    private readonly tenantResolver: TenantResolverService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
    private readonly alerts: GoogleTokenAlertService,
  ) {}

  /**
   * `GET /calendar-feed/<tenant>/<token>.ics`
   *
   * Risponde 404 sia per token inesistente sia per feed revocato: distinguere
   * i due casi confermerebbe a un estraneo che un token è stato valido.
   */
  @Get(':tenant/:token.ics')
  async getFeed(
    @Param('tenant') tenantParam: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    // Il path comanda; il sottodominio resta come ripiego per gli ambienti in
    // cui l'host contiene già il tenant (sviluppo, LAN).
    const tenantAlias =
      this.sanitizeAlias(tenantParam) ?? this.tenantResolver.extractTenantAliasFromRequest(req);
    if (!tenantAlias) {
      this.logger.warn(
        `[ICS] Tenant non risolvibile (path="${tenantParam}", host="${req.headers.host}")`,
      );
      res.status(404).send('Not found');
      return;
    }

    let dataSource: import('typeorm').DataSource;
    try {
      dataSource = await this.tenantDsManager.getDataSource(tenantAlias);
    } catch (err) {
      this.logger.warn(`[ICS] Tenant "${tenantAlias}" non risolto: ${(err as Error).message}`);
      res.status(404).send('Not found');
      return;
    }

    // Il calendario si compone DENTRO il contesto tenant: i repository
    // risolvono il DataSource dall'AsyncLocalStorage.
    const ics = await this.tenantContext.run(
      {
        dataSource,
        tenantAlias,
        dbName: (dataSource.options as { database?: string }).database || '',
        userId: 'calendar-feed',
        requestId: randomUUID(),
      },
      () => this.feedService.buildCalendarByToken(token),
    );

    if (!ics) {
      this.logger.debug(`[ICS] Token non valido o feed revocato (tenant=${tenantAlias})`);
      res.status(404).send('Not found');
      return;
    }

    this.logger.log(`[ICS] Feed servito (tenant=${tenantAlias}, client="${userAgent ?? 'n/d'}")`);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    // `inline` e non `attachment`: chi consuma un feed è un'app di calendario,
    // non un browser che scarica un file. Con `attachment` alcuni client
    // trattano la risposta come un allegato da salvare invece che come
    // contenuto da leggere.
    res.setHeader('Content-Disposition', 'inline; filename="agenda.ics"');
    // `private` tiene fuori le cache condivise, ed è il livello giusto.
    //
    // NIENTE `no-store`, che c'era prima: sottoscrivere un calendario
    // SIGNIFICA che il servizio ne conserva una copia e la rilegge nel tempo —
    // è la funzione, non un effetto collaterale. Vietarglielo non proteggeva
    // nulla (i dati arrivano comunque a destinazione) e poteva impedire a
    // Google di completare la sottoscrizione.
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.send(ics);
  }

  /**
   * `GET /calendar-feed/setup/<tenant>/<token>` — pagina di sottoscrizione
   * aperta dal link usa-e-getta arrivato via WhatsApp o email.
   *
   * Esiste per togliere di mezzo il passaggio peggiore: senza, l'operatore
   * dovrebbe entrare nelle impostazioni del calendario, trovare "aggiungi
   * calendario da URL" e incollare un indirizzo lunghissimo. Qui tocca il
   * link nel messaggio e poi un pulsante.
   *
   * Il link vale una volta sola e per pochi minuti: nella conversazione resta
   * un indirizzo morto invece di una credenziale permanente sull'agenda.
   */
  @Get('setup/:tenant/:token')
  async setupPage(
    @Param('tenant') tenantParam: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const tenantAlias =
      this.sanitizeAlias(tenantParam) ?? this.tenantResolver.extractTenantAliasFromRequest(req);
    if (!tenantAlias) {
      res.status(404).send(this.setupHtml(null, ''));
      return;
    }

    let dataSource: import('typeorm').DataSource;
    try {
      dataSource = await this.tenantDsManager.getDataSource(tenantAlias);
    } catch {
      res.status(404).send(this.setupHtml(null, ''));
      return;
    }

    const data = await this.tenantContext.run(
      {
        dataSource,
        tenantAlias,
        dbName: (dataSource.options as { database?: string }).database || '',
        userId: 'calendar-feed-setup',
        requestId: randomUUID(),
      },
      // GUARDA soltanto: aprire non consuma. Vedi il commento su
      // `peekSetupLink` — WhatsApp scarica l'URL da sé per l'anteprima.
      () => this.feedService.peekSetupLink(token),
    );

    if (!data) {
      // Scaduto, già usato o inesistente: stessa risposta per tutti e tre.
      res.status(410).send(this.expiredHtml());
      return;
    }

    res.status(200).send(this.activateHtml(data.operatorName));
  }

  /**
   * `GET /calendar-feed/google-renew/<tenant>/<token>` — pagina di rinnovo
   * dell'autorizzazione Google.
   *
   * Come per la sottoscrizione, aprire NON consuma: WhatsApp e i filtri di
   * posta scaricano l'URL da soli per l'anteprima, e un link bruciato
   * dall'anteprima arriverebbe sempre gia' scaduto al destinatario.
   */
  @Get('google-renew/:tenant/:token')
  async renewPage(
    @Param('tenant') tenantParam: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ctx = await this.publicTenantContext(tenantParam, req);
    if (!ctx) {
      res.status(410).send(this.expiredHtml());
      return;
    }

    const data = await this.tenantContext.run(ctx.scope, () =>
      this.alerts.peekRenewLink(token),
    );

    if (!data) {
      res.status(410).send(this.expiredHtml());
      return;
    }

    res.status(200).send(this.renewHtml(data.operatorName, ctx.alias, token));
  }

  /**
   * `POST /calendar-feed/google-renew/<tenant>/<token>` — consuma il link e
   * manda la persona alla schermata di consenso di Google.
   */
  @Post('google-renew/:tenant/:token')
  async renewStart(
    @Param('tenant') tenantParam: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ctx = await this.publicTenantContext(tenantParam, req);
    if (!ctx) {
      res.status(410).send(this.expiredHtml());
      return;
    }

    const url = await this.tenantContext.run(ctx.scope, () =>
      this.alerts.consumeRenewLink(token),
    );

    if (!url) {
      res.status(410).send(this.expiredHtml());
      return;
    }

    // 302 verso Google: da qui in poi comanda il consenso, e il callback
    // esistente rimette a posto il collegamento.
    res.redirect(302, url);
  }

  /** Contesto di tenant per le rotte pubbliche, o null se non risolvibile. */
  private async publicTenantContext(
    tenantParam: string,
    req: Request,
  ): Promise<{ alias: string; scope: any } | null> {
    const tenantAlias =
      this.sanitizeAlias(tenantParam) ?? this.tenantResolver.extractTenantAliasFromRequest(req);
    if (!tenantAlias) return null;

    try {
      const dataSource = await this.tenantDsManager.getDataSource(tenantAlias);
      return {
        alias: tenantAlias,
        scope: {
          dataSource,
          tenantAlias,
          dbName: (dataSource.options as { database?: string }).database || '',
          userId: 'google-renew-link',
          requestId: randomUUID(),
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * `POST /calendar-feed/setup/<tenant>/<token>` — attivazione vera.
   *
   * È qui che il link si consuma, e non sulla visita: i crawler che generano
   * le anteprime dei messaggi fanno GET, non POST. Senza questa separazione
   * il destinatario trovava sempre "link scaduto", perché WhatsApp lo aveva
   * già aperto un secondo dopo l'invio.
   */
  @Post('setup/:tenant/:token')
  async activateSetup(
    @Param('tenant') tenantParam: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const tenantAlias =
      this.sanitizeAlias(tenantParam) ?? this.tenantResolver.extractTenantAliasFromRequest(req);
    if (!tenantAlias) {
      res.status(404).send(this.expiredHtml());
      return;
    }

    let dataSource: import('typeorm').DataSource;
    try {
      dataSource = await this.tenantDsManager.getDataSource(tenantAlias);
    } catch {
      res.status(404).send(this.expiredHtml());
      return;
    }

    const data = await this.tenantContext.run(
      {
        dataSource,
        tenantAlias,
        dbName: (dataSource.options as { database?: string }).database || '',
        userId: 'calendar-feed-setup',
        requestId: randomUUID(),
      },
      () => this.feedService.consumeSetupLink(token),
    );

    if (!data) {
      res.status(410).send(this.expiredHtml());
      return;
    }

    const feedUrl = `${this.publicBaseUrl()}/calendar-feed/${tenantAlias}/${data.feedToken}.ics`;
    res.status(200).send(this.setupHtml(data.operatorName, feedUrl));
  }

  /** Base pubblica: la stessa da cui il feed viene servito. */
  private publicBaseUrl(): string {
    return process.env.CLINICO_PUBLIC_API_URL || 'https://api.curandis.cloud';
  }

  /**
   * Scaduto, già usato o inesistente: stessa pagina per tutti e tre, così chi
   * apre non può distinguere i casi.
   *
   * (I pulsanti di sottoscrizione e il perché di `webcal://` stanno ora in
   * `calendar-feed-page.util.ts`, condivisi col calendario dei pazienti.)
   */
  private expiredHtml(): string {
    return this.wrapHtml(
      'Link non più valido',
      `<p>Questo link è scaduto o è già stato usato.</p>
       <p class="hint">Chiedi alla segreteria di inviartene uno nuovo.</p>`,
    );
  }

  /**
   * Prima pagina: nessun indirizzo dentro, solo il pulsante che attiva.
   *
   * Il segreto non compare finché non c'è un gesto umano: così anche
   * l'anteprima generata automaticamente dal messaggio non se lo porta dietro.
   */
  private activateHtml(operatorName: string): string {
    return this.wrapHtml(
      `Agenda di ${escapeHtml(operatorName)}`,
      `<p>Stai per aggiungere la tua agenda di lavoro al calendario del telefono.
          Gli appuntamenti compariranno accanto ai tuoi impegni personali, in un
          calendario separato che puoi nascondere quando vuoi.</p>
       <form method="post">
         <button class="btn btn-primary" type="submit">Attiva la sincronizzazione</button>
       </form>
       <p class="hint">Questo link vale una volta sola.</p>`,
    );
  }

  /**
   * Pagina di rinnovo: un solo pulsante, che porta al consenso di Google.
   *
   * Non spiega niente di tecnico. Chi arriva qui ha ricevuto un messaggio che
   * gli diceva che il calendario sta per fermarsi: deve poter risolvere in un
   * tocco, non capire cos'e' un token.
   */
  private renewHtml(operatorName: string, alias: string, token: string): string {
    return this.wrapHtml(
      `Rinnova il collegamento`,
      `<p>Ciao ${escapeHtml(operatorName)}. Il permesso che Curandis usa per scrivere
          sul tuo Google Calendar sta per scadere — è una regola di Google, non
          un problema del tuo account.</p>
       <p>Rinnovandolo, i tuoi appuntamenti tornano ad aggiornarsi da soli.
          Curandis continua a vedere solo il calendario che ha creato, non gli altri.</p>
       <form method="post" action="/calendar-feed/google-renew/${escapeHtml(alias)}/${escapeHtml(token)}">
         <button class="btn btn-primary" type="submit">Rinnova con Google</button>
       </form>
       <p class="hint">Questo link vale una volta sola.</p>`,
    );
  }

  private setupHtml(operatorName: string | null, feedUrl: string): string {
    if (!operatorName) return this.expiredHtml();

    return subscribePageHtml({
      title: `Agenda di ${escapeHtml(operatorName)}`,
      intro: `<p>Aggiungi la tua agenda di lavoro al calendario.
                 Gli appuntamenti compariranno accanto ai tuoi impegni personali,
                 in un calendario separato che puoi nascondere quando vuoi.</p>`,
      feedUrl,
      privacyNote:
        'Questo indirizzo è personale e dà accesso alla tua agenda: non inoltrarlo a nessuno.',
    });
  }

  private wrapHtml(title: string, body: string): string {
    return wrapFeedPageHtml(title, body);
  }

  /**
   * Alias tenant accettabile: minuscole, cifre, trattini. Filtra prima di
   * usarlo per aprire una connessione, invece di passare al pool qualunque
   * cosa arrivi dall'URL.
   */
  private sanitizeAlias(value?: string): string | null {
    const alias = (value ?? '').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,62}$/.test(alias) ? alias : null;
  }
}
