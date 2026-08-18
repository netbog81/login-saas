import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TenantContextService } from '@curandis/tenant-datasource';
import { WhatsappConversation } from '../entities/whatsapp-conversation.entity';
import { WhatsappChatMessage } from '../entities/whatsapp-chat-message.entity';
import {
  WhatsappChatDirection,
  WhatsappConversationStatus,
  WhatsappMessageStatus,
  WhatsappTemplateType,
} from '../../enums/whatsapp-enums';
import { WhatsappGatewayService } from '../../gateway/whatsapp-gateway.service';
import { WhatsappTemplateService } from '../../template/services/whatsapp-template.service';
import { EventsService } from '../../../events/events.service';

/** Lunghezza massima dell'anteprima salvata sulla conversazione. */
const PREVIEW_MAX_LENGTH = 280;

export interface InboundChatMessage {
  /** Numero grezzo del mittente, normalizzato dal service. */
  phone: string;
  body?: string;
  mediaType?: string;
  evolutionMessageId?: string;
  /** Nome profilo WhatsApp del mittente, unica etichetta per i numeri ignoti. */
  pushName?: string;
  /** Istante dichiarato da WhatsApp; se assente si usa "adesso". */
  timestamp?: Date;
}

/**
 * Conversazioni WhatsApp bidirezionali della segreteria.
 *
 * L'identita' della conversazione e' il NUMERO: si accetta e si archivia anche
 * quello che arriva da numeri non presenti in anagrafica (inbox completa), e il
 * collegamento al paziente viene fatto quando possibile — automaticamente sui
 * numeri gia' visti in un appuntamento, a mano negli altri casi.
 */
@Injectable()
export class WhatsappChatService {
  private readonly logger = new Logger(WhatsappChatService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly gatewayService: WhatsappGatewayService,
    private readonly templateService: WhatsappTemplateService,
    private readonly eventsService: EventsService,
  ) {}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get conversations() {
    return this.dataSource.getRepository(WhatsappConversation);
  }

  private get messages() {
    return this.dataSource.getRepository(WhatsappChatMessage);
  }

  // ==================== LETTURA ====================

  /**
   * Elenco conversazioni ordinate per ultimo messaggio. Le archiviate e le
   * bloccate restano fuori salvo richiesta esplicita.
   */
  async listConversations(params?: {
    status?: WhatsappConversationStatus;
    search?: string;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<WhatsappConversation[]> {
    const qb = this.conversations
      .createQueryBuilder('c')
      .orderBy('c."lastMessageAt"', 'DESC', 'NULLS LAST')
      .limit(Math.min(params?.limit ?? 100, 300));

    qb.andWhere('c."status" = :status', {
      status: params?.status ?? WhatsappConversationStatus.OPEN,
    });

    if (params?.unreadOnly) {
      qb.andWhere('c."unreadCount" > 0');
    }

    const search = params?.search?.trim();
    if (search) {
      // Il numero si cerca a cifre nude: l'utente lo digita come capita.
      const digits = search.replace(/\D/g, '');
      qb.andWhere(
        `(c."patientName" ILIKE :like OR c."contactName" ILIKE :like` +
        (digits ? ` OR c."phoneNumber" LIKE :digits` : '') +
        `)`,
        { like: `%${search}%`, ...(digits ? { digits: `%${digits}%` } : {}) },
      );
    }

    return qb.getMany();
  }

  /**
   * Id WhatsApp dell'ultimo messaggio IN ARRIVO di ogni conversazione indicata.
   *
   * È la chiave con cui il gateway riconosce il messaggio nello storico di
   * stato di Evolution: se quello risulta letto, la conversazione è stata
   * aperta — anche solo su WhatsApp Web, senza rispondere.
   */
  async findLatestInboundMessageIds(
    conversationIds: string[],
  ): Promise<Map<string, string>> {
    if (conversationIds.length === 0) return new Map();

    const rows: { conversationId: string; evolutionMessageId: string }[] =
      await this.dataSource.query(
        `
        SELECT DISTINCT ON ("conversationId") "conversationId", "evolutionMessageId"
        FROM "whatsapp_chat_messages"
        WHERE "conversationId" = ANY($1)
          AND "direction" = 'inbound'
          AND "evolutionMessageId" IS NOT NULL
        ORDER BY "conversationId", "sentAt" DESC NULLS LAST, "createdAt" DESC
        `,
        [conversationIds],
      );

    return new Map(rows.map((row) => [row.conversationId, row.evolutionMessageId]));
  }

  async getConversation(id: string): Promise<WhatsappConversation> {
    const conversation = await this.conversations.findOne({ where: { id } });
    if (!conversation) throw new NotFoundException('Conversazione non trovata');
    return conversation;
  }

  /**
   * Messaggi della conversazione, dal piu' recente. Paginazione a offset: la
   * finestra di chat carica l'ultima pagina e risale a richiesta.
   */
  async listMessages(
    conversationId: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: WhatsappChatMessage[]; total: number }> {
    const take = Math.min(limit, 200);
    const [items, total] = await this.messages.findAndCount({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      skip: (Math.max(page, 1) - 1) * take,
      take,
    });
    // Il client mostra dal piu' vecchio al piu' recente.
    return { items: items.reverse(), total };
  }

  /** Totale messaggi in arrivo non letti su tutte le conversazioni aperte. */
  async countUnread(): Promise<number> {
    const row = await this.conversations
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c."unreadCount"), 0)', 'total')
      .where('c."status" = :status', { status: WhatsappConversationStatus.OPEN })
      .getRawOne<{ total: string }>();
    return parseInt(row?.total ?? '0', 10);
  }

