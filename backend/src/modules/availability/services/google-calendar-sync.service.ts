import { Injectable, Logger } from '@nestjs/common';
import { Between, FindOptionsWhere, In, MoreThan, Not } from 'typeorm';
import { TenantContextService } from '@curandis/tenant-datasource';
import {
  AvailabilityAppointment, BookingStatus,
} from '../entities/availability-appointment.entity';
import { Operator } from '../entities/operator.entity';
import { CalendarSyncSettingService } from './calendar-sync-setting.service';
import { AppUser } from '../../users/entities/app-user.entity';
import {
  GoogleCalendarConnection,
  GoogleCalendarOwnerType,
  GoogleCalendarConnectionStatus,
} from '../entities/google-calendar-connection.entity';
import { GoogleCalendarConnectionService } from './google-calendar-connection.service';
import {
  GoogleCalendarApiService, GoogleAuthorizationExpiredError, GoogleEventBody,
} from './google-calendar-api.service';
import { GoogleCalendarOAuthService } from './google-calendar-oauth.service';
import { RegistryClient } from '../../registry/registry.client';
import { RegistrySubjectResponse } from '../../registry/registry.types';
import {
  buildExternalEventContent, isAppointmentVisibleExternally,
} from '../utils/external-event-content.util';
import { toDateString } from '../utils/date-string.util';

/**
 * Porta gli appuntamenti dentro il calendario Google dell'operatore.
 *
 * DUE MECCANISMI, e servono entrambi:
 *
 *  - **push immediato** quando un appuntamento nasce, cambia o sparisce. È
 *    ciò che rende utile l'integrazione OAuth rispetto al feed ICS, che il
 *    telefono ricontrolla quando gli pare.
 *  - **riconciliazione periodica**. Il push è fire-and-forget — non deve mai
 *    impedire di salvare un appuntamento perché Google è lento — quindi può
 *    perdersi qualcosa: una richiesta fallita, un riavvio a metà, una
 *    modifica passata da un percorso che non abbiamo agganciato. La
 *    riconciliazione è ciò che rende la correttezza indipendente dall'aver
 *    intercettato ogni singola scrittura.
 *
 * La riconciliazione lavora a DUE VELOCITÀ, e non è un dettaglio di
 * prestazioni: riscrivere ogni dieci minuti tutti gli appuntamenti di tutti
 * gli operatori esauriva la quota di Google a metà strada, e gli
 * appuntamenti che restavano fuori non arrivavano sul telefono. Il rimedio
 * al sovraccarico era diventato il guasto.
 *
 *  - **giro incrementale**, ogni dieci minuti: solo ciò che è cambiato dopo
 *    il segnalibro `syncedThroughAt`. Nella quasi totalità dei giri non c'è
 *    niente da scrivere e Google non viene nemmeno contattato.
 *  - **riversata integrale**, una al giorno per collegamento e una sola per
 *    giro: rimette a posto anche ciò che cambia SENZA toccare
 *    l'appuntamento (un servizio rinominato, un recapito aggiornato) e ciò
 *    che qualcuno ha cancellato a mano dal proprio calendario.
 *
 * NESSUNA TABELLA DI CORRISPONDENZA fra appuntamenti ed eventi: l'id
 * dell'evento su Google è l'UUID dell'appuntamento senza trattini. Una
 * mappatura in più sarebbe una cosa in più da tenere allineata e da riparare
 * quando si disallinea.
 */
@Injectable()
export class GoogleCalendarSyncService {
  private readonly logger = new Logger(GoogleCalendarSyncService.name);

  /** Finestra sincronizzata: come il feed ICS. */
  private static readonly PAST_DAYS = 30;
  private static readonly FUTURE_DAYS = 180;

  /** Tentativi del push immediato prima di lasciar fare alla riconciliazione. */
  private static readonly PUSH_ATTEMPTS = 3;

  /**
   * Ogni quanto un collegamento merita una riversata integrale.
   *
   * Ventiquattr'ore è il ritardo massimo con cui si sistema da sé una
   * differenza che il giro incrementale non può vedere — un servizio
   * rinominato, un evento cancellato a mano dal telefono. Tutto ciò che passa
   * dagli appuntamenti continua ad arrivare entro dieci minuti.
   */
  private static readonly FULL_SWEEP_HOURS = 24;

