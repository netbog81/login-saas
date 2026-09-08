import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { WhatsappConfigService } from '../config/services/whatsapp-config.service';
import { WhatsappTenantConfig } from '../config/entities/whatsapp-tenant-config.entity';
import { WhatsappLogService } from '../log/services/whatsapp-log.service';
import { WhatsappTemplateService } from '../template/services/whatsapp-template.service';
import { NotificationChannelService } from '../notifications/services/notification-channel.service';
import {
  buildNotificationPlan, categoryOfMessage, PatientChannelPreference,
} from '../notifications/utils/notification-plan.util';
import { NotificationChannel } from '../notifications/entities/notification-channel-setting.entity';
import { WhatsappMessageStatus, WhatsappMessageType, WhatsappTemplateType } from '../enums/whatsapp-enums';
import {
  DispatchBookingPayload,
  DispatchUpdatePayload,
  ReminderWindowFields,
} from './dto/dispatch-booking.dto';
import { AvailabilityAppointment } from '../../availability/entities/availability-appointment.entity';

/**
 * Shape minimo del paziente richiesto dai metodi del gateway.
 * Il caller costruisce questo oggetto a partire dal SubjectResponse del registry.
 */
export interface WhatsappPatientContact {
  id: string;
  nome?: string;
  cognome?: string;
  telefono?: string;
  cellulare?: string;
  /** Serve al canale email; assente = quel canale viene saltato dal gateway. */
  email?: string;
  /**
   * Come il paziente vuole essere avvisato, dal registry.
   * Assente = decide lo studio. `'none'` = non vuole avvisi.
   */
  canalePreferito?: string | null;
}

/**
 * Posizione di un appuntamento nel calendario: il minimo che serve per dire
 * "da dove" si è mosso. Si passa uno snapshot invece dell'entità perché al
 * momento della notifica l'entità porta già i valori nuovi.
 */
export interface AppointmentSlot {
  appointmentDate: Date | string;
  startTime: string;
}

/** Messaggio in coda sul gateway, così come lo restituisce `/whatsapp/scheduled`. */
export interface GatewayScheduledMessage {
  jobId: string;
  jobName: string;
  type: string;
  phone: string;
  pazienteId?: string;
  appointmentIds: string[];
  content?: string;
  bufferedCount?: number;
  scheduledFor: string;
  state: 'delayed' | 'waiting';
}

@Injectable()
export class WhatsappGatewayService {
  private readonly logger = new Logger(WhatsappGatewayService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: WhatsappConfigService,
    private readonly logService: WhatsappLogService,
    private readonly templateService: WhatsappTemplateService,
    private readonly channelSettings: NotificationChannelService,
  ) {}