  // ==================== APERTURA CONVERSAZIONE ====================

  /**
   * Conversazione del numero indicato, creandola se non esiste.
   *
   * Usata sia dal webhook (messaggio in arrivo) sia dalla UI quando
   * l'operatore apre la chat da un appuntamento.
   */
  async openConversation(params: {
    phone: string;
    patientId?: string;
    patientName?: string;
    contactName?: string;
  }): Promise<WhatsappConversation> {
    const phoneNumber = this.gatewayService.formatPhoneNumber(params.phone);
    if (!phoneNumber) {
      throw new BadRequestException(`Numero di telefono non valido: ${params.phone}`);
    }

    let conversation = await this.conversations.findOne({ where: { phoneNumber } });

    if (!conversation) {
      conversation = this.conversations.create({
        phoneNumber,
        patientId: params.patientId,
        patientName: params.patientName,
        contactName: params.contactName,
        status: WhatsappConversationStatus.OPEN,
        unreadCount: 0,
      });
      return this.conversations.save(conversation);
    }

    // Arricchisce quello che manca senza sovrascrivere dati gia' presenti:
    // il collegamento al paziente e' la cosa piu' preziosa della riga.
    const patch: Partial<WhatsappConversation> = {};
    if (!conversation.patientId && params.patientId) patch.patientId = params.patientId;
    if (!conversation.patientName && params.patientName) patch.patientName = params.patientName;
    if (!conversation.contactName && params.contactName) patch.contactName = params.contactName;
    // Riaprire una chat archiviata e' esattamente cio' che l'operatore intende
    // quando ci scrive dentro. Una BLOCCATA invece resta bloccata.
    if (conversation.status === WhatsappConversationStatus.ARCHIVED) {
      patch.status = WhatsappConversationStatus.OPEN;
    }

    if (Object.keys(patch).length > 0) {
      await this.conversations.update({ id: conversation.id }, patch);
      Object.assign(conversation, patch);
    }
    return conversation;
  }

  /** Collega (o scollega, con patientId null) un paziente alla conversazione. */
  async linkPatient(
    conversationId: string,
    patientId: string | null,
    patientName?: string,
  ): Promise<WhatsappConversation> {
    const conversation = await this.getConversation(conversationId);
    await this.conversations.update(
      { id: conversation.id },
      { patientId: patientId ?? null, patientName: patientId ? patientName : null },
    );
    return this.getConversation(conversationId);
  }

  /** Archivia, riapre o blocca una conversazione. */
  async setStatus(
    conversationId: string,
    status: WhatsappConversationStatus,
  ): Promise<WhatsappConversation> {
    await this.getConversation(conversationId);
    await this.conversations.update(
      { id: conversationId },
      // Bloccare o archiviare significa anche togliere il badge: i non letti
      // di una chat che non si vuole piu' vedere sono solo rumore.
      status === WhatsappConversationStatus.OPEN ? { status } : { status, unreadCount: 0 },
    );
    // Archiviare o bloccare cambia cosa vedono TUTTE le postazioni: senza
    // l'evento la chat resterebbe nell'elenco delle colleghe finche' non
    // ricaricano la pagina, e due persone lavorerebbero su elenchi diversi.
    this.emitChanged(conversationId);
    return this.getConversation(conversationId);
  }

