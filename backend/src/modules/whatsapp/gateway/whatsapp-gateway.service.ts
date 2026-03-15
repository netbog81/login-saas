import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { WhatsappConfigService } from '../config/services/whatsapp-config.service';
import { WhatsappLogService } from '../log/services/whatsapp-log.service';
import { WhatsappTemplateService } from '../template/services/whatsapp-template.service';
import { WhatsappMessageStatus, WhatsappMessageType, WhatsappTemplateType } from '../enums/whatsapp-enums';
import { DispatchBookingPayload } from './dto/dispatch-booking.dto';
import { AvailabilityAppointment } from '../../availability/entities/availability-appointment.entity';
import { Patient } from '../../../entities/patient.entity';

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
    patient: Patient,
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

      // Render messageBody from template
      let messageBody: string | undefined;
      try {
        const template = await this.templateService.findByType(WhatsappTemplateType.RECAP_SINGLE);
        if (template?.bodyTemplate) {
          const dateObj = appointment.appointmentDate instanceof Date
            ? appointment.appointmentDate
            : new Date(String(appointment.appointmentDate));
          const fmtDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
          const fmtTime = appointment.startTime.substring(0, 5);
          messageBody = this.templateService.renderTemplate(template.bodyTemplate, {
            name: patientName,
            date: fmtDate,
            time: fmtTime,
          });
        }
      } catch (e: any) {
        this.logger.warn(`[WA-DISPATCH] Template render failed: ${e?.message}`);
      }

      // Create log entry before calling gateway (status DISPATCHED)
      await this.logService.createLog({
        appointmentId: appointment.id,
        patientId: patient.id,
        patientName,
        phoneNumber,
        messageType: WhatsappMessageType.RECAP_SINGLE,
        correlationId,
        messageBody,
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
   * Cancels a booking and optionally sends a cancellation notification.
   * Sends APPOINTMENT_CANCEL payload to the gateway.
   * If sendCancelNotification is enabled in config, renders the cancellation
   * template and creates a log entry.
   * Fire-and-forget.
   */
  async cancelBooking(
    appointment: AvailabilityAppointment,
    patient: Patient,
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
        try {
          const template = await this.templateService.findByType(WhatsappTemplateType.CANCELLATION);
          if (template?.bodyTemplate) {
            const dateObj = appointment.appointmentDate instanceof Date
              ? appointment.appointmentDate
              : new Date(String(appointment.appointmentDate));
            const fmtDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
            const fmtTime = appointment.startTime.substring(0, 5);
            cancelNotificationMessage = this.templateService.renderTemplate(template.bodyTemplate, {
              name: patientName,
              date: fmtDate,
              time: fmtTime,
            });
          }
        } catch (e: any) {
          this.logger.warn(`[WA-CANCEL] Template render failed: ${e?.message}`);
        }

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

  /**
   * Builds ISO 8601 date string from appointment date and time.
   * appointmentDate can be a Date object or a string ("YYYY-MM-DD").
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
    return `${datePart}T${time}+01:00`;
  }
}
