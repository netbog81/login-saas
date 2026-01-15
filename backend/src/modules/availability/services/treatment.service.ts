import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not, DataSource, EntityManager } from 'typeorm';
import { Treatment, TreatmentStatus, PaymentMethod } from '../entities/treatment.entity';
import { TreatmentInstrument } from '../entities/treatment-instrument.entity';
import { AvailabilityAppointment, BookingStatus } from '../entities/availability-appointment.entity';
import { AppointmentInstrument } from '../entities/appointment-instrument.entity';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { Patient } from '../../../entities/patient.entity';

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
  serviceId?: string;
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
    @InjectRepository(AvailabilityAppointment)
    private appointmentRepo: Repository<AvailabilityAppointment>,
    @InjectRepository(AppointmentInstrument)
    private appointmentInstrumentRepo: Repository<AppointmentInstrument>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(TherapeuticPath)
    private pathRepo: Repository<TherapeuticPath>,
    private dataSource: DataSource,
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

      // Crea il trattamento
      const treatment = treatmentRepo.create({
        appointmentId,
        operatorId: appointment.operatorId!,
        patientId: appointment.patientId,
        serviceId: appointment.serviceId,
        therapeuticPathId,
        scontoFE,
        status: TreatmentStatus.IN_PROGRESS,
        isTest: false,
        startedAt: new Date(),
        price: appointment.service?.defaultPrice || 0,
      });

      const savedTreatment = await treatmentRepo.save(treatment);

      // Copia gli strumenti dall'appuntamento al trattamento
      await this.copyInstrumentsFromAppointment(manager, savedTreatment.id, appointmentId);

      // Ritorna il trattamento con le relazioni
      return this.findByIdWithManager(manager, savedTreatment.id);
    });
  }

  /**
   * Trova un trattamento per ID
   */
  async findById(id: string): Promise<Treatment | null> {
    return this.treatmentRepo.findOne({
      where: { id },
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath']
    });
  }

  /**
   * Trova un trattamento per ID (con EntityManager per transazioni)
   */
  private async findByIdWithManager(manager: EntityManager, id: string): Promise<Treatment> {
    const treatment = await manager.getRepository(Treatment).findOne({
      where: { id },
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath']
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
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath']
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

      const { id, instruments, ...updateData } = input;

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

    return this.treatmentRepo.save(treatment);
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

    return this.treatmentRepo.save(treatment);
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

  // ==================== QUERIES ====================

  /**
   * Trattamenti in corso per un operatore
   */
  async getActiveByOperator(operatorId: string, date?: string): Promise<Treatment[]> {
    const queryBuilder = this.treatmentRepo.createQueryBuilder('treatment')
      .leftJoinAndSelect('treatment.appointment', 'appointment')
      .leftJoinAndSelect('treatment.patient', 'patient')
      .leftJoinAndSelect('treatment.service', 'service')
      .leftJoinAndSelect('treatment.instruments', 'instruments')
      .leftJoinAndSelect('treatment.therapeuticPath', 'therapeuticPath')
      .where('treatment.operatorId = :operatorId', { operatorId })
      .andWhere('treatment.status IN (:...statuses)', {
        statuses: [TreatmentStatus.IN_PROGRESS, TreatmentStatus.OPERATOR_COMPLETED]
      });

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
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath'],
      order: { completedAt: 'ASC' }
    });
  }

  /**
   * Trattamenti di un paziente
   */
  async getByPatient(patientId: number, limit?: number, offset?: number): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      where: { patientId },
      relations: ['appointment', 'operator', 'service', 'instruments', 'therapeuticPath'],
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
      relations: ['appointment', 'operator', 'patient', 'service', 'instruments', 'therapeuticPath'],
      order: { startedAt: 'DESC' }
    });
  }

  /**
   * Trattamenti di un percorso terapeutico
   */
  async getByTherapeuticPath(therapeuticPathId: string): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      where: { therapeuticPathId },
      relations: ['appointment', 'operator', 'service', 'instruments', 'therapeuticPath'],
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

    const result = await this.treatmentRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
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
