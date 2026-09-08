import {
  BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional, forwardRef,
} from '@nestjs/common';
import { Between, In, MoreThanOrEqual, Not } from 'typeorm';
import { TenantContextService } from '@curandis/tenant-datasource';
import { randomBytes } from 'crypto';
import {
  PatientCalendarFeed,
  PatientCalendarFeedRevokedBy,
} from '../entities/patient-calendar-feed.entity';
import {
  AvailabilityAppointment, BookingStatus,
} from '../entities/availability-appointment.entity';
import { buildIcsCalendar, IcsEvent } from '../utils/ics.util';
import { toDateString } from '../utils/date-string.util';
import { RegistryClient } from '../../registry/registry.client';
import { WhatsappGatewayService } from '../../whatsapp/gateway/whatsapp-gateway.service';
import { WhatsappTemplateService } from '../../whatsapp/template/services/whatsapp-template.service';
import { WhatsappTemplateType } from '../../whatsapp/enums/whatsapp-enums';

/**
 * Il calendario dei propri appuntamenti, sottoscrivibile dal paziente.
 *
 * PERCHÉ UNA SOTTOSCRIZIONE E NON UN INVITO PER APPUNTAMENTO: un invito iMIP
 * porta un appuntamento solo (iTIP vuole un UID per messaggio, e i client veri
 * processano il primo evento e ignorano gli altri). Significherebbe una mail
 * per appuntamento più una a ogni spostamento. Qui il link parte UNA VOLTA e
 * il calendario del paziente si aggiorna da sé, per sempre, senza altra posta.
 *
 * COSA CONTIENE, e perché così poco: solo gli appuntamenti FUTURI e come
 * titolo solo la sede. Non il nome della prestazione, non il medico. Il
 * calendario di una persona lo legge il coniuge dal telefono di casa, lo
 * mostra una notifica sullo schermo bloccato, finisce nei backup: la riga
 * "fisioterapia" o "psicologo" lì dentro è un dato sanitario che nessuno ha
 * chiesto di pubblicare. L'ora e il posto bastano per non mancare l'impegno.
 *
 * IL TOKEN È UNA CREDENZIALE. Alla revoca sparisce dalla tabella invece di
 * restare disattivato, e le rotte rispondono 404 identico per token inesistente
 * e per feed revocato: distinguerli confermerebbe a un estraneo di aver
 * indovinato un token valido.
 */
@Injectable()
export class PatientCalendarFeedService {
  private readonly logger = new Logger(PatientCalendarFeedService.name);

  /**
   * Quanto avanti guarda il feed. Solo futuro, come deciso: il passato
   * clinico di una persona non ha motivo di stare in un calendario condiviso
   * col telefono di casa.
   */
  private static readonly FUTURE_DAYS = 365;

