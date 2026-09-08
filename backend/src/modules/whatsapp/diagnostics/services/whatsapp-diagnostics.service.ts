import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';
import { RegistryClient } from '../../../registry/registry.client';

import {
  NotificationCategory,
} from '../../notifications/entities/notification-channel-setting.entity';
import { NotificationChannelService } from '../../notifications/services/notification-channel.service';
import { WhatsappGatewayService } from '../../gateway/whatsapp-gateway.service';
import { AvailabilityAppointmentService } from '../../../availability/services/availability-appointment.service';
import {
  AppointmentNotificationIssue,
  NotificationIssueKind,
  PatientNotificationIssues,
  ContactState,
  PhoneNumberIssue,
  ResendOutcome,
  WhatsappDiagnostics,
} from '../dto/whatsapp-diagnostics.output';

/**
 * Quanto si concede a un messaggio per uscire prima di considerarlo fermo.
 *
 * Il gateway raggruppa per 180 secondi e poi tiene i messaggi automatici a
 * 10 secondi l'uno dall'altro: un recupero di trenta pazienti impiega
 * legittimamente sette-otto minuti. Sotto il quarto d'ora si segnalerebbero
 * come guasti dei messaggi semplicemente in coda.
 */
const ATTESA_MASSIMA_MINUTI = 15;

/** Messaggi che comunicano al paziente QUANDO ha l'appuntamento. */
const TIPI_CHE_COMUNICANO_LA_DATA = [
  'recap_single', 'recap_multi', 'update', 'update_multi',
];

/** Messaggi che comunicano che l'appuntamento non c'è più. */
const TIPI_DI_DISDETTA = ['cancellation', 'cancellation_multi'];

const STATI_CONSEGNATI = ['sent', 'delivered', 'read'];
const STATI_IN_VOLO = ['dispatched', 'pending'];

const BOOKING_DISDETTI = ['cancelled', 'cancelled_early', 'cancelled_late'];

interface RigaRiconciliazione {
  appointment_id: string;
  appointment_date: string;
  start_time: string;
  booked_at: string;
  contact_state: string;
  cancelled_at_label: string | null;
  patient_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  booking_status: string;
  created_at: Date;
  cancelled_at: Date | null;
  slot: Date;
  msg_status: string | null;
  msg_at: Date | null;
  announced: Date | null;
  announced_label: string | null;
  msg_patient_name: string | null;
  msg_phone: string | null;
  canc_at: Date | null;
  canc_status: string | null;
  in_volo: boolean;
}

/**
 * Che cosa il paziente NON ha ricevuto, e come rimediare.
 *
 * Riconcilia gli appuntamenti con i messaggi invece di limitarsi a guardare
 * la tabella dei log, perché il guasto peggiore non lascia log: quando nessun
 * canale acceso porta una categoria, `dispatchBooking` esce prima di scrivere
 * la riga. Il 21/08/2026 sono rimasti scoperti 81 appuntamenti e la tabella
 * dei messaggi non aveva NIENTE di anomalo da mostrare — semplicemente non
 * cresceva più.
 */
