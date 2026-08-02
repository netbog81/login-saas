import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WhatsappGatewayService } from '../../gateway/whatsapp-gateway.service';
import { WhatsappLogService } from '../../log/services/whatsapp-log.service';
import { WhatsappScheduledMessage } from '../dto/whatsapp-scheduled.dto';

/**
 * Vista sui messaggi ancora in coda sul gateway.
 *
 * Il gateway conosce solo numeri e id: qui i messaggi vengono arricchiti con il
 * nome paziente preso dai log, che è ciò che serve in segreteria per capire a
 * chi sta per partire un messaggio.
 */
@Injectable()
export class WhatsappScheduledService {
  private readonly logger = new Logger(WhatsappScheduledService.name);

  constructor(
    private readonly gatewayService: WhatsappGatewayService,
    private readonly logService: WhatsappLogService,
  ) {}

  async list(): Promise<WhatsappScheduledMessage[]> {
    const raw = await this.gatewayService.listScheduled();

    return Promise.all(
      raw.map(async (m) => ({
        jobId: m.jobId,
        type: m.type,
        phone: m.phone,
        patientName: await this.resolvePatientName(m.appointmentIds, m.phone),
        appointmentIds: m.appointmentIds ?? [],
        content: m.content,
        bufferedCount: m.bufferedCount,
        scheduledFor: new Date(m.scheduledFor),
        state: m.state,
      })),
    );
  }

  /**
   * Annulla un invio programmato e allinea il log del clinico.
   *
   * Gli appointmentId servono per marcare i log come CANCELLED, ma il gateway
   * non li restituisce dopo la rimozione: si leggono prima dalla coda.
   */
  async cancel(jobId: string): Promise<boolean> {
    const scheduled = await this.gatewayService.listScheduled();
    const target = scheduled.find((m) => m.jobId === jobId);
    if (!target) {
      throw new NotFoundException('Messaggio programmato non trovato o già inviato');
    }

    const removed = await this.gatewayService.cancelScheduled(jobId);
    if (!removed) {
      throw new NotFoundException('Messaggio programmato non trovato o già inviato');
    }

    for (const appointmentId of target.appointmentIds ?? []) {
      await this.logService.cancelByAppointmentId(appointmentId);
    }

    this.logger.log(`[WA-SCHEDULED] Invio ${jobId} annullato (tipo ${target.type})`);
    return true;
  }

  private async resolvePatientName(
    appointmentIds: string[] | undefined,
    phone: string,
  ): Promise<string | undefined> {
    for (const id of appointmentIds ?? []) {
      const info = await this.logService.findPatientInfoByAppointmentId(id);
      if (info?.patientName) return info.patientName;
    }
    // Recap ancora in composizione: nessun appuntamento noto, si prova col numero.
    return this.logService.findPatientNameByPhone(phone);
  }
}