  /** Azzera i non letti: l'operatore ha aperto la conversazione. */
  async markAsRead(conversationId: string): Promise<WhatsappConversation> {
    await this.getConversation(conversationId);
    await this.conversations.update({ id: conversationId }, { unreadCount: 0 });
    // Stesso motivo di setStatus: il badge dei non letti e' condiviso, se una
    // collega legge la chat il pallino deve sparire anche alle altre.
    this.emitChanged(conversationId);
    return this.getConversation(conversationId);
  }

  // ==================== INVIO ====================

  /**
   * Invia un messaggio nella conversazione.
   *
   * Il record viene creato PRIMA della chiamata al gateway: se l'invio fallisce
   * resta la riga in stato FAILED, cosi' l'operatore vede cosa aveva scritto e
   * puo' riprovare, invece di perdere il testo.
   */
  async sendMessage(params: {
    conversationId: string;
    text: string;
    userId?: string;
    userName?: string;
  }): Promise<WhatsappChatMessage> {
    const text = params.text?.trim();
    if (!text) throw new BadRequestException('Il messaggio è vuoto');

    const conversation = await this.getConversation(params.conversationId);
    if (conversation.status === WhatsappConversationStatus.BLOCKED) {
      throw new BadRequestException('Conversazione bloccata: impossibile inviare messaggi');
    }

    const correlationId = randomUUID();
    const message = await this.messages.save(
      this.messages.create({
        conversationId: conversation.id,
        direction: WhatsappChatDirection.OUTBOUND,
        body: text,
        status: WhatsappMessageStatus.PENDING,
        correlationId,
        senderUserId: params.userId,
        senderName: params.userName,
      }),
    );

    await this.touchConversation(conversation.id, {
      preview: text,
      direction: WhatsappChatDirection.OUTBOUND,
      at: new Date(),
    });

    try {
      await this.gatewayService.sendChatMessage({
        phone: conversation.phoneNumber,
        text,
        correlationId,
        conversationId: conversation.id,
        userId: params.userId,
      });
      await this.messages.update(
        { id: message.id },
        { status: WhatsappMessageStatus.SENT, sentAt: new Date() },
      );
      message.status = WhatsappMessageStatus.SENT;
      message.sentAt = new Date();
    } catch (error: any) {
      const reason =
        error?.response?.data?.message || error?.message || 'Errore sconosciuto';
      await this.messages.update(
        { id: message.id },
        { status: WhatsappMessageStatus.FAILED, errorMessage: String(reason).slice(0, 1000) },
      );
      this.logger.error(`[WA-CHAT] Invio fallito per ${conversation.phoneNumber}: ${reason}`);
      throw new BadRequestException(`Invio del messaggio fallito: ${reason}`);
    }

    this.emitChanged(conversation.id);
    return message;
  }

  /**
   * Ritenta l'invio di un messaggio rimasto FAILED.
   *
   * Riusa la riga esistente invece di crearne una nuova: il testo è già lì e
   * duplicarlo lascerebbe in cronologia due copie dello stesso messaggio, una
   * fallita e una riuscita.
   */
  async retryMessage(messageId: string, userId?: string): Promise<WhatsappChatMessage> {
    const message = await this.messages.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Messaggio non trovato');
    if (message.direction !== WhatsappChatDirection.OUTBOUND) {
      throw new BadRequestException('Solo i messaggi in uscita possono essere reinviati');
    }
    if (message.status !== WhatsappMessageStatus.FAILED) {
      throw new BadRequestException('Il messaggio non è in errore');
    }

    const conversation = await this.getConversation(message.conversationId);
    if (conversation.status === WhatsappConversationStatus.BLOCKED) {
      throw new BadRequestException('Conversazione bloccata: impossibile inviare messaggi');
    }

    // Nuovo correlationId: quello vecchio potrebbe essere già stato usato dal
    // gateway per il tentativo fallito.
    const correlationId = randomUUID();
    await this.messages.update(
      { id: message.id },
      { status: WhatsappMessageStatus.PENDING, errorMessage: null, correlationId },
    );

    try {
      await this.gatewayService.sendChatMessage({
        phone: conversation.phoneNumber,
        text: message.body ?? '',
        correlationId,
        conversationId: conversation.id,
        userId,
      });
      await this.messages.update(
        { id: message.id },
        { status: WhatsappMessageStatus.SENT, sentAt: new Date() },
      );
    } catch (error: any) {
      const reason = error?.response?.data?.message || error?.message || 'Errore sconosciuto';
      await this.messages.update(
        { id: message.id },
        { status: WhatsappMessageStatus.FAILED, errorMessage: String(reason).slice(0, 1000) },
      );
      throw new BadRequestException(`Invio del messaggio fallito: ${reason}`);
    }

    this.emitChanged(conversation.id);
    return this.messages.findOne({ where: { id: message.id } }) as Promise<WhatsappChatMessage>;
  }