  /**
   * Invia una email attraverso il gateway.
   *
   * Il gateway ha già la configurazione SMTP per tenant (o il relay condiviso
   * con mittente dello studio): qui si passa solo il testo, già pronto. Serve
   * a raggiungere chi non ha un numero di telefono — il primo caso è il link
   * di sottoscrizione dell'agenda per gli operatori.
   */
  async sendEmail(params: {
    email: string;
    subject: string;
    message: string;
  }): Promise<void> {
    const config = await this.configService.getConfig();
    const apiKey = await this.configService.getDecryptedApiKey();
    const url = `${config.gatewayUrl}/notify/email`;

    // Si logga il destinatario, mai il contenuto.
    this.logger.log(`[NOTIFY-EMAIL] POST ${url} → ${params.email}`);

    await firstValueFrom(
      this.httpService.post(
        url,
        { email: params.email, subject: params.subject, message: params.message },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': config.tenantApiId,
            'x-tenant-api-key': apiKey,
          },
          timeout: 15000,
        },
      ),
    );
  }

  /**
   * Dispatches a booking notification to the WhatsApp gateway.
   * Fire-and-forget: never throws, always logs errors.
   */
  async dispatchBooking(
    appointment: AvailabilityAppointment,
    patient: WhatsappPatientContact,
    options?: { immediateRecap?: boolean },
  ): Promise<void> {
    try {
      this.logger.log(`[WA-DISPATCH] START appointmentId=${appointment.id}, patientId=${patient.id}`);

      const config = await this.configService.getConfig();
      if (!config || !config.isActive) {
        this.logger.warn(`[WA-DISPATCH] SKIP: config=${config ? 'exists' : 'null'}, isActive=${config?.isActive}`);
        return;
      }

      // Appuntamento gia' avvenuto: non si avvisa nessuno.
      //
      // Vale anche per lo spostamento e per la disdetta, e in tutti e tre i
      // casi si guarda la data ATTUALE dell'appuntamento: uno spostato DAL
      // passato AL futuro va comunicato, ed e' proprio quella la data che il
      // paziente deve sapere.
      if (this.isPassato(appointment)) {
        this.logger.log(
          `[WA-DISPATCH] SKIP appointmentId=${appointment.id}: appuntamento gia' passato (${appointment.appointmentDate} ${appointment.startTime})`,
        );
        return;
      }

      const rawPhone = patient.cellulare || patient.telefono;
      const phoneNumber = this.formatPhoneNumber(rawPhone);
      this.logger.log(`[WA-DISPATCH] Phone: raw="${rawPhone}" -> formatted="${phoneNumber}"`);

      if (!phoneNumber) {
        this.logger.warn(`[WA-DISPATCH] SKIP: no valid phone for patient ${patient.id}`);
        return;
      }

      const correlationId = uuidv4();
      const apiKey = await this.configService.getDecryptedApiKey();
      if (!apiKey) {
        this.logger.error(`[WA-DISPATCH] SKIP: cannot decrypt API key`);
        return;
      }

      const patientName = `${patient.nome || ''} ${patient.cognome || ''}`.trim();
      const isoDate = this.buildIsoDate(appointment.appointmentDate, appointment.startTime);
      this.logger.log(`[WA-DISPATCH] Date: raw=${appointment.appointmentDate} + ${appointment.startTime} -> iso=${isoDate}`);

      // Testi dei messaggi: renderizzati QUI dai template del tenant e passati al
      // gateway. Il recap multiplo viaggia grezzo perché l'elenco degli
      // appuntamenti è noto solo al gateway, alla chiusura del buffer di 60s.
      const { date: fmtDate, time: fmtTime } = this.formatAppointment(appointment);
      const variables = { name: patientName, date: fmtDate, time: fmtTime };

      const [recapMessage, reminderMessage, reminderMessageEarly, recapMultiTemplate] =
        await Promise.all([
          this.renderTemplateOrUndefined(WhatsappTemplateType.RECAP_SINGLE, variables),
          this.renderTemplateOrUndefined(WhatsappTemplateType.REMINDER_24H, variables),
          // Quale dei due promemoria verrà usato lo decide il gateway, che è
          // l'unico a sapere in che giorno cadrà l'invio: si mandano entrambi.
          this.renderTemplateOrUndefined(WhatsappTemplateType.REMINDER_48H, variables),
          this.rawTemplateOrUndefined(WhatsappTemplateType.RECAP_MULTI),
        ]);

      // Il piano PRIMA del log: se non si manda niente non deve restare una
      // riga "inviato" per un messaggio che non e' mai partito.
      // Il piano di canali per questa prenotazione. `null` = il paziente non
      // vuole essere avvisato, o nessun canale acceso porta queste categorie:
      // in quel caso non si chiama nemmeno il gateway.
      const delivery = await this.deliveryFieldsFor(
        { primary: 'booking', withReminder: true },
        patient,
      );
      if (delivery === null) {
        this.logger.log(
          `[WA-DISPATCH] SKIP: nessun canale per il paziente ${patient.id} (preferenza o impostazioni)`,
        );
        return;
      }

      // Create log entry before calling gateway (status DISPATCHED)
      await this.logService.createLog({
        appointmentId: appointment.id,
        patientId: patient.id,
        patientName,
        phoneNumber,
        messageType: WhatsappMessageType.RECAP_SINGLE,
        correlationId,
        messageBody: recapMessage,
        status: WhatsappMessageStatus.DISPATCHED,
        announcedFor: this.announcedFor(appointment),
      });

      // I testi per canale di TUTTI i tipi che questa richiesta puo' generare:
      // quale uscira' davvero — conferma singola o elenco, promemoria a 24 o
      // 48 ore — si sapra' solo al momento di spedire.
      const channelTexts = await this.buildChannelTexts(
        [...(delivery.channels ?? []), ...(delivery.reminderChannels ?? [])],
        [
          { key: 'single_recap', type: WhatsappTemplateType.RECAP_SINGLE },
          { key: 'multiple_recap', type: WhatsappTemplateType.RECAP_MULTI },
          { key: 'reminder_24h', type: WhatsappTemplateType.REMINDER_24H },
          { key: 'reminder_48h', type: WhatsappTemplateType.REMINDER_48H },
        ],
        variables,
      );

      const payload: DispatchBookingPayload = {
        type: 'APPOINTMENT_BOOKING',
        data: {
          appointmentId: appointment.id,
          pazienteId: patient.id,
          phone: phoneNumber,
          date: isoDate,
          name: patientName,
          recapMessage,
          reminderMessage,
          reminderMessageEarly,
          recapMultiTemplate,
          recapLine: `- ${fmtDate} alle ${fmtTime}`,
          recapDelaySeconds: config.recapBufferSeconds ?? undefined,
          // Solo per il reinvio manuale: una prenotazione normale deve poter
          // essere accorpata alle altre dello stesso paziente.
          ...(options?.immediateRecap ? { recapImmediate: true } : {}),
          ...this.reminderWindowFields(config),
          ...delivery,
          ...(channelTexts ? { channelTexts } : {}),
        },
        correlationId,
      };

      const url = `${config.gatewayUrl}/whatsapp/dispatch`;
      this.logger.log(`[WA-DISPATCH] POST ${url} tenantId=${config.tenantApiId} correlationId=${correlationId}`);
      this.logger.log(`[WA-DISPATCH] Payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': config.tenantApiId,
            'x-tenant-api-key': apiKey,
            'x-correlation-id': correlationId,
          },
          timeout: 10000,
        }),
      );

      this.logger.log(
        `[WA-DISPATCH] SUCCESS status=${response.status} data=${JSON.stringify(response.data)}`,
      );
    } catch (error: any) {
      const gwStatus = error?.response?.status;
      const gwBody = error?.response?.data;
      this.logger.error(
        `[WA-DISPATCH] FAILED appointmentId=${appointment.id}: ${error?.message}`,
      );
      if (gwStatus || gwBody) {
        this.logger.error(`[WA-DISPATCH] Gateway response: status=${gwStatus} body=${JSON.stringify(gwBody)}`);
      }
    }
  }

  /**
   * Notifica lo spostamento di un appuntamento già prenotato.
   *
   * Il gateway, ricevendo APPOINTMENT_UPDATE, rimuove il reminder programmato
   * sul vecchio orario, invia la notifica di modifica e riprogramma il reminder
   * 24h sul nuovo orario. Fire-and-forget: non lancia mai.
   */
  async updateBooking(
    appointment: AvailabilityAppointment,
    patient: WhatsappPatientContact,
    previous?: AppointmentSlot,
  ): Promise<void> {
    try {
      this.logger.log(`[WA-UPDATE] START appointmentId=${appointment.id}, patientId=${patient.id}`);

      const config = await this.configService.getConfig();
      if (!config || !config.isActive) {
        this.logger.warn(`[WA-UPDATE] SKIP: config=${config ? 'exists' : 'null'}, isActive=${config?.isActive}`);
        return;
      }

      const rawPhone = patient.cellulare || patient.telefono;
      const phoneNumber = this.formatPhoneNumber(rawPhone);
      if (!phoneNumber) {
        this.logger.warn(`[WA-UPDATE] SKIP: no valid phone for patient ${patient.id}`);
        return;
      }

      const apiKey = await this.configService.getDecryptedApiKey();
      if (!apiKey) {
        this.logger.error(`[WA-UPDATE] SKIP: cannot decrypt API key`);
        return;
      }

      const correlationId = uuidv4();
      const patientName = `${patient.nome || ''} ${patient.cognome || ''}`.trim();
      const isoDate = this.buildIsoDate(appointment.appointmentDate, appointment.startTime);
      const { date: fmtDate, time: fmtTime } = this.formatAppointment(appointment);

      // Da dove l'appuntamento si è mosso. Serve al testo — "spostato al 22"
      // non dice quale dei tre appuntamenti si è mosso, quando ne sposti tre
      // insieme — e come ripiego al gateway se il template è disattivato.
      const before = previous ? this.formatSlot(previous) : undefined;
      const variables = {
        name: patientName,
        date: fmtDate,
        time: fmtTime,
        oldDate: before?.date ?? '',
        oldTime: before?.time ?? '',
      };

      // Il POST parte comunque anche a notifica disattivata: il gateway deve
      // spostare il reminder 24h sul nuovo orario.
      let sendNotification = config.sendUpdateNotification !== false;

      // Spostato a una data gia' passata — succede quando si riallinea a
      // posteriori il lavoro del mese. Il paziente non va avvisato, ma la
      // chiamata al gateway si fa lo stesso: e' quella che toglie dalla coda
      // il promemoria programmato sulla vecchia data futura, che altrimenti
      // partirebbe domani per un appuntamento ormai datato nel passato.
      if (this.isPassato(appointment)) {
        this.logger.log(
          `[WA-UPDATE] appointmentId=${appointment.id} spostato nel passato (${appointment.appointmentDate} ${appointment.startTime}): riprogrammo senza avvisare`,
        );
        sendNotification = false;
      }

      const [
        updateMessage,
        reminderMessage,
        reminderMessageEarly,
        updateMultiTemplate,
        recapMessage,
        recapMultiTemplate,
      ] = await Promise.all([
        sendNotification
          ? this.renderTemplateOrUndefined(WhatsappTemplateType.UPDATE, variables)
          : Promise.resolve(undefined),
        this.renderTemplateOrUndefined(WhatsappTemplateType.REMINDER_24H, variables),
        this.renderTemplateOrUndefined(WhatsappTemplateType.REMINDER_48H, variables),
        sendNotification
          ? this.rawTemplateOrUndefined(WhatsappTemplateType.UPDATE_MULTI)
          : Promise.resolve(undefined),
        // Per il caso "spostato mentre la conferma è ancora in buffer": il
        // gateway corregge la conferma invece di mandare uno spostamento, e
        // per farlo gli serve il testo della conferma sul NUOVO orario.
        //
        // Questi due partono SEMPRE, anche a notifiche di spostamento spente:
        // chi le spegne non vuole essere avvisato dei movimenti, non vuole una
        // conferma che annuncia un orario sbagliato.
        this.renderTemplateOrUndefined(WhatsappTemplateType.RECAP_SINGLE, variables),
        this.rawTemplateOrUndefined(WhatsappTemplateType.RECAP_MULTI),
      ]);

      // Il piano prima del log: se non si manda niente non deve restare una
      // riga "inviato" per un messaggio che non e' mai partito.
      //
      // Niente ritorno anticipato, pero': questa chiamata non serve solo ad
      // avvisare, RIPROGRAMMA anche il promemoria sulla data nuova. Saltarla
      // lascerebbe in coda un promemoria con l'orario vecchio — un paziente
      // che ha chiesto di non essere disturbato riceverebbe l'unico messaggio
      // che non doveva ricevere, per giunta sbagliato.
      const plan = await this.deliveryFieldsFor(
        // Riprogramma anche il promemoria: servono pure i canali di quello,
        // che e' una categoria a se' e puo' essere configurata diversamente.
        { primary: 'update', withReminder: true },
        patient,
      );
      const delivery = plan ?? {};
      if (plan === null) {
        this.logger.log(
          `[WA-UPDATE] Nessun canale per il paziente ${patient.id}: riprogrammo il promemoria senza avvisare`,
        );
        sendNotification = false;
      }

      if (sendNotification) {
        await this.logService.createLog({
          appointmentId: appointment.id,
          patientId: patient.id,
          patientName,
          phoneNumber,
          messageType: WhatsappMessageType.UPDATE,
          correlationId,
          messageBody: updateMessage,
          status: WhatsappMessageStatus.DISPATCHED,
          // La data NUOVA: è quella che il paziente si ritrova in mano.
          announcedFor: this.announcedFor(appointment),
        });
      }

      const channelTexts = await this.buildChannelTexts(
        [...(delivery.channels ?? []), ...(delivery.reminderChannels ?? [])],
        [
          { key: 'update_notification', type: WhatsappTemplateType.UPDATE },
          { key: 'multiple_update', type: WhatsappTemplateType.UPDATE_MULTI },
          { key: 'reminder_24h', type: WhatsappTemplateType.REMINDER_24H },
          { key: 'reminder_48h', type: WhatsappTemplateType.REMINDER_48H },
        ],
        variables,
      );

      const payload: DispatchUpdatePayload = {
        type: 'APPOINTMENT_UPDATE',
        data: {
          appointmentId: appointment.id,
          pazienteId: patient.id,
          phone: phoneNumber,
          date: isoDate,
          name: patientName,
          updateMessage,
          reminderMessage,
          reminderMessageEarly,
          sendUpdateNotification: sendNotification,
          updateMultiTemplate,
          updateLine: before
            ? `- ${before.date} ${before.time} → ${fmtDate} ${fmtTime}`
            : `- ${fmtDate} alle ${fmtTime}`,
          ...(previous
            ? { previousDate: this.buildIsoDate(previous.appointmentDate, previous.startTime) }
            : {}),
          recapDelaySeconds: config.recapBufferSeconds ?? undefined,
          recapMessage,
          recapMultiTemplate,
          recapLine: `- ${fmtDate} alle ${fmtTime}`,
          ...this.reminderWindowFields(config),
          ...delivery,
          ...(channelTexts ? { channelTexts } : {}),
        },
        correlationId,
      };

      const url = `${config.gatewayUrl}/whatsapp/dispatch`;
      this.logger.log(`[WA-UPDATE] POST ${url} sendNotification=${sendNotification} correlationId=${correlationId}`);
      this.logger.log(`[WA-UPDATE] Payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': config.tenantApiId,
            'x-tenant-api-key': apiKey,
            'x-correlation-id': correlationId,
          },
          timeout: 10000,
        }),
      );

      this.logger.log(
        `[WA-UPDATE] SUCCESS status=${response.status} data=${JSON.stringify(response.data)}`,
      );

      // Il gateway ha corretto la conferma ancora in buffer invece di mandare
      // uno spostamento: il paziente riceverà una conferma sola, con l'orario
      // giusto. Il log di UPDATE appena creato non corrisponde a nessun
      // messaggio, e lasciarlo racconterebbe un avviso mai partito.
      if (response.data?.bookingRewritten === true) {
        await this.logService.cancelByCorrelationId(correlationId);
        this.logger.log(
          `[WA-UPDATE] Spostamento di ${appointment.id} confluito nel recap: nessun messaggio separato`,
        );
      }
    } catch (error: any) {
      const gwStatus = error?.response?.status;
      const gwBody = error?.response?.data;
      this.logger.error(
        `[WA-UPDATE] FAILED appointmentId=${appointment.id}: ${error?.message}`,
      );
      if (gwStatus || gwBody) {
        this.logger.error(`[WA-UPDATE] Gateway response: status=${gwStatus} body=${JSON.stringify(gwBody)}`);
      }
    }
  }

  /**
   * Cancels a booking and optionally sends a cancellation notification.
   * Sends APPOINTMENT_CANCEL payload to the gateway.
   * If sendCancelNotification is enabled in config, renders the cancellation
   * template and creates a log entry.
   * Fire-and-forget.
   */
  async cancelBooking(
    appointment: AvailabilityAppointment,
    patient: WhatsappPatientContact,
  ): Promise<void> {
    try {
      this.logger.log(`[WA-CANCEL] START appointmentId=${appointment.id}, patientId=${patient.id}`);

      const config = await this.configService.getConfig();
      if (!config || !config.isActive) {
        this.logger.warn(`[WA-CANCEL] SKIP: config=${config ? 'exists' : 'null'}, isActive=${config?.isActive}`);
        return;
      }

      const rawPhone = patient.cellulare || patient.telefono;
      const phoneNumber = this.formatPhoneNumber(rawPhone);
      if (!phoneNumber) {
        this.logger.warn(`[WA-CANCEL] SKIP: no valid phone for patient ${patient.id}`);
        return;
      }

      const apiKey = await this.configService.getDecryptedApiKey();
      if (!apiKey) {
        this.logger.error(`[WA-CANCEL] SKIP: cannot decrypt API key`);
        return;
      }

      const correlationId = uuidv4();
      const patientName = `${patient.nome || ''} ${patient.cognome || ''}`.trim();
      const isoDate = this.buildIsoDate(appointment.appointmentDate, appointment.startTime);
      let sendNotification = config.sendCancelNotification === true;

      // Stesso criterio dello spostamento: di un appuntamento gia' avvenuto
      // non si annuncia la disdetta — nessuno puo' piu' presentarsi — ma il
      // gateway va chiamato ugualmente per ripulire la coda.
      if (this.isPassato(appointment)) {
        this.logger.log(
          `[WA-CANCEL] appointmentId=${appointment.id} gia' passato (${appointment.appointmentDate} ${appointment.startTime}): annullo la coda senza avvisare`,
        );
        sendNotification = false;
      }

      // Render cancellation message if notification is enabled
      let cancelNotificationMessage: string | undefined;
      let cancelMultiTemplate: string | undefined;
      let cancelLine: string | undefined;
      // Il piano prima del log, e senza ritorno anticipato: la chiamata di
      // disdetta CANCELLA anche il promemoria gia' in coda. Saltarla farebbe
      // arrivare, il giorno prima, il promemoria di un appuntamento che non
      // esiste piu'.
      const plan = await this.deliveryFieldsFor({ primary: 'cancel' }, patient);
      const delivery = plan ?? {};
      if (plan === null) {
        this.logger.log(
          `[WA-CANCEL] Nessun canale per il paziente ${patient.id}: annullo il promemoria senza avvisare`,
        );
        sendNotification = false;
      }

      if (sendNotification) {
        const { date: fmtDate, time: fmtTime } = this.formatAppointment(appointment);
        [cancelNotificationMessage, cancelMultiTemplate] = await Promise.all([
          this.renderTemplateOrUndefined(WhatsappTemplateType.CANCELLATION, {
            name: patientName,
            date: fmtDate,
            time: fmtTime,
          }),
          this.rawTemplateOrUndefined(WhatsappTemplateType.CANCELLATION_MULTI),
        ]);
        cancelLine = `- ${fmtDate} alle ${fmtTime}`;

        // Create log entry only when sending notification
        await this.logService.createLog({
          appointmentId: appointment.id,
          patientId: patient.id,
          patientName,
          phoneNumber,
          messageType: WhatsappMessageType.CANCELLATION,
          correlationId,
          messageBody: cancelNotificationMessage,
          announcedFor: this.announcedFor(appointment),
        });
      }

      const channelTexts = await this.buildChannelTexts(
        delivery.channels ?? [],
        [
          { key: 'cancel_notification', type: WhatsappTemplateType.CANCELLATION },
          { key: 'multiple_cancel', type: WhatsappTemplateType.CANCELLATION_MULTI },
        ],
        // Stesse variabili del testo WhatsApp qui sopra: i testi degli altri
        // canali dicono la stessa cosa scritta per un mezzo diverso, non
        // un'altra cosa.
        (() => {
          const { date, time } = this.formatAppointment(appointment);
          return { name: patientName, date, time };
        })(),
      );

      const payload = {
        appointmentId: appointment.id,
        pazienteId: patient.id,
        phone: phoneNumber,
        sendCancelNotification: sendNotification,
        cancelNotificationMessage,
        cancelMultiTemplate,
        cancelLine,
        // Stessa finestra dei recap: chi disdice tre sedute in una telefonata
        // riceve un elenco, non tre messaggi a dieci secondi l'uno dall'altro.
        recapDelaySeconds: config.recapBufferSeconds ?? undefined,
        name: patientName,
        date: isoDate,
        correlationId,
        ...delivery,
        ...(channelTexts ? { channelTexts } : {}),
      };

      const url = `${config.gatewayUrl}/whatsapp/cancel`;
      this.logger.log(`[WA-CANCEL] POST ${url} sendNotification=${sendNotification} correlationId=${correlationId}`);
      this.logger.log(`[WA-CANCEL] PAYLOAD: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': config.tenantApiId,
            'x-tenant-api-key': apiKey,
            'x-correlation-id': correlationId,
          },
          timeout: 10000,
        }),
      );

      this.logger.log(`[WA-CANCEL] SUCCESS status=${response.status}`);

      // Il gateway ha tolto il recap dal buffer prima che partisse: al paziente
      // non è arrivato niente, quindi nemmeno i log devono raccontare un
      // messaggio inviato e poi smentito. Si annullano entrambe le righe.
      if (response.data?.recapSuppressed === true) {
        await this.logService.cancelAllByAppointmentId(appointment.id);
        this.logger.log(
          `[WA-CANCEL] Recap soppresso per ${appointment.id}: disdetta dentro la finestra di raggruppamento`,
        );
      }
    } catch (error: any) {
      const responseData = error?.response?.data ? JSON.stringify(error.response.data) : 'no response data';
      this.logger.error(
        `[WA-CANCEL] FAILED appointmentId=${appointment.id}: ${error?.message} | response: ${responseData}`,
      );
    }
  }

  /**
   * Invia un messaggio di chat scritto a mano dalla segreteria.
   *
   * A differenza dei dispatch (fire-and-forget) l'errore viene PROPAGATO: chi
   * scrive in una chat deve sapere subito se il messaggio non è partito,
   * altrimenti resterebbe convinto di aver risposto al paziente.
   */
  async sendChatMessage(params: {
    phone: string;
    text: string;
    correlationId: string;
    conversationId: string;
    userId?: string;
  }): Promise<void> {
    const { config, apiKey } = await this.requireGatewayAccess();

    const phone = this.formatPhoneNumber(params.phone);
    if (!phone) {
      throw new BadRequestException(`Numero di telefono non valido: ${params.phone}`);
    }

    const url = `${config.gatewayUrl}/whatsapp/chat/send`;
    this.logger.log(
      `[WA-CHAT] POST ${url} conversationId=${params.conversationId} correlationId=${params.correlationId}`,
    );

    await firstValueFrom(
      this.httpService.post(
        url,
        {
          phone,
          text: params.text,
          correlationId: params.correlationId,
          conversationId: params.conversationId,
        },
        {
          headers: {
            'x-tenant-id': config.tenantApiId,
            'x-tenant-api-key': apiKey,
            'x-user-id': params.userId || 'SYSTEM',
          },
          timeout: 10000,
        },
      ),
    );
  }

  /**
   * Messaggi programmati sul gateway e non ancora inviati.
   *
   * A differenza dei dispatch (fire-and-forget) qui gli errori vengono
   * propagati: è una lettura interattiva e l'utente deve sapere se il gateway
   * non risponde, invece di vedere una lista vuota.
   */
  async listScheduled(): Promise<GatewayScheduledMessage[]> {
    const { config, apiKey } = await this.requireGatewayAccess();

    const response = await firstValueFrom(
      this.httpService.get<GatewayScheduledMessage[]>(`${config.gatewayUrl}/whatsapp/scheduled`, {
        headers: {
          'x-tenant-id': config.tenantApiId,
          'x-tenant-api-key': apiKey,
        },
        timeout: 10000,
      }),
    );

    return response.data ?? [];
  }

  /**
   * Non letti per numero secondo WhatsApp.
   *
   * Unica fonte del dato: l'evento `chats.update` di Evolution non trasporta il
   * contatore, quindi una conversazione aperta da WhatsApp Web non lo comunica
   * a nessuno. Va interrogato.
   */
  async getUnreadCounts(): Promise<Record<string, number>> {
    const { config, apiKey } = await this.requireGatewayAccess();

    const response = await firstValueFrom(
      this.httpService.get<Record<string, number>>(
        `${config.gatewayUrl}/whatsapp/chats/unread`,
        {
          headers: {
            'x-tenant-id': config.tenantApiId,
            'x-tenant-api-key': apiKey,
          },
          timeout: 20000,
        },
      ),
    );

    return response.data ?? {};
  }

  /**
   * Stato di lettura delle conversazioni secondo WhatsApp.
   *
   * Va oltre il contatore, che per molte chat è nullo: guarda anche lo storico
   * di stato dei messaggi in arrivo, dove compare la lettura fatta dalla
   * segreteria su WhatsApp Web anche quando non ha risposto.
   */
  async getChatReadStates(
    items: { phone: string; messageId?: string }[],
  ): Promise<Record<string, 'read' | 'unread' | 'unknown'>> {
    if (items.length === 0) return {};

    const { config, apiKey } = await this.requireGatewayAccess();

    const response = await firstValueFrom(
      this.httpService.post<Record<string, 'read' | 'unread' | 'unknown'>>(
        `${config.gatewayUrl}/whatsapp/chats/read-state`,
        { items },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': config.tenantApiId,
            'x-tenant-api-key': apiKey,
          },
          timeout: 60000,
        },
      ),
    );

    return response.data ?? {};
  }

  /** Annulla un singolo invio programmato. `false` se il job non esiste più. */
  async cancelScheduled(jobId: string): Promise<boolean> {
    const { config, apiKey } = await this.requireGatewayAccess();

    try {
      await firstValueFrom(
        this.httpService.delete(
          `${config.gatewayUrl}/whatsapp/scheduled/${encodeURIComponent(jobId)}`,
          {
            headers: {
              'x-tenant-id': config.tenantApiId,
              'x-tenant-api-key': apiKey,
            },
            timeout: 10000,
          },
        ),
      );
      this.logger.log(`[WA-SCHEDULED] Annullato invio programmato ${jobId}`);
      return true;
    } catch (error: any) {
      if (error?.response?.status === 404) return false;
      throw error;
    }
  }

  /**
   * Parametri della fascia di invio del promemoria, mandati al gateway solo se
   * il tenant l'ha accesa: in loro assenza il gateway resta sul comportamento
   * storico (promemoria alle 24h esatte). Spegnere la fascia non richiede quindi
   * nessun coordinamento fra i due servizi.
   */
  private reminderWindowFields(config: WhatsappTenantConfig): ReminderWindowFields {
    if (!config.reminderWindowEnabled) return {};

    return {
      reminderWindowStart: config.reminderWindowStart,
      reminderWindowEnd: config.reminderWindowEnd,
      reminderEarlyPolicy: config.reminderEarlyPolicy,
    };
  }

  /** Config attiva + API key decifrata, o eccezione parlante. */
  private async requireGatewayAccess(): Promise<{ config: WhatsappTenantConfig; apiKey: string }> {
    const config = await this.configService.getConfig();
    if (!config) {
      throw new BadRequestException('Gateway WhatsApp non configurato');
    }

    const apiKey = await this.configService.getDecryptedApiKey();
    if (!apiKey) {
      throw new BadRequestException('API key del gateway non disponibile');
    }

    return { config, apiKey };
  }

  /**
   * Strips '+' and non-digit characters, returns phone in format 393515847659
   */
  formatPhoneNumber(phone?: string): string | null {
    if (!phone) return null;
    let cleaned = phone.replace(/[\s\-\(\)\.\/]/g, '');
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    // Se il numero inizia con 3 ed è lungo 10 cifre → numero italiano senza prefisso, aggiungi 39
    if (/^3\d{8,9}$/.test(cleaned)) {
      cleaned = '39' + cleaned;
    }
    // Se il numero inizia con 0 → numero fisso italiano, aggiungi 39 e togli lo 0
    if (cleaned.startsWith('0') && cleaned.length >= 9) {
      cleaned = '39' + cleaned.substring(1);
    }
    if (cleaned.length < 11) return null;
    // Verifica che sia composto solo da cifre
    if (!/^\d+$/.test(cleaned)) return null;
    return cleaned;
  }

  /** Data e ora dell'appuntamento nel formato dei template: {date} e {time}. */
  /**
   * Campi di consegna da allegare al payload per il gateway.
   *
   * Prende le impostazioni per canale dello studio, la preferenza del
   * paziente e la categoria del messaggio, e ne ricava l'ordine dei canali.
   * Restituisce `{}` quando l'unico canale utilizzabile e' WhatsApp: e' il
   * comportamento storico, e non allegare niente lo lascia intatto invece di
   * riaffermarlo — un tenant che non ha mai toccato le impostazioni continua
   * esattamente come prima.
   *
   * `null` significa "non mandare niente": il paziente ha chiesto di non
   * essere avvisato, oppure nessun canale acceso porta questa categoria.
   */
  private async deliveryFieldsFor(
    kinds: { primary: 'booking' | 'update' | 'cancel'; withReminder?: boolean },
    patient: WhatsappPatientContact,
  ): Promise<Record<string, any> | null> {
    let settings: any[];
    try {
      settings = await this.channelSettings.list();
    } catch (error) {
      // Impostazioni illeggibili non devono impedire una notifica: si ricade
      // sul comportamento storico, che e' WhatsApp.
      this.logger.warn(
        `[NOTIFY] Impostazioni canali non leggibili, uso solo WhatsApp: ${(error as Error).message}`,
      );
      return {};
    }

    const preference = (patient.canalePreferito ?? null) as PatientChannelPreference;
    const plan = buildNotificationPlan(settings, categoryOfMessage(kinds.primary), preference);
    if (!plan) return null;

    const reminderPlan = kinds.withReminder
      ? buildNotificationPlan(settings, categoryOfMessage('reminder'), preference)
      : null;

    const onlyWhatsapp = (channels: string[]) =>
      channels.length === 1 && channels[0] === 'whatsapp';

    // Nessuna configurazione oltre WhatsApp, nemmeno per il promemoria: non
    // c'e' niente da dire al gateway.
    if (onlyWhatsapp(plan.channels) && (!reminderPlan || onlyWhatsapp(reminderPlan.channels))) {
      return {};
    }

    return {
      channels: plan.channels,
      ...(reminderPlan ? { reminderChannels: reminderPlan.channels } : {}),
      ...(patient.email ? { email: patient.email } : {}),
      ...(plan.smsDriver || reminderPlan?.smsDriver
        ? { smsDriver: plan.smsDriver ?? reminderPlan!.smsDriver }
        : {}),
      ...(plan.emailFromName || reminderPlan?.emailFromName
        ? { emailFromName: plan.emailFromName ?? reminderPlan!.emailFromName }
        : {}),
    };
  }

  private formatAppointment(
    appointment: AvailabilityAppointment,
  ): { date: string; time: string } {
    return this.formatSlot(appointment);
  }

  /** Stessa formattazione, per una posizione qualunque (anche quella vecchia). */
  private formatSlot(slot: AppointmentSlot): { date: string; time: string } {
    const dateObj = slot.appointmentDate instanceof Date
      ? slot.appointmentDate
      : new Date(String(slot.appointmentDate));
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    return {
      date: `${day}/${month}/${dateObj.getFullYear()}`,
      time: String(slot.startTime).substring(0, 5),
    };
  }

  /**
   * Template del tenant renderizzato con le variabili passate.
   * Non lancia mai: se il template manca, è disattivato o il DB non risponde
   * torna undefined e il gateway userà il proprio testo di fallback.
   */
  /**
   * Testi per canale, indicizzati per tipo di messaggio.
   *
   * Costruita solo per i canali diversi da WhatsApp che sono davvero nel
   * piano: se lo studio manda tutto da WhatsApp non c'e' nulla da calcolare, e
   * interrogare i template di email e SMS sarebbe lavoro buttato a ogni
   * prenotazione.
   *
   * Un tipo senza testo proprio non compare nella mappa: il gateway ricade
   * sul testo WhatsApp, che c'e' sempre. Accendere un canale senza averne
   * scritto i testi deve funzionare — la personalizzazione e' un miglioramento,
   * non un prerequisito.
   */
  private async buildChannelTexts(
    channels: string[],
    types: { key: string; type: WhatsappTemplateType }[],
    variables: Record<string, string>,
  ): Promise<Record<string, { sms?: string; emailSubject?: string; emailBody?: string }> | undefined> {
    const wantsSms = channels.includes('sms');
    const wantsEmail = channels.includes('email');
    if (!wantsSms && !wantsEmail) return undefined;

    const texts: Record<string, { sms?: string; emailSubject?: string; emailBody?: string }> = {};

    for (const { key, type } of types) {
      const entry: { sms?: string; emailSubject?: string; emailBody?: string } = {};

      if (wantsSms) {
        const t = await this.channelTemplate(type, NotificationChannel.SMS);
        if (t) entry.sms = this.templateService.renderTemplate(t.bodyTemplate, variables);
      }

      if (wantsEmail) {
        const t = await this.channelTemplate(type, NotificationChannel.EMAIL);
        if (t) {
          entry.emailBody = this.templateService.renderTemplate(t.bodyTemplate, variables);
          if (t.subjectTemplate) {
            entry.emailSubject = this.templateService.renderTemplate(t.subjectTemplate, variables);
          }
        }
      }

      if (Object.keys(entry).length) texts[key] = entry;
    }

    return Object.keys(texts).length ? texts : undefined;
  }

  /**
   * Il template PROPRIO di quel canale, o niente.
   *
   * Non usa `resolveForChannel`, che ripiega su WhatsApp: qui il ripiego lo
   * fa gia' il gateway, e restituire il testo WhatsApp lo farebbe viaggiare
   * due volte spacciato per personalizzato.
   */
  private async channelTemplate(
    type: WhatsappTemplateType,
    channel: NotificationChannel,
  ): Promise<{ bodyTemplate: string; subjectTemplate?: string } | null> {
    try {
      const all = await this.templateService.findAll(channel);
      const found = all.find(t => t.templateType === type && t.isActive && t.bodyTemplate?.trim());
      return found ?? null;
    } catch (error) {
      this.logger.warn(
        `[NOTIFY] Template ${type}/${channel} non leggibile: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async renderTemplateOrUndefined(
    type: WhatsappTemplateType,
    variables: Record<string, string>,
  ): Promise<string | undefined> {
    const body = await this.rawTemplateOrUndefined(type);
    return body ? this.templateService.renderTemplate(body, variables) : undefined;
  }

  /**
   * Corpo grezzo del template, per i casi in cui la sostituzione delle
   * variabili avviene nel gateway (RECAP_MULTI: l'elenco appuntamenti è noto
   * solo alla chiusura del buffer).
   */
  private async rawTemplateOrUndefined(
    type: WhatsappTemplateType,
  ): Promise<string | undefined> {
    try {
      const template = await this.templateService.findByType(type);
      if (!template?.bodyTemplate || !template.isActive) return undefined;
      return template.bodyTemplate;
    } catch (e: any) {
      this.logger.warn(`[WA] Lettura template ${type} fallita: ${e?.message}`);
      return undefined;
    }
  }

  /**
   * Builds ISO 8601 date string from appointment date and time.
   * appointmentDate can be a Date object or a string ("YYYY-MM-DD").
   *
   * NB: si invia l'ora LOCALE senza offset. Il gateway la interpreta in
   * Europe/Rome applicando la DST corretta; un offset fisso (era `+01:00`)
   * sballa di un'ora tutti i messaggi da fine marzo a fine ottobre.
   */
  /**
   * La data e ora che il messaggio sta per comunicare, da salvare sul log.
   *
   * Stessa stringa che finisce nel testo per il paziente, letta come ora
   * locale: il fuso del processo la interpreta in scrittura e la riscrive
   * uguale in lettura, quindi il valore a database resta l'ora del calendario
   * dello studio comunque sia configurato l'host.
   */
  /**
   * L'appuntamento e' gia' passato?
   *
   * Nessun messaggio di appuntamento ha senso dopo che l'appuntamento e'
   * avvenuto: una conferma per il 12 agosto ricevuta il 24 confonde e basta.
   * Succede per davvero — uno studio che carica a posteriori il lavoro del
   * mese per allineare la contabilita' fa nascere decine di appuntamenti in
   * data passata, e senza questa guardia ne parte un messaggio per ognuno.
   *
   * Confronto sull'orologio da parete di Roma, come stringhe.
   * `new Date("2026-08-24T14:00:00")` verrebbe letto nel fuso del processo:
   * su un host in UTC quel "14:00" diventa le 16:00 italiane, e per due ore
   * un appuntamento appena passato sembrerebbe ancora futuro. Il formato
   * "YYYY-MM-DDTHH:mm:ss" si ordina cronologicamente da solo, quindi il
   * confronto fra stringhe e' esatto e non passa da nessuna conversione.
   */
  private isPassato(appointment: AppointmentSlot): boolean {
    const quando = this.buildIsoDate(appointment.appointmentDate, appointment.startTime);
    const adesso = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Rome',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(new Date()).replace(' ', 'T');

    return quando < adesso;
  }

  private announcedFor(appointment: AppointmentSlot): Date {
    return new Date(this.buildIsoDate(appointment.appointmentDate, appointment.startTime));
  }

  private buildIsoDate(
    appointmentDate: Date | string,
    startTime: string,
  ): string {
    let datePart: string;

    if (appointmentDate instanceof Date) {
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
      const day = String(appointmentDate.getDate()).padStart(2, '0');
      datePart = `${year}-${month}-${day}`;
    } else {
      // Already a string like "2026-03-15" or "2026-03-15T00:00:00.000Z"
      datePart = String(appointmentDate).substring(0, 10);
    }

    const time = startTime.includes(':') && startTime.split(':').length === 2
      ? `${startTime}:00`
      : startTime;
    return `${datePart}T${time}`;
  }
}
