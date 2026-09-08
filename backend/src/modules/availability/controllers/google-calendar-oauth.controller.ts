import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { TenantContextService, TenantDataSourceManager } from '@curandis/tenant-datasource';
import { randomUUID } from 'crypto';
import { GoogleCalendarOAuthService, ConnectOutcome } from '../services/google-calendar-oauth.service';

/**
 * Ritorno del consenso Google.
 *
 * ROTTA NON AUTENTICATA, per necessità: è il browser dell'utente che ci
 * arriva per redirect da Google, senza Authorization header. Come per il feed
 * ICS, la rotta è esclusa da `CurandisTenantContextMiddleware` e il contesto
 * tenant si costruisce a mano.
 *
 * La differenza rispetto al feed è da dove viene il tenant: lì stava nel path
 * (l'URL lo componiamo noi), qui viene dallo `state` **firmato in HMAC** che
 * abbiamo messo nella richiesta di autorizzazione e che Google ci restituisce
 * intatto. È l'unica fonte di cui ci si può fidare: senza firma, cambiare
 * l'id nell'URL basterebbe a farsi collegare il calendario a nome di un altro.
 */
@Controller('integrations/google-calendar')
export class GoogleCalendarOAuthController {
  private readonly logger = new Logger(GoogleCalendarOAuthController.name);

  constructor(
    private readonly oauth: GoogleCalendarOAuthService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
  ) {}

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    // L'utente ha negato il consenso, o Google ha rifiutato.
    if (error) {
      this.logger.warn(`[GCAL] Consenso non concesso: ${error}`);
      res.status(200).send(this.page(false, this.denyMessage(error)));
      return;
    }
    if (!code || !state) {
      res.status(400).send(this.page(false, 'Richiesta incompleta da Google.'));
      return;
    }

    // Lo state va verificato PRIMA di toccare qualunque database: è ciò che
    // dice di quale tenant si tratta.
    let parsed: Awaited<ReturnType<GoogleCalendarOAuthService['verifyState']>>;
    try {
      parsed = await this.oauth.verifyState(state);
    } catch (err) {
      this.logger.warn(`[GCAL] State rifiutato: ${(err as Error).message}`);
      res.status(400).send(this.page(false, (err as Error).message));
      return;
    }

    let dataSource: import('typeorm').DataSource;
    try {
      dataSource = await this.tenantDsManager.getDataSource(parsed.tenantAlias);
    } catch (err) {
      this.logger.error(`[GCAL] Tenant "${parsed.tenantAlias}" non risolto: ${(err as Error).message}`);
      res.status(404).send(this.page(false, 'Studio non riconosciuto.', parsed.tenantAlias));
      return;
    }

    let outcome: ConnectOutcome;
    try {
      outcome = await this.tenantContext.run(
        {
          dataSource,
          tenantAlias: parsed.tenantAlias,
          dbName: (dataSource.options as { database?: string }).database || '',
          userId: 'google-oauth-callback',
          requestId: randomUUID(),
        },
        () => this.oauth.completeConnection(parsed, code),
      );
    } catch (err) {
      this.logger.error(`[GCAL] Collegamento fallito: ${(err as Error).message}`);
      res.status(200).send(this.page(false, (err as Error).message, parsed.tenantAlias));
      return;
    }

    res.status(200).send(this.page(outcome.ok, outcome.message, parsed.tenantAlias));
  }

  /** Testo leggibile per i rifiuti di Google, che arrivano come codici. */
  private denyMessage(error: string): string {
    if (error === 'access_denied') {
      return 'Hai annullato l\'autorizzazione: il calendario non è stato collegato.';
    }
    return `Google ha rifiutato l'autorizzazione (${error}).`;
  }

  /**
   * Pagina di ritorno.
   *
   * L'utente arriva qui col browser dopo Google, quindi qualcosa da leggere
   * ci vuole: un JSON grezzo lo lascerebbe davanti a una schermata
   * incomprensibile senza sapere se ha funzionato. La pagina prova a chiudersi
   * da sola se è stata aperta come finestra secondaria, e altrimenti dice di
   * tornare al gestionale.
   */
  private page(ok: boolean, message: string, tenantAlias?: string): string {
    const color = ok ? '#047857' : '#b91c1c';
    const background = ok ? '#ecfdf5' : '#fef2f2';
    const border = ok ? '#a7f3d0' : '#fecaca';
    const title = ok ? 'Calendario collegato' : 'Collegamento non riuscito';
    const escape = (v: string) =>
      v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Il ritorno al gestionale serve a chi è arrivato qui senza finestra
    // secondaria — un link aperto dal telefono, o un browser che ha ignorato
    // il target. Senza, resterebbe su una pagina bianca di Curandis senza
    // sapere come rientrare.
    const backLink = tenantAlias
      ? `<p><a class="back" href="https://gestione.${escape(tenantAlias)}.curandis.cloud/">`
        + 'Torna al gestionale</a></p>'
      : '';

    return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>${escape(title)} — Curandis</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         display: flex; align-items: center; justify-content: center;
         min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
  .card { max-width: 460px; padding: 28px; border-radius: 12px;
          background: ${background}; border: 1px solid ${border}; text-align: center; }
  h1 { font-size: 1.1rem; margin: 0 0 10px; color: ${color}; }
  p { font-size: 0.9rem; line-height: 1.5; margin: 0 0 6px; }
  .hint { font-size: 0.8rem; color: #64748b; margin-top: 14px; }
  .back { display: inline-block; margin-top: 14px; padding: 9px 18px;
          background: #2563eb; color: #fff; border-radius: 8px;
          text-decoration: none; font-size: 0.9rem; font-weight: 600; }
</style>
</head>
<body>
  <div class="card">
    <h1>${escape(title)}</h1>
    <p>${escape(message)}</p>
    ${backLink}
    <p class="hint" id="hint">Puoi chiudere questa finestra e tornare al gestionale.</p>
  </div>
  <script>
    // Aperta come finestra secondaria: si chiude da sola dopo un attimo, il
    // tempo di leggere l'esito, e il gestionale è rimasto dietro intatto.
    if (window.opener) {
      var hint = document.getElementById('hint');
      if (hint) hint.textContent = 'Questa finestra si chiude da sola.';
      setTimeout(function () { window.close(); }, 4000);
    }
  </script>
</body>
</html>`;
  }
}
