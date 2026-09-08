import {
  Injectable, Logger, NotFoundException, BadRequestException,
  Optional, Inject, forwardRef,
} from '@nestjs/common';
import { Between, In, Not } from 'typeorm';
import { TenantContextService } from '@curandis/tenant-datasource';
import { randomBytes } from 'crypto';
import { Operator } from '../entities/operator.entity';
import { CalendarFeedSetupLink } from '../entities/calendar-feed-setup-link.entity';
import { CalendarSyncSettingService } from './calendar-sync-setting.service';
import {
  AvailabilityAppointment, BookingStatus,
} from '../entities/availability-appointment.entity';
import { buildIcsCalendar, IcsEvent } from '../utils/ics.util';
import {
  buildExternalEventContent, isAppointmentVisibleExternally,
} from '../utils/external-event-content.util';
import { toDateString } from '../utils/date-string.util';
import { RegistryClient } from '../../registry/registry.client';
import { RegistrySubjectResponse } from '../../registry/registry.types';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';

/**
 * Feed ICS dell'agenda di un operatore.
 *
 * L'operatore sottoscrive un URL segreto dal proprio calendario (iOS, Google,
 * Outlook) e ci ritrova i suoi appuntamenti. È sola lettura e a senso unico:
 * quello che scrive nel calendario personale non torna indietro.
 *
 * Perché non un'integrazione vera con Google: la scrittura su Google Calendar
 * richiede OAuth col consenso del singolo operatore e un consent screen
 * verificato da Google (settimane), e Apple non espone alcuna API di
 * calendario. La sottoscrizione .ics è l'unico meccanismo nativo su tutti e
 * tre senza custodire credenziali altrui.
 */
@Injectable()
export class OperatorCalendarFeedService {
  private readonly logger = new Logger(OperatorCalendarFeedService.name);

  /** Finestra pubblicata: un mese indietro per la storia recente, sei mesi avanti. */
  private static readonly PAST_DAYS = 30;
  private static readonly FUTURE_DAYS = 180;

  /**
   * Suggerimento di aggiornamento dato ai client. È un suggerimento e basta:
   * iOS ricontrolla ogni 15-60 minuti, Google può arrivare a 24 ore. La UI lo
   * dice all'operatore, perché è il limite vero di questo meccanismo.
   */
  private static readonly REFRESH_MINUTES = 60;

  /** Quanto vive il link usa-e-getta mandato all'operatore. */
  private static readonly SETUP_LINK_TTL_MINUTES = 30;