  // ==================== RICEZIONE (dal webhook) ====================

  /**
   * Registra un messaggio in arrivo dal paziente.
   *
   * Chiamata dal webhook, quindi FUORI da una richiesta utente: non c'è un
   * token con cui interrogare il registry, e il collegamento al paziente si
   * ricava dagli appuntamenti gia' presenti nel DB del tenant (che portano
   * `clientPhone` denormalizzato). Se il numero non risulta, la conversazione
   * nasce comunque — senza paziente — e finisce nella lista "da smistare".
   */
  async recordInbound(
    message: InboundChatMessage,
    tenantAlias?: string,
  ): Promise<WhatsappChatMessage | null> {
    const phoneNumber = this.gatewayService.formatPhoneNumber(message.phone);
    if (!phoneNumber) {
      this.logger.warn(`[WA-CHAT] Messaggio in arrivo con numero non valido: ${message.phone}`);
      return null;
    }

    // Deduplica: Evolution puo' consegnare lo stesso evento piu' volte
    // (riconnessioni, retry della coda).
    if (message.evolutionMessageId) {
      const existing = await this.messages.findOne({
        where: { evolutionMessageId: message.evolutionMessageId },
      });
      if (existing) {
        this.logger.debug(
          `[WA-CHAT] Messaggio ${message.evolutionMessageId} gia' registrato, skip`,
        );
        return existing;
      }
    }

    const known = await this.findPatientByPhone(phoneNumber);
    const conversation = await this.openConversation({
      phone: phoneNumber,
      patientId: known?.patientId,
      patientName: known?.patientName,
      contactName: message.pushName,
    });

    if (conversation.status === WhatsappConversationStatus.BLOCKED) {
      this.logger.log(`[WA-CHAT] Numero bloccato ${phoneNumber}: messaggio scartato`);
      return null;
    }

    const saved = await this.messages.save(
      this.messages.create({
        conversationId: conversation.id,
        direction: WhatsappChatDirection.INBOUND,
        body: message.body,
        mediaType: message.mediaType,
        status: WhatsappMessageStatus.RECEIVED,
        evolutionMessageId: message.evolutionMessageId,
        sentAt: message.timestamp ?? new Date(),
      }),
    );

    await this.touchConversation(conversation.id, {
      preview: message.body || `[${message.mediaType || 'allegato'}]`,
      direction: WhatsappChatDirection.INBOUND,
      at: message.timestamp ?? new Date(),
      incrementUnread: true,
    });

    this.emitChanged(conversation.id, tenantAlias);
    return saved;
  }

