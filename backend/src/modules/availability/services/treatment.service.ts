import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not, DataSource, EntityManager } from 'typeorm';
import { Treatment, TreatmentStatus, PaymentMethod } from '../entities/treatment.entity';
import { TreatmentInstrument } from '../entities/treatment-instrument.entity';
import { TreatmentService as TreatmentServiceEntity } from '../entities/treatment-service.entity';
import { AvailabilityAppointment, BookingStatus } from '../entities/availability-appointment.entity';
import { AppointmentInstrument } from '../entities/appointment-instrument.entity';
import { AppointmentService as AppointmentServiceEntity } from '../entities/appointment-service.entity';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { Service } from '../entities/service.entity';
import { Patient } from '../../../entities/patient.entity';
import { EventsService } from '../../events/events.service';
import { TreatmentServiceInputItem } from '../dto/treatment.input';

// ==================== INPUT INTERFACES ====================

export interface CompleteTreatmentInput {
  clinicalNotes?: string;
  secretaryNotes?: string;
  operatorNotes?: string;
  price: number;
  isTest?: boolean;
}

export interface CloseTreatmentInput {
  secretaryNotes?: string;
}

export interface RecordPaymentInput {
  paymentMethod: PaymentMethod;
  collectedBy: string;
  amount?: number; // Se diverso dal prezzo originale
}

export interface TreatmentInstrumentInput {
  instrumentId: string;
  instrumentCategoryId?: string;
  wasUsed: boolean;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  orderPosition?: number;
}

export interface UpdateTreatmentInstrumentInput {
  instrumentId: string;
  instrumentCategoryId?: string;
  quantity?: number;
  wasUsed?: boolean;
  startOffsetMinutes?: number;
  endOffsetMinutes?: number;
  notes?: string;
}

export interface UpdateTreatmentInput {
  id: string;
  therapeuticPathId?: string;
  /** @deprecated Usa treatmentServices invece */
  serviceId?: string;
  /** Lista dei servizi eseguiti nel trattamento */
  treatmentServices?: TreatmentServiceInputItem[];
  clinicalNotes?: string;
  secretaryNotes?: string;
  patientNotes?: string;
  price?: number;
  scontoFE?: boolean;
  painLevel?: number;
  painBefore?: number;
  painAfter?: number;
  rescheduleRequested?: boolean;
  reschedulingType?: string;
  suggestInDays?: number;
  suggestDateRangeStart?: string;
  suggestDateRangeEnd?: string;
  reschedulingNotes?: string;
  instruments?: UpdateTreatmentInstrumentInput[];
  isPaid?: boolean; // Se false, resetta paymentMethod, paidAt, collectedBy
}

// ==================== SERVICE ====================

@Injectable()
export class TreatmentService {
  constructor(
    @InjectRepository(Treatment)
    private treatmentRepo: Repository<Treatment>,
    @InjectRepository(TreatmentInstrument)
    private treatmentInstrumentRepo: Repository<TreatmentInstrument>,
    @InjectRepository(TreatmentServiceEntity)
    private treatmentServiceRepo: Repository<TreatmentServiceEntity>,
    @InjectRepository(AvailabilityAppointment)
    private appointmentRepo: Repository<AvailabilityAppointment>,
    @InjectRepository(AppointmentInstrument)
    private appointmentInstrumentRepo: Repository<AppointmentInstrument>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(TherapeuticPath)
    private pathRepo: Repository<TherapeuticPath>,
    private dataSource: DataSource,
    private eventsService: EventsService,
  ) {}

  // ==================== CRUD ====================

  /**
   * Crea un trattamento da un appuntamento quando il paziente si presenta
   * Copia automaticamente gli strumenti dall'appuntamento
   */
  async createFromAppointment(
    appointmentId: string,
    therapeuticPathId: string,
    scontoFE: boolean = false
  ): Promise<Treatment> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentRepo = manager.getRepository(Treatment);
      const appointmentRepo = manager.getRepository(AvailabilityAppointment);
      const pathRepo = manager.getRepository(TherapeuticPath);

      // Verifica che l'appuntamento esista
      const appointment = await appointmentRepo.findOne({
        where: { id: appointmentId },
        relations: ['instruments', 'operator', 'service']
      });