  /** Suggerimento di aggiornamento ai client. iOS ricontrolla ogni 15-60 min. */
  private static readonly REFRESH_MINUTES = 60;

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly registryClient: RegistryClient,
    // Il canale email e i template vivono nel modulo WhatsApp, che a sua volta
    // dipende da questo: opzionali e in forwardRef, come già fa il servizio
    // degli appuntamenti.
    @Optional() @Inject(forwardRef(() => WhatsappGatewayService))
    private readonly whatsappGateway?: WhatsappGatewayService,
    @Optional() @Inject(forwardRef(() => WhatsappTemplateService))
    private readonly templateService?: WhatsappTemplateService,
  ) {}

  /**
   * DataSource del tenant corrente (AsyncLocalStorage). Non si usa
   * `@InjectRepository`: con un database per tenant quel repository resterebbe
   * legato a una connessione statica e leggerebbe il database sbagliato.
   */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get feedRepo() { return this.dataSource.getRepository(PatientCalendarFeed); }
  private get appointmentRepo() { return this.dataSource.getRepository(AvailabilityAppointment); }

  // ==================== CICLO DI VITA DELLA SOTTOSCRIZIONE ====================

  /**
   * Sottoscrizione del paziente, creandola se non c'è o riattivandola se era
   * stata revocata.
   *
   * Riattivare genera token NUOVI: quelli vecchi sono stati revocati, e
   * rimetterli in circolo significherebbe che un link finito in mani sbagliate
   * torna a funzionare dopo una revoca.
   */
  async ensureFeed(patientId: string): Promise<PatientCalendarFeed> {
    const existing = await this.feedRepo.findOne({ where: { patientId } });

    if (existing?.enabled && existing.token) return existing;

    const feed = existing ?? this.feedRepo.create({ patientId });
    // 32 byte = 64 caratteri esadecimali: l'unica credenziale del feed, deve
    // essere impossibile da indovinare per tentativi.
    feed.token = randomBytes(32).toString('hex');
    feed.unsubscribeToken = randomBytes(32).toString('hex');
    feed.enabled = true;
    feed.revokedAt = undefined;
    feed.revokedBy = undefined;
    // Una riattivazione riparte da zero anche nei conteggi: il paziente dovrà
    // rifare la sottoscrizione, quindi dire che l'aveva già fatta sarebbe falso.
    feed.firstAccessAt = undefined;
    feed.lastAccessAt = undefined;

    return this.feedRepo.save(feed);
  }

  /** Stato della sottoscrizione, o null se il paziente non ne ha mai avuta una. */
  async findByPatient(patientId: string): Promise<PatientCalendarFeed | null> {
    return this.feedRepo.findOne({ where: { patientId } });
  }

  /**
   * Revoca: il link smette di rispondere e i segreti spariscono dalla riga.
   *
   * La riga resta, con le sue date: serve a rispondere a "a chi era stato
   * mandato?" e "quanti si sono tolti da soli?" anche dopo la revoca.
   */
  async revoke(
    patientId: string,
    by: PatientCalendarFeedRevokedBy,
  ): Promise<PatientCalendarFeed> {
    const feed = await this.feedRepo.findOne({ where: { patientId } });
    if (!feed) throw new NotFoundException('Nessuna sottoscrizione per questo paziente');
    return this.revokeRow(feed, by);
  }

  /**
   * Revoca dal link in fondo alla mail, senza autenticazione.
   *
   * Il token di disiscrizione è distinto da quello del calendario: chi apre
   * questa pagina non ottiene, per averla aperta, la possibilità di leggere
   * gli appuntamenti.
   *
   * Torna null per token inesistente O già revocato: chi apre non deve poter
   * distinguere i due casi. Idempotente — riaprire il link di una revoca già
   * fatta non è un errore da mostrare al paziente.
   */
  async revokeByUnsubscribeToken(token: string): Promise<boolean> {
    if (!this.isValidToken(token)) return false;

    const feed = await this.feedRepo.findOne({ where: { unsubscribeToken: token } });
    if (!feed) return false;

    await this.revokeRow(feed, PatientCalendarFeedRevokedBy.PATIENT);
    this.logger.log(`Sottoscrizione calendario revocata dal paziente ${feed.patientId}`);
    return true;
  }

  /** Esiste ed è ancora spendibile? Serve alla pagina di conferma. */
  async isUnsubscribeTokenLive(token: string): Promise<boolean> {
    if (!this.isValidToken(token)) return false;
    return this.feedRepo.exists({ where: { unsubscribeToken: token } });
  }

  /**
   * Il token del feed corrisponde a una sottoscrizione attiva?
   *
   * Serve alla pagina di sottoscrizione, che deve sapere se il link è ancora
   * buono senza LEGGERE il calendario: comporlo qui segnerebbe un accesso, e
   * `firstAccessAt` deve dire "un'app di calendario l'ha scaricato", non "il
   * paziente ha aperto la pagina". Sono due cose diverse ed è la seconda che
   * non conta.
   */
  async isFeedTokenLive(token: string): Promise<boolean> {
    if (!this.isValidToken(token)) return false;
    return this.feedRepo.exists({ where: { token, enabled: true } });
  }

  private async revokeRow(
    feed: PatientCalendarFeed,
    by: PatientCalendarFeedRevokedBy,
  ): Promise<PatientCalendarFeed> {
    feed.token = undefined;
    feed.unsubscribeToken = undefined;
    feed.enabled = false;
    feed.revokedAt = new Date();
    feed.revokedBy = by;
    return this.feedRepo.save(feed);
  }

  // ==================== REVOCHE IN BLOCCO ====================

  /**
   * Revoca ogni sottoscrizione attiva del tenant.
   *
   * È l'interruttore generale: serve quando si spegne la funzione, o dopo un
   * incidente in cui non si sa quali link siano in giro.
   */
  async revokeAll(): Promise<number> {
    const active = await this.feedRepo.find({ where: { enabled: true } });
    for (const feed of active) {
      await this.revokeRow(feed, PatientCalendarFeedRevokedBy.SYSTEM);
    }
    this.logger.log(`Revocate ${active.length} sottoscrizioni calendario (revoca totale)`);
    return active.length;
  }

  /**
   * Revoca le sottoscrizioni dei pazienti che non hanno più appuntamenti
   * futuri.
   *
   * È la pulizia periodica che tiene onesta la funzione: un paziente che ha
   * finito il ciclo continuerebbe altrimenti a esporre un calendario vuoto per
   * sempre, con un token vivo che nessuno ha motivo di tenere in circolo.
   */
  async revokeWithoutFutureAppointments(): Promise<number> {
    const active = await this.feedRepo.find({ where: { enabled: true } });
    if (active.length === 0) return 0;

    // Una query sola per tutti i pazienti, non una per paziente: le
    // sottoscrizioni attive possono essere centinaia.
    const withFuture = await this.appointmentRepo.find({
      where: {
        patientId: In(active.map((f) => f.patientId)),
        appointmentDate: MoreThanOrEqual(this.startOfToday()),
        bookingStatus: Not(In([
          BookingStatus.CANCELLED,
          BookingStatus.CANCELLED_EARLY,
          BookingStatus.CANCELLED_LATE,
        ])),
      },
      select: { id: true, patientId: true },
    });

    const keep = new Set(withFuture.map((a) => a.patientId).filter(Boolean));
    const stale = active.filter((f) => !keep.has(f.patientId));

    for (const feed of stale) {
      await this.revokeRow(feed, PatientCalendarFeedRevokedBy.SYSTEM);
    }

    this.logger.log(
      `Revocate ${stale.length} sottoscrizioni calendario senza appuntamenti futuri`,
    );
    return stale.length;
  }

  // ==================== PROSPETTO ====================

  /**
   * Tutte le sottoscrizioni, per il pannello di amministrazione.
   *
   * Le PII non stanno qui ma nel registry: i nomi li risolve il resolver,
   * in blocco, così questo servizio resta ignaro delle anagrafiche.
   */
  async findAll(): Promise<PatientCalendarFeed[]> {
    return this.feedRepo.find({ order: { createdAt: 'DESC' } });
  }

  // ==================== INVIO ====================

  /** Segna che il link è partito, e a quale indirizzo. */
  async markEmailSent(patientId: string, email: string): Promise<void> {
    await this.feedRepo.update({ patientId }, { emailSentAt: new Date(), emailSentTo: email });
  }

  /**
   * Email e nome del paziente secondo il registry, che è il master delle
   * anagrafiche: il clinico non li conserva.
   *
   * I due dati si prendono INSIEME, in una chiamata sola: servono entrambi
   * per la stessa mail — l'indirizzo per mandarla e il nome per il `{name}`
   * del template — e chiederli separatamente significherebbe interrogare il
   * registry due volte per la stessa persona.
   */
  async findPatientContact(
    patientId: string,
  ): Promise<{ email: string | null; name: string } | null> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) return null;

    try {
      const subject = await this.registryClient.getSubjectAsService(patientId, tenantAlias);
      if (!subject) return null;

      const primary = subject.contacts?.find((c) => c.isPrimary && c.contactType === 'EMAIL');
      const any = subject.contacts?.find((c) => c.contactType === 'EMAIL');

      return {
        email: (primary ?? any)?.value ?? null,
        name: `${subject.firstName ?? ''} ${subject.lastName ?? ''}`.trim(),
      };
    } catch (err) {
      this.logger.warn(
        `Lettura anagrafica paziente ${patientId} dal registry fallita: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** URL della pagina di sottoscrizione, quella che finisce nella mail. */
  buildSetupUrl(feed: PatientCalendarFeed, baseUrl: string, tenantAlias: string): string | null {
    if (!feed.enabled || !feed.token) return null;
    return `${baseUrl.replace(/\/$/, '')}/calendar-feed/patient/setup/${tenantAlias}/${feed.token}`;
  }

  /** URL della disiscrizione, in fondo alla mail come in una newsletter. */
  buildUnsubscribeUrl(
    feed: PatientCalendarFeed,
    baseUrl: string,
    tenantAlias: string,
  ): string | null {
    if (!feed.enabled || !feed.unsubscribeToken) return null;
    return `${baseUrl.replace(/\/$/, '')}/calendar-feed/patient/unsubscribe/${tenantAlias}/${feed.unsubscribeToken}`;
  }

  /** URL del feed vero, quello che entra nell'app calendario. */
  buildFeedUrl(feed: PatientCalendarFeed, baseUrl: string, tenantAlias: string): string | null {
    if (!feed.enabled || !feed.token) return null;
    return `${baseUrl.replace(/\/$/, '')}/calendar-feed/patient/${tenantAlias}/${feed.token}.ics`;
  }

  /**
   * Compone e manda al paziente la mail con il link del calendario.
   *
   * Sta qui e non nel resolver perché la usano in due: il pulsante nella
   * scheda paziente e l'aggancio al recap della prenotazione, che manda il
   * link la prima volta senza che nessuno debba ricordarsene.
   *
   * Gli errori sono PARLANTI e vengono propagati: chi preme il pulsante deve
   * sapere perché non è partito — manca l'email in anagrafica, manca l'SMTP —
   * non vedere un generico "operazione fallita". Il chiamante automatico li
   * cattura e li logga.
   */
  async sendInviteEmail(
    patientId: string,
    options?: { email?: string; patientName?: string },
  ): Promise<void> {
    if (!this.whatsappGateway || !this.templateService) {
      throw new BadRequestException('Canale email non disponibile: gateway non configurato');
    }

    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) {
      throw new BadRequestException('Tenant non risolto: impossibile comporre il link');
    }

    const contact = await this.findPatientContact(patientId);
    const email = options?.email?.trim() || contact?.email;
    if (!email) {
      throw new BadRequestException(
        "Il paziente non ha un indirizzo email in anagrafica: aggiungilo nel registry o indicane uno qui.",
      );
    }

    const template = await this.templateService.findByType(
      WhatsappTemplateType.CALENDAR_INVITE_EMAIL,
    );
    if (!template?.isActive || !template.bodyTemplate) {
      throw new BadRequestException(
        "Il testo dell'email del calendario non è configurato o è disattivato.",
      );
    }

    const feed = await this.ensureFeed(patientId);
    const base = this.publicBaseUrl();
    const link = this.buildSetupUrl(feed, base, tenantAlias);
    const unsubscribe = this.buildUnsubscribeUrl(feed, base, tenantAlias);
    if (!link || !unsubscribe) {
      throw new BadRequestException('Sottoscrizione non attiva: impossibile comporre il link');
    }

    // Senza nome il saluto diventerebbe "Gentile ,": meglio un generico che
    // una virgola sospesa. Capita per i pazienti creati come walk-in.
    const variables = {
      name: options?.patientName?.trim() || contact?.name || 'paziente',
      link,
      unsubscribe,
      appointments: await this.buildAppointmentLines(patientId),
    };

    await this.whatsappGateway.sendEmail({
      email,
      subject: this.templateService.renderTemplate(
        template.subjectTemplate?.trim() || 'I suoi appuntamenti sul calendario',
        variables,
      ),
      message: this.templateService.renderTemplate(template.bodyTemplate, variables),
    });

    await this.markEmailSent(patientId, email);
    this.logger.log(`Link calendario inviato al paziente ${patientId}`);
  }

  /**
   * Elenco dei prossimi appuntamenti del paziente, per il `{appointments}`
   * del template email.
   *
   * L'email può così valere anche da recap scritto: chi non ha WhatsApp, o
   * chi vuole rileggerlo con calma, trova nella stessa email sia quando deve
   * venire sia il link per non doverselo più ricordare.
   *
   * Se il template non usa `{appointments}` questo elenco semplicemente non
   * compare: il tenant decide se vuole l'email lunga o quella con il solo
   * link.
   */
  private async buildAppointmentLines(patientId: string): Promise<string> {
    const from = this.startOfToday();
    const to = new Date(from);
    to.setDate(from.getDate() + PatientCalendarFeedService.FUTURE_DAYS);

    const appointments = await this.appointmentRepo.find({
      where: {
        patientId,
        appointmentDate: Between(from, to),
        bookingStatus: Not(In([
          BookingStatus.CANCELLED,
          BookingStatus.CANCELLED_EARLY,
          BookingStatus.CANCELLED_LATE,
          BookingStatus.NO_SHOW,
        ])),
      },
      relations: ['site'],
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) {
      // Capita col rinvio a mano a chi non ha nulla in programma: meglio
      // dirlo che lasciare un elenco vuoto sotto la sua intestazione.
      return '(nessun appuntamento in programma al momento)';
    }

    return appointments
      .map((a) => {
        const [y, m, d] = toDateString(a.appointmentDate as unknown as Date | string).split('-');
        const time = String(a.startTime).slice(0, 5);
        // La sede c'è: in una email c'è lo spazio per dirla, e al paziente
        // che frequenta due studi serve.
        const where = a.site?.name?.trim();
        return `- ${d}/${m}/${y} alle ${time}${where ? ` — ${where}` : ''}`;
      })
      .join('\n');
  }

  /**
   * Manda il link SOLO se è il caso, per l'aggancio automatico al recap.
   *
   * La regola sta qui e non nel chiamante perché è una decisione di merito,
   * non un dettaglio del webhook, e dipende da CHI ha revocato:
   *
   *  - mai mandato → si manda, ed è il caso normale della prima prenotazione;
   *  - già mandato → non si rimanda: il link è ancora buono, e ripeterlo a
   *    ogni prenotazione sarebbe l'inondazione di posta che si voleva evitare
   *    scegliendo la sottoscrizione invece degli inviti;
   *  - revocato dal PAZIENTE → non si rimanda mai da soli. Si è tolto lui dal
   *    link in fondo alla mail: rimandarglielo alla prima occasione vanifica
   *    il senso stesso di quel link. Resta il pulsante nella scheda, se lo
   *    richiede a voce;
   *  - revocato dalla SEGRETERIA → non si rimanda: qualcuno l'ha deciso, e
   *    va disfatto dalla stessa parte da cui è stato deciso;
   *  - revocato da una PULIZIA IN BLOCCO → si rimanda. La pulizia toglie chi
   *    non aveva più appuntamenti: se ne sta prendendo uno adesso, la ragione
   *    per cui era stato tolto non c'è più. Senza questo, usare la pulizia
   *    periodica taglierebbe fuori per sempre chiunque torni.
   */
  async sendInviteIfDue(patientId: string): Promise<'sent' | 'skipped'> {
    const existing = await this.findByPatient(patientId);

    if (existing?.emailSentAt && existing.enabled) return 'skipped';
    if (
      existing?.revokedAt &&
      existing.revokedBy !== PatientCalendarFeedRevokedBy.SYSTEM
    ) {
      return 'skipped';
    }

    await this.sendInviteEmail(patientId);
    return 'sent';
  }

  /**
   * Base pubblica del backend: la stessa da cui il feed viene servito. In
   * produzione tutti i tenant parlano con `api.curandis.cloud`, quindi il
   * tenant viaggia nel path e non nel sottodominio.
   */
  private publicBaseUrl(): string {
    return process.env.CLINICO_PUBLIC_API_URL || 'https://api.curandis.cloud';
  }

  // ==================== LETTURA DEL FEED ====================

  /**
   * Il calendario a partire dal token. Null se il token non corrisponde a
   * nessun feed attivo — il chiamante risponde 404 senza distinguere fra "non
   * esiste" e "revocato".
   */
  async buildCalendarByToken(token: string): Promise<string | null> {
    if (!this.isValidToken(token)) return null;

    const feed = await this.feedRepo.findOne({ where: { token, enabled: true } });
    if (!feed) return null;

    // Mezzanotte, non "adesso": `appointmentDate` è una colonna `date`, e
    // confrontarla con un istante di metà giornata farebbe sparire dal
    // calendario gli appuntamenti di oggi pomeriggio.
    const from = this.startOfToday();
    const to = new Date(from);
    to.setDate(from.getDate() + PatientCalendarFeedService.FUTURE_DAYS);

    const appointments = await this.appointmentRepo.find({
      where: {
        patientId: feed.patientId,
        appointmentDate: Between(from, to),
        // Un appuntamento disdetto NON sparisce e basta: resta con
        // STATUS:CANCELLED, altrimenti i client che aggiornano per differenza
        // continuerebbero a mostrarlo al paziente per sempre.
        bookingStatus: Not(In([BookingStatus.NO_SHOW])),
      },
      relations: ['site'],
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });

    const events = appointments.map((a) => this.toIcsEvent(a));

    this.trackAccess(feed);

    return buildIcsCalendar(events, {
      // Nome neutro: comparirà nell'elenco dei calendari del telefono, dove lo
      // vede chiunque lo prenda in mano.
      calendarName: 'I miei appuntamenti',
      uidDomain: 'curandis.cloud',
      refreshIntervalMinutes: PatientCalendarFeedService.REFRESH_MINUTES,
    });
  }

  /**
   * Da appuntamento a evento del calendario del paziente.
   *
   * Il titolo è la SEDE e nient'altro. Niente prestazione, niente operatore:
   * vedi la nota in testa alla classe. Se la sede manca resta "Appuntamento",
   * che è comunque quello che serve per non dimenticarlo.
   */
  private toIcsEvent(appointment: AvailabilityAppointment): IcsEvent {
    const cancelled = [
      BookingStatus.CANCELLED,
      BookingStatus.CANCELLED_EARLY,
      BookingStatus.CANCELLED_LATE,
    ].includes(appointment.bookingStatus);

    return {
      uid: appointment.id,
      date: toDateString(appointment.appointmentDate as unknown as Date | string),
      startTime: String(appointment.startTime).slice(0, 5),
      endTime: String(appointment.endTime).slice(0, 5),
      summary: appointment.site?.name?.trim() || 'Appuntamento',
      location: appointment.site?.address?.trim() || undefined,
      lastModified: appointment.updatedAt,
      // Il SEQUENCE deve crescere a ogni modifica perché il client accetti
      // l'aggiornamento: `updatedAt` in secondi è l'unico segnale di modifica
      // che abbiamo, ed è monotono.
      sequence: appointment.updatedAt
        ? Math.floor(new Date(appointment.updatedAt).getTime() / 1000) % 2147483647
        : 0,
      cancelled,
    };
  }

  /**
   * Prima e ultima lettura del feed.
   *
   * `firstAccessAt` è l'unico dato che distingue "gli abbiamo mandato il link"
   * da "ce l'ha davvero nel telefono": senza, il prospetto racconterebbe
   * adesioni che non ci sono. Fire-and-forget — un problema qui non deve
   * impedire al paziente di leggere il proprio calendario.
   */
  private trackAccess(feed: PatientCalendarFeed): void {
    const now = new Date();
    this.feedRepo
      .update(
        { id: feed.id },
        { lastAccessAt: now, ...(feed.firstAccessAt ? {} : { firstAccessAt: now }) },
      )
      .catch((err) =>
        this.logger.warn(`Tracciamento accesso feed paziente fallito: ${err?.message}`),
      );
  }

  /**
   * Oggi a mezzanotte. `appointmentDate` è una colonna `date`: confrontarla
   * con un istante che porta anche l'ora esclude la giornata in corso.
   */
  private startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  /** 32 byte in esadecimale: la forma di tutti i token di questa feature. */
  private isValidToken(token: string): boolean {
    return !!token && /^[a-f0-9]{64}$/.test(token);
  }
}
