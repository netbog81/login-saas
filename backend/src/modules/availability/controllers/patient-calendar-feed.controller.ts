import { Controller, Get, Post, Param, Req, Res, Logger, Headers } from '@nestjs/common';
import { Request, Response } from 'express';
import { TenantResolverService } from '@curandis/auth-core';
import { TenantContextService, TenantDataSourceManager } from '@curandis/tenant-datasource';
import { randomUUID } from 'crypto';
import { PatientCalendarFeedService } from '../services/patient-calendar-feed.service';
import { subscribePageHtml, wrapFeedPageHtml } from '../utils/calendar-feed-page.util';

/**
 * Calendario del paziente: feed ICS, pagina di sottoscrizione e disiscrizione.
 *
 * ROTTE NON AUTENTICATE, per necessità: un'app di calendario che sottoscrive un
 * URL non sa fare OAuth né mandare un Bearer, e il paziente non ha un account
 * nel gestionale. L'unica credenziale è il token nell'URL — 32 byte casuali,
 * revocabile. Di conseguenza sono escluse da `CurandisTenantContextMiddleware`
 * (che pretende un JWT) e il contesto tenant si costruisce a mano.
 *
 * IL TENANT STA NEL PATH: in produzione tutti i tenant parlano con lo stesso
 * host, `api.curandis.cloud`, e senza JWT non c'è altro da cui ricavarlo.
 */
@Controller('calendar-feed/patient')
export class PatientCalendarFeedController {
  private readonly logger = new Logger(PatientCalendarFeedController.name);

  constructor(
    private readonly feedService: PatientCalendarFeedService,
    private readonly tenantResolver: TenantResolverService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
  ) {}

  /**
   * `GET /calendar-feed/patient/<tenant>/<token>.ics`
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
    const ics = await this.inTenant(tenantParam, req, 'patient-calendar-feed', (run) =>
      run(() => this.feedService.buildCalendarByToken(token)),
    );

    if (!ics) {
      res.status(404).send('Not found');
      return;
    }

    this.logger.log(`[ICS-PAZ] Feed servito (client="${userAgent ?? 'n/d'}")`);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    // `inline` e non `attachment`: chi consuma un feed è un'app di calendario,
    // non un browser che scarica un file.
    res.setHeader('Content-Disposition', 'inline; filename="appuntamenti.ics"');
    // NIENTE `no-store`: sottoscrivere un calendario SIGNIFICA che il servizio
    // ne conserva una copia e la rilegge nel tempo. `private` tiene fuori le
    // cache condivise ed è il livello giusto.
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.send(ics);
  }

  /**
   * `GET /calendar-feed/patient/setup/<tenant>/<token>` — la pagina che il
   * paziente apre dal link nella mail.
   *
   * A differenza di quella dell'operatore NON è usa-e-getta: l'operatore
   * riceve il link in chat e lo apre subito, il paziente legge la posta quando
   * capita e deve poterci tornare (soprattutto chi ha Google, che deve
   * completare la sottoscrizione da computer). Il link resta valido finché la
   * sottoscrizione non viene revocata.
   */
  @Get('setup/:tenant/:token')
  async setupPage(
    @Param('tenant') tenantParam: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Si controlla solo che il token sia vivo: comporre qui il calendario
    // segnerebbe un accesso, e `firstAccessAt` deve dire "un'app di calendario
    // l'ha scaricato", non "il paziente ha aperto la pagina".
    const live = await this.inTenant(tenantParam, req, 'patient-calendar-setup', (run) =>
      run(() => this.feedService.isFeedTokenLive(token)),
    );

    if (!live) {
      res.status(404).send(this.revokedHtml());
      return;
    }

    const feedUrl =
      `${this.publicBaseUrl()}/calendar-feed/patient/${this.aliasOf(tenantParam, req)}/${token}.ics`;

    res.status(200).send(
      subscribePageHtml({
        title: 'I tuoi appuntamenti sul calendario',
        intro: `<p>Da qui puoi aggiungere i tuoi appuntamenti al calendario del telefono.
                   Una volta fatto <strong>si aggiorna da solo</strong>: se un appuntamento
                   viene spostato o disdetto, il calendario lo segue senza che tu debba
                   fare niente.</p>
                <p class="hint">Nel calendario compaiono solo la data, l'ora e la sede.</p>`,
        feedUrl,
        privacyNote:
          'Questo indirizzo è personale e mostra i tuoi appuntamenti: non inoltrarlo a nessuno.',
        footer: `<p class="foot">Non vuoi più questo servizio?
                   Trovi il link per annullare l'iscrizione in fondo all'email che hai ricevuto,
                   oppure puoi chiederlo alla segreteria.</p>`,
      }),
    );
  }