      // Carica appointmentServices separatamente (relazione unidirezionale)
      const appointmentServiceRepo = manager.getRepository(AppointmentServiceEntity);
      const appointmentServices = await appointmentServiceRepo.find({
        where: { appointmentId },
        relations: ['service'],
        order: { orderPosition: 'ASC' }
      });

      if (!appointment) {
        throw new NotFoundException(`Appuntamento ${appointmentId} non trovato`);
      }

      // Verifica che il percorso terapeutico esista
      const path = await pathRepo.findOne({
        where: { id: therapeuticPathId }
      });

      if (!path) {
        throw new NotFoundException(`Percorso terapeutico ${therapeuticPathId} non trovato`);
      }

      // Verifica che l'appuntamento sia in stato ATTENDED
      if (appointment.bookingStatus !== BookingStatus.ATTENDED) {
        throw new BadRequestException(
          `L'appuntamento deve essere in stato 'attended' per creare un trattamento. Stato attuale: ${appointment.bookingStatus}`
        );
      }

      // Verifica che non esista già un trattamento per questo appuntamento
      const existingTreatment = await treatmentRepo.findOne({
        where: { appointmentId }
      });

      if (existingTreatment) {
        throw new ConflictException(`Esiste già un trattamento per l'appuntamento ${appointmentId}`);
      }

      // Calcola il prezzo totale dai servizi (se presenti)
      let totalPrice = 0;
      if (appointmentServices && appointmentServices.length > 0) {
        // Usa i servizi multipli
        for (const apptService of appointmentServices) {
          if (apptService.customPrice !== undefined && apptService.customPrice !== null) {
            totalPrice += Number(apptService.customPrice);
          } else if (apptService.service) {
            // Se scontoFE, usa discountFE altrimenti defaultPrice
            const price = scontoFE && apptService.service.discountFE
              ? apptService.service.discountFE
              : (apptService.service.defaultPrice || 0);
            totalPrice += Number(price);
          }
        }
      } else if (appointment.service) {
        // Fallback: usa serviceId singolo legacy
        totalPrice = scontoFE && appointment.service.discountFE
          ? appointment.service.discountFE
          : (appointment.service.defaultPrice || 0);
      }

      // Crea il trattamento
      const treatment = treatmentRepo.create({
        appointmentId,
        operatorId: appointment.operatorId!,
        patientId: appointment.patientId,
        serviceId: appointment.serviceId, // Mantiene per retrocompatibilità
        therapeuticPathId,
        scontoFE,
        status: TreatmentStatus.IN_PROGRESS,
        isTest: false,
        startedAt: new Date(appointment.appointmentDate + 'T' + appointment.startTime),
        price: totalPrice,
      });

      const savedTreatment = await treatmentRepo.save(treatment);

      // Copia gli strumenti dall'appuntamento al trattamento
      await this.copyInstrumentsFromAppointment(manager, savedTreatment.id, appointmentId);

      // Copia i servizi dall'appuntamento al trattamento
      await this.copyServicesFromAppointment(manager, savedTreatment.id, appointment, appointmentServices, scontoFE);

      // Ritorna il trattamento con le relazioni
      const result = await this.findByIdWithManager(manager, savedTreatment.id);

      // Emetti evento SSE per notificare il frontend (dopo commit transazione)
      this.eventsService.emit({
        type: 'treatment_created',
        treatmentId: result.id,
        operatorId: result.operatorId,
        timestamp: new Date(),
      });