  /**
   * Di quanto il segnalibro resta indietro rispetto all'inizio del giro.
   *
   * Non è prudenza generica, è una corsa precisa. `updatedAt` viene timbrato
   * quando la UPDATE viene ESEGUITA, ma la riga diventa visibile agli altri
   * solo quando la transazione COMMITTA. Una modifica dentro una transazione
   * iniziata prima del giro e chiusa subito dopo la nostra query ha quindi un
   * `updatedAt` più vecchio del segnalibro pur non essendo mai stata letta:
   * portando il segnalibro fino all'istante di partenza la daremmo per
   * sincronizzata e non la guarderemmo MAI PIÙ.
   *
   * Due minuti di margine coprono con abbondanza le transazioni del
   * gestionale — la più lunga è la creazione di una serie ricorrente — e
   * costano solo la riscrittura di quel che è cambiato negli ultimi due
   * minuti, che è un'operazione idempotente e quasi sempre a vuoto.
   */
  private static readonly WATERMARK_LAG_MS = 2 * 60 * 1000;

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly connections: GoogleCalendarConnectionService,
    private readonly api: GoogleCalendarApiService,
    private readonly oauth: GoogleCalendarOAuthService,
    private readonly syncSettings: CalendarSyncSettingService,
    private readonly registryClient: RegistryClient,
  ) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get appointmentRepo() {
    return this.dataSource.getRepository(AvailabilityAppointment);
  }

  /**
   * Push di un appuntamento, senza far aspettare chi lo sta salvando.
   *
   * Fire-and-forget di proposito: un rallentamento di Google non deve
   * tradursi in una segreteria che aspetta davanti al calendario. Se fallisce
   * ci pensa la riconciliazione, e nel frattempo l'appuntamento è comunque
   * salvato nel gestionale, che è la fonte di verità.
   */
  schedulePush(appointmentId: string): void {
    // Il contesto tenant vive nell'AsyncLocalStorage della richiesta in corso:
    // catturato ora, perché fra un attimo la richiesta sarà finita.
    const context = this.tenantContext.getContext();
    if (!context) return;

    void this.tenantContext
      .run(context, () => this.pushWithRetry(appointmentId))
      .catch(err => this.logger.warn(`[GCAL] Push ${appointmentId} fallito: ${err?.message}`));
  }

  /** Rimozione dell'evento, con la stessa logica del push. */
  scheduleRemoval(appointmentId: string, operatorId?: string | null): void {
    const context = this.tenantContext.getContext();
    if (!context || !operatorId) return;

    void this.tenantContext
      .run(context, () => this.removeEvent(appointmentId, operatorId))
      .catch(err => this.logger.warn(`[GCAL] Rimozione ${appointmentId} fallita: ${err?.message}`));
  }

  private async pushWithRetry(appointmentId: string): Promise<void> {
    for (let attempt = 1; attempt <= GoogleCalendarSyncService.PUSH_ATTEMPTS; attempt++) {
      try {
        await this.pushOne(appointmentId);
        return;
      } catch (err) {
        // Autorizzazione scaduta: ritentare non serve, serve l'utente.
        if (err instanceof GoogleAuthorizationExpiredError) throw err;
        if (attempt === GoogleCalendarSyncService.PUSH_ATTEMPTS) throw err;
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }

  /** Allinea un singolo appuntamento sul calendario del suo operatore. */
  private async pushOne(appointmentId: string): Promise<void> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['appointmentServices', 'appointmentServices.service', 'service', 'site', 'room'],
    });
    if (!appointment?.operatorId) return;

    const target = await this.resolveTarget(appointment.operatorId);
    if (!target) return;

    // Un appuntamento disdetto non deve restare sul calendario: si toglie.
    if (!isAppointmentVisibleExternally(appointment)) {
      await this.deleteFromGoogle(target, appointment.id);
      return;
    }

    // Orari impossibili: Google lo rifiuterebbe, e i tre tentativi del push
    // servirebbero solo ad aspettare tre volte lo stesso "no".
    if (!this.hasUsableTimes(appointment)) {
      this.logger.warn(
        `[GCAL] Appuntamento ${appointment.id} non inviabile: finisce prima di cominciare `
        + `(${String(appointment.startTime).slice(0, 5)}–${String(appointment.endTime).slice(0, 5)})`,
      );
      return;
    }

    const phones = target.operator.calendarFeedShowPatientPhone
      ? await this.loadPhones([appointment])
      : new Map<string, string>();

    const accessToken = await this.oauth.accessTokenFor(target.connection);
    await this.api.upsertEvent(
      accessToken,
      target.connection.calendarId!,
      this.eventId(appointment.id),
      this.toGoogleEvent(appointment, target.operator, phones),
    );
    await this.connections.markSynced(target.connection.id);
  }

  private async removeEvent(appointmentId: string, operatorId: string): Promise<void> {
    const target = await this.resolveTarget(operatorId);
    if (!target) return;
    await this.deleteFromGoogle(target, appointmentId);
  }

  private async deleteFromGoogle(target: SyncTarget, appointmentId: string): Promise<void> {
    const accessToken = await this.oauth.accessTokenFor(target.connection);
    await this.api.deleteEvent(
      accessToken,
      target.connection.calendarId!,
      this.eventId(appointmentId),
    );
    await this.connections.markSynced(target.connection.id);
  }

  /**
   * Riallinea il calendario di un collegamento.
   *
   * `full` riscrive tutta la finestra; `incremental` solo ciò che è cambiato
   * dopo l'ultimo segnalibro. Il valore di default è `full` perché i
   * chiamanti che non scelgono sono quelli che vogliono vedere il risultato
   * ADESSO — il collegamento appena autorizzato, il "sincronizza ora" della
   * scheda operatore, il cambio delle impostazioni di riservatezza — e per
   * loro un giro incrementale non scriverebbe niente.
   */
  async syncWindowForConnection(
    connection: GoogleCalendarConnection,
    mode: SyncMode = 'full',
  ): Promise<number> {
    if (!connection.calendarId) return 0;

    const operator = await this.dataSource.getRepository(Operator).findOne({
      where: { appUserId: connection.ownerId },
    });
    if (!operator) return 0;

    const today = new Date();
    const to = new Date(today);
    to.setDate(today.getDate() + GoogleCalendarSyncService.FUTURE_DAYS);

    // Quanto indietro guardare lo decide lo studio: con "mantieni passati" si
    // risale al giorno del collegamento, senza si parte da oggi.
    const from = await this.syncSettings.pastBound({
      connectedAt: connection.connectedAt,
      fallbackDays: GoogleCalendarSyncService.PAST_DAYS,
      now: today,
    });

    // Senza segnalibro non esiste un "da dove": il primo giro dopo
    // l'aggiornamento è per forza integrale, e da lì in poi tiene il conto.
    const effective: SyncMode = connection.syncedThroughAt ? mode : 'full';

    /**
     * Preso PRIMA di leggere gli appuntamenti, non dopo.
     *
     * Ciò che cambia MENTRE la riversata è in corso deve restare al di sopra
     * del segnalibro: con l'istante di fine lo daremmo per scritto senza
     * averlo mai guardato, ed è la modifica dell'ultimo minuto — quella che
     * la segreteria ha appena fatto — a sparire per sempre.
     */
    const startedAt = new Date();

    // Il turno della riversata integrale si consuma qui, prima di qualunque
    // query: vedi `markFullSweepAttempt`.
    if (effective === 'full') {
      await this.connections.markFullSweepAttempt(connection.id, startedAt);
    }

    const appointments = await this.appointmentRepo.find({
      where: this.windowFilter(operator.id, from, to, effective, connection.syncedThroughAt),
      relations: ['appointmentServices', 'appointmentServices.service', 'service', 'site', 'room'],
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });

    const pruning = await this.pastToPrune(connection, operator.id, today);

    /**
     * Niente da scrivere e niente da togliere: si esce senza toccare nulla.
     * Non è un dettaglio di efficienza — è ciò che evita di chiedere un
     * access token a Google ogni dieci minuti per ogni operatore collegato
     * solo per scoprire che non c'era niente da fare.
     *
     * Vale SOLO per il giro incrementale. L'integrale deve arrivare in fondo
     * anche a mani vuote, perché è lì che si scovano gli strascichi — e un
     * operatore a cui hanno riassegnato tutti gli appuntamenti è esattamente
     * un operatore senza niente da scrivere e con il calendario pieno di
     * roba che non è più sua.
     */
    if (effective === 'incremental' && appointments.length === 0 && pruning.items.length === 0) {
      return 0;
    }

    const phones = operator.calendarFeedShowPatientPhone
      ? await this.loadPhones(appointments)
      : new Map<string, string>();

    // Un solo access token per tutta la riversata: rinnovarlo a ogni evento
    // sarebbe una chiamata in più per appuntamento, e sono centinaia.
    // FUORI dal try dei singoli eventi: un'autorizzazione scaduta non è il
    // fallimento di un appuntamento, è il fallimento del collegamento, e chi
    // ci ha chiamati deve poterlo distinguere.
    const accessToken = await this.oauth.accessTokenFor(connection);

    let done = 0;
    let malformati = 0;
    let oldestFailure: Date | null = null;

    for (const appointment of appointments) {
      /**
       * Un appuntamento che finisce prima di cominciare non è
       * rappresentabile come evento, e Google lo rifiuta — giustamente — con
       * "The specified time range is empty".
       *
       * Si SALTA invece di contarlo fra i falliti, ed è una distinzione che
       * conta: un fallimento riporta indietro il segnalibro perché il giro
       * dopo lo ripeschi, ma questo non guarirà al prossimo tentativo. Contarlo
       * come tale terrebbe il segnalibro inchiodato per sempre alla sua data,
       * e ogni dieci minuti riesamineremmo tutto quello che è cambiato da
       * allora — cioè il lavoro inutile che questa riconciliazione serve a
       * togliere, rimesso in piedi da una riga di dati sbagliata.
       */
      if (isAppointmentVisibleExternally(appointment) && !this.hasUsableTimes(appointment)) {
        malformati++;
        continue;
      }

      try {
        if (isAppointmentVisibleExternally(appointment)) {
          await this.api.upsertEvent(
            accessToken,
            connection.calendarId,
            this.eventId(appointment.id),
            this.toGoogleEvent(appointment, operator, phones),
          );
        } else {
          // Disdetto da quando l'abbiamo guardato l'ultima volta: va TOLTO,
          // non riscritto.
          await this.api.deleteEvent(
            accessToken, connection.calendarId, this.eventId(appointment.id),
          );
        }
        done++;
      } catch (err) {
        // Si tiene la modifica più VECCHIA fra quelle fallite: è quella che,
        // riportando indietro il segnalibro, le rimette tutte in gioco.
        if (!oldestFailure || appointment.updatedAt < oldestFailure) {
          oldestFailure = appointment.updatedAt;
        }
        this.logger.warn(
          `[GCAL] Evento ${appointment.id} non sincronizzato: ${(err as Error).message}`,
        );
      }
    }

    const pruned = await this.prune(
      accessToken, connection.calendarId, pruning.items, pruning.through,
    );

    const strays = effective === 'full'
      ? await this.sweepStrays(accessToken, connection.calendarId, operator.id, from, to, appointments)
      : 0;

    /**
     * Fin dove possiamo dire di essere allineati.
     *
     * Un solo evento rimasto indietro e il segnalibro si ferma un istante
     * PRIMA della sua ultima modifica: al giro successivo rientra da sé nella
     * selezione, insieme a tutto ciò che nel frattempo è cambiato. Così non
     * serve tenere un elenco di cose da riprovare — che sarebbe una cosa in
     * più da mantenere allineata, e da riparare quando si disallinea.
     */
    const syncedThroughAt = oldestFailure
      ? new Date(oldestFailure.getTime() - 1)
      : new Date(startedAt.getTime() - GoogleCalendarSyncService.WATERMARK_LAG_MS);

    await this.connections.markSynced(connection.id, {
      syncedThroughAt,
      prunedThroughDate: pruned.prunedThrough ?? undefined,
    });

    this.logger.log(
      `[GCAL] ${effective === 'full' ? 'Riversata' : 'Aggiornamento'} `
      + `su "${connection.calendarName}": ${done}/${appointments.length} appuntamenti`
      + (pruned.removed ? `, ${pruned.removed} passati rimossi` : '')
      + (strays ? `, ${strays} strascichi tolti` : '')
      + (malformati ? `, ${malformati} saltati per orari non validi` : '')
      + (oldestFailure ? ' — qualcosa è rimasto indietro, si riprova al giro dopo' : ''),
    );
    return done;
  }

  /**
   * Quali appuntamenti guardare in questo giro.
   *
   * La differenza fra i due modi non è solo "quanti": è anche QUALI stati.
   */
  private windowFilter(
    operatorId: string,
    from: Date,
    to: Date,
    mode: SyncMode,
    syncedThroughAt?: Date,
  ): FindOptionsWhere<AvailabilityAppointment> {
    const base: FindOptionsWhere<AvailabilityAppointment> = {
      operatorId,
      appointmentDate: Between(from, to),
    };

    if (mode === 'full' || !syncedThroughAt) {
      // L'integrale scrive ciò che DEVE esserci, e basta.
      return {
        ...base,
        bookingStatus: Not(In([
          BookingStatus.CANCELLED,
          BookingStatus.CANCELLED_EARLY,
          BookingStatus.CANCELLED_LATE,
        ])),
      };
    }

    /**
     * L'incrementale guarda ciò che è cambiato, DISDETTI COMPRESI: un
     * appuntamento disdetto è cambiato proprio nel senso che va tolto da
     * Google.
     *
     * Escluderli qui è il modo in cui una serie disdetta in blocco restava
     * sul telefono dell'operatore per sempre: la disdetta di gruppo non passa
     * dal push immediato, e la riconciliazione non li guardava.
     */
    return { ...base, updatedAt: MoreThan(syncedThroughAt) };
  }

  /**
   * Gli appuntamenti passati ancora da togliere da Google.
   *
   * Serve perché la sincronizzazione normale si limita a scrivere: un evento
   * che esce dalla finestra smette di essere aggiornato ma resta lì per
   * sempre. Senza questa pulizia, "non mantenere i passati" non avrebbe alcun
   * effetto su quello che l'operatore vede già sul telefono.
   *
   * Il gestionale non viene toccato: gli appuntamenti restano tutti, è solo
   * la copia su Google che viene sfoltita.
   *
   * Qui si fa SOLO la query. Il dialogo con Google viene dopo, e solo se c'è
   * davvero qualcosa da togliere.
   */
  private async pastToPrune(
    connection: GoogleCalendarConnection,
    operatorId: string,
    today: Date,
  ): Promise<{ items: AvailabilityAppointment[]; through: string | null }> {
    const nothing = { items: [] as AvailabilityAppointment[], through: null };

    const setting = await this.syncSettings.get();
    if (setting.keepPastAppointments) return nothing;

    const midnight = new Date(today);
    midnight.setHours(0, 0, 0, 0);

    /**
     * Fino a IERI, non a oggi.
     *
     * `Between` include gli estremi, e la finestra di scrittura parte proprio
     * da mezzanotte: con `midnight` come limite superiore gli appuntamenti di
     * OGGI venivano scritti e poi subito cancellati, a ogni ciclo. Sul
     * telefono sarebbero spariti quelli della giornata in corso — cioè gli
     * unici che servono davvero.
     */
    const endOfYesterday = new Date(midnight.getTime() - 1);

    /**
     * Da dove ripartire: dal giorno DOPO l'ultima potatura completata.
     *
     * Senza questo segnalibro ogni giro ripercorreva tutti i passati della
     * finestra per ricancellare cose già cancellate — centinaia di 404 ogni
     * dieci minuti, che non toglievano niente e bruciavano la quota che
     * serviva a scrivere gli appuntamenti veri.
     */
    const since = connection.prunedThroughDate
      ? this.dayAfter(connection.prunedThroughDate)
      : this.pruneBacklogStart(connection, today);

    if (since > endOfYesterday) return nothing;

    const items = await this.appointmentRepo.find({
      where: { operatorId, appointmentDate: Between(since, endOfYesterday) },
      select: { id: true, appointmentDate: true },
      order: { appointmentDate: 'ASC' },
    });

    return { items, through: toDateString(endOfYesterday) };
  }

  /**
   * Da dove parte la potatura quando non c'è ancora nessun segnalibro.
   *
   * NON dal collegamento: gli eventi da togliere sono quelli che ci sono
   * finiti quando la finestra andava trenta giorni indietro, cioè PRIMA del
   * collegamento. Ancorandola a `connectedAt` l'intervallo risultava pure
   * invertito — inizio dopo la fine — e non rimuoveva mai niente, mentre gli
   * appuntamenti restavano bene in vista sul telefono.
   *
   * Si prende quindi la più lontana fra la data del collegamento e la
   * finestra fissa: è l'insieme di tutto ciò che possiamo avergli mandato.
   */
  private pruneBacklogStart(connection: GoogleCalendarConnection, today: Date): Date {
    const window = new Date(today);
    window.setDate(window.getDate() - GoogleCalendarSyncService.PAST_DAYS);
    const connected = new Date(connection.connectedAt);
    return connected < window ? connected : window;
  }

  /**
   * Toglie da Google i passati, e dice fin dove ci è riuscita.
   *
   * Al primo intoppo si ferma, e il segnalibro si ferma al giorno PRIMA:
   * insistere non aiuta — se è la quota, le cancellazioni successive
   * falliscono uguale — e riprendere dal giorno buono è ciò che rende la
   * potatura ripetibile senza rifare da capo ogni volta.
   */
  private async prune(
    accessToken: string,
    calendarId: string,
    items: AvailabilityAppointment[],
    through: string | null,
  ): Promise<{ removed: number; prunedThrough: string | null }> {
    let removed = 0;

    for (const appointment of items) {
      try {
        const deleted = await this.api.deleteEvent(
          accessToken, calendarId, this.eventId(appointment.id),
        );
        // Solo le rimozioni VERE: i 404 sono appuntamenti già tolti in un
        // giro precedente, e contarli direbbe che si sta lavorando quando non
        // c'è più niente da fare.
        if (deleted) removed++;
      } catch (err) {
        const day = toDateString(appointment.appointmentDate as unknown as Date | string);
        this.logger.warn(
          `[GCAL] Potatura interrotta al ${day}: ${(err as Error).message}`,
        );
        return { removed, prunedThrough: this.dayBefore(day) };
      }
    }

    return { removed, prunedThrough: through };
  }

  /**
   * Toglie dal calendario gli eventi che non dovrebbero più esserci.
   *
   * IL BUCO CHE CHIUDE: quando un appuntamento viene riassegnato a un altro
   * operatore, viene scritto sul calendario nuovo — ma su quello vecchio
   * resta per sempre. Non lo cancella nessuno perché, una volta cambiato
   * l'`operatorId`, non risulta più da nessuna parte che ci fosse finito. Lo
   * stesso vale per una serie disdetta in blocco prima che la riconciliazione
   * imparasse a guardare i disdetti, e per gli appuntamenti cancellati dal
   * gestionale mentre Google era irraggiungibile.
   *
   * Si ripara CONFRONTANDO invece di ricordando: si chiede a Google cosa ha
   * nella finestra e si toglie ciò che non ha diritto di starci. Nessuna
   * tabella di corrispondenza da tenere allineata — che è la stessa ragione
   * per cui l'id dell'evento è l'UUID dell'appuntamento — e la riparazione
   * vale anche per gli strascichi lasciati da versioni precedenti del codice,
   * che nessun elenco avrebbe mai registrato.
   *
   * Solo nella riversata integrale: serve l'insieme COMPLETO di ciò che deve
   * esserci, e il giro incrementale per definizione non ce l'ha.
   */
  private async sweepStrays(
    accessToken: string,
    calendarId: string,
    operatorId: string,
    from: Date,
    to: Date,
    expected: AvailabilityAppointment[],
  ): Promise<number> {
    const legittimi = new Set(
      expected
        .filter(a => isAppointmentVisibleExternally(a))
        .map(a => this.eventId(a.id)),
    );

    const presenti = await this.api.listOwnEventIds(accessToken, calendarId, from, to);
    const sospetti = presenti.filter(id => !legittimi.has(id));
    if (sospetti.length === 0) return 0;

    /**
     * Prima di cancellare, si chiede al database.
     *
     * Fra la nostra query e la risposta di Google passano secondi, e in quei
     * secondi la segreteria può aver creato un appuntamento che il push
     * immediato ha già scritto: comparirebbe fra i "presenti" senza essere
     * fra i "legittimi", e lo cancelleremmo un attimo dopo averlo creato.
     * Questa verifica è ciò che distingue uno strascico da un appuntamento
     * appena nato.
     */
    const attuali = await this.appointmentRepo.find({
      where: { id: In(sospetti.map(id => this.uuidFromEventId(id))) },
      select: { id: true, operatorId: true, bookingStatus: true },
    });
    const perId = new Map(attuali.map(a => [a.id, a]));

    let removed = 0;
    for (const eventId of sospetti) {
      const appointment = perId.get(this.uuidFromEventId(eventId));
      const suo = !!appointment
        && appointment.operatorId === operatorId
        && isAppointmentVisibleExternally(appointment);
      if (suo) continue;

      try {
        if (await this.api.deleteEvent(accessToken, calendarId, eventId)) removed++;
      } catch (err) {
        // Non si interrompe il giro: uno strascico che resta un giorno in più
        // è molto meno grave di una pulizia che si ferma al primo intoppo e
        // lascia indietro tutti gli altri.
        this.logger.warn(
          `[GCAL] Strascico ${eventId} non rimosso: ${(err as Error).message}`,
        );
      }
    }

    if (removed > 0) {
      this.logger.log(
        `[GCAL] ${removed} eventi tolti da un calendario a cui non appartenevano più`,
      );
    }
    return removed;
  }

  /**
   * Se l'appuntamento abbia orari che descrivono una durata vera.
   *
   * Confronto fra stringhe 'HH:MM': l'ordine alfabetico e quello cronologico
   * coincidono, e non serve costruire due Date per scoprire che le sedici e
   * mezza vengono dopo le sette.
   */
  private hasUsableTimes(appointment: AvailabilityAppointment): boolean {
    return String(appointment.startTime).slice(0, 5)
      < String(appointment.endTime).slice(0, 5);
  }

  /** Dall'id dell'evento all'UUID dell'appuntamento: si rimettono i trattini. */
  private uuidFromEventId(eventId: string): string {
    return [
      eventId.slice(0, 8),
      eventId.slice(8, 12),
      eventId.slice(12, 16),
      eventId.slice(16, 20),
      eventId.slice(20),
    ].join('-');
  }

  /** Giorno successivo a una data 'YYYY-MM-DD', a mezzanotte locale. */
  private dayAfter(date: string): Date {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    return next;
  }

  /** Giorno precedente a una data 'YYYY-MM-DD', come stringa. */
  private dayBefore(date: string): string {
    const previous = new Date(`${date}T00:00:00`);
    previous.setDate(previous.getDate() - 1);
    return toDateString(previous);
  }

  /** Riversata iniziale subito dopo il collegamento, in background. */
  scheduleInitialSync(ownerId: string): void {
    const context = this.tenantContext.getContext();
    if (!context) return;

    void this.tenantContext
      .run(context, async () => {
        const connection = await this.connections.findByOwner(
          GoogleCalendarOwnerType.APP_USER, ownerId,
        );
        if (connection?.status === GoogleCalendarConnectionStatus.ACTIVE) {
          await this.syncWindowForConnection(connection);
        }
      })
      .catch(err => this.logger.error(`[GCAL] Riversata iniziale fallita: ${err?.message}`));
  }

  /**
   * Riconcilia tutti i collegamenti attivi del tenant corrente.
   *
   * Da chiamare dentro un contesto tenant già costruito (lo fa il job).
   */
  async reconcileTenant(): Promise<void> {
    const repo = this.dataSource.getRepository(GoogleCalendarConnection);
    // Anche quelle in ERRORE, non solo le attive.
    //
    // Un errore di sincronizzazione e' quasi sempre passeggero — Google
    // irraggiungibile, un nostro bug, una rete che cade — ma escludendole
    // dalla riconciliazione un guasto di un minuto diventava definitivo:
    // nessuno le riprovava piu' e restavano ferme per sempre.
    // Le scadute (EXPIRED) e le revocate restano fuori: quelle non si
    // recuperano ritentando, serve che una persona riautorizzi.
    const active = await repo.find({
      where: [
        { status: GoogleCalendarConnectionStatus.ACTIVE },
        { status: GoogleCalendarConnectionStatus.ERROR },
      ],
    });

    /**
     * Una sola riversata integrale per giro, e tocca a chi l'ha fatta più
     * tempo fa.
     *
     * L'integrale è la parte cara: farle tutte nello stesso giro rimetterebbe
     * in piedi esattamente il picco di richieste che si vuole togliere — ed è
     * il picco, non il totale, a far scattare il limite di Google. Una per
     * giro ogni dieci minuti vuol dire che con una manciata di operatori
     * ognuno la riceve molto più spesso delle ventiquattr'ore che
     * servirebbero, e il picco non c'è mai.
     */
    const dueForFull = this.pickFullSweep(active);

    for (const connection of active) {
      try {
        await this.syncWindowForConnection(
          connection,
          connection.id === dueForFull?.id ? 'full' : 'incremental',
        );
      } catch (err) {
        if (err instanceof GoogleAuthorizationExpiredError) {
          this.logger.warn(
            `[GCAL] Autorizzazione scaduta per ${connection.googleEmail}: serve ricollegare`,
          );
          continue;
        }
        await this.connections.markError(connection.id, (err as Error).message);
        this.logger.error(
          `[GCAL] Riconciliazione fallita per ${connection.googleEmail}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Il collegamento a cui tocca la riversata integrale, se a qualcuno tocca.
   *
   * Chi non ne ha mai fatta una viene prima di tutti: è il collegamento
   * appena aggiornato, che non ha ancora un segnalibro e senza integrale non
   * potrebbe nemmeno cominciare a lavorare per differenze.
   */
  private pickFullSweep(
    connections: GoogleCalendarConnection[],
  ): GoogleCalendarConnection | null {
    const deadline =
      Date.now() - GoogleCalendarSyncService.FULL_SWEEP_HOURS * 60 * 60 * 1000;

    const due = connections.filter(
      c => !c.lastFullSyncAt || new Date(c.lastFullSyncAt).getTime() <= deadline,
    );
    if (due.length === 0) return null;

    return due.sort(
      (a, b) =>
        (a.lastFullSyncAt ? new Date(a.lastFullSyncAt).getTime() : 0)
        - (b.lastFullSyncAt ? new Date(b.lastFullSyncAt).getTime() : 0),
    )[0];
  }

  // ==================== COSTRUZIONE EVENTO ====================

  /**
   * Id dell'evento su Google: UUID senza trattini.
   *
   * Google accetta solo caratteri base32hex (0-9, a-v): le 32 cifre
   * esadecimali di un UUID ci stanno tutte dentro.
   */
  private eventId(appointmentId: string): string {
    return appointmentId.replace(/-/g, '').toLowerCase();
  }

  private toGoogleEvent(
    appointment: AvailabilityAppointment,
    operator: Operator,
    phones: Map<string, string>,
  ): GoogleEventBody {
    const content = buildExternalEventContent(appointment, {
      showPatientName: operator.calendarFeedShowPatientName,
      showPatientPhone: operator.calendarFeedShowPatientPhone,
      patientPhone: appointment.patientId ? phones.get(appointment.patientId) : undefined,
      todayStr: toDateString(new Date()),
    });

    const date = toDateString(appointment.appointmentDate as unknown as Date | string);
    const start = String(appointment.startTime).slice(0, 5);
    const end = String(appointment.endTime).slice(0, 5);

    return {
      summary: content.summary,
      description: content.description,
      location: content.location,
      // Ora locale + fuso dichiarato: la conversione la fa Google. Nessuna
      // aritmetica sui fusi da mantenere, a differenza del feed ICS dove il
      // formato impone UTC.
      start: { dateTime: `${date}T${start}:00`, timeZone: 'Europe/Rome' },
      end: { dateTime: `${date}T${end}:00`, timeZone: 'Europe/Rome' },
    };
  }

  /** Recapiti dei pazienti degli appuntamenti futuri, in una sola chiamata. */
  private async loadPhones(
    appointments: AvailabilityAppointment[],
  ): Promise<Map<string, string>> {
    const phones = new Map<string, string>();
    const todayStr = toDateString(new Date());

    const ids = Array.from(new Set(
      appointments
        .filter(a => !!a.patientId
          && toDateString(a.appointmentDate as unknown as Date | string) >= todayStr)
        .map(a => a.patientId as string),
    )).slice(0, 200);
    if (ids.length === 0) return phones;

    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) return phones;

    try {
      const subjects = await this.registryClient.bulkSubjectsAsService(ids, tenantAlias);
      for (const subject of subjects) {
        if (!subject) continue;
        const contacts = this.patientPhones(subject);
        if (contacts) phones.set(subject.id, contacts);
      }
    } catch (err) {
      // Best-effort: senza recapiti il calendario esce comunque.
      this.logger.warn(`[GCAL] Recupero telefoni fallito: ${(err as Error).message}`);
    }
    return phones;
  }

  /** Tutti i recapiti, etichettati e deduplicati sulle cifre. */
  private patientPhones(subject: RegistrySubjectResponse): string | undefined {
    const parts: string[] = [];
    const seen = new Set<string>();

    for (const [type, label] of [['MOBILE', 'Cell'], ['PHONE', 'Tel']] as const) {
      const ofType = (subject.contacts ?? [])
        .filter(c => c.contactType === type && !!c.value)
        .sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
      for (const contact of ofType) {
        const digits = contact.value.replace(/\D/g, '');
        if (!digits || seen.has(digits)) continue;
        seen.add(digits);
        parts.push(`${label}: ${contact.value}`);
      }
    }
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }

  /**
   * Collegamento e operatore a cui appartiene un appuntamento.
   *
   * Il percorso è appuntamento → operatore → app_user → collegamento: il
   * calendario appartiene alla PERSONA, mentre `operators` porta il ruolo.
   */
  private async resolveTarget(operatorId: string): Promise<SyncTarget | null> {
    const operator = await this.dataSource
      .getRepository(Operator)
      .findOne({ where: { id: operatorId } });
    if (!operator?.appUserId) return null;

    const connection = await this.connections.findByOwner(
      GoogleCalendarOwnerType.APP_USER,
      operator.appUserId,
    );
    if (
      !connection
      || connection.status !== GoogleCalendarConnectionStatus.ACTIVE
      || !connection.calendarId
    ) {
      return null;
    }

    return { operator, connection };
  }
}

interface SyncTarget {
  operator: Operator;
  connection: GoogleCalendarConnection;
}

/**
 * Come riallineare un calendario.
 *
 * `full` riscrive tutta la finestra, `incremental` solo ciò che è cambiato
 * dopo l'ultimo segnalibro.
 */
export type SyncMode = 'full' | 'incremental';