  /**
   * `GET /calendar-feed/patient/unsubscribe/<tenant>/<token>` — la pagina di
   * conferma della disiscrizione.
   *
   * Il GET non revoca NIENTE: mostra solo un pulsante. La revoca avviene sul
   * POST, che i crawler non fanno. Senza questa separazione basterebbe un
   * antivirus aziendale o un filtro antispam che apre i link del messaggio per
   * disiscrivere il paziente a sua insaputa — è già successo con i link
   * usa-e-getta dell'agenda operatori, consumati da WhatsApp un secondo dopo
   * l'invio.
   */
  @Get('unsubscribe/:tenant/:token')
  async unsubscribePage(
    @Param('tenant') tenantParam: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const live = await this.inTenant(tenantParam, req, 'patient-calendar-unsub', (run) =>
      run(() => this.feedService.isUnsubscribeTokenLive(token)),
    );

    // Già revocato o inesistente: stessa pagina, ed è quella giusta da
    // mostrare — chi arriva qui voleva disiscriversi e il risultato è quello.
    if (!live) {
      res.status(200).send(this.alreadyUnsubscribedHtml());
      return;
    }

    res.status(200).send(
      wrapFeedPageHtml(
        'Annulla iscrizione',
        `<p>Stai per smettere di ricevere i tuoi appuntamenti sul calendario del
            telefono. Il calendario che hai aggiunto smetterà di aggiornarsi e
            potrai rimuoverlo dal telefono.</p>
         <p class="hint">Gli appuntamenti restano: cambia solo il fatto che non
            li vedrai più aggiornarsi da soli sul calendario.</p>
         <form method="post">
           <button class="btn btn-danger" type="submit">Annulla iscrizione</button>
         </form>`,
      ),
    );
  }

  /** `POST /calendar-feed/patient/unsubscribe/...` — la revoca vera. */
  @Post('unsubscribe/:tenant/:token')
  async unsubscribe(
    @Param('tenant') tenantParam: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.inTenant(tenantParam, req, 'patient-calendar-unsub', (run) =>
      run(() => this.feedService.revokeByUnsubscribeToken(token)),
    );

    // Stessa pagina che il token esistesse o no: idempotente, e non conferma a
    // un estraneo di aver indovinato un token.
    res.status(200).send(this.alreadyUnsubscribedHtml());
  }

  // ==================== SUPPORTO ====================

  /**
   * Esegue `work` dentro il contesto tenant ricavato dal path.
   *
   * Torna null se il tenant non è risolvibile: per queste rotte anonime è la
   * stessa risposta di un token sbagliato, e va bene così.
   */
  private async inTenant<T>(
    tenantParam: string,
    req: Request,
    userId: string,
    work: (run: <R>(fn: () => Promise<R>) => Promise<R>) => Promise<T>,
  ): Promise<T | null> {
    const tenantAlias = this.aliasOf(tenantParam, req);
    if (!tenantAlias) {
      this.logger.warn(
        `[ICS-PAZ] Tenant non risolvibile (path="${tenantParam}", host="${req.headers.host}")`,
      );
      return null;
    }

    let dataSource: import('typeorm').DataSource;
    try {
      dataSource = await this.tenantDsManager.getDataSource(tenantAlias);
    } catch (err) {
      this.logger.warn(`[ICS-PAZ] Tenant "${tenantAlias}" non risolto: ${(err as Error).message}`);
      return null;
    }

    return work(<R>(fn: () => Promise<R>) =>
      this.tenantContext.run(
        {
          dataSource,
          tenantAlias,
          dbName: (dataSource.options as { database?: string }).database || '',
          userId,
          requestId: randomUUID(),
        },
        fn,
      ),
    );
  }

  /** Il path comanda; il sottodominio resta come ripiego (sviluppo, LAN). */
  private aliasOf(tenantParam: string, req: Request): string | null {
    return (
      this.sanitizeAlias(tenantParam) ??
      this.tenantResolver.extractTenantAliasFromRequest(req) ??
      null
    );
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

  private publicBaseUrl(): string {
    return process.env.CLINICO_PUBLIC_API_URL || 'https://api.curandis.cloud';
  }

  private revokedHtml(): string {
    return wrapFeedPageHtml(
      'Link non più valido',
      `<p>Questo link non è più attivo.</p>
       <p class="hint">Se ti serve di nuovo, puoi chiederlo alla segreteria.</p>`,
    );
  }

  private alreadyUnsubscribedHtml(): string {
    return wrapFeedPageHtml(
      'Iscrizione annullata',
      `<p>Non riceverai più i tuoi appuntamenti sul calendario del telefono.</p>
       <p class="hint">Se avevi aggiunto il calendario al telefono, puoi rimuoverlo
          dalle impostazioni del calendario: smetterà comunque di aggiornarsi.</p>
       <p class="hint">Hai cambiato idea? Chiedi alla segreteria di rimandarti il link.</p>`,
    );
  }
}