  /**
   * Registra un messaggio inviato DAL TELEFONO dello studio, fuori
   * dall'applicativo.
   *
   * Senza questo, la conversazione mostrata in segreteria avrebbe dei buchi:
   * si vedrebbero le domande del paziente ma non le risposte date a mano dal
   * telefono, e il prossimo operatore risponderebbe due volte.
   */
  async recordExternalOutbound(
    message: InboundChatMessage,
    tenantAlias?: string,
  ): Promise<WhatsappChatMessage | null> {
    const phoneNumber = this.gatewayService.formatPhoneNumber(message.phone);
    if (!phoneNumber) return null;

    if (message.evolutionMessageId) {
      const existing = await this.messages.findOne({
        where: { evolutionMessageId: message.evolutionMessageId },
      });
      if (existing) return existing;
    }

    // Ogni messaggio partito dal telefono dello studio crea la conversazione,
    // anche verso un numero mai visto e non collegato a un paziente. Prima
    // veniva scartato per non popolare la inbox di chat fantasma, ma il
    // risultato era peggiore: la segreteria che risponde da WhatsApp Web non
    // vedeva comparire nulla nell'applicativo, e le due viste divergevano.
    const existingConversation = await this.conversations.findOne({ where: { phoneNumber } });
    const known = existingConversation ? null : await this.findPatientByPhone(phoneNumber);

    const conversation =
      existingConversation ??
      (await this.openConversation({
        phone: phoneNumber,
        patientId: known?.patientId,
        patientName: known?.patientName,
      }));

    const saved = await this.messages.save(
      this.messages.create({
        conversationId: conversation.id,
        direction: WhatsappChatDirection.OUTBOUND,
        body: message.body,
        mediaType: message.mediaType,
        status: WhatsappMessageStatus.SENT,
        evolutionMessageId: message.evolutionMessageId,
        senderName: 'Da telefono',
        sentAt: message.timestamp ?? new Date(),
      }),
    );

    await this.touchConversation(conversation.id, {
      preview: message.body || `[${message.mediaType || 'allegato'}]`,
      direction: WhatsappChatDirection.OUTBOUND,
      at: message.timestamp ?? new Date(),
      // Chi risponde da WhatsApp Web ha per forza letto quello che c'era: senza
      // questo il pallino verde resterebbe acceso per sempre su una chat già
      // evasa. Non si aspetta il job di allineamento perché il contatore di
      // Evolution non torna a zero in modo affidabile.
      resetUnread: true,
    });

    this.emitChanged(conversation.id, tenantAlias);
    return saved;
  }

  /** Aggiorna lo stato di consegna di un messaggio in uscita. */
  async updateOutboundStatus(
    ref: { evolutionMessageId?: string; correlationId?: string },
    status: WhatsappMessageStatus,
    tenantAlias?: string,
  ): Promise<boolean> {
    const where = ref.correlationId
      ? { correlationId: ref.correlationId }
      : ref.evolutionMessageId
        ? { evolutionMessageId: ref.evolutionMessageId }
        : null;
    if (!where) return false;

    const message = await this.messages.findOne({ where });
    if (!message) return false;

    // Lo stato non torna mai indietro: un DELIVERY_ACK in ritardo non deve
    // cancellare un READ gia' registrato.
    const rank: Record<string, number> = {
      [WhatsappMessageStatus.PENDING]: 0,
      [WhatsappMessageStatus.FAILED]: 0,
      [WhatsappMessageStatus.SENT]: 1,
      [WhatsappMessageStatus.DELIVERED]: 2,
      [WhatsappMessageStatus.READ]: 3,
    };
    if ((rank[status] ?? 0) <= (rank[message.status] ?? 0) && status !== WhatsappMessageStatus.FAILED) {
      return false;
    }

    const patch: Partial<WhatsappChatMessage> = { status };
    const now = new Date();
    if (status === WhatsappMessageStatus.SENT && !message.sentAt) patch.sentAt = now;
    if (status === WhatsappMessageStatus.DELIVERED) patch.deliveredAt = now;
    if (status === WhatsappMessageStatus.READ) patch.readAt = now;

    await this.messages.update({ id: message.id }, patch);
    // Se il messaggio in uscita era associato a un evolutionMessageId non
    // ancora noto, lo si registra ora: serve per gli aggiornamenti successivi.
    if (ref.evolutionMessageId && !message.evolutionMessageId) {
      await this.messages.update(
        { id: message.id },
        { evolutionMessageId: ref.evolutionMessageId },
      );
    }

    this.emitChanged(message.conversationId, tenantAlias);
    return true;
  }

  // ==================== RECAP APPUNTAMENTI ====================