  /** Quanti pazienti al massimo si risolvono nel registry per un singolo feed. */
  private static readonly MAX_PHONE_LOOKUPS = 200;

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly registryClient: RegistryClient,
    private readonly syncSettings: CalendarSyncSettingService,
    /** Opzionale: il push su Google è una conseguenza, non un prerequisito. */
    @Optional()
    @Inject(forwardRef(() => GoogleCalendarSyncService))
    private readonly googleSync?: GoogleCalendarSyncService,
  ) {}

  /**
   * DataSource del tenant della request corrente.
   *
   * NON si usa `@InjectRepository`: con un database per tenant quel
   * repository resterebbe legato a una connessione statica e leggerebbe il
   * database sbagliato. Il DataSource giusto sta nell'AsyncLocalStorage, e
   * per il feed lo popola il controller a mano (non c'è JWT da cui dedurlo).
   */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get operatorRepo() { return this.dataSource.getRepository(Operator); }
  private get setupLinkRepo() { return this.dataSource.getRepository(CalendarFeedSetupLink); }
  private get appointmentRepo() { return this.dataSource.getRepository(AvailabilityAppointment); }

  /**
   * Genera (o rigenera) il token del feed e lo attiva.
   *
   * Rigenerare **invalida il link precedente**: è anche il modo di revocare un
   * URL finito nelle mani sbagliate senza perdere la sottoscrizione, purché
   * l'operatore reinserisca il nuovo indirizzo nel telefono.
   */
  async generateToken(operatorId: string): Promise<Operator> {
    const operator = await this.findOperator(operatorId);

    // 32 byte = 64 caratteri esadecimali. È l'unica credenziale del feed:
    // deve essere impossibile da indovinare per tentativi.
    operator.calendarFeedToken = randomBytes(32).toString('hex');
    operator.calendarFeedEnabled = true;
    operator.calendarFeedCreatedAt = new Date();
    operator.calendarFeedRevokedAt = undefined;
    operator.calendarFeedLastAccessAt = undefined;

    await this.operatorRepo.save(operator);
    this.logger.log(`Feed calendario generato per operatore ${operatorId}`);
    return operator;
  }

  /**
   * Revoca il feed: l'URL smette di rispondere.
   *
   * Il token viene azzerato, non solo disattivato: un token che resta in
   * tabella dopo la revoca è un segreto che continua a esistere senza motivo.
   */
  async revokeToken(operatorId: string): Promise<Operator> {
    const operator = await this.findOperator(operatorId);
    operator.calendarFeedToken = undefined;
    operator.calendarFeedEnabled = false;
    operator.calendarFeedRevokedAt = new Date();
    await this.operatorRepo.save(operator);
    this.logger.log(`Feed calendario revocato per operatore ${operatorId}`);
    return operator;
  }

  /**
   * Attiva o disattiva il nome del paziente nel feed.
   *
   * La conferma informata avviene nella UI, che spiega cosa comporta prima di
   * arrivare qui. Il default resta "spento" e non cambia rigenerando il token.
   */
  /**
   * Attiva o disattiva il numero di telefono del paziente nel feed.
   * Interruttore indipendente da quello del nome.
   */
  async setShowPatientPhone(operatorId: string, show: boolean): Promise<Operator> {
    const operator = await this.findOperator(operatorId);
    operator.calendarFeedShowPatientPhone = show;
    await this.operatorRepo.save(operator);
    this.logger.log(
      `Feed calendario operatore ${operatorId}: telefono paziente ${show ? 'VISIBILE' : 'nascosto'}`,
    );
    this.resyncGoogle(operator);
    return operator;
  }

  /**
   * Riporta subito su Google il cambio di riservatezza.
   *
   * Il feed ICS si aggiorna da sé alla lettura successiva, ma gli eventi già
   * scritti su Google resterebbero com'erano fino al giro di riconciliazione:
   * chi SPEGNE la visibilità di un nome si aspetta che sparisca adesso, non
   * fra dieci minuti.
   */
  private resyncGoogle(operator: Operator): void {
    if (!operator.appUserId) return;
    this.googleSync?.scheduleInitialSync(operator.appUserId);
  }

  async setShowPatientName(operatorId: string, show: boolean): Promise<Operator> {
    const operator = await this.findOperator(operatorId);
    operator.calendarFeedShowPatientName = show;
    await this.operatorRepo.save(operator);
    this.logger.log(
      `Feed calendario operatore ${operatorId}: nome paziente ${show ? 'VISIBILE' : 'nascosto'}`,
    );
    this.resyncGoogle(operator);
    return operator;
  }

  /**
   * URL pubblico del feed, o null se non attivo.
   *
   * Il token non viaggia mai come campo dell'operatore nelle query: esce solo
   * da qui, su richiesta esplicita di chi ha i permessi.
   */
  buildFeedUrl(operator: Operator, baseUrl: string, tenantAlias: string): string | null {
    if (!operator.calendarFeedEnabled || !operator.calendarFeedToken) return null;
    return `${baseUrl.replace(/\/$/, '')}/calendar-feed/${tenantAlias}/${operator.calendarFeedToken}.ics`;
  }

  // ==================== LINK USA-E-GETTA ====================

  /**
   * Crea un link temporaneo per la sottoscrizione e invalida i precedenti.
   *
   * Invalidare i vecchi non è pignoleria: se la segreteria rimanda il link
   * perché il primo messaggio non è arrivato, restare con due link vivi
   * significa un secondo segreto in giro che nessuno sa di dover ritirare.
   */
  async issueSetupLink(
    operatorId: string,
    sentVia: string,
    sentTo: string,
    purpose: 'feed' | 'google_renew' = 'feed',
  ): Promise<string> {
    const operator = await this.findOperator(operatorId);
    // Il feed deve esistere solo per i link che lo sottoscrivono: quelli di
    // riautorizzazione Google riguardano un'altra cosa e devono poter partire
    // anche per chi non usa l'ICS.
    if (purpose === 'feed' && (!operator.calendarFeedEnabled || !operator.calendarFeedToken)) {
      throw new BadRequestException(
        'Genera prima il link della sincronizzazione: non c\'è ancora un feed da sottoscrivere.',
      );
    }

    // Brucia solo i link ANCORA VALIDI dello stesso scopo: un link di
    // sottoscrizione in volo non deve morire perche' e' partito un avviso di
    // scadenza Google.
    await this.setupLinkRepo.update(
      { operatorId, purpose, usedAt: undefined as any },
      { usedAt: new Date() },
    );

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(
      Date.now() + OperatorCalendarFeedService.SETUP_LINK_TTL_MINUTES * 60_000,
    );
    await this.setupLinkRepo.save(
      this.setupLinkRepo.create({ operatorId, token, expiresAt, sentVia, sentTo, purpose }),
    );

    this.logger.log(
      `Link ${purpose} emesso per operatore ${operatorId} (via ${sentVia})`,
    );
    return token;
  }

  /**
   * Guarda un link temporaneo SENZA consumarlo.
   *
   * Esiste per un motivo scoperto sul campo: WhatsApp (come i filtri di posta
   * e gli antivirus aziendali) scarica l'URL appena il messaggio parte, per
   * generare l'anteprima. Se la semplice apertura bruciasse il link, il
   * destinatario troverebbe sempre e solo "scaduto" — è esattamente quello
   * che è successo alla prima prova, con il consumo registrato **un secondo**
   * dopo l'invio.
   *
   * Quindi la visita in GET non consuma niente: mostra solo il pulsante di
   * attivazione. Il consumo avviene sul POST, che i crawler non fanno.
   */
  async peekSetupLink(token: string): Promise<{ operatorName: string } | null> {
    const link = await this.findValidSetupLink(token);
    if (!link) return null;

    const operator = await this.operatorRepo.findOne({ where: { id: link.operatorId } });
    if (!operator?.calendarFeedEnabled || !operator.calendarFeedToken) return null;

    return { operatorName: `${operator.name} ${operator.surname ?? ''}`.trim() };
  }

  /** Link ancora spendibile: esiste, non usato, non scaduto. */
  private async findValidSetupLink(
    token: string,
    purpose: 'feed' | 'google_renew' = 'feed',
  ): Promise<CalendarFeedSetupLink | null> {
    if (!token || !/^[a-f0-9]{48}$/.test(token)) return null;
    const link = await this.setupLinkRepo.findOne({ where: { token } });
    if (!link || link.usedAt || link.expiresAt.getTime() < Date.now()) return null;
    // Uno scopo diverso vale come token sconosciuto: chi apre non deve poter
    // capire che il link esiste ma serve ad altro.
    if ((link.purpose ?? 'feed') !== purpose) return null;
    return link;
  }

  /**
   * Guarda un link di QUALUNQUE scopo senza consumarlo.
   *
   * Generico perche' i link usa-e-getta servono ormai a due cose diverse
   * (sottoscrivere il feed, riautorizzare Google) ma la regola del crawler
   * vale identica per entrambe: la visita in GET non deve bruciare niente.
   */
  async peekLink(
    token: string,
    purpose: 'feed' | 'google_renew',
  ): Promise<CalendarFeedSetupLink | null> {
    return this.findValidSetupLink(token, purpose);
  }

  /** Consuma un link di qualunque scopo. Null se scaduto, gia' usato o di altro scopo. */
  async consumeLink(
    token: string,
    purpose: 'feed' | 'google_renew',
  ): Promise<CalendarFeedSetupLink | null> {
    const link = await this.findValidSetupLink(token, purpose);
    if (!link) return null;
    // Segnato PRIMA di restituire: meglio un link bruciato da rimandare che
    // uno riutilizzabile.
    await this.setupLinkRepo.update(link.id, { usedAt: new Date() });
    return link;
  }

  /**
   * Consuma un link temporaneo e restituisce ciò che serve alla pagina di
   * sottoscrizione. Null se scaduto, già usato o inesistente: chi apre non
   * deve poter distinguere i tre casi.
   */
  async consumeSetupLink(
    token: string,
  ): Promise<{ operatorName: string; feedToken: string; calendarLabel: string } | null> {
    const link = await this.findValidSetupLink(token);
    if (!link) return null;

    const operator = await this.operatorRepo.findOne({ where: { id: link.operatorId } });
    if (!operator?.calendarFeedEnabled || !operator.calendarFeedToken) return null;

    // Segnato come usato PRIMA di restituire: se qualcosa va storto dopo,
    // meglio un link bruciato da rimandare che uno riutilizzabile.
    await this.setupLinkRepo.update(link.id, { usedAt: new Date() });

    return {
      operatorName: `${operator.name} ${operator.surname ?? ''}`.trim(),
      feedToken: operator.calendarFeedToken,
      calendarLabel: `Agenda ${operator.name} ${operator.surname ?? ''}`.trim(),
    };
  }

  /**
   * Compone il calendario a partire dal token. Ritorna null se il token non
   * corrisponde a nessun feed attivo — il chiamante risponde 404 senza
   * distinguere fra "non esiste" e "revocato", per non confermare a un
   * estraneo che un token è stato valido.
   */
  async buildCalendarByToken(token: string): Promise<string | null> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

    const operator = await this.operatorRepo.findOne({
      where: { calendarFeedToken: token, calendarFeedEnabled: true },
    });
    if (!operator) return null;

    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - OperatorCalendarFeedService.PAST_DAYS);
    // Stessa regola di Google: se lo studio non conserva i passati, il feed
    // parte da oggi. Qui la pulizia e' automatica — il feed e' un documento
    // intero, e cio' che non c'e' dentro sparisce dal calendario da solo.
    if (!(await this.syncSettings.get()).keepPastAppointments) {
      from.setTime(new Date(today).setHours(0, 0, 0, 0));
    }
    const to = new Date(today);
    to.setDate(today.getDate() + OperatorCalendarFeedService.FUTURE_DAYS);

    const appointments = await this.appointmentRepo.find({
      where: {
        operatorId: operator.id,
        appointmentDate: Between(from, to),
        // I no-show restano: all'operatore serve sapere che quel buco c'era.
        bookingStatus: Not(In([BookingStatus.CANCELLED_EARLY])),
      },
      relations: ['service', 'appointmentServices', 'appointmentServices.service', 'site', 'room'],
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });

    // Telefoni: solo se richiesto, e solo per gli appuntamenti FUTURI — sono
    // gli unici per cui una telefonata ha senso, e limitarli tiene piccolo sia
    // il giro nel registry sia la quantità di dati esposti nel feed.
    const phonesByPatient = operator.calendarFeedShowPatientPhone
      ? await this.loadPatientPhones(appointments)
      : new Map<string, string>();

    const todayStr = toDateString(new Date());
    const events = appointments.map(a => this.toIcsEvent(a, operator, phonesByPatient, todayStr));
    const calendarName = `Agenda ${operator.name} ${operator.surname ?? ''}`.trim();

    // Tracciamento accesso: risponde a "il calendario si sta aggiornando?" e,
    // dopo una revoca, a "questo link lo sta ancora scaricando qualcuno?".
    // Fire-and-forget: un problema qui non deve impedire la lettura del feed.
    this.operatorRepo
      .update(operator.id, { calendarFeedLastAccessAt: new Date() })
      .catch(err => this.logger.warn(`Tracciamento accesso feed fallito: ${err?.message}`));

    return buildIcsCalendar(events, {
      calendarName,
      uidDomain: 'curandis.cloud',
      refreshIntervalMinutes: OperatorCalendarFeedService.REFRESH_MINUTES,
    });
  }

  /**
   * Da appuntamento a evento del calendario.
   *
   * Il titolo è la parte delicata: di default NON contiene il nome del
   * paziente, perché il feed viaggia su un URL non autenticato e finisce nel
   * calendario personale dell'operatore (e nei backup del suo telefono).
   * Senza nome resta comunque utile — orario, servizio, studio — che è quello
   * che serve per sapere se si è liberi.
   */
  /**
   * Telefoni dei pazienti degli appuntamenti futuri, presi dal registry.
   *
   * Il clinico non conserva i recapiti: sono nel registry, che è il master
   * delle anagrafiche. Una chiamata sola in blocco per tutti i pazienti
   * distinti, non una per appuntamento — un feed di un operatore pieno arriva
   * a duecento eventi e viene riscaricato ogni ora.
   *
   * Best-effort: se il registry non risponde il feed esce comunque, senza
   * numeri. Meglio un'agenda senza telefoni che nessuna agenda.
   */
  private async loadPatientPhones(
    appointments: AvailabilityAppointment[],
  ): Promise<Map<string, string>> {
    const phones = new Map<string, string>();
    const todayStr = toDateString(new Date());

    const patientIds = Array.from(new Set(
      appointments
        .filter(a => !!a.patientId
          && toDateString(a.appointmentDate as unknown as Date | string) >= todayStr)
        .map(a => a.patientId as string),
    )).slice(0, OperatorCalendarFeedService.MAX_PHONE_LOOKUPS);

    if (patientIds.length === 0) return phones;

    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) return phones;

    try {
      const subjects = await this.registryClient.bulkSubjectsAsService(patientIds, tenantAlias);
      for (const subject of subjects) {
        if (!subject) continue;
        const contacts = this.patientPhones(subject);
        if (contacts) phones.set(subject.id, contacts);
      }
    } catch (err) {
      this.logger.warn(`Recupero telefoni dal registry fallito: ${(err as Error).message}`);
    }

    return phones;
  }

  /**
   * TUTTI i recapiti telefonici del paziente, etichettati.
   *
   * Non solo il cellulare: se il paziente non risponde al mobile, il fisso è
   * esattamente ciò che serve a chi sta provando a rintracciarlo, ed è la
   * ragione per cui il numero è nel feed. Prima ne usciva uno solo e l'altro
   * andava perso.
   *
   * Il primario di ciascun tipo viene per primo; i duplicati (stesso numero
   * censito due volte) si eliminano confrontando le sole cifre.
   */
  private patientPhones(subject: RegistrySubjectResponse): string | undefined {
    const parts: string[] = [];
    const seen = new Set<string>();

    for (const [type, label] of [['MOBILE', 'Cell'], ['PHONE', 'Tel']] as const) {
      const ofType = (subject.contacts ?? [])
        .filter(c => c.contactType === type && !!c.value)
        // Il primario prima degli altri dello stesso tipo.
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

  private toIcsEvent(
    appointment: AvailabilityAppointment,
    operator: Operator,
    phonesByPatient: Map<string, string>,
    todayStr: string,
  ): IcsEvent {
    // Titolo, descrizione e luogo li decide `external-event-content.util`,
    // condiviso col push su Google: le regole di riservatezza devono essere
    // le stesse su entrambi i canali.
    const content = buildExternalEventContent(appointment, {
      showPatientName: operator.calendarFeedShowPatientName,
      showPatientPhone: operator.calendarFeedShowPatientPhone,
      patientPhone: appointment.patientId
        ? phonesByPatient.get(appointment.patientId)
        : undefined,
      todayStr,
    });

    return {
      uid: appointment.id,
      date: toDateString(appointment.appointmentDate as unknown as Date | string),
      startTime: String(appointment.startTime).slice(0, 5),
      endTime: String(appointment.endTime).slice(0, 5),
      summary: content.summary,
      description: content.description,
      location: content.location,
      lastModified: appointment.updatedAt,
      // SEQUENCE deve crescere a ogni modifica perché i client la applichino.
      // Il numero esatto non conta: conta che cambi quando cambia l'evento,
      // e updatedAt è l'unico segnale di modifica che abbiamo.
      sequence: appointment.updatedAt
        ? Math.floor(new Date(appointment.updatedAt).getTime() / 1000) % 2147483647
        : 0,
      cancelled: !isAppointmentVisibleExternally(appointment),
    };
  }

  private async findOperator(operatorId: string): Promise<Operator> {
    const operator = await this.operatorRepo.findOne({ where: { id: operatorId } });
    if (!operator) throw new NotFoundException(`Operatore ${operatorId} non trovato`);
    if (!operator.isActive) {
      throw new BadRequestException(
        'Operatore non attivo: non si può gestire il feed calendario',
      );
    }
    return operator;
  }
}
