import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not, DataSource, EntityManager } from 'typeorm';
import { Treatment, TreatmentStatus, PaymentMethod } from '../entities/treatment.entity';
import { TreatmentInstrument } from '../entities/treatment-instrument.entity';
import { TreatmentService as TreatmentServiceEntity } from '../entities/treatment-service.entity';
import { TreatmentInvoiceLine } from '../entities/treatment-invoice-line.entity';
import { Operator } from '../entities/operator.entity';
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
    @InjectRepository(TreatmentInvoiceLine)
    private treatmentInvoiceLineRepo: Repository<TreatmentInvoiceLine>,
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
    scontoFE: boolean = false,
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
      if (updateData.scontoFE !== undefined) {
        treatment.scontoFE = updateData.scontoFE;
        // Sconto FE attivo => trattamento NON fatturabile:
        // forza readyForBilling a false per coerenza con markInvoicedToPatient.
        if (updateData.scontoFE === true && treatment.readyForBilling) {
          treatment.readyForBilling = false;
          treatment.readyForBillingAt = null as any;
        }
      }
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
   * Operatore completa il trattamento. Transizione: IN_PROGRESS → OPERATOR_COMPLETED.
   *
   * Scatto snapshot strumenti: al completamento fotografiamo nome, brand,
   * modello, categoria e `technicalData` sullo strumento per preservare i
   * dati clinicamente rilevanti anche se lo strumento viene archiviato o
   * modificato in futuro. Lo snapshot viene sovrascritto a ogni nuovo
   * COMPLETED (in caso di reopen operatore + ricompletamento). Le riaperture
   * della segreteria (CLOSED → OPERATOR_COMPLETED) NON toccano lo snapshot:
   * solo transizioni guidate dall'operatore rinfrescano la fotografia.
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

    const now = new Date();

    await this.dataSource.transaction(async manager => {
      await manager.getRepository(Treatment).update(id, {
        status: TreatmentStatus.OPERATOR_COMPLETED,
        completedAt: now,
        clinicalNotes: input.clinicalNotes,
        secretaryNotes: input.secretaryNotes,
        operatorNotes: input.operatorNotes,
        price: input.price,
        ...(input.isTest !== undefined ? { isTest: input.isTest } : {}),
      });

      await this.writeInstrumentsSnapshot(manager, id, now);
    });

    const result = (await this.findById(id))!;

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
   * Congela nome/marca/modello/categoria/technicalData dello strumento e della
   * sua categoria nei campi snapshot dei TreatmentInstrument collegati al
   * trattamento. Usato da `complete()` e `forceCloseByOperatorForgot()`.
   *
   * Ciclo di vita dello snapshot — INVARIANTI:
   *
   * 1. Lo snapshot scatta SOLO al passaggio `IN_PROGRESS → OPERATOR_COMPLETED`
   *    (complete operatore) oppure `IN_PROGRESS → CLOSED` (force close).
   *    È quello l'evento che "fissa" il dato come confermato dall'operatore.
   *
   * 2. Lo snapshot viene ELIMINATO implicitamente quando l'operatore
   *    riapre il trattamento (OPERATOR_COMPLETED → IN_PROGRESS) e poi
   *    salva i campi senza completare: `update()` ricrea da zero le righe
   *    TreatmentInstrument tramite delete + create, perdendo i campi
   *    snapshot. Questo comportamento è INTENZIONALE: in stato IN_PROGRESS
   *    il trattamento è ancora in lavorazione, gli strumenti non sono
   *    "confermati definitivamente", e mantenere uno snapshot stantio
   *    fornirebbe un'informazione potenzialmente errata. Al successivo
   *    complete lo snapshot viene riscritto sulle righe attuali.
   *
   * 3. Se l'operatore riapre ma NON salva (chiude il dialog senza save),
   *    lo snapshot resta: stiamo solo "guardando" il record, non lo
   *    abbiamo modificato.
   *
   * 4. Le riaperture/chiusure della segreteria (CLOSED ↔ OPERATOR_COMPLETED)
   *    NON toccano gli strumenti né lo snapshot: la segreteria interviene
   *    sui dati amministrativi/economici, non clinici.
   */
  private async writeInstrumentsSnapshot(
    manager: EntityManager,
    treatmentId: string,
    takenAt: Date,
  ): Promise<void> {
    // L'UPDATE FROM di Postgres non consente di referenziare la tabella
    // aggiornata (`treatment_instruments`) dentro un JOIN della FROM clause:
    // tutti i riferimenti laterali devono passare per la WHERE. Per la
    // categoria usiamo una subquery scalare che gestisce sia il caso in cui
    // `instrumentCategoryId` sia popolato sul TreatmentInstrument, sia il
    // fallback alla categoria dell'Instrument.
    await manager.query(
      `UPDATE "treatment_instruments" AS ti
       SET "instrumentNameSnapshot" = i."name",
           "brandSnapshot"          = i."brand",
           "modelSnapshot"          = i."model",
           "categoryNameSnapshot"   = (
             SELECT c."name"
             FROM "instrument_categories" c
             WHERE c."id" = COALESCE(ti."instrumentCategoryId", i."categoryId")
           ),
           "technicalDataSnapshot"  = i."technicalData",
           "snapshotTakenAt"        = $2
       FROM "instruments" i
       WHERE ti."treatmentId" = $1
         AND ti."instrumentId" = i."id"
         AND ti."deletedAt" IS NULL`,
      [treatmentId, takenAt],
    );
  }

  /**
   * Segreteria chiude il trattamento (OPERATOR_COMPLETED → CLOSED).
   *
   * @param closedByUserId - AppUser della segreteria che esegue la chiusura
   *   (per audit). Viene persistito su `treatment.closedByUserId`.
   */
  async close(
    id: string,
    input: CloseTreatmentInput,
    closedByUserId?: string,
  ): Promise<Treatment> {
    const treatment = await this.findById(id);

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    if (treatment.status !== TreatmentStatus.OPERATOR_COMPLETED) {
      throw new BadRequestException(
        `Il trattamento deve essere in stato 'operator_completed' per essere chiuso. Stato attuale: ${treatment.status}`
      );
    }

    const now = new Date();
    treatment.status = TreatmentStatus.CLOSED;
    treatment.closedAt = now;
    treatment.closedByUserId = closedByUserId ?? treatment.closedByUserId;
    if (input.secretaryNotes) {
      treatment.secretaryNotes = input.secretaryNotes;
    }

    // Chiusura dalla segreteria = auto-marca "pronto per fatturazione"
    // a meno che scontoFE sia attivo (non fatturabile) o sia già fatturato.
    if (!treatment.scontoFE && !treatment.isInvoicedToPatient) {
      treatment.readyForBilling = true;
      treatment.readyForBillingAt = now;
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
   * Segreteria forza la chiusura di un trattamento lasciato aperto
   * dall'operatore (es. operatore dimentico di completare).
   *
   * Transizione: IN_PROGRESS → CLOSED in un solo passo, marcando
   * `forcedClosure = true` per audit. Scatta comunque lo snapshot degli
   * strumenti (come avviene al passaggio OPERATOR_COMPLETED) perché il
   * trattamento non tornerà più in mano all'operatore.
   *
   * Richiede il permesso `treatment_force_close` (segreteria/admin).
   *
   * @param closedByUserId - AppUser della segreteria che forza la chiusura
   * @param secretaryNotes - note amministrative
   */
  async forceCloseByOperatorForgot(
    id: string,
    closedByUserId: string,
    secretaryNotes?: string,
  ): Promise<Treatment> {
    const treatment = await this.findById(id);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }
    if (treatment.status !== TreatmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Il force-close è consentito solo su trattamenti in stato 'in_progress'. ` +
          `Stato attuale: ${treatment.status}. Per altri stati usare close() o reopen().`,
      );
    }

    const now = new Date();

    await this.dataSource.transaction(async manager => {
      const repo = manager.getRepository(Treatment);
      await repo.update(id, {
        status: TreatmentStatus.CLOSED,
        completedAt: now,
        closedAt: now,
        closedByUserId,
        forcedClosure: true,
        ...(secretaryNotes ? { secretaryNotes } : {}),
        ...(!treatment.scontoFE && !treatment.isInvoicedToPatient
          ? { readyForBilling: true, readyForBillingAt: now }
          : {}),
      });

      await this.writeInstrumentsSnapshot(manager, id, now);
    });

    const result = (await this.findById(id))!;

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
   *
   * @deprecated Usa `reopenByOperator` o `reopenBySecretary` per chiarezza
   *   semantica e controlli di autorizzazione distinti.
   */
  async reopen(id: string): Promise<Treatment> {
    const treatment = await this.findById(id);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }
    if (treatment.status === TreatmentStatus.OPERATOR_COMPLETED) {
      return this.reopenByOperator(id);
    }
    if (treatment.status === TreatmentStatus.CLOSED) {
      return this.reopenBySecretary(id);
    }
    throw new BadRequestException(
      `Il trattamento è in stato ${treatment.status}: non è riapribile.`,
    );
  }

  /**
   * Riapertura da parte dell'operatore: OPERATOR_COMPLETED → IN_PROGRESS.
   * L'operatore vuole riprendere il lavoro clinico. Lo snapshot degli
   * strumenti NON viene modificato in questa transizione; se poi l'operatore
   * ricompleta il trattamento lo snapshot verrà sovrascritto in `complete()`.
   *
   * Richiede ownership del trattamento (gestita a livello di resolver/guard).
   */
  async reopenByOperator(id: string): Promise<Treatment> {
    const treatment = await this.findById(id);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }
    if (treatment.isInvoicedToPatient) {
      throw new BadRequestException(
        'Trattamento già fatturato: non può essere riaperto.',
      );
    }
    if (treatment.status !== TreatmentStatus.OPERATOR_COMPLETED) {
      throw new BadRequestException(
        `Riapertura operatore consentita solo da OPERATOR_COMPLETED. ` +
          `Stato attuale: ${treatment.status}.`,
      );
    }

    treatment.status = TreatmentStatus.IN_PROGRESS;
    treatment.completedAt = null as any;
    const result = await this.treatmentRepo.save(treatment);

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
   * Riapertura da parte della segreteria: CLOSED → OPERATOR_COMPLETED.
   * Viene usata per correggere campi amministrativi/fatturazione dopo che
   * la segreteria aveva chiuso il trattamento. Lo snapshot strumenti NON
   * viene toccato (la segreteria non modifica dato clinico).
   *
   * Richiede il permesso `treatment_write` (già gestito dal resolver).
   */
  async reopenBySecretary(id: string): Promise<Treatment> {
    const treatment = await this.findById(id);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }
    if (treatment.isInvoicedToPatient) {
      throw new BadRequestException(
        'Trattamento già fatturato: non può essere riaperto.',
      );
    }
    if (treatment.status !== TreatmentStatus.CLOSED) {
      throw new BadRequestException(
        `Riapertura segreteria consentita solo da CLOSED. ` +
          `Stato attuale: ${treatment.status}.`,
      );
    }

    treatment.status = TreatmentStatus.OPERATOR_COMPLETED;
    treatment.closedAt = null as any;
    treatment.readyForBilling = false;
    treatment.readyForBillingAt = null as any;
    const result = await this.treatmentRepo.save(treatment);

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
   * Registra il pagamento del paziente.
   *
   * @param callerRole - ruolo di chi chiama la mutation.
   *   'operator': chiamata dall'interfaccia operatore. Richiede che
   *     l'operatore associato al trattamento abbia canCollectPayment=true.
   *   'secretary' (default): la segreteria può sempre incassare (a meno
   *     che il trattamento sia già CLOSED, in cui caso è congelato).
   *   TODO: sostituire con lettura ruolo dal JWT quando auth sarà attivo.
   */
  async recordPayment(
    id: string,
    input: RecordPaymentInput,
    callerRole: 'operator' | 'secretary' = 'secretary',
  ): Promise<Treatment> {
    const treatment = await this.findById(id);

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    if (treatment.isPaid) {
      throw new BadRequestException('Il trattamento è già stato pagato');
    }

    // Dopo CLOSED l'economia è congelata (solo sblocco via reopen).
    if (treatment.status === TreatmentStatus.CLOSED) {
      throw new BadRequestException(
        'Il trattamento è chiuso dalla segreteria: il pagamento non è più modificabile.'
      );
    }

    if (callerRole === 'operator') {
      const operator = await this.dataSource
        .getRepository(Operator)
        .findOne({ where: { id: treatment.operatorId } });
      if (!operator || operator.canCollectPayment === false) {
        throw new BadRequestException(
          "L'operatore non ha il permesso di registrare pagamenti."
        );
      }
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
   * Marca il trattamento come fatturato al paziente.
   *
   * Vincolo: i trattamenti con scontoFE attivo non sono fatturabili.
   * La segreteria deve prima rimuovere lo scontoFE per poterli marcare.
   */
  async markInvoicedToPatient(id: string, invoiceNumber?: string): Promise<Treatment> {
    const treatment = await this.findById(id);

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    if (treatment.scontoFE) {
      throw new BadRequestException(
        'Il trattamento ha sconto FE attivo: non può essere marcato come fatturato. Rimuovere prima lo sconto FE.'
      );
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
   * Bulk: Trattamenti attivi per più operatori in una data (singola query).
   */
  async getActiveByOperators(operatorIds: string[], date?: string): Promise<Treatment[]> {
    if (operatorIds.length === 0) return [];
    const queryBuilder = this.treatmentRepo.createQueryBuilder('treatment')
      .leftJoinAndSelect('treatment.appointment', 'appointment')
      .leftJoinAndSelect('treatment.operator', 'operator')
      .leftJoinAndSelect('treatment.patient', 'patient')
      .leftJoinAndSelect('treatment.service', 'service')
      .leftJoinAndSelect('treatment.instruments', 'instruments')
      .leftJoinAndSelect('treatment.therapeuticPath', 'therapeuticPath')
      .leftJoinAndSelect('treatment.treatmentServices', 'treatmentServices')
      .leftJoinAndSelect('treatmentServices.service', 'treatmentServiceService')
      .where('treatment.operatorId IN (:...operatorIds)', { operatorIds });

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
   * Soft-delete di un singolo trattamento.
   *
   * Imposta `deletedAt` sul trattamento e sui suoi figli (TreatmentInstrument,
   * TreatmentService, TreatmentInvoiceLine) e sull'appointment collegato
   * 1-1 (che nasce come appuntamento del trattamento).
   *
   * Il record resta in DB, recuperabile dal cestino entro il periodo di
   * retention. Per l'eliminazione definitiva vedi `hardDelete()`.
   *
   * @param id - id del trattamento
   * @param deletedByUserId - AppUser che sta eseguendo la cancellazione
   *   (per audit; viene propagato anche sui figli soft-deletati).
   */
  async delete(id: string, deletedByUserId?: string): Promise<boolean> {
    const treatment = await this.treatmentRepo.findOne({ where: { id } });

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    const operatorId = treatment.operatorId;

    await this.dataSource.transaction(async manager => {
      const now = new Date();

      await manager
        .createQueryBuilder()
        .update(TreatmentInstrument)
        .set({ deletedAt: now, deletedByUserId: deletedByUserId ?? null })
        .where('"treatmentId" = :id AND "deletedAt" IS NULL', { id })
        .execute();

      await manager
        .createQueryBuilder()
        .update(TreatmentServiceEntity)
        .set({ deletedAt: now, deletedByUserId: deletedByUserId ?? null } as any)
        .where('"treatmentId" = :id AND "deletedAt" IS NULL', { id })
        .execute()
        .catch(() => {
          /* la colonna deletedAt su treatment_services potrebbe non essere
             stata aggiunta se si decide di non softdeletare anche i servizi.
             Non bloccare la transazione su questo. */
        });

      await manager
        .createQueryBuilder()
        .update(Treatment)
        .set({
          deletedAt: now,
          deletedByUserId: deletedByUserId ?? null,
        } as any)
        .where('id = :id', { id })
        .execute();

      // L'appuntamento ha relazione 1-1 col trattamento (il trattamento nasce
      // dall'appuntamento). Lo soft-deletiamo insieme.
      if (treatment.appointmentId) {
        await manager
          .createQueryBuilder()
          .update(AvailabilityAppointment)
          .set({
            deletedAt: now,
            deletedByUserId: deletedByUserId ?? null,
          } as any)
          .where('id = :aid AND "deletedAt" IS NULL', {
            aid: treatment.appointmentId,
          })
          .execute();
      }
    });

    this.eventsService.emit({
      type: 'treatment_deleted',
      treatmentId: id,
      operatorId: operatorId,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Ripristina un trattamento dal cestino (e i suoi figli soft-deletati).
   *
   * Ripristina anche l'appuntamento collegato se era stato soft-deletato
   * nello stesso istante (± tolleranza di 5 secondi) — evita di riportare
   * in vita appuntamenti che erano già stati cancellati prima.
   */
  async restoreFromRecycleBin(id: string): Promise<Treatment> {
    const treatment = await this.treatmentRepo.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }
    if (!treatment.deletedAt) {
      throw new BadRequestException(
        `Trattamento ${id} non è nel cestino.`,
      );
    }

    const deletedAt = treatment.deletedAt;

    await this.dataSource.transaction(async manager => {
      await manager
        .createQueryBuilder()
        .update(Treatment)
        .set({ deletedAt: null, deletedByUserId: null } as any)
        .where('id = :id', { id })
        .execute();

      await manager
        .createQueryBuilder()
        .update(TreatmentInstrument)
        .set({ deletedAt: null, deletedByUserId: null })
        .where('"treatmentId" = :id', { id })
        .execute();

      if (treatment.appointmentId) {
        const toleranceMs = 5000;
        await manager
          .createQueryBuilder()
          .update(AvailabilityAppointment)
          .set({ deletedAt: null, deletedByUserId: null } as any)
          .where(
            'id = :aid AND "deletedAt" BETWEEN :from AND :to',
            {
              aid: treatment.appointmentId,
              from: new Date(deletedAt.getTime() - toleranceMs),
              to: new Date(deletedAt.getTime() + toleranceMs),
            },
          )
          .execute();
      }
    });

    const restored = await this.treatmentRepo.findOne({ where: { id } });
    return restored!;
  }

  /**
   * Eliminazione definitiva (hard delete). Riservata ad admin, da chiamare
   * solo dal cestino dopo doppia conferma. Rimuove fisicamente il record
   * e, per effetto dei CASCADE DB, figli e collegamenti.
   */
  async hardDelete(id: string): Promise<boolean> {
    const result = await this.treatmentRepo.delete(id);
    return (result.affected ?? 0) > 0;
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

  // ==================== SECRETARY-ONLY ECONOMIC UPDATES ====================

  /**
   * Aggiorna i campi economici/contabili di un trattamento OPERATOR_COMPLETED
   * o CLOSED. Pensato per la segreteria che verifica prima della fatturazione.
   *
   * Campi consentiti: price, scontoFE, secretaryNotes, treatmentServices.
   * Campi proibiti: tutto quello che è clinico (clinicalNotes, painLevel,
   * painBefore, painAfter, operatorNotes, patientNotes). Se la segreteria
   * deve far cambiare dati clinici, riapre il trattamento con reopen.
   *
   * Se scontoFE passa a true, readyForBilling viene forzato a false.
   */
  async updateBySecretary(input: {
    id: string;
    price?: number;
    scontoFE?: boolean;
    secretaryNotes?: string;
    treatmentServices?: TreatmentServiceInputItem[];
  }): Promise<Treatment> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentRepo = manager.getRepository(Treatment);
      const treatment = await treatmentRepo.findOne({ where: { id: input.id } });

      if (!treatment) {
        throw new NotFoundException(`Trattamento ${input.id} non trovato`);
      }

      const allowed = [
        TreatmentStatus.OPERATOR_COMPLETED,
        TreatmentStatus.CLOSED,
      ];
      if (!allowed.includes(treatment.status)) {
        throw new BadRequestException(
          `La segreteria può modificare solo trattamenti chiusi dall'operatore o dalla segreteria. Stato attuale: ${treatment.status}`
        );
      }

      if (input.price !== undefined) treatment.price = input.price;
      if (input.secretaryNotes !== undefined) treatment.secretaryNotes = input.secretaryNotes;

      if (input.scontoFE !== undefined) {
        treatment.scontoFE = input.scontoFE;
        if (input.scontoFE === true && treatment.readyForBilling) {
          treatment.readyForBilling = false;
          treatment.readyForBillingAt = null as any;
        }
      }

      await treatmentRepo.save(treatment);

      if (input.treatmentServices !== undefined) {
        await this.saveTreatmentServicesWithManager(
          manager,
          input.id,
          input.treatmentServices,
          treatment.scontoFE || false,
        );
      }

      return this.findByIdWithManager(manager, input.id);
    });
  }

  // ==================== READY FOR BILLING ====================

  /**
   * Marca (o smarca) N trattamenti come pronti per essere inviati al
   * sistema di fatturazione.
   *
   * Comportamento con ready=true:
   * - Se il trattamento è già CLOSED: marca readyForBilling=true.
   * - Se il trattamento è OPERATOR_COMPLETED: lo chiude automaticamente
   *   (status=CLOSED, closedAt=now) e marca readyForBilling=true.
   *   Questo riflette la policy concordata "chiusura da segreteria =
   *   pronto per fatturazione", coerente con close().
   * - Se il trattamento è IN_PROGRESS/WAITING: errore (l'operatore non
   *   ha ancora completato).
   * - scontoFE attivo o già fatturato: errore.
   *
   * Comportamento con ready=false: toglie solo il flag readyForBilling,
   * non tocca lo stato del trattamento.
   */
  async setReadyForBilling(ids: string[], ready: boolean): Promise<Treatment[]> {
    if (ids.length === 0) return [];

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentRepo = manager.getRepository(Treatment);
      const treatments = await treatmentRepo.find({ where: { id: In(ids) } });

      if (treatments.length !== ids.length) {
        throw new NotFoundException('Alcuni trattamenti non sono stati trovati');
      }

      if (ready) {
        const transitionable = [
          TreatmentStatus.CLOSED,
          TreatmentStatus.OPERATOR_COMPLETED,
        ];
        for (const t of treatments) {
          if (!transitionable.includes(t.status)) {
            throw new BadRequestException(
              `Trattamento ${t.id} in stato ${t.status}: l'operatore deve prima completarlo.`
            );
          }
          if (t.scontoFE) {
            throw new BadRequestException(
              `Trattamento ${t.id} ha sconto FE attivo: non può essere marcato come pronto.`
            );
          }
          if (t.isInvoicedToPatient) {
            throw new BadRequestException(
              `Trattamento ${t.id} è già fatturato.`
            );
          }
        }
      }

      const now = new Date();
      for (const t of treatments) {
        // Auto-chiusura: se OPERATOR_COMPLETED e stiamo marcando pronto,
        // lo chiudiamo contestualmente (policy = segreteria chiude+marca).
        if (ready && t.status === TreatmentStatus.OPERATOR_COMPLETED) {
          t.status = TreatmentStatus.CLOSED;
          t.closedAt = now;
        }
        t.readyForBilling = ready;
        t.readyForBillingAt = ready ? now : (null as any);
      }

      await treatmentRepo.save(treatments);
      return treatments;
    });
  }

  // ==================== INVOICE LINE DESCRIPTIONS ====================

  /**
   * Aggiorna la descrizione della riga fattura di un TreatmentService.
   * Chiamata sia dagli operatori (in fase di completeTreatment) che
   * dalla segreteria (in fase di verifica pre-fatturazione).
   */
  async updateTreatmentServiceInvoiceDescription(
    treatmentServiceId: string,
    description: string | null | undefined,
  ): Promise<TreatmentServiceEntity> {
    const ts = await this.treatmentServiceRepo.findOne({
      where: { id: treatmentServiceId },
    });
    if (!ts) {
      throw new NotFoundException(`TreatmentService ${treatmentServiceId} non trovato`);
    }
    // IMPORTANTE: usare null (non undefined) per cancellare il valore.
    // TypeORM ignora i campi undefined al save (= "non toccare"), mentre
    // null viene scritto in DB come NULL. Serve per il "ripristina
    // auto-generata" che deve azzerare invoiceLineDescription.
    if (description === undefined || description === null || description === '') {
      (ts as any).invoiceLineDescription = null;
    } else {
      ts.invoiceLineDescription = description;
    }
    return this.treatmentServiceRepo.save(ts);
  }

  // ==================== TREATMENT INVOICE LINES (CUSTOM) ====================

  async createInvoiceLine(input: {
    treatmentId: string;
    description: string;
    amount: number;
    createdBy?: string;
  }): Promise<TreatmentInvoiceLine> {
    const treatment = await this.findById(input.treatmentId);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${input.treatmentId} non trovato`);
    }
    if (treatment.isInvoicedToPatient) {
      throw new BadRequestException(
        'Il trattamento è già fatturato: non si possono aggiungere righe.'
      );
    }
    const line = this.treatmentInvoiceLineRepo.create({
      treatmentId: input.treatmentId,
      description: input.description,
      amount: input.amount,
      createdBy: input.createdBy,
    });
    return this.treatmentInvoiceLineRepo.save(line);
  }

  async updateInvoiceLine(input: {
    id: string;
    description?: string;
    amount?: number;
  }): Promise<TreatmentInvoiceLine> {
    const line = await this.treatmentInvoiceLineRepo.findOne({
      where: { id: input.id },
      relations: ['treatment'],
    });
    if (!line) {
      throw new NotFoundException(`Riga ${input.id} non trovata`);
    }
    if (line.treatment?.isInvoicedToPatient) {
      throw new BadRequestException(
        'Il trattamento è già fatturato: le righe non sono modificabili.'
      );
    }
    if (input.description !== undefined) line.description = input.description;
    if (input.amount !== undefined) line.amount = input.amount;
    return this.treatmentInvoiceLineRepo.save(line);
  }

  async deleteInvoiceLine(id: string): Promise<boolean> {
    const line = await this.treatmentInvoiceLineRepo.findOne({
      where: { id },
      relations: ['treatment'],
    });
    if (!line) return false;
    if (line.treatment?.isInvoicedToPatient) {
      throw new BadRequestException(
        'Il trattamento è già fatturato: le righe non sono eliminabili.'
      );
    }
    const result = await this.treatmentInvoiceLineRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async getInvoiceLinesByTreatment(treatmentId: string): Promise<TreatmentInvoiceLine[]> {
    return this.treatmentInvoiceLineRepo.find({
      where: { treatmentId },
      order: { createdAt: 'ASC' },
    });
  }

  // ==================== QUERIES FOR TRATTAMENTI PAGE/DIALOG ====================

  /**
   * Query centralizzata per la pagina/dialog Trattamenti.
   * Se operatorId è fornito, filtra per quell'operatore (uso: un operatore
   * vede solo i propri). Se null, la query è per la segreteria/admin che
   * vede tutto.
   *
   * Filtri combinabili: stato, range date, readyForBilling, isInvoicedToPatient,
   * scontoFE, patientId.
   */
  async findForListing(filters: {
    operatorId?: string | null;
    patientId?: string | null;
    statuses?: TreatmentStatus[];
    dateFrom?: string;
    dateTo?: string;
    readyForBilling?: boolean;
    isInvoicedToPatient?: boolean;
    scontoFE?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Treatment[]> {
    const qb = this.treatmentRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.operator', 'operator')
      .leftJoinAndSelect('t.patient', 'patient')
      .leftJoinAndSelect('t.appointment', 'appointment')
      .leftJoinAndSelect('t.treatmentServices', 'ts')
      .leftJoinAndSelect('ts.service', 'service')
      .leftJoinAndSelect('t.instruments', 'ti')
      .leftJoinAndSelect('ti.instrument', 'instrument')
      .leftJoinAndSelect('t.invoiceLines', 'invoiceLines');

    if (filters.operatorId) {
      qb.andWhere('t.operatorId = :operatorId', { operatorId: filters.operatorId });
    }
    if (filters.patientId) {
      qb.andWhere('t.patientId = :patientId', { patientId: filters.patientId });
    }
    if (filters.statuses && filters.statuses.length > 0) {
      qb.andWhere('t.status IN (:...statuses)', { statuses: filters.statuses });
    }
    if (filters.dateFrom) {
      qb.andWhere('t.startedAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('t.startedAt <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters.readyForBilling !== undefined) {
      qb.andWhere('t.readyForBilling = :readyForBilling', { readyForBilling: filters.readyForBilling });
    }
    if (filters.isInvoicedToPatient !== undefined) {
      qb.andWhere('t.isInvoicedToPatient = :isInvoiced', { isInvoiced: filters.isInvoicedToPatient });
    }
    if (filters.scontoFE !== undefined) {
      qb.andWhere('t.scontoFE = :scontoFE', { scontoFE: filters.scontoFE });
    }

    qb.orderBy('t.startedAt', 'DESC');

    if (filters.limit) qb.take(filters.limit);
    if (filters.offset) qb.skip(filters.offset);

    return qb.getMany();
  }
}
