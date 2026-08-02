import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { WhatsappConfigService } from '../config/services/whatsapp-config.service';
import { WhatsappTenantConfig } from '../config/entities/whatsapp-tenant-config.entity';
import { WhatsappLogService } from '../log/services/whatsapp-log.service';
import { WhatsappTemplateService } from '../template/services/whatsapp-template.service';
import { WhatsappMessageStatus, WhatsappMessageType, WhatsappTemplateType } from '../enums/whatsapp-enums';
import { DispatchBookingPayload, DispatchUpdatePayload } from './dto/dispatch-booking.dto';
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
  ) {}

  /**
   * Dispatches a booking notification to the WhatsApp gateway.
   * Fire-and-forget: never throws, always logs errors.
   */
  async dispatchBooking(
    appointment: AvailabilityAppointment,
    patient: WhatsappPatientContact,
  ): Promise<void> {
    try {
      this.logger.log(`[WA-DISPATCH] START appointmentId=${appointment.id}, patientId=${patient.id}`);

      const config = await this.configService.getConfig();
      if (!config || !config.isActive) {
        this.logger.warn(`[WA-DISPATCH] SKIP: config=${config ? 'exists' : 'null'}, isActive=${config?.isActive}`);
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

      const [recapMessage, reminderMessage, recapMultiTemplate] = await Promise.all([
        this.renderTemplateOrUndefined(WhatsappTemplateType.RECAP_SINGLE, variables),
        this.renderTemplateOrUndefined(WhatsappTemplateType.REMINDER_24H, variables),
        this.rawTemplateOrUndefined(WhatsappTemplateType.RECAP_MULTI),
      ]);

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
      });

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
          recapMultiTemplate,
          recapLine: `- ${fmtDate} alle ${fmtTime}`,
          recapDelaySeconds: config.recapBufferSeconds ?? undefined,
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
      const variables = { name: patientName, date: fmtDate, time: fmtTime };

      // Il POST parte comunque anche a notifica disattivata: il gateway deve
      // spostare il reminder 24h sul nuovo orario.
      const sendNotification = config.sendUpdateNotification !== false;

      const [updateMessage, reminderMessage] = await Promise.all([
        sendNotification
          ? this.renderTemplateOrUndefined(WhatsappTemplateType.UPDATE, variables)
          : Promise.resolve(undefined),
        this.renderTemplateOrUndefined(WhatsappTemplateType.REMINDER_24H, variables),
      ]);

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
        });
      }

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
          sendUpdateNotification: sendNotification,
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
      const sendNotification = config.sendCancelNotification === true;

      // Render cancellation message if notification is enabled
      let cancelNotificationMessage: string | undefined;
      if (sendNotification) {
        const { date: fmtDate, time: fmtTime } = this.formatAppointment(appointment);
        cancelNotificationMessage = await this.renderTemplateOrUndefined(
          WhatsappTemplateType.CANCELLATION,
          { name: patientName, date: fmtDate, time: fmtTime },
        );

        // Create log entry only when sending notification
        await this.logService.createLog({
          appointmentId: appointment.id,
          patientId: patient.id,
          patientName,
          phoneNumber,
          messageType: WhatsappMessageType.CANCELLATION,
          correlationId,
          messageBody: cancelNotificationMessage,
        });
      }

      const payload = {
        appointmentId: appointment.id,
        pazienteId: patient.id,
        phone: phoneNumber,
        sendCancelNotification: sendNotification,
        cancelNotificationMessage,
        name: patientName,
        date: isoDate,
        correlationId,
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
    } catch (error: any) {
      const responseData = error?.response?.data ? JSON.stringify(error.response.data) : 'no response data';
      this.logger.error(
        `[WA-CANCEL] FAILED appointmentId=${appointment.id}: ${error?.message} | response: ${responseData}`,
      );
    }
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
  private formatAppointment(
    appointment: AvailabilityAppointment,
  ): { date: string; time: string } {
    const dateObj = appointment.appointmentDate instanceof Date
      ? appointment.appointmentDate
      : new Date(String(appointment.appointmentDate));
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    return {
      date: `${day}/${month}/${dateObj.getFullYear()}`,
      time: appointment.startTime.substring(0, 5),
    };
  }

  /**
   * Template del tenant renderizzato con le variabili passate.
   * Non lancia mai: se il template manca, è disattivato o il DB non risponde
   * torna undefined e il gateway userà il proprio testo di fallback.
   */
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