@Injectable()
export class WhatsappDiagnosticsService {
  private readonly logger = new Logger(WhatsappDiagnosticsService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly channelSettings: NotificationChannelService,
    // RegistryModule e' globale: nessun import da aggiungere.
    private readonly registry: RegistryClient,
    // Stesso modulo, nessun ciclo: serve solo per riusare il SUO giudizio su
    // cosa sia un numero valido.
    private readonly gateway: WhatsappGatewayService,
    // `@Optional()` come ovunque si attraversi questo ciclo: whatsapp e
    // availability si importano a vicenda, e una dipendenza obbligatoria che
    // non si risolve fa fallire il boot dell'intera applicazione. Qui
    // servirebbe solo al reinvio: perdere anche la LETTURA della diagnostica —
    // cioe' l'unico posto da cui ci si accorge di un guasto — sarebbe il modo
    // peggiore di rompersi.
    @Optional()
    @Inject(forwardRef(() => AvailabilityAppointmentService))
    private readonly appointments?: AvailabilityAppointmentService,
  ) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('Nessun DataSource di tenant nel contesto corrente');
    return ds;
  }

  /**
   * @param windowDays quanto indietro guardare sulla DATA DI PRENOTAZIONE.
   *
   * La finestra sta sulla prenotazione e non sull'appuntamento perche' la
   * domanda e' "cosa ci siamo persi di recente": un appuntamento di ottobre
   * prenotato a giugno e mai confermato e' un caso vecchio, e mescolarlo con
   * quelli di stamattina rende la pagina inservibile proprio nel momento in
   * cui serve. Cio' che resta fuori viene contato, non nascosto.
   */
  async diagnose(windowDays = 7): Promise<WhatsappDiagnostics> {
    const [righe, uncoveredCategories, irraggiungibili, phoneIssues] = await Promise.all([
      this.riconcilia(),
      this.categorieScoperte(),
      this.contaIrraggiungibili(),
      this.numeriDaCorreggere(),
    ]);

    const tutti = righe
      .map((r) => this.classifica(r))
      .filter((p): p is { riga: RigaRiconciliazione; issue: AppointmentNotificationIssue } => !!p);

    const soglia = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const problemi = tutti.filter((p) => new Date(p.riga.created_at).getTime() >= soglia);
    const groups = this.raggruppaPerPaziente(problemi);
    await this.risolviRecapiti(groups);

    const conta = (k: NotificationIssueKind) =>
      problemi.filter((p) => p.issue.kind === k).length;

    return {
      generatedAt: new Date(),
      windowDays,
      uncoveredCategories,
      totals: {
        neverNotified: conta(NotificationIssueKind.NEVER_NOTIFIED),
        staleInfo: conta(NotificationIssueKind.STALE_INFO),
        cancelledNotNotified: conta(NotificationIssueKind.CANCELLED_NOT_NOTIFIED),
        stuck: conta(NotificationIssueKind.STUCK),
        patients: groups.length,
        outsideWindow: tutti.length - problemi.length,
        unreachable: irraggiungibili.totale,
        unreachableUnpaid: irraggiungibili.nonRetribuiti,
      },
      groups,
      phoneIssues,
    };
  }

  /**
   * Telefoni scritti sull'appuntamento che non sono numeri.
   *
   * Fuori dalla riconciliazione perche' rispondono a una domanda diversa: non
   * "chi non e' stato avvisato" ma "quali dati sono da sistemare". Da quando
   * il dispatch ripiega sull'anagrafica i due insiemi non coincidono piu', e
   * tenerli insieme farebbe sparire il dato sporco appena il ripiego funziona.
   *
   * Raggruppati per contenuto del campo e non per paziente: lo stesso errore
   * copiato su trenta appuntamenti di una ricorrenza e' UNA correzione da
   * fare, non trenta.
   */
  private async numeriDaCorreggere(): Promise<PhoneNumberIssue[]> {
    const righe: PhoneNumberIssue[] = await this.dataSource.query(`
      SELECT
        a."clientName"                          AS "patientName",
        a."clientPhone"                         AS "clientPhone",
        a."patientId"::text                     AS "patientId",
        count(*)::int                           AS appointments,
        (a."patientId" IS NOT NULL)             AS "hasRegistryFallback"
      FROM availability_appointments a
      WHERE a."deletedAt" IS NULL
        AND a."appointmentDate" >= (now() AT TIME ZONE 'Europe/Rome')::date
        AND NULLIF(a."clientPhone", '') IS NOT NULL
        AND translate(a."clientPhone", ' -()./+', '') !~ '^[0-9]{9,}$'
      -- Anche per paziente: il numero da proporre e' il SUO, e due persone
      -- diverse con lo stesso campo sbagliato vanno corrette con due numeri
      -- diversi.
      GROUP BY a."clientName", a."clientPhone", a."patientId"
      ORDER BY count(*) DESC
    `);

    // Il numero giusto da proporre lo sa solo l'anagrafica.
    for (const r of righe) {
      if (!r.patientId) continue;
      const trovato = await this.numeroInAnagrafica(r.patientId);
      r.registryPhone = trovato.pulito;
      r.registryPhoneDirty = trovato.sporco;
    }
    return righe;
  }

  /**
   * Il recapito di una persona come sta scritto in anagrafica, distinguendo
   * se sia utilizzabile o no.
   *
   * Cellulare per primo: e' quello su cui WhatsApp funziona. Il fisso resta
   * come ripiego perche' e' comunque un numero che la segretaria puo'
   * chiamare, ed averlo sull'appuntamento vale piu' di un campo vuoto.
   *
   * Anche l'anagrafica pero' e' testo libero, e ci finisce dentro la stessa
   * roba che sporca gli appuntamenti. Distinguere `pulito` da `sporco` evita
   * di proporre una sostituzione che non ripara niente, e permette di dire a
   * chi guarda che stavolta il guasto sta li'.
   */
  private async numeroInAnagrafica(
    patientId: string,
  ): Promise<{ pulito?: string; sporco?: string }> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) return {};
    try {
      const subject = await this.registry.getSubjectAsService(patientId, tenantAlias);
      const contatti = (subject?.contacts ?? []) as any[];
      const scegli = (tipo: string) =>
        contatti.find((c) => c.contactType === tipo && c.isPrimary && c.value)?.value ??
        contatti.find((c) => c.contactType === tipo && c.value)?.value ??
        null;

      const candidato: string | null = scegli('MOBILE') ?? scegli('PHONE');
      if (!candidato) return {};

      // Il giudizio lo da' il gateway, non una regola riscritta qui: e'
      // esattamente quello che verra' applicato al momento di spedire, e
      // proporre un numero che poi l'invio rifiuta sarebbe una promessa falsa.
      //
      // Si valida il candidato ma si restituisce l'ORIGINALE: la forma
      // normalizzata ("393492807857") finirebbe sull'appuntamento e la
      // segreteria si troverebbe a leggere numeri col prefisso al posto di
      // quelli che ha scritto.
      const valido = this.gateway.formatPhoneNumber(candidato);
      return valido ? { pulito: candidato } : { sporco: candidato };
    } catch (error) {
      this.logger.warn(
        `[WA-DIAG] recapito di ${patientId} non leggibile: ${(error as Error).message}`,
      );
      return {};
    }
  }

  /**
   * Appuntamenti futuri che nessun canale potrebbe raggiungere.
   *
   * Fuori dall'elenco dei problemi: senza anagrafica ne' telefono non esiste
   * un messaggio "mancato", esiste un appuntamento senza destinatario. Sono la
   * maggioranza assoluta dei futuri e lasciarli fra le segnalazioni
   * seppellirebbe quelle vere sotto un fattore dieci.
   *
   * Oggi coincidono esattamente con i `non_retribuito` — posti interni delle
   * ricorrenze — e si potrebbe filtrare su quel flag. NON si fa: il flag dice
   * come si fattura, il recapito dice se si puo' avvisare qualcuno, e sono due
   * cose diverse. Il giorno in cui a uno di quei posti venisse agganciato un
   * paziente, escludere per "non retribuito" smetterebbe di avvisarlo senza
   * che nessuno se ne accorga. Si contano entrambi proprio per vedere quando
   * i due numeri smettono di combaciare.
   */
  private async contaIrraggiungibili(): Promise<{ totale: number; nonRetribuiti: number }> {
    const [row] = await this.dataSource.query(`
      SELECT
        count(*)::int                                        AS totale,
        count(*) FILTER (WHERE a.non_retribuito)::int         AS non_retribuiti
      FROM availability_appointments a
      WHERE a."deletedAt" IS NULL
        AND a."appointmentDate" >= (now() AT TIME ZONE 'Europe/Rome')::date
        AND a."patientId" IS NULL
        AND NULLIF(a."clientPhone", '') IS NULL
    `);
    return { totale: row?.totale ?? 0, nonRetribuiti: row?.non_retribuiti ?? 0 };
  }

  /**
   * Appuntamenti futuri con accanto l'ultimo messaggio che li nomina.
   *
   * `LATERAL` e non una GROUP BY perché di ogni appuntamento serve la riga
   * intera dell'ultimo messaggio — stato, istante e data annunciata — e non
   * un aggregato: sono proprio quei tre campi a distinguere "mai avvisato" da
   * "avvisato con la data sbagliata".
   *
   * Il confronto con oggi passa da `Europe/Rome`: l'host è in UTC, e fra
   * mezzanotte e le due italiane `CURRENT_DATE` è ancora il giorno prima.
   */
  private async riconcilia(soloQuesti?: string[]): Promise<RigaRiconciliazione[]> {
    const nominaLAppuntamento = `
      (l."appointmentId" = a.id OR l."appointmentIds" @> jsonb_build_array(a.id::text))
    `;

    // Il filtro per id serve al reinvio, che deve rileggere lo stato ADESSO
    // invece di fidarsi dell'elenco che il browser ha in mano da qualche
    // minuto. Concatenato e non parametrico solo nella forma della clausola:
    // gli id restano un parametro.
    // L'indice e' fisso ($5) e non dipende dalla presenza del filtro: con
    // segnaposto che scalano, aggiungere un parametro in mezzo sposta in
    // silenzio il significato di tutti quelli dopo.
    const filtroId = soloQuesti?.length ? 'AND a.id = ANY($5::uuid[])' : '';

    return this.dataSource.query(
      `
      SELECT
        a.id::text                                  AS appointment_id,
        to_char(a."appointmentDate", 'DD/MM/YYYY')  AS appointment_date,
        to_char(a."startTime", 'HH24:MI')           AS start_time,
        a."patientId"::text                         AS patient_id,
        a."clientName"                              AS client_name,
        a."clientPhone"                             AS client_phone,
        a."bookingStatus"::text                     AS booking_status,
        -- Si puo' davvero raggiungere questa persona?
        --
        -- Tre stati e non un si'/no, perche' le cause si riparano in posti
        -- diversi: un numero che non c'e' si aggiunge in anagrafica, un numero
        -- che c'e' ma contiene testo si corregge sull'appuntamento, e chi e'
        -- gia' raggiungibile non va toccato affatto.
        --
        -- L'ordine conta. Prima il telefono sull'appuntamento, che e' quello
        -- che il dispatch usa per primo. Poi la storia: se a quella persona
        -- abbiamo gia' scritto — notifiche o chat — un numero valido esiste di
        -- sicuro. Solo alla fine si ammette di non sapere: il recapito
        -- verrebbe dal registry, che e' cifrato e da qui non si legge.
        CASE
          -- Stato PRELIMINARE: qui si sa solo cosa c'e' scritto
          -- sull'appuntamento. Se quel telefono e' valido il dispatch usa
          -- quello e non guarda oltre, quindi la risposta e' gia' definitiva.
          -- Negli altri casi la parola spetta all'anagrafica, che vive nel
          -- registry e da SQL non si legge: si rimanda a una verifica vera.
          --
          -- translate() e non regexp_replace(): dentro un template literal
          -- JavaScript le sequenze di escape vengono mangiate prima ancora che
          -- il testo arrivi a Postgres, e la regex arriverebbe deformata.
          WHEN translate(COALESCE(a."clientPhone", ''), ' -()./+', '') ~ '^[0-9]{9,}$'
            THEN 'usable'
          -- Numero illeggibile E nessuna anagrafica su cui ripiegare.
          WHEN NULLIF(a."clientPhone", '') IS NOT NULL AND a."patientId" IS NULL
            THEN 'invalid'
          ELSE 'needs_lookup'
        END                                         AS contact_state,
        a."createdAt"                               AS created_at,
        -- Quando l'appuntamento e' stato fissato, in ora dello studio.
        -- La colonna e' un timestamp senza fuso che contiene UTC: mostrarlo
        -- cosi' com'e' farebbe leggere "prenotato alle 11:25" un appuntamento
        -- preso alle 13:25, e chi cerca di ricordarsi quella telefonata non
        -- la ritroverebbe.
        to_char(
          (a."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Rome'),
          'DD/MM/YYYY HH24:MI'
        )                                           AS booked_at,
        -- Quando e' stata registrata la disdetta, stessa conversione.
        to_char(
          (a."cancelledAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Rome'),
          'DD/MM/YYYY HH24:MI'
        )                                           AS cancelled_at_label,
        a."cancelledAt"                             AS cancelled_at,
        (a."appointmentDate" + a."startTime")       AS slot,
        msg.status::text                            AS msg_status,
        msg."createdAt"                             AS msg_at,
        ann."announcedFor"                          AS announced,
        to_char(ann."announcedFor", 'DD/MM/YYYY HH24:MI') AS announced_label,
        msg."patientName"                           AS msg_patient_name,
        msg."phoneNumber"                           AS msg_phone,
        canc."createdAt"                            AS canc_at,
        canc.status::text                           AS canc_status,
        -- C'e' qualcosa in viaggio per questo appuntamento proprio adesso?
        --
        -- Di QUALUNQUE tipo, ed e' il punto. La riga scritta al momento del
        -- dispatch nasce recap_single, ma appena il gateway programma il
        -- promemoria il webhook le cambia il tipo in reminder_24h: cercando
        -- solo fra i tipi che comunicano la data non si trova piu' niente, e
        -- l'appuntamento riappare come "mai avvisato" mentre il messaggio e'
        -- in coda. Da li' due guai: le prenotazioni appena fatte segnalate
        -- come problema, e un reinvio che si somma a quello gia' in viaggio.
        --
        -- Il limite di tempo serve a non confondere il promemoria, che resta
        -- legittimamente in attesa per giorni: conta solo cio' che e' stato
        -- accodato poco fa.
        EXISTS (
          SELECT 1 FROM whatsapp_message_logs fl
          WHERE (fl."appointmentId" = a.id
                 OR fl."appointmentIds" @> jsonb_build_array(a.id::text))
            AND fl.status::text = ANY($3)
            AND fl."createdAt" > now() - ($4 || ' minutes')::interval
        )                                           AS in_volo
      FROM availability_appointments a
      LEFT JOIN LATERAL (
        SELECT l.status, l."createdAt", l."announcedFor", l."patientName", l."phoneNumber"
        FROM whatsapp_message_logs l
        WHERE ${nominaLAppuntamento}
          AND l."messageType"::text = ANY($1)
        ORDER BY l."createdAt" DESC
        LIMIT 1
      ) msg ON TRUE
      LEFT JOIN LATERAL (
        SELECT l.status, l."createdAt"
        FROM whatsapp_message_logs l
        WHERE ${nominaLAppuntamento}
          AND l."messageType"::text = ANY($2)
        ORDER BY l."createdAt" DESC
        LIMIT 1
      ) canc ON TRUE
      -- L'ultima data COMUNICATA, presa dall'ultima riga che ne porta una —
      -- di qualunque tipo sia.
      --
      -- Non si puo' leggere da msg: la riga scritta al dispatch e' l'unica
      -- che conosce la data annunciata, ma il webhook del promemoria le
      -- cambia il tipo in reminder_24h, e la riga del recap davvero inviato
      -- viene creata dopo, dal webhook, senza quel campo. Cercando la data
      -- annunciata fra i soli tipi che comunicano si trova sempre NULL, e lo
      -- spostamento non si rileva mai.
      LEFT JOIN LATERAL (
        SELECT l."announcedFor"
        FROM whatsapp_message_logs l
        WHERE (l."appointmentId" = a.id OR l."appointmentIds" @> jsonb_build_array(a.id::text))
          AND l."announcedFor" IS NOT NULL
        ORDER BY l."createdAt" DESC
        LIMIT 1
      ) ann ON TRUE
      WHERE a."deletedAt" IS NULL
        -- Data E ORA, non solo il giorno. Questa query decide anche cosa si
        -- puo' rimandare, e un appuntamento delle 08:00 rimasto senza
        -- conferma sarebbe ancora "di oggi" alle sette di sera: il reinvio
        -- direbbe al paziente "le confermiamo il suo appuntamento di oggi
        -- alle 08:00" undici ore dopo che e' passato.
        --
        -- Le altre query di questo servizio restano al giorno di proposito:
        -- contano o sistemano dati, non fanno partire messaggi.
        AND (a."appointmentDate" + a."startTime") >= (now() AT TIME ZONE 'Europe/Rome')
        -- Solo chi si puo' avvisare: gli altri li conta contaIrraggiungibili().
        AND (a."patientId" IS NOT NULL OR NULLIF(a."clientPhone", '') IS NOT NULL)
        ${filtroId}
      ORDER BY a."appointmentDate", a."startTime"
      `,
      soloQuesti?.length
        ? [TIPI_CHE_COMUNICANO_LA_DATA, TIPI_DI_DISDETTA, STATI_IN_VOLO,
           String(ATTESA_MASSIMA_MINUTI), soloQuesti]
        : [TIPI_CHE_COMUNICANO_LA_DATA, TIPI_DI_DISDETTA, STATI_IN_VOLO,
           String(ATTESA_MASSIMA_MINUTI)],
    );
  }

  /**
   * Da riga a problema, o `null` se l'appuntamento è a posto.
   *
   * L'ordine dei controlli è l'ordine in cui contano: un appuntamento disdetto
   * non ha bisogno di conferme, e uno mai annunciato non può avere una data
   * annunciata sbagliata.
   */
  private classifica(
    r: RigaRiconciliazione,
  ): { riga: RigaRiconciliazione; issue: AppointmentNotificationIssue } | null {
    const base = {
      appointmentId: r.appointment_id,
      appointmentDate: r.appointment_date,
      startTime: r.start_time,
      bookedAt: r.booked_at,
      cancelledAt: r.cancelled_at_label ?? undefined,
      lastMessageStatus: r.msg_status ?? undefined,
      lastMessageAt: r.msg_at ?? undefined,
      unreachable: !r.patient_id && !r.client_phone,
    };

    // Qualcosa e' gia' partito per questo appuntamento pochi minuti fa: non e'
    // un problema, e' un messaggio in viaggio.
    //
    // Il controllo viene PRIMA di tutti gli altri, e vale per ogni categoria.
    // Vale soprattutto due volte: una prenotazione appena inserita non deve
    // comparire fra i guasti mentre il buffer del gateway sta ancora
    // raggruppando, e un reinvio appena lanciato non deve ripresentarsi come
    // "da mandare" — chi rivedesse quelle righe le rimanderebbe di nuovo, e
    // al paziente arriverebbero due riepiloghi.
    if (r.in_volo) return null;

    if (BOOKING_DISDETTI.includes(r.booking_status)) {
      const avvisato =
        r.canc_at && r.cancelled_at && r.canc_at >= r.cancelled_at &&
        STATI_CONSEGNATI.includes(r.canc_status ?? '');
      if (avvisato) return null;
      // Disdette registrate senza `cancelledAt` (importazioni, stati messi a
      // mano): non c'è un istante con cui confrontare l'avviso, e dedurlo
      // produrrebbe segnalazioni non verificabili.
      if (!r.cancelled_at) return null;
      return {
        riga: r,
        issue: { ...base, kind: NotificationIssueKind.CANCELLED_NOT_NOTIFIED },
      };
    }

    if (!r.msg_status) {
      return { riga: r, issue: { ...base, kind: NotificationIssueKind.NEVER_NOTIFIED } };
    }

    if (r.msg_status === 'failed') {
      return { riga: r, issue: { ...base, kind: NotificationIssueKind.NEVER_NOTIFIED } };
    }

    // Arrivati qui non c'e' niente di recente in viaggio (lo esclude il
    // controllo in cima): un messaggio ancora "accodato" e' fermo da troppo.
    if (STATI_IN_VOLO.includes(r.msg_status)) {
      return { riga: r, issue: { ...base, kind: NotificationIssueKind.STUCK } };
    }

    // Consegnato: resta da capire se diceva la data giusta. `announcedFor` è
    // nullo su tutto lo storico precedente alla colonna, e lì non si può
    // sapere: meglio non dire niente che inventare uno spostamento.
    if (r.announced && r.slot) {
      const annunciata = new Date(r.announced).getTime();
      const reale = new Date(r.slot).getTime();
      if (annunciata !== reale) {
        return {
          riga: r,
          issue: {
            ...base,
            kind: NotificationIssueKind.STALE_INFO,
            announcedFor: r.announced_label ?? undefined,
          },
        };
      }
    }

    return null;
  }


  /**
   * Un gruppo per persona, non per appuntamento.
   *
   * È l'unità in cui il problema si ripara: chi ha otto appuntamenti scoperti
   * deve ricevere un riepilogo con otto righe. Chi guarda la pagina deve
   * vedere "ventidue persone da riavvisare", non "ottantuno righe".
   */
  private raggruppaPerPaziente(
    problemi: { riga: RigaRiconciliazione; issue: AppointmentNotificationIssue }[],
  ): PatientNotificationIssues[] {
    const per = new Map<string, PatientNotificationIssues>();

    for (const { riga, issue } of problemi) {
      // Senza anagrafica ogni appuntamento resta per conto suo: due righe
      // "Mario Rossi" scritte a mano non sono necessariamente la stessa
      // persona, e accorparle manderebbe a uno il riepilogo dell'altro.
      const chiave = riga.patient_id ?? `orfano:${riga.appointment_id}`;

      let gruppo = per.get(chiave);
      if (!gruppo) {
        gruppo = {
          patientId: riga.patient_id ?? undefined,
          patientName: riga.msg_patient_name ?? riga.client_name ?? undefined,
          phoneNumber: riga.msg_phone ?? riga.client_phone ?? undefined,
          contactState: riga.contact_state as any,
          appointments: [],
        };
        per.set(chiave, gruppo);
      }
      // Il gruppo prende lo stato MIGLIORE fra i suoi appuntamenti: basta un
      // telefono valido su uno solo perche' quella persona sia raggiungibile.
      if (riga.contact_state === 'usable') gruppo.contactState = 'usable' as any;
      gruppo.appointments.push(issue);
    }

    return [...per.values()].sort(
      (a, b) => b.appointments.length - a.appointments.length,
    );
  }

  /**
   * Chiede al registry se le persone ancora in dubbio hanno un recapito.
   *
   * Sostituisce l'indizio con un fatto. Prima si deduceva dall'assenza di
   * messaggi passati, e sbagliava proprio nel caso piu' frequente: un paziente
   * nuovo — o uno rimasto scoperto da un guasto — non ha messaggi alle spalle
   * pur avendo un numero perfettamente valido in anagrafica. La pagina mandava
   * a "verificare il recapito" di gente che il recapito ce l'aveva.
   *
   * Una chiamata bulk ogni 200 persone invece di una a testa: su trecento
   * pazienti sarebbero trecento richieste al registry a ogni apertura.
   *
   * Se il registry non risponde NON si torna a indovinare: quelle persone
   * restano `UNKNOWN`, che qui significa "non verificato adesso" e non
   * "sprovvisto di numero".
   */
  private async risolviRecapiti(groups: PatientNotificationIssues[]): Promise<void> {
    const daVerificare = groups.filter(
      (g) => g.patientId && (g.contactState as any) === 'needs_lookup',
    );
    if (!daVerificare.length) return;

    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) {
      for (const g of daVerificare) g.contactState = ContactState.UNKNOWN;
      return;
    }

    const LOTTO = 200; // tetto imposto dal registry

    for (let i = 0; i < daVerificare.length; i += LOTTO) {
      const fetta = daVerificare.slice(i, i + LOTTO);
      try {
        const subjects = await this.registry.bulkSubjectsAsService(
          fetta.map((g) => g.patientId!),
          tenantAlias,
        );

        // Indicizzati per id e non per posizione: la risposta puo' contenere
        // dei null, e allineare due array per indice si rompe in silenzio.
        const perId = new Map(
          (subjects ?? [])
            .filter((sub): sub is NonNullable<typeof sub> => !!sub)
            .map((sub) => [sub.id, sub]),
        );

        for (const g of fetta) {
          const sub = perId.get(g.patientId!);
          if (!sub) {
            // Non trovato nel registry: l'anagrafica non c'e' proprio.
            g.contactState = ContactState.NO_CONTACT;
            continue;
          }
          const haNumero = (sub.contacts ?? []).some(
            (c: any) =>
              (c.contactType === 'MOBILE' || c.contactType === 'PHONE') &&
              String(c.value ?? '').trim() !== '',
          );
          g.contactState = haNumero ? ContactState.USABLE : ContactState.NO_CONTACT;
        }
      } catch (error) {
        this.logger.warn(
          `[WA-DIAG] registry non raggiungibile, recapiti non verificati: ${(error as Error).message}`,
        );
        for (const g of fetta) g.contactState = ContactState.UNKNOWN;
      }
    }
  }

  /**
   * Riscrive un telefono sbagliato col numero vero dell'anagrafica.
   *
   * Sostituire e non svuotare. Un campo vuoto risolverebbe la notifica — il
   * dispatch ripiega sull'anagrafica — ma peggiorerebbe il lavoro di tutti i
   * giorni: quel numero sull'appuntamento lo leggono l'operatore e la
   * segreteria, e toglierlo li costringerebbe ad aprire l'anagrafica ogni
   * volta. Il campo va riportato alla verita', non azzerato.
   *
   * Solo dove un'anagrafica con un numero c'e': altrove non ci sarebbe niente
   * da scriverci.
   *
   * Solo sui futuri: riscrivere lo storico cancellerebbe il recapito con cui
   * quei messaggi erano davvero stati mandati.
   */
  async applyRegistryPhone(clientPhone: string): Promise<number> {
    // Gli appuntamenti futuri che portano QUEL valore, con la loro anagrafica.
    const bersagli: { patientId: string }[] = await this.dataSource.query(
      `
      SELECT DISTINCT a."patientId"::text AS "patientId"
      FROM availability_appointments a
      WHERE a."clientPhone" = $1
        AND a."deletedAt" IS NULL
        AND a."appointmentDate" >= (now() AT TIME ZONE 'Europe/Rome')::date
        AND a."patientId" IS NOT NULL
      `,
      [clientPhone],
    );

    let totale = 0;
    for (const { patientId } of bersagli) {
      // Il numero si rilegge adesso dall'anagrafica invece di fidarsi di
      // quello che il client ha in schermo: fra il caricamento della pagina e
      // il clic qualcuno puo' averlo corretto di nuovo, e scriverne uno
      // superato sugli appuntamenti sarebbe peggio del campo sbagliato.
      const { pulito: numero } = await this.numeroInAnagrafica(patientId);
      // Niente da scrivere, o cio' che c'e' in anagrafica e' sporco quanto il
      // campo che si voleva riparare: si salta invece di peggiorare.
      if (!numero) continue;

      const result = await this.dataSource.query(
        `
        UPDATE availability_appointments
        SET "clientPhone" = $1, "updatedAt" = now()
        WHERE "clientPhone" = $2
          AND "patientId" = $3::uuid
          AND "deletedAt" IS NULL
          AND "appointmentDate" >= (now() AT TIME ZONE 'Europe/Rome')::date
        `,
        [numero, clientPhone, patientId],
      );
      totale += Array.isArray(result) ? (result[1] ?? 0) : 0;
    }

    this.logger.log(
      `[WA-DIAG] telefono "${clientPhone}" sostituito con quello in anagrafica su ${totale} appuntamenti`,
    );
    return totale;
  }

  /** Categorie che oggi nessun canale acceso porta. */
  private async categorieScoperte(): Promise<string[]> {
    const settings = await this.channelSettings.list();
    return Object.values(NotificationCategory).filter(
      (cat) => !settings.some((s) => s.enabled && (s.categories ?? []).includes(cat)),
    );
  }

  /**
   * Rimanda le conferme mancanti.
   *
   * Uno alla volta e SENZA invio immediato: ogni chiamata deposita
   * l'appuntamento nel buffer del gateway, che a finestra scaduta ricompone un
   * riepilogo unico per numero di telefono e lo consegna al processor, dove il
   * rate limit tiene i messaggi automatici a dieci secondi l'uno dall'altro.
   *
   * Detto altrimenti: il ritmo che evita il ban c'è già, ed è quello del
   * traffico normale. Rifarlo qui — con pause proprie o invii diretti —
   * significherebbe scavalcarlo, che è l'unico modo di sbagliarlo.
   */
  async resend(appointmentIds: string[]): Promise<ResendOutcome> {
    if (!this.appointments) {
      // Rumoroso e visibile, non silenzioso: un reinvio che non parte e non
      // lo dice e' peggio di uno che fallisce.
      this.logger.error('[WA-DIAG] AvailabilityAppointmentService non risolto: reinvio impossibile');
      return {
        requested: appointmentIds.length,
        dispatched: 0,
        skipped: appointmentIds.length,
        errors: ['Servizio appuntamenti non disponibile: riprova dopo un riavvio del backend.'],
      };
    }

    const scoperte = await this.categorieScoperte();

    // Lo stato di ADESSO, non quello dell'elenco aperto nel browser.
    //
    // Fra il caricamento della pagina e il clic passano minuti, e in quei
    // minuti la segretaria puo' aver disdetto o spostato l'appuntamento. La
    // riconciliazione riparte da capo sui soli id richiesti: quello che non
    // compare piu' — cancellato, passato, disdetto e nel frattempo comunicato —
    // semplicemente non viene toccato.
    const righe = await this.riconcilia(appointmentIds);
    const perId = new Map(righe.map((r) => [r.appointment_id, r]));

    let dispatched = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const id of appointmentIds) {
      const riga = perId.get(id);
      if (!riga) {
        skipped++;
        errors.push(`${id}: non e' piu' fra gli appuntamenti futuri, saltato`);
        continue;
      }

      const problema = this.classifica(riga);
      if (!problema) {
        // Riparato nel frattempo — magari proprio da un reinvio precedente
        // ancora nel buffer. Rimandarlo sarebbe un doppione al paziente.
        skipped++;
        continue;
      }

      const disdetta = problema.issue.kind === NotificationIssueKind.CANCELLED_NOT_NOTIFIED;
      const categoria = disdetta
        ? NotificationCategory.CANCELLATION
        : NotificationCategory.CONFIRMATION;

      if (scoperte.includes(categoria)) {
        // Verrebbe scartato in silenzio esattamente come l'invio originale, e
        // la pagina mostrerebbe "reinviato" su un messaggio mai uscito.
        skipped++;
        continue;
      }

      try {
        // Il TIPO di messaggio dipende da cosa e' successo all'appuntamento.
        // Mandare una conferma per uno disdetto direbbe al paziente l'esatto
        // contrario della verita', e lo farebbe presentare in studio.
        if (disdetta) {
          await this.appointments.sendCancellationNotice(id);
        } else {
          await this.appointments.sendRecap(id, { immediate: false });
        }
        dispatched++;
      } catch (error: any) {
        skipped++;
        // Un appuntamento che non si riesce a rimandare non deve fermare gli
        // altri: sono recuperi indipendenti, e interrompere il ciclo
        // lascerebbe a meta' proprio l'operazione che serve a non perdere nulla.
        errors.push(`${id}: ${error?.message ?? 'errore sconosciuto'}`);
        this.logger.warn(`[WA-DIAG] reinvio fallito per ${id}: ${error?.message}`);
      }
    }

    if (!dispatched && scoperte.length) {
      errors.push(
        'Nessun canale acceso porta questi messaggi: riaccendine uno nelle ' +
        'impostazioni, altrimenti il reinvio viene scartato come l\'invio originale.',
      );
    }

    this.logger.log(
      `[WA-DIAG] reinvio: richiesti=${appointmentIds.length} inviati=${dispatched} saltati=${skipped}`,
    );

    return { requested: appointmentIds.length, dispatched, skipped, errors };
  }
}