      return result;
    });
  }

  /**
   * Trova un trattamento per ID
   */
  async findById(id: string): Promise<Treatment | null> {
    return this.treatmentRepo.findOne({
      where: { id },
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service']
    });
  }

  /**
   * Trova un trattamento per ID (con EntityManager per transazioni)
   */
  private async findByIdWithManager(manager: EntityManager, id: string): Promise<Treatment> {
    const treatment = await manager.getRepository(Treatment).findOne({
      where: { id },
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service']
    });

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    return treatment;
  }

  /**
   * Trova il trattamento associato a un appuntamento
   */
  async findByAppointmentId(appointmentId: string): Promise<Treatment | null> {
    return this.treatmentRepo.findOne({
      where: { appointmentId },
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service']
    });
  }

  /**
   * Ottiene i trattamenti per più appuntamenti in una singola query.
   */
  async findByAppointmentIds(appointmentIds: string[]): Promise<Treatment[]> {
    if (appointmentIds.length === 0) return [];
    return this.treatmentRepo.find({
      where: { appointmentId: In(appointmentIds) },
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service']
    });
  }

  // ==================== UPDATE ====================

  /**
   * Aggiorna un trattamento in corso
   * Solo i trattamenti con status IN_PROGRESS possono essere modificati
   */
  async update(input: UpdateTreatmentInput): Promise<Treatment> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentRepo = manager.getRepository(Treatment);
      const treatmentInstrumentRepo = manager.getRepository(TreatmentInstrument);

      const { id, instruments, treatmentServices, ...updateData } = input;

      const treatment = await treatmentRepo.findOne({
        where: { id },
        relations: ['instruments', 'instruments.instrument', 'therapeuticPath', 'appointment', 'service'],
      });

      if (!treatment) {
        throw new NotFoundException(`Trattamento ${id} non trovato`);
      }

      if (treatment.status !== TreatmentStatus.IN_PROGRESS) {
        throw new BadRequestException(
          `Solo i trattamenti in corso possono essere modificati. Stato attuale: ${treatment.status}`
        );
      }

      // Aggiorna campi base (solo quelli forniti)
      if (updateData.clinicalNotes !== undefined) treatment.clinicalNotes = updateData.clinicalNotes;
      if (updateData.secretaryNotes !== undefined) treatment.secretaryNotes = updateData.secretaryNotes;
      if (updateData.patientNotes !== undefined) treatment.patientNotes = updateData.patientNotes;
      if (updateData.price !== undefined) treatment.price = updateData.price;
      if (updateData.scontoFE !== undefined) treatment.scontoFE = updateData.scontoFE;
      if (updateData.painLevel !== undefined) treatment.painLevel = updateData.painLevel;
      if (updateData.painBefore !== undefined) treatment.painBefore = updateData.painBefore;
      if (updateData.painAfter !== undefined) treatment.painAfter = updateData.painAfter;
      if (updateData.rescheduleRequested !== undefined) treatment.rescheduleRequested = updateData.rescheduleRequested;
      if (updateData.reschedulingType !== undefined) treatment.reschedulingType = updateData.reschedulingType;
      if (updateData.suggestInDays !== undefined) treatment.suggestInDays = updateData.suggestInDays;
      if (updateData.suggestDateRangeStart !== undefined) treatment.suggestDateRangeStart = updateData.suggestDateRangeStart ? new Date(updateData.suggestDateRangeStart) : null as any;
      if (updateData.suggestDateRangeEnd !== undefined) treatment.suggestDateRangeEnd = updateData.suggestDateRangeEnd ? new Date(updateData.suggestDateRangeEnd) : null as any;
      if (updateData.reschedulingNotes !== undefined) treatment.reschedulingNotes = updateData.reschedulingNotes;

      // Gestione reset pagamento: se isPaid === false, resetta lo stato di pagamento
      if (updateData.isPaid === false) {
        treatment.isPaid = false;
        treatment.paymentMethod = null as any;
        treatment.paidAt = null as any;
        treatment.collectedBy = null as any;
      }

      // Aggiorna relazioni se specificate
      if (updateData.therapeuticPathId) {
        treatment.therapeuticPathId = updateData.therapeuticPathId;
      }
      if (updateData.serviceId) {
        treatment.serviceId = updateData.serviceId;
      }

      // IMPORTANTE: Rimuovere le relazioni caricate PRIMA del save per evitare che TypeORM
      // sovrascriva i foreign key con i valori degli oggetti caricati.
      // Usare delete invece di = null per evitare che TypeORM interpreti null come "set to null"
      delete (treatment as any).therapeuticPath;
      delete (treatment as any).service;

      await treatmentRepo.save(treatment);

      // Aggiorna strumenti se specificati
      if (instruments !== undefined) {
        // Rimuovi strumenti esistenti
        await treatmentInstrumentRepo.delete({ treatmentId: id });

        // Aggiungi nuovi strumenti
        if (instruments.length > 0) {
          for (const inst of instruments) {
            const treatmentInstrument = treatmentInstrumentRepo.create({
              treatmentId: id,
              instrumentId: inst.instrumentId,
              instrumentCategoryId: inst.instrumentCategoryId,
              wasUsed: inst.wasUsed ?? true,
              startOffsetMinutes: inst.startOffsetMinutes ?? 0,
              endOffsetMinutes: inst.endOffsetMinutes ?? 0,
            });
            await treatmentInstrumentRepo.save(treatmentInstrument);
          }
        }
      }

      // Aggiorna servizi se specificati
      if (treatmentServices !== undefined) {
        await this.saveTreatmentServicesWithManager(
          manager,
          id,
          treatmentServices,
          treatment.scontoFE || false
        );
      }

      return this.findByIdWithManager(manager, id);
    });
  }

  // ==================== STATUS MANAGEMENT ====================

  /**
   * Operatore completa il trattamento
   */
  async complete(id: string, input: CompleteTreatmentInput): Promise<Treatment> {
    const treatment = await this.findById(id);

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    if (treatment.status !== TreatmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Il trattamento deve essere in stato 'in_progress' per essere completato. Stato attuale: ${treatment.status}`
      );
    }

    treatment.status = TreatmentStatus.OPERATOR_COMPLETED;
    treatment.completedAt = new Date();
    treatment.clinicalNotes = input.clinicalNotes;
    treatment.secretaryNotes = input.secretaryNotes;
    treatment.operatorNotes = input.operatorNotes;
    treatment.price = input.price;
    if (input.isTest !== undefined) {
      treatment.isTest = input.isTest;
    }

    const result = await this.treatmentRepo.save(treatment);

    // Emetti evento SSE per notificare il frontend
    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: result.id,
      operatorId: result.operatorId,
      newStatus: result.status,
      timestamp: new Date(),
    });

    return result;
  }

  /**
   * Segreteria chiude il trattamento
   */
  async close(id: string, input: CloseTreatmentInput): Promise<Treatment> {
    const treatment = await this.findById(id);

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    if (treatment.status !== TreatmentStatus.OPERATOR_COMPLETED) {
      throw new BadRequestException(
        `Il trattamento deve essere in stato 'operator_completed' per essere chiuso. Stato attuale: ${treatment.status}`
      );
    }

    treatment.status = TreatmentStatus.CLOSED;
    treatment.closedAt = new Date();
    if (input.secretaryNotes) {
      treatment.secretaryNotes = input.secretaryNotes;
    }

    const result = await this.treatmentRepo.save(treatment);

    // Emetti evento SSE per notificare il frontend
    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: result.id,
      operatorId: result.operatorId,
      newStatus: result.status,
      timestamp: new Date(),
    });

    return result;
  }

  /**
   * Riapre un trattamento completato (riporta a IN_PROGRESS)
   * Solo i trattamenti con status OPERATOR_COMPLETED possono essere riaperti
   */
  async reopen(id: string): Promise<Treatment> {
    const treatment = await this.findById(id);

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    if (treatment.status !== TreatmentStatus.OPERATOR_COMPLETED) {
      throw new BadRequestException(
        `Solo i trattamenti in stato 'operator_completed' possono essere riaperti. Stato attuale: ${treatment.status}`
      );
    }

    treatment.status = TreatmentStatus.IN_PROGRESS;
    treatment.completedAt = null as any;

    const result = await this.treatmentRepo.save(treatment);

    // Emetti evento SSE per notificare il frontend
    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: result.id,
      operatorId: result.operatorId,
      newStatus: result.status,
      timestamp: new Date(),
    });

    return result;
  }

  // ==================== PAYMENT ====================

  /**
   * Registra il pagamento del paziente
   */
  async recordPayment(id: string, input: RecordPaymentInput): Promise<Treatment> {
    const treatment = await this.findById(id);

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    if (treatment.isPaid) {
      throw new BadRequestException('Il trattamento è già stato pagato');
    }

    treatment.isPaid = true;
    treatment.paymentMethod = input.paymentMethod;
    treatment.paidAt = new Date();
    treatment.collectedBy = input.collectedBy;

    if (input.amount !== undefined) {
      treatment.price = input.amount;
    }

    return this.treatmentRepo.save(treatment);
  }

  // ==================== INVOICING ====================

  /**
   * Marca il trattamento come fatturato al paziente
   */
  async markInvoicedToPatient(id: string, invoiceNumber?: string): Promise<Treatment> {
    const treatment = await this.findById(id);

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    treatment.isInvoicedToPatient = true;
    treatment.invoicedToPatientAt = new Date();
    if (invoiceNumber) {
      treatment.patientInvoiceNumber = invoiceNumber;
    }

    return this.treatmentRepo.save(treatment);
  }

  /**
   * Marca il trattamento come fatturato dall'operatore allo studio
   */
  async markInvoicedByOperator(id: string, invoiceNumber?: string): Promise<Treatment> {
    const treatment = await this.findById(id);

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    treatment.isInvoicedByOperator = true;
    treatment.invoicedByOperatorAt = new Date();
    if (invoiceNumber) {
      treatment.operatorInvoiceNumber = invoiceNumber;
    }

    return this.treatmentRepo.save(treatment);
  }

  // ==================== INSTRUMENTS ====================

  /**
   * Aggiorna gli strumenti del trattamento (operatore può modificare wasUsed)
   */
  async updateInstruments(id: string, instruments: TreatmentInstrumentInput[]): Promise<Treatment> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentInstrumentRepo = manager.getRepository(TreatmentInstrument);

      const treatment = await this.findByIdWithManager(manager, id);

      // Rimuovi strumenti esistenti
      await treatmentInstrumentRepo.delete({ treatmentId: id });

      // Crea nuovi strumenti
      for (const inst of instruments) {
        const treatmentInstrument = treatmentInstrumentRepo.create({
          treatmentId: id,
          instrumentId: inst.instrumentId,
          instrumentCategoryId: inst.instrumentCategoryId,
          wasUsed: inst.wasUsed,
          startOffsetMinutes: inst.startOffsetMinutes,
          endOffsetMinutes: inst.endOffsetMinutes,
          orderPosition: inst.orderPosition,
        });
        await treatmentInstrumentRepo.save(treatmentInstrument);
      }

      return this.findByIdWithManager(manager, id);
    });
  }

  /**
   * Copia gli strumenti dall'appuntamento al trattamento
   */
  private async copyInstrumentsFromAppointment(
    manager: EntityManager,
    treatmentId: string,
    appointmentId: string
  ): Promise<void> {
    const appointmentInstrumentRepo = manager.getRepository(AppointmentInstrument);
    const treatmentInstrumentRepo = manager.getRepository(TreatmentInstrument);

    const appointmentInstruments = await appointmentInstrumentRepo.find({
      where: { appointmentId },
      relations: ['instrument']
    });

    for (const aptInst of appointmentInstruments) {
      const treatmentInstrument = treatmentInstrumentRepo.create({
        treatmentId,
        instrumentId: aptInst.instrumentId,
        instrumentCategoryId: aptInst.instrument?.categoryId,
        wasUsed: true, // Di default tutti usati
        startOffsetMinutes: aptInst.startOffsetMinutes,
        endOffsetMinutes: aptInst.endOffsetMinutes,
        orderPosition: aptInst.orderPosition,
      });
      await treatmentInstrumentRepo.save(treatmentInstrument);
    }
  }

  /**
   * Copia i servizi dall'appuntamento al trattamento
   * I servizi vengono copiati con i prezzi appropriati (scontoFE se attivo)
   */
  private async copyServicesFromAppointment(
    manager: EntityManager,
    treatmentId: string,
    appointment: AvailabilityAppointment,
    appointmentServices: AppointmentServiceEntity[],
    scontoFE: boolean
  ): Promise<void> {
    const treatmentServiceRepo = manager.getRepository(TreatmentServiceEntity);

    // Se l'appuntamento ha appointmentServices (nuovo sistema), copiali
    if (appointmentServices && appointmentServices.length > 0) {
      for (const apptService of appointmentServices) {
        let price: number | undefined;

        // Determina il prezzo da usare
        if (apptService.customPrice !== undefined && apptService.customPrice !== null) {
          // Prezzo personalizzato dall'appuntamento
          price = Number(apptService.customPrice);
        } else if (apptService.service) {
          // Prezzo dal servizio (con sconto FE se attivo)
          price = scontoFE && apptService.service.discountFE
            ? Number(apptService.service.discountFE)
            : Number(apptService.service.defaultPrice || 0);
        }

        const treatmentService = treatmentServiceRepo.create({
          treatmentId,
          serviceId: apptService.serviceId,
          price,
          duration: apptService.customDuration,
          orderPosition: apptService.orderPosition || 0,
        });
        await treatmentServiceRepo.save(treatmentService);
      }
    }
    // Fallback: se l'appuntamento ha solo serviceId legacy, crea un singolo TreatmentService
    else if (appointment.serviceId && appointment.service) {
      const price = scontoFE && appointment.service.discountFE
        ? Number(appointment.service.discountFE)
        : Number(appointment.service.defaultPrice || 0);

      const treatmentService = treatmentServiceRepo.create({
        treatmentId,
        serviceId: appointment.serviceId,
        price,
        orderPosition: 0,
      });
      await treatmentServiceRepo.save(treatmentService);
    }
  }

  /**
   * Salva i servizi del trattamento (usato da update)
   * Elimina i servizi esistenti e ne crea di nuovi
   */
  private async saveTreatmentServicesWithManager(
    manager: EntityManager,
    treatmentId: string,
    services: TreatmentServiceInputItem[],
    scontoFE: boolean = false
  ): Promise<void> {
    const treatmentServiceRepo = manager.getRepository(TreatmentServiceEntity);
    const serviceRepo = manager.getRepository(Service);

    // Elimina servizi esistenti
    await treatmentServiceRepo.delete({ treatmentId });

    // Crea nuovi servizi
    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      let price = svc.price;

      // Se non è specificato un prezzo, usa quello del servizio
      if (price === undefined || price === null) {
        const service = await serviceRepo.findOne({ where: { id: svc.serviceId } });
        if (service) {
          price = scontoFE && service.discountFE
            ? Number(service.discountFE)
            : Number(service.defaultPrice || 0);
        }
      }

      const treatmentService = treatmentServiceRepo.create({
        treatmentId,
        serviceId: svc.serviceId,
        price,
        duration: svc.duration,
        orderPosition: svc.orderPosition ?? i,
        isCustomPrice: svc.isCustomPrice ?? false,
      });
      await treatmentServiceRepo.save(treatmentService);
    }
  }

  // ==================== QUERIES ====================

  /**
   * Trattamenti in corso per un operatore
   */
  async getActiveByOperator(operatorId: string, date?: string): Promise<Treatment[]> {
    const queryBuilder = this.treatmentRepo.createQueryBuilder('treatment')
      .leftJoinAndSelect('treatment.appointment', 'appointment')
      .leftJoinAndSelect('treatment.operator', 'operator')
      .leftJoinAndSelect('treatment.patient', 'patient')
      .leftJoinAndSelect('treatment.service', 'service')
      .leftJoinAndSelect('treatment.instruments', 'instruments')
      .leftJoinAndSelect('treatment.therapeuticPath', 'therapeuticPath')
      .leftJoinAndSelect('treatment.treatmentServices', 'treatmentServices')
      .leftJoinAndSelect('treatmentServices.service', 'treatmentServiceService')
      .where('treatment.operatorId = :operatorId', { operatorId });

    if (date) {
      queryBuilder.andWhere('DATE(treatment.startedAt) = :date', { date });
    }

    return queryBuilder
      .orderBy('treatment.startedAt', 'DESC')
      .getMany();
  }

  /**
   * Trattamenti in attesa di chiusura da parte della segreteria
   */
  async getPendingForSecretary(): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      where: { status: TreatmentStatus.OPERATOR_COMPLETED },
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service'],
      order: { completedAt: 'ASC' }
    });
  }

  /**
   * Trattamenti di un paziente
   */
  async getByPatient(patientId: string, limit?: number, offset?: number): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      where: { patientId },
      relations: ['appointment', 'operator', 'service', 'instruments', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service'],
      order: { startedAt: 'DESC' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Trattamenti non fatturati al paziente
   */
  async getNotInvoicedToPatient(dateFrom?: string, dateTo?: string): Promise<Treatment[]> {
    const queryBuilder = this.treatmentRepo.createQueryBuilder('treatment')
      .leftJoinAndSelect('treatment.appointment', 'appointment')
      .leftJoinAndSelect('treatment.operator', 'operator')
      .leftJoinAndSelect('treatment.patient', 'patient')
      .leftJoinAndSelect('treatment.service', 'service')
      .leftJoinAndSelect('treatment.therapeuticPath', 'therapeuticPath')
      .leftJoinAndSelect('treatment.treatmentServices', 'treatmentServices')
      .leftJoinAndSelect('treatmentServices.service', 'treatmentServiceService')
      .where('treatment.isInvoicedToPatient = :invoiced', { invoiced: false })
      .andWhere('treatment.status = :status', { status: TreatmentStatus.CLOSED })
      .andWhere('treatment.isTest = :isTest', { isTest: false });

    if (dateFrom) {
      queryBuilder.andWhere('treatment.startedAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      queryBuilder.andWhere('treatment.startedAt <= :dateTo', { dateTo });
    }

    return queryBuilder
      .orderBy('treatment.startedAt', 'ASC')
      .getMany();
  }

  /**
   * Trattamenti non fatturati dall'operatore allo studio
   */
  async getNotInvoicedByOperator(operatorId?: string, dateFrom?: string, dateTo?: string): Promise<Treatment[]> {
    const queryBuilder = this.treatmentRepo.createQueryBuilder('treatment')
      .leftJoinAndSelect('treatment.appointment', 'appointment')
      .leftJoinAndSelect('treatment.operator', 'operator')
      .leftJoinAndSelect('treatment.patient', 'patient')
      .leftJoinAndSelect('treatment.service', 'service')
      .leftJoinAndSelect('treatment.therapeuticPath', 'therapeuticPath')
      .leftJoinAndSelect('treatment.treatmentServices', 'treatmentServices')
      .leftJoinAndSelect('treatmentServices.service', 'treatmentServiceService')
      .where('treatment.isInvoicedByOperator = :invoiced', { invoiced: false })
      .andWhere('treatment.status = :status', { status: TreatmentStatus.CLOSED })
      .andWhere('treatment.isTest = :isTest', { isTest: false });

    if (operatorId) {
      queryBuilder.andWhere('treatment.operatorId = :operatorId', { operatorId });
    }
    if (dateFrom) {
      queryBuilder.andWhere('treatment.startedAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      queryBuilder.andWhere('treatment.startedAt <= :dateTo', { dateTo });
    }

    return queryBuilder
      .orderBy('treatment.startedAt', 'ASC')
      .getMany();
  }

  /**
   * Trova tutti i trattamenti con relazioni
   */
  async findAll(): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service'],
      order: { startedAt: 'DESC' }
    });
  }

  /**
   * Trattamenti di un percorso terapeutico
   */
  async getByTherapeuticPath(therapeuticPathId: string): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      where: { therapeuticPathId },
      relations: ['appointment', 'operator', 'service', 'instruments', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service'],
      order: { startedAt: 'DESC' }
    });
  }

  /**
   * Elimina un singolo trattamento per ID
   * TreatmentInstrument vengono eliminati automaticamente via CASCADE
   */
  async delete(id: string): Promise<boolean> {
    const treatment = await this.treatmentRepo.findOne({ where: { id } });

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    const operatorId = treatment.operatorId;
    const result = await this.treatmentRepo.delete(id);
    const success = result.affected ? result.affected > 0 : false;

    // Emetti evento SSE per notificare il frontend
    if (success) {
      this.eventsService.emit({
        type: 'treatment_deleted',
        treatmentId: id,
        operatorId: operatorId,
        timestamp: new Date(),
      });
    }

    return success;
  }

  /**
   * Elimina TUTTI i trattamenti (operazione distruttiva)
   * TreatmentInstrument vengono eliminati automaticamente via CASCADE
   */
  async deleteAll(): Promise<number> {
    const result = await this.treatmentRepo
      .createQueryBuilder()
      .delete()
      .from(Treatment)
      .execute();

    return result.affected || 0;
  }
}