  /**
   * Testo di riepilogo dei prossimi appuntamenti del paziente collegato alla
   * conversazione, gia' renderizzato con i template del tenant.
   *
   * NON invia: torna il testo, che la UI mette nella casella di scrittura. Un
   * recap parte verso il paziente e va riletto prima, tanto piu' che l'operatore
   * potrebbe volerlo integrare ("le confermo anche che...").
   */
  async buildAppointmentsRecap(conversationId: string): Promise<string> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation.patientId) {
      throw new BadRequestException(
        'Conversazione non collegata a un paziente: impossibile costruire il recap',
      );
    }

    // Da oggi in avanti, escludendo disdette e no-show: un recap deve elencare
    // ciò che il paziente deve ancora fare.
    const rows: {
      appointmentDate: string | Date;
      startTime: string;
      clientName: string;
    }[] = await this.dataSource.query(
      `
      SELECT "appointmentDate", "startTime", "clientName"
      FROM "availability_appointments"
      WHERE "patientId" = $1
        AND "appointmentDate" >= CURRENT_DATE
        AND "bookingStatus" NOT IN ('cancelled', 'cancelled_early', 'cancelled_late', 'no_show')
        AND "deletedAt" IS NULL
      ORDER BY "appointmentDate" ASC, "startTime" ASC
      LIMIT 20
      `,
      [conversation.patientId],
    );

    // Nessun appuntamento non è un errore: è un esito normale. Tornare stringa
    // vuota lascia alla UI un messaggio pulito, invece di far arrivare
    // un'eccezione con testo tecnico.
    if (rows.length === 0) return '';

    const name = conversation.patientName || rows[0].clientName || '';
    const formatted = rows.map((row) => {
      const date =
        row.appointmentDate instanceof Date
          ? row.appointmentDate
          : new Date(String(row.appointmentDate));
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return {
        date: `${day}/${month}/${date.getFullYear()}`,
        time: String(row.startTime).substring(0, 5),
      };
    });

    // Stessi template usati dai recap automatici: il paziente riceve un testo
    // coerente con quelli che gli arrivano alla prenotazione.
    if (formatted.length === 1) {
      const body = await this.rawTemplate(WhatsappTemplateType.RECAP_SINGLE);
      return this.templateService.renderTemplate(body, {
        name,
        date: formatted[0].date,
        time: formatted[0].time,
      });
    }

    const lines = formatted.map((a) => `- ${a.date} alle ${a.time}`).join('\n');
    const body = await this.rawTemplate(WhatsappTemplateType.RECAP_MULTI);
    return this.templateService.renderTemplate(body, { name, appointments: lines });
  }

  /**
   * Invia SUBITO al paziente un unico messaggio con il riepilogo degli
   * appuntamenti indicati, con gli stessi template dei recap automatici
   * (RECAP_SINGLE per uno, RECAP_MULTI per più di uno).
   *
   * A differenza di buildAppointmentsRecap (che torna solo il testo per la
   * casella di scrittura), qui il messaggio parte davvero: passa da
   * openConversation + sendMessage, quindi niente code del gateway, riga in
   * cronologia chat e errori propagati al chiamante.
   */
  async sendAppointmentsRecap(params: {
    patientId: string;
    patientName?: string;
    phone: string;
    /** Elenco già formattato: date `dd/mm/yyyy`, time `HH:mm`, ordinato. */
    appointments: { date: string; time: string }[];
    userId?: string;
    userName?: string;
  }): Promise<void> {
    if (params.appointments.length === 0) {
      throw new BadRequestException('Nessun appuntamento da riepilogare');
    }

    const name = params.patientName || '';
    let text: string;
    if (params.appointments.length === 1) {
      const body = await this.rawTemplate(WhatsappTemplateType.RECAP_SINGLE);
      text = this.templateService.renderTemplate(body, {
        name,
        date: params.appointments[0].date,
        time: params.appointments[0].time,
      });
    } else {
      const lines = params.appointments.map((a) => `- ${a.date} alle ${a.time}`).join('\n');
      const body = await this.rawTemplate(WhatsappTemplateType.RECAP_MULTI);
      text = this.templateService.renderTemplate(body, { name, appointments: lines });
    }

    const conversation = await this.openConversation({
      phone: params.phone,
      patientId: params.patientId,
      patientName: params.patientName,
    });
    await this.sendMessage({
      conversationId: conversation.id,
      text,
      userId: params.userId,
      userName: params.userName,
    });
  }

  /** Corpo del template del tenant, o il default se assente/disattivato. */
  private async rawTemplate(type: WhatsappTemplateType): Promise<string> {
    const template = await this.templateService.findByType(type);
    if (template?.isActive && template.bodyTemplate) return template.bodyTemplate;
    return type === WhatsappTemplateType.RECAP_SINGLE
      ? 'Gentile {name}, confermiamo il suo appuntamento per il {date} alle {time}.'
      : 'Gentile {name}, confermiamo i seguenti appuntamenti:\n{appointments}';
  }

  // ==================== RETENTION ====================

  /**
   * Anonimizza i messaggi di chat oltre la retention.
   *
   * Il corpo dei messaggi è testo libero fra studio e paziente, quindi dato
   * sanitario: segue la stessa politica dei log automatici, con cui condivide
   * i campi `isAnonymized`/`anonymizedAt`. Restano riga, verso e date, che
   * servono a dimostrare che una comunicazione c'è stata.
   */
  async anonymizeExpiredMessages(retentionDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.messages
      .createQueryBuilder()
      .update(WhatsappChatMessage)
      .set({
        body: '[ANONIMIZZATO]',
        senderName: () => 'NULL',
        senderUserId: () => 'NULL',
        errorMessage: () => 'NULL',
        isAnonymized: true,
        anonymizedAt: new Date(),
      } as any)
      .where('"createdAt" < :cutoff', { cutoff })
      .andWhere('"isAnonymized" = false')
      .execute();

    const affected = result.affected || 0;
    if (affected > 0) {
      // Anche l'anteprima sulla conversazione contiene testo del messaggio:
      // lasciarla intatta vanificherebbe l'anonimizzazione.
      await this.conversations
        .createQueryBuilder()
        .update(WhatsappConversation)
        .set({ lastMessagePreview: '[ANONIMIZZATO]' })
        .where('"lastMessageAt" < :cutoff', { cutoff })
        .execute();
      this.logger.log(
        `[WA-CHAT] Anonimizzati ${affected} messaggi oltre retention (${retentionDays}g)`,
      );
    }
    return affected;
  }

  /** Messaggi di chat oltre la retention e non ancora anonimizzati. */
  async countExpiredMessages(retentionDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    return this.messages
      .createQueryBuilder('m')
      .where('m."createdAt" < :cutoff', { cutoff })
      .andWhere('m."isAnonymized" = false')
      .getCount();
  }

  // ==================== HELPER ====================

  /**
   * Aggiorna i campi di riepilogo della conversazione (ultimo messaggio,
   * anteprima, non letti) con una sola query.
   */
  private async touchConversation(
    conversationId: string,
    params: {
      preview: string;
      direction: WhatsappChatDirection;
      at: Date;
      incrementUnread?: boolean;
      resetUnread?: boolean;
    },
  ): Promise<void> {
    await this.conversations
      .createQueryBuilder()
      .update(WhatsappConversation)
      .set({
        lastMessageAt: params.at,
        lastMessagePreview: params.preview.slice(0, PREVIEW_MAX_LENGTH),
        lastMessageDirection: params.direction,
        ...(params.incrementUnread
          ? { unreadCount: () => '"unreadCount" + 1' }
          : {}),
        ...(params.resetUnread ? { unreadCount: 0 } : {}),
      })
      .where('id = :id', { id: conversationId })
      .execute();
  }

  /**
   * Cerca il paziente a cui appartiene un numero fra gli appuntamenti gia'
   * registrati. E' l'unica fonte disponibile senza contesto utente: il
   * registry richiede un token, che nel webhook non c'è.
   */
  private async findPatientByPhone(
    phoneNumber: string,
  ): Promise<{ patientId: string; patientName?: string } | null> {
    // Il confronto è sulle sole cifre: in anagrafica i numeri sono scritti in
    // ogni formato possibile (+39, spazi, trattini).
    const rows = await this.dataSource.query(
      `
      SELECT "patientId", "clientName"
      FROM "availability_appointments"
      WHERE "patientId" IS NOT NULL
        AND "clientPhone" IS NOT NULL
        AND regexp_replace("clientPhone", '\\D', '', 'g') LIKE $1
      ORDER BY "createdAt" DESC
      LIMIT 1
      `,
      [`%${phoneNumber.slice(-9)}`],
    );
    if (!rows?.length) return null;
    return { patientId: rows[0].patientId, patientName: rows[0].clientName };
  }

  /**
   * Notifica ai client che la conversazione è cambiata. Il payload è
   * volutamente minimo (solo l'id): i contenuti viaggiano su GraphQL
   * autenticato, l'SSE serve solo a far scattare il refetch.
   */
  private emitChanged(conversationId: string, tenantAlias?: string): void {
    const event = {
      type: 'whatsapp_chat_changed' as const,
      conversationId,
      timestamp: new Date(),
    };
    if (tenantAlias) {
      this.eventsService.emitToTenant(tenantAlias, event);
    } else {
      this.eventsService.emit(event);
    }
  }
}
