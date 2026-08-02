import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { In, IsNull, Not, EntityManager, SelectQueryBuilder } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { Treatment, TreatmentStatus, PaymentMethod } from '../entities/treatment.entity';
import { TreatmentBillingStatus } from '../entities/treatment-billing-status.enum';
import { TreatmentInstrument } from '../entities/treatment-instrument.entity';
import { TreatmentService as TreatmentServiceEntity } from '../entities/treatment-service.entity';
import { TreatmentInvoiceLine } from '../entities/treatment-invoice-line.entity';
import { Operator } from '../entities/operator.entity';
import { AvailabilityAppointment, BookingStatus } from '../entities/availability-appointment.entity';
import { AppointmentInstrument } from '../entities/appointment-instrument.entity';
import { AppointmentService as AppointmentServiceEntity } from '../entities/appointment-service.entity';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { Service } from '../entities/service.entity';
import { Site } from '../entities/site.entity';
import { EventsService } from '../../events/events.service';
import { TreatmentServiceInputItem } from '../dto/treatment.input';
import { ClinicalEventBuffer } from '../../clinical-events/clinical-event-buffer.service';
import { flushBufferedEvents } from '../../clinical-events/clinical-event-buffer.helpers';
import { TreatmentEventMapper } from '../../clinical-events/mappers/treatment-event.mapper';
import { VoucherFeService } from './voucher-fe.service';
import { TenantContextService } from '@curandis/tenant-datasource';
import { AppUser } from '../../users/entities/app-user.entity';

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

export interface PaymentTenderLineInput {
  kind: string; // 'method' | 'voucher' | 'voucher_fe'
  paymentMethodId?: string;
  voucherId?: string;
  voucherFeId?: string;
  amount: number;
}

export interface RecordPaymentInput {
  paymentMethod: PaymentMethod;
  collectedBy: string;
  amount?: number; // Se diverso dal prezzo originale
  /**
   * PARTE 4.3 — Solo per trattamenti sconto FE (caso semplice): id del
   * voucher_fe usato per pagare. Per lo split multi-riga usare `tenderLines`.
   */
  voucherFeId?: string;
  /**
   * PARTE 2/4 — Split multi-riga. Se presente, la somma degli amount deve
   * coincidere col totale. Le righe voucher_fe restano nel clinico; le righe
   * method/voucher vengono propagate ad accounting (se !scontoFE e post-invio).
   */
  tenderLines?: PaymentTenderLineInput[];
  /**
   * Se true, consente di CORREGGERE/SOSTITUIRE un pagamento già registrato:
   * storna l'eventuale voucher_fe consumato in precedenza e ri-registra
   * l'incasso con i nuovi dati. Senza questo flag, un treatment già pagato
   * rifiuta una nuova registrazione.
   */
  replaceExisting?: boolean;
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
  private readonly logger = new Logger(TreatmentService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private eventsService: EventsService,
    private readonly eventBuffer: ClinicalEventBuffer,
    private readonly eventEmitter: EventEmitter2,
    private readonly treatmentEventMapper: TreatmentEventMapper,
    private readonly voucherFeService: VoucherFeService,
  ) {}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get treatmentRepo() { return this.dataSource.getRepository(Treatment); }
  private get treatmentInstrumentRepo() { return this.dataSource.getRepository(TreatmentInstrument); }
  private get treatmentServiceRepo() { return this.dataSource.getRepository(TreatmentServiceEntity); }
  private get treatmentInvoiceLineRepo() { return this.dataSource.getRepository(TreatmentInvoiceLine); }
  private get appointmentRepo() { return this.dataSource.getRepository(AvailabilityAppointment); }
  private get appointmentInstrumentRepo() { return this.dataSource.getRepository(AppointmentInstrument); }
  private get pathRepo() { return this.dataSource.getRepository(TherapeuticPath); }

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

      // Verifica che l'appuntamento esista. Usiamo `withDeleted` perché la
      // delete() del trattamento soft-deleta a cascata anche l'appuntamento
      // collegato 1-1: se l'operatore cestina un trattamento e poi riavvia il
      // trattamento dallo stesso appuntamento, qui lo troveremmo soft-deleted.
      // In quel caso facciamo "cancella e ricrea pulito" (vedi sotto).
      const appointment = await appointmentRepo.findOne({
        where: { id: appointmentId },
        relations: ['instruments', 'operator', 'service'],
        withDeleted: true,
      });

      if (!appointment) {
        throw new NotFoundException(`Appuntamento ${appointmentId} non trovato`);
      }

      // Se l'appuntamento è soft-deleted (residuo storico: fino al 2026-06 la
      // delete del trattamento soft-deletava a cascata anche l'appuntamento),
      // lo riattiviamo per poterci riagganciare il nuovo trattamento.
      if (appointment.deletedAt) {
        await manager
          .createQueryBuilder()
          .update(AvailabilityAppointment)
          .set({ deletedAt: null, deletedByUserId: null } as any)
          .where('id = :aid', { aid: appointmentId })
          .execute();
        appointment.deletedAt = null;
      }

      // Purga i trattamenti soft-deleted che occupano ancora lo slot UNIQUE
      // "UQ_treatments_appointment" (il vincolo DB non distingue i soft-deleted).
      // Va fatto SEMPRE, non solo con appuntamento soft-deleted: oggi "annulla
      // trattamento" dal workspace operatore cestina il solo trattamento e
      // lascia vivo l'appuntamento, quindi senza questa purga la ricreazione
      // violerebbe il vincolo. Guardia: se il trattamento cestinato era già
      // nel circuito fatturazione non lo distruggiamo (perderemmo lo storico
      // fiscale) — va ripristinato dal cestino, non ricreato.
      const staleTreatments = await treatmentRepo.find({
        where: { appointmentId },
        withDeleted: true,
      });
      const purgeSafeStatuses = [
        TreatmentBillingStatus.NOT_READY,
        TreatmentBillingStatus.READY_FOR_BILLING,
        TreatmentBillingStatus.CANCELLED,
      ];
      for (const stale of staleTreatments.filter((t) => t.deletedAt)) {
        if (stale.billingStatus && !purgeSafeStatuses.includes(stale.billingStatus)) {
          throw new ConflictException(
            `Per questo appuntamento esiste un trattamento annullato ma già inviato in fatturazione ` +
            `(stato ${stale.billingStatus}). Ripristinalo dal cestino invece di crearne uno nuovo.`,
          );
        }
        await treatmentRepo.delete(stale.id);
      }

      // Carica appointmentServices separatamente (relazione unidirezionale)
      const appointmentServiceRepo = manager.getRepository(AppointmentServiceEntity);
      const appointmentServices = await appointmentServiceRepo.find({
        where: { appointmentId },
        relations: ['service'],
        order: { orderPosition: 'ASC' }
      });

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

      // Verifica che non esista già un trattamento VIVO per questo appuntamento
      // (gli eventuali soft-deleted sono già stati purgati sopra).
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

      // siteId: usa quello dell'appuntamento, altrimenti fallback su sede
      // default attiva (per appuntamenti pre-migrazione billing).
      let siteId = appointment.siteId;
      if (!siteId) {
        const siteRepo = manager.getRepository(Site);
        const defaultSite = await siteRepo.findOne({
          where: { isActive: true },
          order: { createdAt: 'ASC' },
        });
        if (!defaultSite) {
          throw new BadRequestException(
            'Nessuna sede attiva configurata. Contattare l\'amministratore.',
          );
        }
        siteId = defaultSite.id;
      }

      // Crea il trattamento
      const treatment = treatmentRepo.create({
        appointmentId,
        operatorId: appointment.operatorId!,
        patientId: appointment.patientId,
        serviceId: appointment.serviceId, // Mantiene per retrocompatibilità
        therapeuticPathId,
        siteId,
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
      // 'site' serve alla generazione dell'attestato di presenza
      // (intestazione con nome/indirizzo dello studio)
      relations: ['appointment', 'operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrumentCategory', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service', 'site']
    });
  }

  /**
   * Trova un trattamento per ID (con EntityManager per transazioni)
   */
  private async findByIdWithManager(manager: EntityManager, id: string): Promise<Treatment> {
    const treatment = await manager.getRepository(Treatment).findOne({
      where: { id },
      // 'instruments.instrument' e 'instruments.instrumentCategory' sono
      // necessarie: il fragment GraphQL legge instrument.name; senza il
      // join annidato la relazione arriva null e il frontend crasha.
      relations: [
        'appointment', 'operator', 'service',
        'instruments', 'instruments.instrument', 'instruments.instrumentCategory',
        'therapeuticPath', 'treatmentServices', 'treatmentServices.service',
      ],
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
      relations: ['appointment', 'operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrumentCategory', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service']
    });
  }

  /**
   * Ottiene i trattamenti per più appuntamenti in una singola query.
   */
  async findByAppointmentIds(appointmentIds: string[]): Promise<Treatment[]> {
    if (appointmentIds.length === 0) return [];
    return this.treatmentRepo.find({
      where: { appointmentId: In(appointmentIds) },
      relations: ['appointment', 'operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrumentCategory', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service']
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
      if (updateData.price !== undefined) {
        treatment.price = updateData.price;
        // Invariante: accountingTotalAmount vale solo finché il documento
        // accounting da cui deriva è corrente. Qui il treatment è IN_PROGRESS
        // (guardia sopra) quindi nessun documento esiste: un eventuale residuo
        // è stale e va azzerato, altrimenti la UI mostrerebbe l'icona "totale
        // fattura" e incasserebbe sul totale sbagliato.
        treatment.accountingTotalAmount = null as any;
        treatment.accountingTreatmentLinesAmount = null as any;
        treatment.accountingDocumentTreatmentCount = null as any;
      }
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
        // forcedClosure descrive l'ULTIMA chiusura: un completamento normale
        // dell'operatore sovrascrive un eventuale flag residuo di una vecchia
        // chiusura forzata (force-close → reopen → ricompletamento).
        forcedClosure: false,
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
   *
   * Transition billingStatus (sessione 6):
   *  - NOT_READY → READY_FOR_BILLING (se !scontoFE && !isInvoicedToPatient)
   *  - Niente publish ancora: il publish di `treatment.closed` avviene in
   *    `setReadyForBilling(ids, true)` con la transition READY_FOR_BILLING → SENT.
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
    // Chiusura normale (non forzata): sovrascrive un eventuale flag residuo
    // di una precedente chiusura forzata poi riaperta.
    treatment.forcedClosure = false;
    if (input.secretaryNotes) {
      treatment.secretaryNotes = input.secretaryNotes;
    }

    // Chiusura dalla segreteria = fatturabile (billingStatus →
    // READY_FOR_BILLING) a meno che scontoFE sia attivo o sia già fatturato.
    // 2026-07-10: NON marca più readyForBilling — quel flag ora significa
    // "inviato ad accounting" (settato solo da setReadyForBilling(true),
    // con readyForBillingAt = timestamp di invio).
    if (!treatment.scontoFE && !treatment.isInvoicedToPatient) {
      // Transition billingStatus: NOT_READY → READY_FOR_BILLING.
      // Solo se siamo in NOT_READY: edge case (es. trattamento già SENT
      // riaperto da segreteria e richiuso) non regrediamo lo stato.
      if (treatment.billingStatus === TreatmentBillingStatus.NOT_READY) {
        treatment.billingStatus = TreatmentBillingStatus.READY_FOR_BILLING;
      }
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
      // Transition billingStatus: NOT_READY → READY_FOR_BILLING (fatturabile).
      // readyForBilling NON viene marcato: significa "inviato ad accounting"
      // (vedi close()).
      const billingStatusPatch =
        !treatment.scontoFE &&
        !treatment.isInvoicedToPatient &&
        treatment.billingStatus === TreatmentBillingStatus.NOT_READY
          ? { billingStatus: TreatmentBillingStatus.READY_FOR_BILLING }
          : {};
      await repo.update(id, {
        status: TreatmentStatus.CLOSED,
        completedAt: now,
        closedAt: now,
        closedByUserId,
        forcedClosure: true,
        ...(secretaryNotes ? { secretaryNotes } : {}),
        ...billingStatusPatch,
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
    // Difensivo: non regredire a IN_PROGRESS un treatment che è già stato
    // inviato/fatturato (billingStatus avanzato). Va prima richiamato/annullato.
    const blockedReopen = [
      TreatmentBillingStatus.SENT,
      TreatmentBillingStatus.PENDING,
      TreatmentBillingStatus.INVOICED,
      TreatmentBillingStatus.PARTIALLY_REFUNDED,
      TreatmentBillingStatus.REFUNDED,
      TreatmentBillingStatus.REISSUED,
    ];
    if (blockedReopen.includes(treatment.billingStatus)) {
      throw new BadRequestException(
        `Trattamento non riapribile (billingStatus=${treatment.billingStatus}): è già stato ` +
          `inviato/fatturato. Usa "Richiama indietro" o "Annulla invio" prima di riaprirlo.`,
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
    // La riapertura annulla la chiusura: il flag di chiusura forzata non deve
    // sopravvivere (altrimenti il badge "Chiusura forzata" resta per sempre).
    treatment.forcedClosure = false;
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
    // GUARDIA POST-INVIO: se il treatment è già stato inviato/fatturato
    // (billingStatus SENT/PENDING/INVOICED/REFUNDED/...), la riapertura locale
    // NON è consentita — porterebbe a stati incoerenti (es. operator_completed
    // + INVOICED, con la fattura già emessa in accounting). Per modificarlo,
    // l'operatore deve prima "Richiamare indietro" (recall) o annullare l'invio.
    const blockedReopen = [
      TreatmentBillingStatus.SENT,
      TreatmentBillingStatus.PENDING,
      TreatmentBillingStatus.INVOICED,
      TreatmentBillingStatus.PARTIALLY_REFUNDED,
      TreatmentBillingStatus.REFUNDED,
      TreatmentBillingStatus.REISSUED,
    ];
    if (blockedReopen.includes(treatment.billingStatus)) {
      throw new BadRequestException(
        `Trattamento non riapribile (billingStatus=${treatment.billingStatus}): è già stato ` +
          `inviato/fatturato. Usa "Richiama indietro" per recuperarlo da accounting, ` +
          `oppure "Annulla invio", prima di riaprirlo.`,
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
    // La riapertura annulla la chiusura: azzera anche il flag di chiusura
    // forzata, così una successiva chiusura normale non mostra più il badge.
    treatment.forcedClosure = false;
    treatment.readyForBilling = false;
    treatment.readyForBillingAt = null as any;
    // Un treatment auto-marcato READY_FOR_BILLING alla chiusura deve tornare
    // NOT_READY quando viene riaperto: altrimenti, riabilitando lo sconto FE e
    // richiudendo (close() non auto-marca più perché scontoFE=true), il
    // billingStatus resterebbe bloccato su READY_FOR_BILLING e i pulsanti
    // fatturazione risulterebbero incoerenti. Gli stati post-invio (SENT,
    // PENDING, INVOICED+) sono ora bloccati dalla guardia sopra (la riapertura
    // locale è preclusa: isInvoicedToPatient + billingStatus avanzati
    // passano per cancel/recall, non per reopenBySecretary).
    if (treatment.billingStatus === TreatmentBillingStatus.READY_FOR_BILLING) {
      treatment.billingStatus = TreatmentBillingStatus.NOT_READY;
    }
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
   * Verifica che l'operatore del trattamento sia abilitato all'incasso
   * (Operator.canCollectPayment). Usato per le chiamate con ruolo 'operator'
   * (derivato server-side dal JWT nel resolver).
   */
  private async assertTreatmentOperatorCanCollect(
    treatment: Treatment,
  ): Promise<void> {
    const operator = await this.dataSource
      .getRepository(Operator)
      .findOne({ where: { id: treatment.operatorId } });
    if (!operator || operator.canCollectPayment === false) {
      throw new BadRequestException(
        "L'operatore non ha il permesso di registrare pagamenti."
      );
    }
  }

  /**
   * Registra il pagamento del paziente.
   *
   * @param callerRole - ruolo derivato server-side dal resolver (JWT).
   *   'operator': richiede che l'operatore associato al trattamento abbia
   *     canCollectPayment=true.
   *   'secretary' (default): la segreteria può sempre incassare, in
   *     qualsiasi stato del trattamento (anche CLOSED/SENT/PENDING/INVOICED:
   *     l'incasso post-chiusura è un caso d'uso legittimo).
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

    if (treatment.isPaid && !input.replaceExisting) {
      throw new BadRequestException(
        'Il trattamento è già stato pagato. Usa la correzione del pagamento per modificarlo.',
      );
    }

    // NB: il pagamento è consentito anche su trattamenti CLOSED/SENT/PENDING/
    // INVOICED: serve a registrare/sincronizzare l'incasso DOPO l'invio a
    // fatturazione. Con replaceExisting=true si può anche correggere un
    // pagamento già registrato (storno voucher_fe precedente + ri-registrazione).
    // La modifica di righe/prezzi resta congelata altrove (updateBySecretary).

    if (callerRole === 'operator') {
      await this.assertTreatmentOperatorCanCollect(treatment);
    }

    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;
    const paymentId = randomUUID();
    const now = new Date();
    const amount = input.amount ?? treatment.accountingTotalAmount ?? treatment.price ?? 0;
    // Tutti i treatment marcati pagati da questo incasso (il primario + gli
    // eventuali fratelli della stessa fattura multi-trattamento). Popolato
    // dentro la transazione, usato per payload evento e notifiche SSE.
    const coveredTreatmentIds: string[] = [id];

    const updated = await this.dataSource.transaction(async (manager) => {
      // Correzione: se stiamo sostituendo un pagamento esistente, storniamo
      // prima i consumi voucher_fe collegati (ripristina il residuo) così la
      // ri-registrazione riparte pulita.
      if (input.replaceExisting && treatment.isPaid) {
        await this.voucherFeService.reverseConsumptionsForTreatment(
          manager,
          id,
          input.collectedBy,
        );
      }

      // Guardia first-write-wins: senza replaceExisting l'UPDATE applica solo
      // se isPaid è ancora false (row lock Postgres) — se un'altra
      // registrazione concorrente ha già vinto, RETURNING è vuoto → scartiamo.
      // Con replaceExisting aggiorniamo comunque (correzione esplicita).
      // IMPORTANTE: NON sovrascriviamo `treatment.price` con l'importo
      // incassato. Il `price` è il totale DOVUTO (somma delle righe servizio);
      // l'`amount` incassato può essere parziale/diverso e va tracciato a parte
      // (nel PaymentAllocation lato accounting, non sul treatment). Sovrascrivere
      // il price corromperebbe il totale del trattamento.
      const updateQb = manager
        .createQueryBuilder()
        .update(Treatment)
        .set({
          isPaid: true,
          paymentMethod: input.paymentMethod,
          paidAt: now,
          collectedBy: input.collectedBy,
          paymentId,
          paymentRecordedSource: 'clinical',
        })
        .returning('*');
      if (input.replaceExisting) {
        updateQb.where('id = :id', { id });
      } else {
        updateQb.where('id = :id AND "isPaid" = false', { id });
      }
      const res = await updateQb.execute();

      if (!res.raw || res.raw.length === 0) {
        // Qualcun altro ha già registrato l'incasso. Idempotente: nessun errore.
        return null;
      }

      const fresh = await manager.getRepository(Treatment).findOne({ where: { id } });

      // 2026-07-08 — Fattura multi-trattamento: l'incasso è del DOCUMENTO,
      // mai della quota. Un solo paymentId condiviso da tutti i treatment
      // della fattura: si valida che l'importo sia il saldo intero e si
      // marcano pagati anche gli altri treatment nella STESSA transazione.
      // Verso accounting parte UN SOLO evento (questo), con l'elenco dei
      // treatment coperti — niente N eventi da totale pieno (sovra-incasso).
      const isMultiInvoice =
        (fresh!.accountingDocumentTreatmentCount ?? 1) > 1 &&
        !!fresh!.accountingDocumentId;
      if (isMultiInvoice) {
        const docTotal = Number(fresh!.accountingTotalAmount ?? 0);
        if (docTotal > 0 && Math.abs(Number(amount) - docTotal) > 0.01) {
          throw new BadRequestException(
            `La fattura ${fresh!.patientInvoiceNumber ?? fresh!.accountingDocumentId} copre ` +
              `${fresh!.accountingDocumentTreatmentCount} trattamenti: l'incasso va registrato ` +
              `a saldo intero (€ ${docTotal.toFixed(2)}), ricevuto € ${Number(amount).toFixed(2)}.`,
          );
        }
        const siblings = await manager.getRepository(Treatment).find({
          where: { accountingDocumentId: fresh!.accountingDocumentId },
        });
        for (const sib of siblings) {
          if (sib.id === id) continue;
          coveredTreatmentIds.push(sib.id);
          const sibQb = manager
            .createQueryBuilder()
            .update(Treatment)
            .set({
              isPaid: true,
              paymentMethod: input.paymentMethod,
              paidAt: now,
              collectedBy: input.collectedBy,
              paymentId,
              paymentRecordedSource: 'clinical',
            })
            .returning('id');
          if (input.replaceExisting) {
            sibQb.where('id = :sid', { sid: sib.id });
          } else {
            sibQb.where('id = :sid AND "isPaid" = false', { sid: sib.id });
          }
          const sibRes = await sibQb.execute();
          if (!sibRes.raw || sibRes.raw.length === 0) {
            // Un altro treatment della stessa fattura risulta già incassato
            // con un paymentId diverso: stato incoerente, meglio fermarsi
            // (rollback di tutto) che produrre un doppio incasso parziale.
            throw new BadRequestException(
              `Un altro trattamento della fattura ${fresh!.patientInvoiceNumber ?? ''} risulta ` +
                `già incassato separatamente. Correggere prima quell'incasso ` +
                `(o ripetere con la correzione del pagamento).`,
            );
          }
        }
      }

      // Normalizza le righe di tender. Se non fornite, ricava una riga singola
      // dal `paymentMethod` legacy (retro-compat "Fattura e incassa").
      const amountStr = Number(amount).toFixed(2);
      const tenderLines =
        input.tenderLines && input.tenderLines.length > 0
          ? input.tenderLines
          : input.voucherFeId
          ? [{ kind: 'voucher_fe', voucherFeId: input.voucherFeId, amount }]
          : [{ kind: 'method', paymentMethodId: input.paymentMethod, amount }];

      // Validazione somma = totale (tolleranza centesimi).
      const sum = tenderLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
      if (Math.abs(sum - Number(amount)) > 0.01) {
        throw new BadRequestException(
          `La somma delle righe di pagamento (€ ${sum.toFixed(2)}) non coincide con il totale (€ ${amountStr}).`,
        );
      }

      // Voucher FE (PARTE 4.3): consuma ogni riga voucher_fe nella stessa
      // transazione. Vietato per trattamenti non-scontoFE.
      for (const line of tenderLines) {
        if (line.kind === 'voucher_fe' && line.voucherFeId) {
          if (!fresh!.scontoFE) {
            throw new BadRequestException(
              'Il voucher FE è utilizzabile solo per trattamenti con sconto FE attivo.',
            );
          }
          await this.voucherFeService.consume(manager, {
            voucherFeId: line.voucherFeId,
            amount: Number(line.amount),
            treatmentId: id,
            createdByUserId: input.collectedBy,
          });
        }
      }

      // Publish verso accounting SOLO se:
      //  - il trattamento NON è scontoFE (quei pagamenti restano nel clinico), E
      //  - è già stato inviato a fatturazione (SENT/PENDING/INVOICED): pre-invio
      //    il payment viaggia già dentro treatment.closed.
      const postSent =
        fresh!.billingStatus === TreatmentBillingStatus.SENT ||
        fresh!.billingStatus === TreatmentBillingStatus.PENDING ||
        fresh!.billingStatus === TreatmentBillingStatus.INVOICED;

      if (!fresh!.scontoFE && postSent) {
        if (!tenantAlias) {
          throw new Error(
            'recordPayment chiamato fuori da contesto tenant. Wrappare in TenantContextService.run + eventBuffer.runInScope.',
          );
        }
        const subMap = await this.batchLookupKeycloakSubsForCancel(
          manager,
          [input.collectedBy],
        );
        const collectedByKeycloakSub = subMap.get(input.collectedBy) ?? null;

        // Mappa le righe verso il payload evento (escludendo voucher_fe, che è
        // puramente clinico e non va mai verso accounting).
        const eventTenderLines = tenderLines
          .filter((l) => l.kind !== 'voucher_fe')
          .map((l) => ({
            kind: (l.kind === 'voucher' ? 'voucher' : 'method') as 'method' | 'voucher',
            paymentMethodId: l.kind === 'method' ? l.paymentMethodId ?? null : null,
            voucherId: l.kind === 'voucher' ? l.voucherId ?? null : null,
            amount: Number(l.amount).toFixed(2),
          }));

        this.eventBuffer.add({
          eventType: 'treatment.payment-recorded',
          payload: {
            treatmentId: id,
            paymentId,
            isPaid: true as const,
            paidAt: now.toISOString(),
            totalAmount: amountStr,
            tenderLines: eventTenderLines,
            collectedByUserId: collectedByKeycloakSub,
            recordedAt: now.toISOString(),
            // Fattura multi-trattamento: un solo evento a saldo documento,
            // con l'elenco completo dei treatment coperti (audit accounting).
            accountingDocumentId: coveredTreatmentIds.length > 1
              ? fresh!.accountingDocumentId ?? undefined
              : undefined,
            coveredTreatmentIds: coveredTreatmentIds.length > 1
              ? coveredTreatmentIds
              : undefined,
          },
          tenantAlias,
          correlationId,
        });
      }

      return fresh!;
    });

    if (!updated) {
      // First-write-wins perso: ritorna lo stato corrente senza ulteriori azioni.
      return this.requireFullTreatment(id);
    }

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    // SSE: notifica le UI aperte (anche l'incasso locale deve propagarsi).
    // Per le fatture multi-trattamento la notifica parte per TUTTI i treatment
    // marcati pagati, così ogni riga aperta in lista si aggiorna.
    for (const coveredId of coveredTreatmentIds) {
      this.eventsService.emit({
        type: 'treatment_status_changed',
        treatmentId: coveredId,
        operatorId: updated.operatorId,
        newStatus: updated.billingStatus,
        timestamp: new Date(),
      });
    }
    return this.requireFullTreatment(id);
  }

  /**
   * 2026-07-08 — Annulla un pagamento registrato (flusso annulla-e-reinserisci:
   * la vecchia "modifica" con replaceExisting sovrascriveva metodo/data in
   * silenzio, sbagliato per la riconciliazione dei movimenti carte/banca).
   *
   * Consentito SOLO se la fattura NON è emessa. Per i trattamenti FATTURATI
   * (decisione 2026-07-08) lo storno si fa esclusivamente da accounting, che
   * cancella la riga incasso sul documento e rimanda billable.payment-reversed
   * (il clinico torna isPaid=false da lì).
   *
   * Se il treatment è SENT/PENDING (pagamento già comunicato ad accounting via
   * treatment.closed embedded o treatment.payment-recorded), pubblica
   * `treatment.payment-cancelled` così accounting elimina l'allocazione orfana
   * e il payment embedded sul billable.
   *
   * @param callerRole - derivato server-side dal resolver (JWT): 'secretary'
   *   annulla sempre; 'operator' richiede canCollectPayment=true (stessa
   *   regola della registrazione: chi può incassare può anche correggere).
   */
  async cancelPayment(
    id: string,
    actorUserId?: string,
    callerRole: 'operator' | 'secretary' = 'secretary',
  ): Promise<Treatment> {
    const treatment = await this.findById(id);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }
    if (!treatment.isPaid) {
      throw new BadRequestException('Nessun pagamento da annullare per questo trattamento.');
    }

    if (callerRole === 'operator') {
      await this.assertTreatmentOperatorCanCollect(treatment);
    }

    const invoicedStatuses: TreatmentBillingStatus[] = [
      TreatmentBillingStatus.INVOICED,
      TreatmentBillingStatus.REFUNDED,
      TreatmentBillingStatus.PARTIALLY_REFUNDED,
      TreatmentBillingStatus.REISSUED,
    ];
    if (
      treatment.isInvoicedToPatient ||
      invoicedStatuses.includes(treatment.billingStatus)
    ) {
      throw new BadRequestException(
        'La fattura è già stata emessa: l\'incasso va annullato dalla Contabilità ' +
          '(dettaglio documento → pagamenti registrati). Il trattamento si aggiornerà automaticamente.',
      );
    }

    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;
    const cancelledPaymentId = treatment.paymentId;
    const wasSentOrPending =
      treatment.billingStatus === TreatmentBillingStatus.SENT ||
      treatment.billingStatus === TreatmentBillingStatus.PENDING;

    await this.dataSource.transaction(async (manager) => {
      // Storno difensivo di eventuali consumi voucher_fe (ripristina il residuo).
      await this.voucherFeService.reverseConsumptionsForTreatment(
        manager,
        id,
        actorUserId ?? treatment.collectedBy ?? '',
      );

      await manager.getRepository(Treatment).update(id, {
        isPaid: false,
        paymentMethod: null as any,
        paidAt: null as any,
        collectedBy: null as any,
        paymentId: null as any,
        paymentRecordedSource: null as any,
      });

      // Il pagamento era già stato comunicato ad accounting → annullalo anche là.
      if (wasSentOrPending && !treatment.scontoFE && cancelledPaymentId) {
        if (!tenantAlias) {
          throw new Error(
            'cancelPayment chiamato fuori da contesto tenant. Wrappare in TenantContextService.run + eventBuffer.runInScope.',
          );
        }
        const subMap = actorUserId
          ? await this.batchLookupKeycloakSubsForCancel(manager, [actorUserId])
          : new Map<string, string>();
        this.eventBuffer.add({
          eventType: 'treatment.payment-cancelled',
          payload: {
            treatmentId: id,
            paymentId: cancelledPaymentId,
            cancelledByUserId: (actorUserId && subMap.get(actorUserId)) ?? null,
            cancelledAt: new Date().toISOString(),
          },
          tenantAlias,
          correlationId,
        });
      }
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: id,
      operatorId: treatment.operatorId,
      newStatus: treatment.billingStatus,
      timestamp: new Date(),
    });
    this.logger.log(
      `Pagamento annullato per treatment ${id} (paymentId=${cancelledPaymentId ?? 'n/d'}, ` +
        `notificaAccounting=${wasSentOrPending && !treatment.scontoFE}).`,
    );
    return this.requireFullTreatment(id);
  }

  /**
   * 2026-07-01 — Toggle "Segna come incassato in contanti" per trattamenti
   * SCONTO FE. Scorciatoia della segreteria: al posto di aprire il dialog
   * pagamento, marca (o annulla) l'incasso in CONTANTI sull'intero totale.
   *
   * Vincolo: solo scontoFE (i trattamenti non-scontoFE incassano dalla scheda
   * Pagamento con i metodi accounting). Nessun evento verso accounting (i
   * pagamenti scontoFE restano 100% clinici — vedi payment-source-duality).
   *
   *  - paid=true  → registra incasso contanti sul totale (riusa recordPayment,
   *    con replaceExisting se già pagato in altro modo).
   *  - paid=false → annulla l'incasso: reset campi pagamento + storno difensivo
   *    di eventuali consumi voucher_fe.
   */
  async setScontoFeCashPayment(
    id: string,
    paid: boolean,
    actorUserId?: string,
  ): Promise<Treatment> {
    const treatment = await this.findById(id);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }
    if (!treatment.scontoFE) {
      throw new BadRequestException(
        'La marcatura "incassato in contanti" è disponibile solo per trattamenti con sconto FE attivo.',
      );
    }
    const collectedBy = actorUserId ?? treatment.collectedBy ?? '';

    if (paid) {
      // Idempotente: se già incassato in contanti, non rifare nulla.
      if (treatment.isPaid && treatment.paymentMethod === PaymentMethod.CASH) {
        return this.requireFullTreatment(id);
      }
      const total = Number(treatment.price ?? 0);
      return this.recordPayment(
        id,
        {
          paymentMethod: PaymentMethod.CASH,
          collectedBy,
          amount: total,
          tenderLines: [{ kind: 'method', paymentMethodId: 'cash', amount: total }],
          replaceExisting: treatment.isPaid,
        },
        'secretary',
      );
    }

    // paid=false → annulla l'incasso. Reset campi + storno voucher_fe difensivo.
    await this.dataSource.transaction(async (manager) => {
      if (treatment.isPaid) {
        await this.voucherFeService.reverseConsumptionsForTreatment(
          manager,
          id,
          collectedBy,
        );
      }
      await manager
        .createQueryBuilder()
        .update(Treatment)
        .set({
          isPaid: false,
          paymentMethod: null as any,
          paidAt: null as any,
          collectedBy: null as any,
          paymentId: null as any,
          paymentRecordedSource: null as any,
        })
        .where('id = :id', { id })
        .execute();
    });

    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: id,
      operatorId: treatment.operatorId,
      newStatus: treatment.billingStatus,
      timestamp: new Date(),
    });
    return this.requireFullTreatment(id);
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

    // GUARDIA ANTI-CORRUZIONE: un array vuoto NON deve azzerare le righe
    // esistenti del trattamento. Un treatment senza righe servizio non è un
    // caso d'uso valido (perderebbe il totale fatturabile). Se il chiamante
    // passa [] è quasi certamente un bug a monte (payload mal costruito): in
    // tal caso NON tocchiamo le righe e usciamo. La sostituzione legittima
    // passa sempre un array non vuoto.
    if (!services || services.length === 0) {
      this.logger.warn(
        `saveTreatmentServices ignorato per treatment ${treatmentId}: array servizi vuoto ` +
          `(protezione anti-cancellazione accidentale).`,
      );
      return;
    }

    // 2026-07-15 — Il replace (delete+reinsert) perdeva i campi per-riga
    // non presenti nell'input: operatore esecutore ("Eseguito da", che
    // decide a chi va il compenso) e descrizione fattura personalizzata.
    // Li conserviamo riabbinandoli per serviceId (FIFO sui duplicati).
    const existingRows = await treatmentServiceRepo.find({
      where: { treatmentId },
      order: { orderPosition: 'ASC' },
    });
    const carryOverByService = new Map<
      string,
      Array<{ executorOperatorId: string | null; invoiceLineDescription: string | null }>
    >();
    for (const row of existingRows) {
      const queue = carryOverByService.get(row.serviceId) ?? [];
      queue.push({
        executorOperatorId: row.executorOperatorId ?? null,
        invoiceLineDescription: row.invoiceLineDescription ?? null,
      });
      carryOverByService.set(row.serviceId, queue);
    }

    // Replace: elimina le righe esistenti e reinserisce quelle nuove.
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

      const carried = carryOverByService.get(svc.serviceId)?.shift();

      const treatmentService = treatmentServiceRepo.create({
        treatmentId,
        serviceId: svc.serviceId,
        price,
        duration: svc.duration,
        orderPosition: svc.orderPosition ?? i,
        isCustomPrice: svc.isCustomPrice ?? false,
        executorOperatorId: (carried?.executorOperatorId ?? null) as any,
        invoiceLineDescription: (carried?.invoiceLineDescription ?? null) as any,
      });
      await treatmentServiceRepo.save(treatmentService);
    }
  }

  /**
   * 2026-07-01 — Ricalcola i prezzi delle righe servizio di un treatment
   * ESISTENTE quando si abilita/disabilita lo sconto FE (senza toccare le righe:
   * l'operatore ha solo cambiato il flag). Le righe con `isCustomPrice=true`
   * NON vengono toccate (prezzo fissato a mano dalla segreteria). Per le altre
   * si applica la tariffa `Service.discountFE` (se scontoFE) o `defaultPrice`.
   *
   * Ritorna il nuovo totale (somma di tutte le righe) da assegnare a
   * `treatment.price`. Stessa logica prezzo di `saveTreatmentServicesWithManager`.
   */
  private async recalcServicePricesForScontoFE(
    manager: EntityManager,
    treatmentId: string,
    scontoFE: boolean,
  ): Promise<number> {
    const treatmentServiceRepo = manager.getRepository(TreatmentServiceEntity);
    const rows = await treatmentServiceRepo.find({
      where: { treatmentId },
      relations: { service: true },
    });

    let total = 0;
    for (const row of rows) {
      if (row.isCustomPrice) {
        // Prezzo fissato a mano: non lo tocchiamo, ma conta nel totale.
        total += Number(row.price ?? 0);
        continue;
      }
      const service = row.service;
      const newPrice =
        scontoFE && service?.discountFE
          ? Number(service.discountFE)
          : Number(service?.defaultPrice ?? 0);
      if (Number(row.price ?? 0) !== newPrice) {
        row.price = newPrice;
        await treatmentServiceRepo.save(row);
      }
      total += newPrice;
    }
    // Somma anche le righe custom (legacy testo libero) al totale.
    const customLines = await manager
      .getRepository(TreatmentInvoiceLine)
      .find({ where: { treatmentId } });
    total += customLines.reduce((s, l) => s + Number(l.amount ?? 0), 0);
    return total;
  }

  // ==================== QUERIES ====================

  /**
   * Trattamenti in corso per un operatore
   */
  async getActiveByOperator(operatorId: string, date?: string): Promise<Treatment[]> {
    const queryBuilder = this.treatmentRepo.createQueryBuilder('treatment')
      .leftJoinAndSelect('treatment.appointment', 'appointment')
      .leftJoinAndSelect('treatment.operator', 'operator')
      .leftJoinAndSelect('treatment.service', 'service')
      .leftJoinAndSelect('treatment.instruments', 'instruments')
      .leftJoinAndSelect('instruments.instrument', 'instrumentsInstrument')
      .leftJoinAndSelect('instruments.instrumentCategory', 'instrumentsCategory')
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
  async getActiveByOperators(
    operatorIds: string[],
    date?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Treatment[]> {
    if (operatorIds.length === 0) return [];
    const queryBuilder = this.treatmentRepo.createQueryBuilder('treatment')
      .leftJoinAndSelect('treatment.appointment', 'appointment')
      .leftJoinAndSelect('treatment.operator', 'operator')
      .leftJoinAndSelect('treatment.service', 'service')
      .leftJoinAndSelect('treatment.instruments', 'instruments')
      .leftJoinAndSelect('instruments.instrument', 'instrumentsInstrument')
      .leftJoinAndSelect('instruments.instrumentCategory', 'instrumentsCategory')
      .leftJoinAndSelect('treatment.therapeuticPath', 'therapeuticPath')
      .leftJoinAndSelect('treatment.treatmentServices', 'treatmentServices')
      .leftJoinAndSelect('treatmentServices.service', 'treatmentServiceService')
      .where('treatment.operatorId IN (:...operatorIds)', { operatorIds });

    // Filtro per giorno singolo (vista giornaliera) oppure per intervallo
    // (vista settimanale). Il giorno singolo ha la precedenza se passato.
    if (date) {
      queryBuilder.andWhere('DATE(treatment.startedAt) = :date', { date });
    } else if (startDate && endDate) {
      queryBuilder.andWhere('DATE(treatment.startedAt) BETWEEN :startDate AND :endDate', { startDate, endDate });
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
      relations: ['appointment', 'operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrumentCategory', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service'],
      order: { completedAt: 'ASC' }
    });
  }

  /**
   * Trattamenti di un paziente
   */
  async getByPatient(patientId: string, limit?: number, offset?: number): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      where: { patientId },
      relations: ['appointment', 'operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrumentCategory', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service'],
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
      relations: ['appointment', 'operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrumentCategory', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service'],
      order: { startedAt: 'DESC' }
    });
  }

  /**
   * Trattamenti di un percorso terapeutico
   */
  async getByTherapeuticPath(therapeuticPathId: string): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      where: { therapeuticPathId },
      relations: ['appointment', 'operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrumentCategory', 'therapeuticPath', 'treatmentServices', 'treatmentServices.service'],
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

      // NB: l'appuntamento NON viene più soft-deletato insieme al trattamento.
      // L'appuntamento è un'entità indipendente (esiste in calendario a
      // prescindere dal trattamento, e con l'auto-start possono nascere
      // trattamenti che non "possiedono" l'appuntamento). Cestinare un
      // trattamento non deve far sparire l'appuntamento dal calendario.
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

      // NB: l'appuntamento non viene più toccato (né soft-deletato dal delete
      // né ripristinato qui): è un'entità indipendente.
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
    /**
     * Motivo dell'amend (es. "aggiunta riga prodotto", "correzione prezzo").
     * Obbligatorio se la modifica genera un evento `treatment.amended` (cioè
     * billingStatus IN SENT/PENDING). Per altri stati può essere omesso.
     */
    amendmentReason?: string;
  }, actorUserId?: string): Promise<Treatment> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    // Reason fissa per l'auto-recall scatenato dall'abilitazione dello sconto FE
    // (decisione di prodotto: nessun prompt all'operatore, azione fluida).
    const SCONTO_FE_RECALL_REASON = 'Abilitazione sconto fattura elettronica';

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
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

      // Stati post-fatturazione: ogni modifica richiede nota di credito.
      const blockedForAmend = [
        TreatmentBillingStatus.INVOICED,
        TreatmentBillingStatus.PARTIALLY_REFUNDED,
        TreatmentBillingStatus.REFUNDED,
        TreatmentBillingStatus.REISSUED,
        TreatmentBillingStatus.CANCELLED,
      ];

      // Blocco specifico per scontoFE su treatment già fatturato: messaggio
      // dedicato (più chiaro del generico "non modificabile"). Abilitare lo
      // sconto FE su un INVOICED+ è vietato finché non si emette NC.
      if (input.scontoFE === true && blockedForAmend.includes(treatment.billingStatus)) {
        throw new BadRequestException(
          `Impossibile abilitare lo sconto fattura elettronica: il trattamento è già fatturato ` +
            `(billingStatus=${treatment.billingStatus}). Per applicare lo sconto FE occorre prima ` +
            `emettere una nota di credito da accounting.`,
        );
      }

      // 2026-07-03 — Regola pagamenti (decisione utente): NON si può attivare
      // lo sconto FE su un trattamento già incassato (con scontoFE OFF
      // l'incasso è con metodi accounting, eventualmente già riconciliato in
      // contabilità). Prima si storna l'incasso — da accounting
      // (deleteDocumentPayment, che ora propaga lo storno al clinico) o dalla
      // scheda Pagamento — poi si cambia la fonte. Evita incassi orfani.
      if (input.scontoFE === true && !treatment.scontoFE && treatment.isPaid) {
        throw new BadRequestException(
          `Impossibile abilitare lo sconto fattura elettronica: il trattamento risulta già ` +
            `incassato. Stornare prima l'incasso, poi attivare lo sconto FE.`,
        );
      }

      // Vincolo billing per amend (spec §10): se il treatment è già stato
      // pubblicato e fatturato, modificare le righe richiede nota credito.
      if (blockedForAmend.includes(treatment.billingStatus)) {
        throw new BadRequestException(
          `Trattamento ${input.id} non modificabile (billingStatus=${treatment.billingStatus}). ` +
            `Per modifiche post-fatturazione emettere nota di credito da accounting.`,
        );
      }

      const wasSentOrPending =
        treatment.billingStatus === TreatmentBillingStatus.SENT ||
        treatment.billingStatus === TreatmentBillingStatus.PENDING;

      // Auto-recall: abilitare lo sconto FE su un treatment già inviato
      // (SENT/PENDING) deve recuperarlo da accounting (publish
      // treatment.cancelled → NOT_READY). In questo caso NON pubblichiamo anche
      // treatment.amended (mutua esclusione: stiamo richiamando, non emendando).
      const triggersScontoFERecall =
        input.scontoFE === true && wasSentOrPending;

      // Decisione publish amend: SOLO se accounting già conosce il treatment
      // (SENT o PENDING) E non stiamo facendo l'auto-recall scontoFE.
      const shouldPublishAmend = wasSentOrPending && !triggersScontoFERecall;

      // Invariante: accountingTotalAmount non-null ⟺ documento accounting
      // corrente. `blockedForAmend` (sopra) garantisce che qui il billingStatus
      // sia NOT_READY/READY_FOR_BILLING/SENT/PENDING, cioè nessun documento
      // emesso: se il prezzo cambia, un residuo di una fattura precedente
      // (stornata/richiamata) è stale → azzera.
      if (input.price !== undefined) {
        treatment.price = input.price;
        treatment.accountingTotalAmount = null as any;
        treatment.accountingTreatmentLinesAmount = null as any;
        treatment.accountingDocumentTreatmentCount = null as any;
      }
      if (input.secretaryNotes !== undefined) treatment.secretaryNotes = input.secretaryNotes;

      // Rileva un cambio EFFETTIVO di scontoFE per ricalcolare i prezzi.
      const scontoFEChanged =
        input.scontoFE !== undefined && input.scontoFE !== treatment.scontoFE;

      if (input.scontoFE !== undefined) {
        treatment.scontoFE = input.scontoFE;
        // Con scontoFE attivo il treatment non è fatturabile: azzera il flag.
        if (input.scontoFE === true && treatment.readyForBilling) {
          treatment.readyForBilling = false;
          treatment.readyForBillingAt = null as any;
        }
      }

      // Ricalcolo prezzi al cambio scontoFE (Step 6): le righe servizio
      // non-custom passano alla tariffa discountFE (se ON) o defaultPrice (se
      // OFF) e il totale si aggiorna. Solo se l'operatore NON ha anche passato
      // treatmentServices (in quel caso saveTreatmentServicesWithManager, più
      // sotto, ricalcola già con il nuovo scontoFE). Se input.price è passato
      // esplicitamente, rispettiamo quello (override manuale).
      if (
        scontoFEChanged &&
        input.treatmentServices === undefined &&
        input.price === undefined
      ) {
        const newTotal = await this.recalcServicePricesForScontoFE(
          manager,
          input.id,
          treatment.scontoFE,
        );
        treatment.price = newTotal;
        treatment.accountingTotalAmount = null as any;
        treatment.accountingTreatmentLinesAmount = null as any;
        treatment.accountingDocumentTreatmentCount = null as any;
      }

      // 2026-07-03 — ON→OFF con incasso scontoFE esistente: reset SEMPRE
      // (decisione utente). Cambiando la fonte dei pagamenti, l'incasso
      // clinico (contanti o voucher_fe) viene azzerato — storno voucher_fe
      // incluso — e si reincassa con i metodi accounting dopo la fattura.
      // Nessun evento verso accounting: l'incasso scontoFE non era mai
      // stato comunicato (payment-source-duality).
      if (scontoFEChanged && input.scontoFE === false && treatment.isPaid) {
        await this.voucherFeService.reverseConsumptionsForTreatment(
          manager,
          input.id,
          actorUserId ?? treatment.collectedBy ?? '',
        );
        treatment.isPaid = false;
        treatment.paymentMethod = null as any;
        treatment.paidAt = null as any;
        treatment.collectedBy = null as any;
        treatment.paymentId = null as any;
        treatment.paymentRecordedSource = null as any;
        this.logger.log(
          `Toggle scontoFE OFF su treatment ${input.id}: incasso clinico azzerato (reincassare con metodi accounting).`,
        );
      }

      if (triggersScontoFERecall) {
        // Recupera da accounting (torna NOT_READY, azzera snapshot, publish
        // treatment.cancelled). applyAutoRecall fa già il save del treatment.
        await this.applyAutoRecall(manager, treatment, {
          cancelledByUserId: actorUserId ?? treatment.closedByUserId ?? '',
          reason: SCONTO_FE_RECALL_REASON,
          tenantAlias,
          correlationId,
        });
      } else {
        await treatmentRepo.save(treatment);
      }

      if (input.treatmentServices !== undefined) {
        await this.saveTreatmentServicesWithManager(
          manager,
          input.id,
          input.treatmentServices,
          treatment.scontoFE || false,
        );
      }

      // Publish treatment.amended con revision atomic (UPDATE ... RETURNING).
      // SOLO se billingStatus PRIMA delle modifiche era SENT/PENDING.
      if (shouldPublishAmend) {
        if (!input.amendmentReason || input.amendmentReason.trim().length === 0) {
          throw new BadRequestException(
            'amendmentReason è obbligatorio quando il trattamento è già stato pubblicato (SENT/PENDING).',
          );
        }
        if (!tenantAlias) {
          throw new Error(
            'updateBySecretary chiamato fuori da contesto tenant. Wrappare in TenantContextService.run + eventBuffer.runInScope.',
          );
        }

        // Increment atomico via UPDATE ... RETURNING. Evita la race tra
        // amend concorrenti sullo stesso treatment (postgres garantisce
        // l'atomicità del SET col valore corrente + RETURNING). NON
        // read-then-write in due query.
        // NB: TypeORM `manager.query()` su UPDATE con RETURNING ritorna
        // `[rows[], affectedCount]` — destruttura per estrarre i rows.
        const [incRows]: [Array<{ amendmentRevision: number }>, number] = await manager.query(
          `UPDATE "treatments"
             SET "amendmentRevision" = "amendmentRevision" + 1
             WHERE id = $1
             RETURNING "amendmentRevision"`,
          [input.id],
        );
        const newRevisionRaw = incRows?.[0]?.amendmentRevision;
        const newRevision = typeof newRevisionRaw === 'string' ? parseInt(newRevisionRaw, 10) : newRevisionRaw;
        if (typeof newRevision !== 'number' || newRevision < 1) {
          throw new Error(
            `Increment atomic amendmentRevision fallito per treatment ${input.id} (rows=${JSON.stringify(incRows)}).`,
          );
        }

        const payload = await this.treatmentEventMapper.mapTreatmentAmended(
          input.id,
          manager,
          { revision: newRevision, amendmentReason: input.amendmentReason },
        );
        this.eventBuffer.add({
          eventType: 'treatment.amended',
          payload,
          tenantAlias,
          correlationId,
        });
      }

      const updated = await this.findByIdWithManager(manager, input.id);
      return { updated, recalled: triggersScontoFERecall };
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    // SSE: se è scattato l'auto-recall (abilitazione scontoFE su SENT/PENDING),
    // notifica le UI aperte del cambio billingStatus → NOT_READY, così i flag
    // dei pulsanti si riallineano senza attendere altri eventi.
    if (result.recalled && result.updated) {
      this.eventsService.emit({
        type: 'treatment_status_changed',
        treatmentId: result.updated.id,
        operatorId: result.updated.operatorId,
        newStatus: result.updated.billingStatus,
        timestamp: new Date(),
      });
    }
    return result.updated;
  }

  // ==================== CANCEL TREATMENT (sessione 6) ====================

  /**
   * Annulla l'INVIO a fatturazione di un trattamento (rinominato in
   * sessione 7 da "cancella trattamento" a "annulla invio fatturazione").
   *
   * Semantica REVISIONATA in sessione 7:
   *   - Da NOT_READY / READY_FOR_BILLING → torna NOT_READY (no-op se già)
   *   - Da SENT / PENDING → billingStatus = NOT_READY + publish
   *     `treatment.cancelled` ad accounting (accounting cancella billable).
   *     Il treatment può essere RI-inviato. Non è più terminale.
   *   - Da INVOICED+ → BadRequestException (serve nota credito da accounting)
   *
   * Pre-sessione 7 portava a `CANCELLED` terminale, ora invece torna a
   * NOT_READY così l'operatore può modificare e re-inviare. L'enum
   * `CANCELLED` resta usato SOLO per:
   *   - record storici già in DB (backward compat)
   *   - rollback race condition `billable.cancellation-rejected` (verso INVOICED)
   *
   * Per "cestinare definitivamente" un trattamento c'è la mutation generica
   * `deleteTreatment` (soft-delete TypeORM): semantica completamente diversa.
   */
  async cancelTreatment(
    id: string,
    cancelledByUserId: string,
    reason: string,
  ): Promise<Treatment> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentRepo = manager.getRepository(Treatment);
      const treatment = await treatmentRepo.findOne({ where: { id } });
      if (!treatment) {
        throw new NotFoundException(`Trattamento ${id} non trovato`);
      }

      // Vincolo billingStatus: stati post-INVOICED bloccati (richiede NC).
      const cancellable = [
        TreatmentBillingStatus.NOT_READY,
        TreatmentBillingStatus.READY_FOR_BILLING,
        TreatmentBillingStatus.SENT,
        TreatmentBillingStatus.PENDING,
      ];
      if (!cancellable.includes(treatment.billingStatus)) {
        throw new BadRequestException(
          `Trattamento già fatturato (billingStatus=${treatment.billingStatus}). ` +
            `Per modificarlo o cancellarlo contatta l'amministrazione: serve emettere una nota di credito.`,
        );
      }

      await this.applyAutoRecall(manager, treatment, {
        cancelledByUserId,
        reason,
        tenantAlias,
        correlationId,
      });

      return treatment;
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    // SSE: notifica UI aperte del cambio billingStatus (cancel → NOT_READY).
    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: result.id,
      operatorId: result.operatorId,
      newStatus: result.billingStatus,
      timestamp: new Date(),
    });
    // Re-fetch con relations per il return GraphQL (vedi nota su
    // requireFullTreatment in requestTreatmentRecall).
    return this.requireFullTreatment(result.id);
  }

  /**
   * Logica condivisa di "recupero da fatturazione" (auto-recall): riporta il
   * treatment a NOT_READY, azzera lo snapshot accounting e — se il treatment
   * era già stato pubblicato (SENT/PENDING) — accoda l'evento
   * `treatment.cancelled` così accounting cancella il billable corrispondente.
   *
   * Usata sia da `cancelTreatment` (annulla invio manuale) sia da
   * `updateBySecretary` quando l'operatore abilita lo sconto FE su un treatment
   * già inviato (auto-recall). Il chiamante è responsabile dei vincoli di stato
   * a monte (cancelTreatment blocca INVOICED+, updateBySecretary idem) e del
   * flush/SSE post-commit.
   *
   * NB: l'`add()` al buffer va fatto DENTRO la transazione del chiamante; il
   * flush avviene dopo il commit. Va invocata all'interno di
   * `dataSource.transaction(...)` con il `manager` relativo.
   */
  private async applyAutoRecall(
    manager: EntityManager,
    treatment: Treatment,
    params: {
      cancelledByUserId: string;
      reason: string;
      tenantAlias: string | null | undefined;
      correlationId: string | undefined;
    },
  ): Promise<void> {
    // Decisione publish: SOLO se accounting già conosce il treatment.
    const shouldPublish =
      treatment.billingStatus === TreatmentBillingStatus.SENT ||
      treatment.billingStatus === TreatmentBillingStatus.PENDING;

    const now = new Date();
    // Sessione 7: torna a NOT_READY (riemibile) invece di CANCELLED.
    treatment.billingStatus = TreatmentBillingStatus.NOT_READY;
    // Coerenza con reopen(): l'annullo dell'invio smarca anche "pronto per
    // fatturazione" (altrimenti la CTA "Invia" e i filtri lista vedrebbero
    // ancora il treatment come pronto/inviato).
    treatment.readyForBilling = false;
    treatment.readyForBillingAt = null as any;
    // Audit dell'annullamento (campi mantenuti per storia: chi/quando/perché).
    treatment.cancelledAt = now;
    treatment.cancelledByUserId = params.cancelledByUserId;
    treatment.cancellationReason = params.reason;
    // Pulisco snapshot accounting così il treatment torna "fresco" per
    // un nuovo invio (eventuali billable.invoiced "vecchi" per il billable
    // appena cancellato vengono filtrati dall'anti-stale check su
    // accountingBillableEventId in handleBillableInvoiced).
    treatment.accountingBillableEventId = null as any;
    treatment.accountingDocumentId = null as any;
    treatment.accountingInvoiceUrl = null as any;
    treatment.accountingInvoiceIssuedAt = null as any;
    treatment.accountingDocumentType = null as any;
    treatment.patientInvoiceNumber = null as any;
    treatment.isInvoicedToPatient = false;
    treatment.invoicedToPatientAt = null as any;
    // Il documento (se esisteva) viene cancellato da accounting: i totali che
    // ne derivavano sono stale (stesso invariante dei reset nel consumer).
    treatment.accountingTotalAmount = null as any;
    treatment.accountingTreatmentLinesAmount = null as any;
    treatment.accountingDocumentTreatmentCount = null as any;
    await manager.getRepository(Treatment).save(treatment);

    if (shouldPublish) {
      if (!params.tenantAlias) {
        throw new Error(
          'applyAutoRecall chiamato fuori da contesto tenant. Wrappare in TenantContextService.run + eventBuffer.runInScope.',
        );
      }
      // Risolvo il keycloakSub del cancelledBy (consistente con altri payload).
      const subMap = await this.batchLookupKeycloakSubsForCancel(
        manager,
        [params.cancelledByUserId],
      );
      const cancelledByKeycloakSub = subMap.get(params.cancelledByUserId) ?? null;

      this.eventBuffer.add({
        eventType: 'treatment.cancelled',
        payload: {
          treatmentId: treatment.id,
          cancelledAt: now.toISOString(),
          cancelledByUserId: cancelledByKeycloakSub,
          reason: params.reason,
        },
        tenantAlias: params.tenantAlias,
        correlationId: params.correlationId,
      });
    }
  }

  /**
   * Riapre un trattamento precedentemente annullato (cascata appuntamento):
   * azzera i campi di cancellazione e lo riporta IN_PROGRESS. Usato nel caso
   * "ritardatario": l'appuntamento era passato a NO_SHOW (annullando il
   * trattamento), poi il paziente arriva e viene rimesso ATTENDED.
   *
   * Idempotente sul piano logico: se il trattamento non è annullato, lo lascia
   * invariato. Non tocca la fatturazione oltre a riportare lo snapshot a
   * "fresco" (è già NOT_READY dopo il cancel). Pensato per essere chiamato dal
   * TreatmentCascadeService, dentro un contesto tenant + eventBuffer scope.
   */
  async reopenCancelledTreatment(id: string): Promise<Treatment> {
    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentRepo = manager.getRepository(Treatment);
      const treatment = await treatmentRepo.findOne({ where: { id } });
      if (!treatment) {
        throw new NotFoundException(`Trattamento ${id} non trovato`);
      }

      // Se non è annullato non facciamo nulla (evita di "riaprire" trattamenti
      // chiusi/fatturati legittimamente).
      if (!treatment.cancelledAt) {
        return treatment;
      }

      treatment.cancelledAt = null as any;
      treatment.cancelledByUserId = null as any;
      treatment.cancellationReason = null as any;
      treatment.status = TreatmentStatus.IN_PROGRESS;
      treatment.billingStatus = TreatmentBillingStatus.NOT_READY;
      await treatmentRepo.save(treatment);
      return treatment;
    });

    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: result.id,
      operatorId: result.operatorId,
      newStatus: result.billingStatus,
      timestamp: new Date(),
    });
    return this.requireFullTreatment(result.id);
  }

  /**
   * Sessione 7 — Richiede ad accounting di "richiamare indietro" un treatment
   * già inviato a fatturazione, per consentire all'operatore di modificarlo.
   *
   * Vincoli:
   *  - billingStatus IN (SENT, PENDING, INVOICED) → OK. Altri stati: 400.
   *  - recallRequestId già valorizzato (recall in volo) → 409 Conflict.
   *
   * Effetto immediato:
   *  - genera UUID per `recallRequestId` (= eventId dell'envelope, accounting
   *    lo riceve come `requestId` e lo eccheggia nella response)
   *  - salva `recallRequestId` + `recallRequestedAt`
   *  - billingStatus NON cambia (resta SENT/PENDING/INVOICED) — la transition
   *    a NOT_READY avviene solo all'arrivo di `billable.recall-accepted`
   *  - pubblica `treatment.recall-requested.<tenant>` (publish-after-commit)
   *
   * Cleanup: se non arriva risposta entro `RECALL_REQUEST_TIMEOUT_MS`, lo
   * scheduler `recall-cleanup.job` azzera recallRequestId/At (utente può
   * ritentare). Vedi `recall-cleanup.job.ts`.
   */
  async requestTreatmentRecall(id: string, reason?: string): Promise<Treatment> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const recallEventId = randomUUID();

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentRepo = manager.getRepository(Treatment);
      const treatment = await treatmentRepo.findOne({ where: { id } });
      if (!treatment) {
        throw new NotFoundException(`Trattamento ${id} non trovato`);
      }

      const recallable = [
        TreatmentBillingStatus.SENT,
        TreatmentBillingStatus.PENDING,
        TreatmentBillingStatus.INVOICED,
      ];
      if (!recallable.includes(treatment.billingStatus)) {
        throw new BadRequestException(
          `Trattamento ${id} non richiamabile (billingStatus=${treatment.billingStatus}). ` +
            `Richiamabili solo SENT, PENDING, INVOICED.`,
        );
      }

      if (treatment.recallRequestId) {
        throw new ConflictException(
          `Trattamento ${id} ha già un recall in volo (recallRequestId=${treatment.recallRequestId}). ` +
            `Aspetta la risposta da accounting o lo scadere del timeout.`,
        );
      }

      treatment.recallRequestId = recallEventId;
      treatment.recallRequestedAt = new Date();
      // Pulisco una eventuale rejection precedente (UX: nuovo tentativo →
      // nessun banner stale "richiamo rifiutato" che si sovrapponga).
      treatment.lastRecallRejectionMessage = undefined;
      treatment.lastRecallRejectionAt = undefined;
      await treatmentRepo.save(treatment);

      if (!tenantAlias) {
        throw new Error(
          'requestTreatmentRecall chiamato fuori da contesto tenant. Wrappare in TenantContextService.run + eventBuffer.runInScope.',
        );
      }

      this.eventBuffer.add({
        eventType: 'treatment.recall-requested',
        // eventId forzato → coincide con recallRequestId salvato sul treatment.
        // Accounting deriva `requestId` dall'envelope.eventId (vedi
        // accounting/clinical-event.consumer.ts case 'treatment.recall-requested').
        eventId: recallEventId,
        payload: {
          treatmentId: id,
          reason,
        },
        tenantAlias,
        correlationId,
      });

      return treatment;
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    // SSE: notifica UI dello stato recall in volo (recallRequestId valorizzato).
    // Il billingStatus NON cambia (aspetta response accounting), ma serve
    // notificare il frontend per mostrare subito lo spinner "Richiamo in corso".
    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: result.id,
      operatorId: result.operatorId,
      newStatus: result.billingStatus,
      timestamp: new Date(),
    });
    // Re-fetch con relations (operator/patient/appointment/services/...)
    // per il return GraphQL: il TreatmentDetails fragment del frontend
    // legge `operator` non-nullable + altri sotto-campi, e il `treatment`
    // della transazione qui sopra ha solo le colonne dirette.
    return this.requireFullTreatment(result.id);
  }

  /**
   * 2026-06-30 — "Verifica risoluzione e riprova". L'operatore ha risolto la
   * causa che bloccava l'emissione fattura (es. ha aggiunto l'indirizzo del
   * paziente nel registry) e chiede ad accounting di ri-tentare l'auto-issue.
   *
   * Pubblica `treatment.retry-invoice-requested.<tenant>` (publish-after-commit)
   * → consumer accounting → ri-chiama AutoIssue. Se la causa è risolta, arriva
   * `billable.invoiced` (e il banner sparisce); altrimenti riarriva
   * `billable.invoice-blocked` col motivo aggiornato.
   *
   * Pulisce ottimisticamente `billingHoldReason*`: se il blocco persiste, il
   * nuovo `billable.invoice-blocked` lo ri-popola; se si risolve,
   * `billable.invoiced` lo lascia pulito. Lo stato `billingStatus` NON cambia
   * (resta PENDING finché accounting non emette).
   *
   * Idempotente: ri-cliccare pubblica un nuovo evento, ma AutoIssue è
   * idempotente (se la fattura è già emessa, esce subito senza duplicare).
   */
  async retryTreatmentInvoice(id: string): Promise<Treatment> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentRepo = manager.getRepository(Treatment);
      const treatment = await treatmentRepo.findOne({ where: { id } });
      if (!treatment) {
        throw new NotFoundException(`Trattamento ${id} non trovato`);
      }

      // Ritentabile solo se inviato ad accounting ma non ancora fatturato.
      const retryable = [
        TreatmentBillingStatus.SENT,
        TreatmentBillingStatus.PENDING,
      ];
      if (!retryable.includes(treatment.billingStatus)) {
        throw new BadRequestException(
          `Trattamento ${id} non ritentabile (billingStatus=${treatment.billingStatus}). ` +
            `Ritentabili solo trattamenti inviati e non ancora fatturati (SENT/PENDING).`,
        );
      }
      if (treatment.scontoFE) {
        throw new BadRequestException(
          `Trattamento ${id} ha sconto FE: non passa da accounting.`,
        );
      }

      // Pulizia ottimistica del motivo di blocco: verrà ri-popolato dal nuovo
      // billable.invoice-blocked se il problema persiste.
      treatment.billingHoldReason = undefined;
      treatment.billingHoldReasonCode = undefined;
      treatment.billingHoldReasonAt = undefined;
      await treatmentRepo.save(treatment);

      if (!tenantAlias) {
        throw new Error(
          'retryTreatmentInvoice chiamato fuori da contesto tenant. Wrappare in TenantContextService.run + eventBuffer.runInScope.',
        );
      }

      this.eventBuffer.add({
        eventType: 'treatment.retry-invoice-requested',
        payload: { treatmentId: id },
        tenantAlias,
        correlationId,
      });

      return treatment;
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: result.id,
      operatorId: result.operatorId,
      newStatus: result.billingStatus,
      timestamp: new Date(),
    });
    return this.requireFullTreatment(result.id);
  }

  /**
   * Sessione 7 — Chiude il banner "Restituito dall'amministrazione"
   * (one-way da `billable.returned-to-clinical`). Setta
   * `returnedFromAccountingDismissedAt = NOW`. Nessun evento pubblicato:
   * la dismiss è puramente UI-local.
   */
  async dismissReturnFromAccountingBanner(id: string): Promise<Treatment> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentRepo = manager.getRepository(Treatment);
      const treatment = await treatmentRepo.findOne({ where: { id } });
      if (!treatment) {
        throw new NotFoundException(`Trattamento ${id} non trovato`);
      }
      if (!treatment.returnedFromAccountingAt) {
        throw new BadRequestException(
          `Trattamento ${id} non ha un banner di restituzione attivo.`,
        );
      }
      treatment.returnedFromAccountingDismissedAt = new Date();
      await treatmentRepo.save(treatment);
    });
    const fresh = await this.requireFullTreatment(id);
    // SSE: notifica UI per nascondere il banner "Restituito da amministrazione".
    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: fresh.id,
      operatorId: fresh.operatorId,
      newStatus: fresh.billingStatus,
      timestamp: new Date(),
    });
    return fresh;
  }

  /**
   * Helper: rilegge un Treatment con tutte le relations necessarie al
   * TreatmentDetails fragment GraphQL (operator, patient, appointment,
   * services, instruments). Usato dai metodi che fanno UPDATE in
   * transazione e devono ritornare l'entità completa al resolver
   * (altrimenti GraphQL fallisce con "Cannot return null for
   * non-nullable field Treatment.operator").
   */
  private async requireFullTreatment(id: string): Promise<Treatment> {
    const full = await this.findById(id);
    if (!full) {
      throw new NotFoundException(`Trattamento ${id} non trovato dopo update`);
    }
    return full;
  }

  /**
   * Helper batch lookup AppUser.id → keycloakId limitato a un solo id.
   * Estratto qui per evitare di caricare il TreatmentEventMapper completo
   * solo per `cancelTreatment` (che ha payload minimale, niente lines).
   */
  private async batchLookupKeycloakSubsForCancel(
    manager: EntityManager,
    appUserIds: string[],
  ): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (appUserIds.length === 0) return map;
    const rows = await manager.find(AppUser, {
      where: { id: In(appUserIds) },
      select: { id: true, keycloakId: true },
    });
    for (const u of rows) map.set(u.id, u.keycloakId ?? null);
    for (const id of appUserIds) {
      if (!map.has(id)) map.set(id, null);
    }
    return map;
  }

  // ==================== BILLING ALERT (sessione 6 Step 6.7) ====================

  /**
   * Dismissa il billing alert di un treatment (es. dopo che l'operatore
   * ha letto un `cancellation-rejected` warning). Setta
   * `billingAlertDismissedAt = now`. NON cancella il messaggio dell'alert
   * — resta in DB per audit, solo il timestamp di dismissal cambia.
   *
   * Idempotente: se l'alert è già dismissato (o non c'è), no-op (return
   * treatment senza modifiche). Niente throw — UI può chiamare safe.
   */
  async dismissBillingAlert(id: string): Promise<Treatment> {
    const treatment = await this.findById(id);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }

    // Idempotenza: se non c'è alert da dismissare, ritorna il treatment
    // così com'è (no UPDATE inutile).
    if (!treatment.billingAlertMessage || treatment.billingAlertDismissedAt) {
      return treatment;
    }

    treatment.billingAlertDismissedAt = new Date();
    return this.treatmentRepo.save(treatment);
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
  /**
   * Marca un batch di trattamenti come "pronto per fatturazione" e (se
   * `ready=true`) pubblica `treatment.closed.<tenant>` per ognuno verso
   * il modulo accounting tramite `ex.clinical.events`.
   *
   * Transition billingStatus (sessione 6):
   *   ready=true   → READY_FOR_BILLING → SENT (con publish)
   *   ready=false  → consentito SOLO se billingStatus IN
   *                  (NOT_READY, READY_FOR_BILLING). Per stati post-publish
   *                  (SENT, PENDING, INVOICED, ...) lanciamo error: rimuovere
   *                  il flag dopo il publish significherebbe "annullare un
   *                  evento già pubblicato" (use case sbagliato — quello giusto
   *                  è cancelTreatment, non setReady=false).
   *
   * Pattern publish-after-commit:
   *   1. Tutta la mutazione DB (update treatments) avviene dentro la tx.
   *   2. Dentro la tx: enqueue evento nel ClinicalEventBuffer (ALS).
   *   3. Solo dopo che la transaction ritorna OK: `flushBufferedEvents()`
   *      emette su EventEmitter2 → @OnEvent listener nel publisher → publish
   *      reale al broker. Se la tx fa rollback, gli eventi restano nel
   *      buffer ALS e vengono droppati alla fine della request HTTP.
   */
  async setReadyForBilling(
    ids: string[],
    ready: boolean,
    /**
     * Se true (e ready=true), il payload `treatment.closed.<tenant>` viene
     * emesso con `requestImmediateInvoice=true`. Lato accounting, se il
     * mapping è fiscalmente configurato, AutoIssue scatta automaticamente
     * → INVOICE emessa entro pochi secondi senza intervento manuale.
     * Se il mapping è pending, AutoIssue skippa ed entra in coda finché
     * l'admin non configura il mapping (LOCAL_BILLABLE_MAPPING_COMPLETED
     * triggera AutoIssue retroattivo).
     *
     * Default false: chi chiama il batch standard (lista trattamenti
     * "Pronto per fatturazione") NON triggera AutoIssue automatico —
     * la fatturazione resta su passo separato dell'operatore accounting.
     * Il valore true è UX dell'azione "Fattura subito + incassa".
     *
     * Ignorato se ready=false (no payload emesso).
     */
    immediateInvoice = false,
  ): Promise<Treatment[]> {
    if (ids.length === 0) return [];

    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const updated = await this.dataSource.transaction(async (manager: EntityManager) => {
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
          // ANTI-INVIO-A-VUOTO: un treatment senza righe fatturabili (0 servizi
          // E 0 righe custom) produrrebbe un `treatment.closed` con `lines: []`,
          // che lato accounting non crea alcun billable → il treatment resterebbe
          // bloccato in SENT all'infinito. Lo blocchiamo a monte.
          const svcCount = await manager.getRepository(TreatmentServiceEntity).count({
            where: { treatmentId: t.id },
          });
          const customCount = await manager.getRepository(TreatmentInvoiceLine).count({
            where: { treatmentId: t.id },
          });
          if (svcCount === 0 && customCount === 0) {
            throw new BadRequestException(
              `Trattamento ${t.id} non ha righe fatturabili (nessun servizio né riga personalizzata): ` +
                `non può essere inviato a fatturazione. Aggiungi almeno una riga.`,
            );
          }
        }
      } else {
        // ready=false: vincolo billingStatus per evitare di "annullare" un
        // evento già pubblicato (quel caso d'uso è cancelTreatment, non setReady=false).
        const allowedToUnset = [
          TreatmentBillingStatus.NOT_READY,
          TreatmentBillingStatus.READY_FOR_BILLING,
        ];
        for (const t of treatments) {
          if (!allowedToUnset.includes(t.billingStatus)) {
            throw new BadRequestException(
              `Trattamento ${t.id} è già stato pubblicato verso accounting (billingStatus=${t.billingStatus}). ` +
                `Per annullarlo usa cancelTreatment (se PENDING) o emetti nota di credito da accounting.`,
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
          // Chiusura normale: sovrascrive eventuale flag residuo (vedi close()).
          t.forcedClosure = false;
        }
        t.readyForBilling = ready;
        t.readyForBillingAt = ready ? now : (null as any);

        if (ready) {
          // Transition billingStatus → SENT. Idempotente: se già SENT/PENDING/...
          // non regrediamo lo stato (es. operatore clicca "ready" su qualcosa
          // di già publishato — DB invariato, ma niente re-publish).
          if (
            t.billingStatus === TreatmentBillingStatus.NOT_READY ||
            t.billingStatus === TreatmentBillingStatus.READY_FOR_BILLING
          ) {
            t.billingStatus = TreatmentBillingStatus.SENT;
          }
        } else {
          // Unset: torna a NOT_READY. (Vincoli sopra hanno escluso stati post-publish.)
          t.billingStatus = TreatmentBillingStatus.NOT_READY;
        }
      }

      await treatmentRepo.save(treatments);

      // Enqueue payload solo per i treatment che effettivamente sono
      // transitati a SENT in questa run (skippa quelli già SENT/PENDING).
      if (ready && tenantAlias) {
        for (const t of treatments) {
          if (t.billingStatus !== TreatmentBillingStatus.SENT) continue;
          const payload = await this.treatmentEventMapper.mapTreatmentClosed(
            t.id,
            manager,
            { requestImmediateInvoice: immediateInvoice },
          );
          this.eventBuffer.add({
            eventType: 'treatment.closed',
            payload,
            tenantAlias,
            correlationId,
          });
        }
      } else if (ready && !tenantAlias) {
        // Sicurezza: se chiamato fuori dal contesto HTTP (es. cron senza
        // runInScope) il tenantAlias è null. NON pubblichiamo (mancherebbe
        // anche lo scope ALS del buffer): meglio fail rumoroso.
        throw new Error(
          'setReadyForBilling chiamato fuori da contesto tenant (tenantAlias mancante). ' +
            'Per chiamate non-HTTP, wrappare in TenantContextService.run(...) + eventBuffer.runInScope(...).',
        );
      }

      return treatments;
    });

    // Flush DOPO commit OK. Se la tx ha throw, questa riga non viene
    // raggiunta e il buffer ALS resta con gli eventi (mai pubblicati).
    flushBufferedEvents(this.eventBuffer, this.eventEmitter);

    return updated;
  }

  /**
   * Sessione 7 — Forza re-invio di un treatment ad accounting.
   *
   * Use case: il treatment è in `SENT` da minuti senza che accounting lo
   * passi a `PENDING` (= `billable.received` mai arrivato). Tipicamente
   * succede dopo incident accounting (Vault rotation, DB-pool esaurito,
   * registry 401 propagato come errore permanente → DLQ) e il messaggio
   * originale è perso.
   *
   * Vincoli:
   *  - billingStatus DEVE essere SENT. Altri stati: 400 (non c'è nulla da
   *    re-inviare se NOT_READY/READY_FOR_BILLING; se PENDING+ accounting
   *    sta già processando).
   *  - readyForBillingAt DEVE essere > 5 min fa (smart guard: niente
   *    re-invio finché l'invio originale ha ancora chance di essere
   *    processato normalmente).
   *
   * Effetto: ripubblica `treatment.closed.<tenant>` con un nuovo eventId.
   * Lato accounting, il fix idempotency (createFromClinicalEvent ignora
   * billable in stato CANCELLED + check sourceOperationalSnapshotId)
   * garantisce che:
   *  - se nessun billable esisteva → ne viene creato uno (caso happy)
   *  - se esisteva già un PENDING → no-op idempotente (caso edge)
   *
   * Aggiorna `readyForBillingAt = NOW` come segnale "ho appena ri-inviato",
   * così il warning UI sparisce e non scatta subito un altro forza-re-invio.
   */
  async resendTreatmentToAccounting(id: string): Promise<Treatment> {
    const RESEND_GUARD_MINUTES = 5;
    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      const treatmentRepo = manager.getRepository(Treatment);
      const treatment = await treatmentRepo.findOne({ where: { id } });
      if (!treatment) {
        throw new NotFoundException(`Trattamento ${id} non trovato`);
      }

      if (treatment.billingStatus !== TreatmentBillingStatus.SENT) {
        throw new BadRequestException(
          `Trattamento ${id} non re-inviabile (billingStatus=${treatment.billingStatus}). ` +
            `Re-invio disponibile solo per trattamenti in stato "Inviato ad accounting" ` +
            `che non hanno ricevuto conferma.`,
        );
      }

      // Smart guard: l'utente deve aver atteso almeno 5 minuti dall'invio
      // originale. Evita re-invii inutili (accounting normalmente risponde
      // in <1s) e protegge da doppio-click impaziente.
      const sentAt = treatment.readyForBillingAt;
      if (sentAt) {
        const elapsedMs = Date.now() - sentAt.getTime();
        const guardMs = RESEND_GUARD_MINUTES * 60 * 1000;
        if (elapsedMs < guardMs) {
          const waitSec = Math.ceil((guardMs - elapsedMs) / 1000);
          throw new BadRequestException(
            `Re-invio non ancora disponibile. Attendi ancora ~${Math.ceil(waitSec / 60)} minuti ` +
              `(accounting potrebbe rispondere a breve all'invio originale).`,
          );
        }
      }

      if (!tenantAlias) {
        throw new Error(
          'resendTreatmentToAccounting chiamato fuori da contesto tenant.',
        );
      }

      // Marca il nuovo invio così il warning UI sparisce.
      treatment.readyForBillingAt = new Date();
      await treatmentRepo.save(treatment);

      // Ricostruisci e bufferizza payload (publish-after-commit).
      const payload = await this.treatmentEventMapper.mapTreatmentClosed(
        treatment.id,
        manager,
        { requestImmediateInvoice: false },
      );
      this.eventBuffer.add({
        eventType: 'treatment.closed',
        payload,
        tenantAlias,
        correlationId,
      });

      return treatment;
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    // SSE: notifica UI per aggiornare readyForBillingAt (timer warning UI
    // riparte da zero post-resend).
    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: result.id,
      operatorId: result.operatorId,
      newStatus: result.billingStatus,
      timestamp: new Date(),
    });
    return this.requireFullTreatment(result.id);
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
    // 2026-07-02 — Trattamento chiuso dalla segreteria: niente nuove righe.
    if (treatment.status === TreatmentStatus.CLOSED) {
      throw new BadRequestException(
        'Trattamento chiuso dalla segreteria: riaprirlo per aggiungere righe.'
      );
    }
    const line = this.treatmentInvoiceLineRepo.create({
      treatmentId: input.treatmentId,
      description: input.description,
      amount: input.amount,
      createdBy: input.createdBy,
    });
    const saved = await this.treatmentInvoiceLineRepo.save(line);
    await this.dataSource.transaction((m) =>
      this.recomputeTreatmentTotal(m, input.treatmentId),
    );
    return saved;
  }

  /**
   * 2026-07-02 — Aggiunge una riga collegata a un SERVIZIO del catalogo (NON
   * testo libero: accounting deve poter associare la natura IVA via serviceCode).
   * Descrizione e prezzo sono opzionalmente sovrascrivibili:
   *  - prezzo assente → tariffa del servizio (discountFE se scontoFE, altrimenti
   *    defaultPrice);
   *  - prezzo presente → prezzo custom (isCustomPrice=true, non ricalcolato dal
   *    toggle scontoFE).
   * Vietato su trattamento chiuso dalla segreteria o già fatturato.
   */
  async addTreatmentServiceLine(
    input: {
      treatmentId: string;
      serviceId: string;
      description?: string;
      price?: number;
      /**
       * 2026-07-15 — Operatore esecutore esplicito della riga ("Eseguito
       * da"). Assente/null = la riga è dell'operatore del trattamento.
       * NON viene più stampato l'utente loggato: attribuiva i compensi a
       * chi inseriva la riga (segreteria/admin) invece che all'operatore.
       */
      executorOperatorId?: string | null;
    },
  ): Promise<Treatment> {
    const treatment = await this.findById(input.treatmentId);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${input.treatmentId} non trovato`);
    }
    if (treatment.isInvoicedToPatient) {
      throw new BadRequestException(
        'Il trattamento è già fatturato: non si possono aggiungere righe.',
      );
    }
    if (treatment.status === TreatmentStatus.CLOSED) {
      throw new BadRequestException(
        'Trattamento chiuso dalla segreteria: riaprirlo per aggiungere righe.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const tsRepo = manager.getRepository(TreatmentServiceEntity);
      const service = await manager
        .getRepository(Service)
        .findOne({ where: { id: input.serviceId } });
      if (!service) {
        throw new BadRequestException(`Servizio ${input.serviceId} non trovato`);
      }

      let price: number;
      let isCustomPrice = false;
      if (input.price !== undefined && input.price !== null) {
        price = Number(input.price);
        isCustomPrice = true;
      } else {
        price =
          treatment.scontoFE && service.discountFE
            ? Number(service.discountFE)
            : Number(service.defaultPrice ?? 0);
      }

      // Esecutore esplicito: deve essere un operatore esistente e non
      // archiviato. Se coincide con l'operatore del trattamento lo
      // normalizziamo a NULL (fallback implicito, nessun override).
      let executorOperatorId: string | null = null;
      if (input.executorOperatorId) {
        const executor = await manager
          .getRepository(Operator)
          .findOne({ where: { id: input.executorOperatorId } });
        if (!executor) {
          throw new BadRequestException(
            `Operatore esecutore ${input.executorOperatorId} non trovato o archiviato`,
          );
        }
        executorOperatorId =
          executor.id === treatment.operatorId ? null : executor.id;
      }

      const existing = await tsRepo.find({ where: { treatmentId: input.treatmentId } });
      const maxOrder = existing.reduce(
        (m, r) => Math.max(m, r.orderPosition ?? 0),
        -1,
      );

      const row = tsRepo.create({
        treatmentId: input.treatmentId,
        serviceId: input.serviceId,
        price,
        isCustomPrice,
        invoiceLineDescription: input.description?.trim() || (null as any),
        orderPosition: maxOrder + 1,
        executorOperatorId: executorOperatorId as any,
      });
      await tsRepo.save(row);

      await this.recomputeTreatmentTotal(manager, input.treatmentId);
    });

    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: treatment.id,
      operatorId: treatment.operatorId,
      newStatus: treatment.billingStatus,
      timestamp: new Date(),
    });
    return this.requireFullTreatment(input.treatmentId);
  }

  /**
   * 2026-07-02 — Rimuove una riga servizio del trattamento e ricalcola il
   * totale. Vietato su trattamento chiuso dalla segreteria o già fatturato.
   */
  async removeTreatmentServiceLine(treatmentServiceId: string): Promise<Treatment> {
    const row = await this.treatmentServiceRepo.findOne({
      where: { id: treatmentServiceId },
    });
    if (!row) {
      throw new NotFoundException(`Riga servizio ${treatmentServiceId} non trovata`);
    }
    const treatment = await this.findById(row.treatmentId);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${row.treatmentId} non trovato`);
    }
    if (treatment.isInvoicedToPatient) {
      throw new BadRequestException(
        'Il trattamento è già fatturato: le righe non sono modificabili.',
      );
    }
    if (treatment.status === TreatmentStatus.CLOSED) {
      throw new BadRequestException(
        'Trattamento chiuso dalla segreteria: riaprirlo per modificare le righe.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(TreatmentServiceEntity)
        .delete({ id: treatmentServiceId });
      await this.recomputeTreatmentTotal(manager, row.treatmentId);
    });

    this.eventsService.emit({
      type: 'treatment_status_changed',
      treatmentId: treatment.id,
      operatorId: treatment.operatorId,
      newStatus: treatment.billingStatus,
      timestamp: new Date(),
    });
    return this.requireFullTreatment(row.treatmentId);
  }

  /**
   * 2026-07-15 — Cambia l'operatore esecutore di una riga servizio
   * ("Eseguito da"). `executorOperatorId` null = torna al fallback
   * sull'operatore del trattamento. Vietato su trattamento chiuso dalla
   * segreteria o già fatturato (stesse guardie di add/remove riga).
   */
  async updateTreatmentServiceExecutor(
    treatmentServiceId: string,
    executorOperatorId: string | null,
  ): Promise<TreatmentServiceEntity> {
    const row = await this.treatmentServiceRepo.findOne({
      where: { id: treatmentServiceId },
    });
    if (!row) {
      throw new NotFoundException(`Riga servizio ${treatmentServiceId} non trovata`);
    }
    const treatment = await this.findById(row.treatmentId);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${row.treatmentId} non trovato`);
    }
    if (treatment.isInvoicedToPatient) {
      throw new BadRequestException(
        'Il trattamento è già fatturato: le righe non sono modificabili.',
      );
    }
    if (treatment.status === TreatmentStatus.CLOSED) {
      throw new BadRequestException(
        'Trattamento chiuso dalla segreteria: riaprirlo per modificare le righe.',
      );
    }

    let normalized: string | null = null;
    if (executorOperatorId) {
      const executor = await this.dataSource
        .getRepository(Operator)
        .findOne({ where: { id: executorOperatorId } });
      if (!executor) {
        throw new BadRequestException(
          `Operatore esecutore ${executorOperatorId} non trovato o archiviato`,
        );
      }
      normalized = executor.id === treatment.operatorId ? null : executor.id;
    }

    await this.treatmentServiceRepo.update(treatmentServiceId, {
      executorOperatorId: normalized as any,
    });
    return this.treatmentServiceRepo.findOneOrFail({
      where: { id: treatmentServiceId },
      relations: { service: true, executorOperator: true },
    });
  }

  /**
   * 2026-07-02 — Ricalcola `treatment.price` come somma delle righe servizio +
   * righe custom (legacy). Chiamato dopo add/remove riga.
   */
  private async recomputeTreatmentTotal(
    manager: EntityManager,
    treatmentId: string,
  ): Promise<void> {
    const services = await manager
      .getRepository(TreatmentServiceEntity)
      .find({ where: { treatmentId } });
    const customLines = await manager
      .getRepository(TreatmentInvoiceLine)
      .find({ where: { treatmentId } });
    const total =
      services.reduce((s, r) => s + Number(r.price ?? 0), 0) +
      customLines.reduce((s, l) => s + Number(l.amount ?? 0), 0);
    await manager.getRepository(Treatment).update(treatmentId, { price: total });
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
  async findForListing(filters: TreatmentListingFilters): Promise<Treatment[]> {
    const qb = this.treatmentRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.operator', 'operator')
      .leftJoinAndSelect('t.appointment', 'appointment')
      .leftJoinAndSelect('t.treatmentServices', 'ts')
      .leftJoinAndSelect('ts.service', 'service')
      .leftJoinAndSelect('t.instruments', 'ti')
      .leftJoinAndSelect('ti.instrument', 'instrument')
      .leftJoinAndSelect('t.invoiceLines', 'invoiceLines');

    this.applyListingFilters(qb, filters);

    qb.orderBy('t.startedAt', 'DESC');

    if (filters.limit) qb.take(filters.limit);
    if (filters.offset) qb.skip(filters.offset);

    return qb.getMany();
  }

  /**
   * Conteggio totale per la paginazione della lista: stessi filtri di
   * findForListing ma senza join né limit/offset.
   */
  async countForListing(filters: TreatmentListingFilters): Promise<number> {
    const qb = this.treatmentRepo.createQueryBuilder('t');
    this.applyListingFilters(qb, filters);
    return qb.getCount();
  }

  private applyListingFilters(
    qb: SelectQueryBuilder<Treatment>,
    filters: TreatmentListingFilters,
  ): void {
    if (filters.operatorId) {
      qb.andWhere('t.operatorId = :operatorId', { operatorId: filters.operatorId });
    }
    if (filters.patientId) {
      qb.andWhere('t.patientId = :patientId', { patientId: filters.patientId });
    }
    if (filters.statuses && filters.statuses.length > 0) {
      qb.andWhere('t.status IN (:...statuses)', { statuses: filters.statuses });
    }
    // Confronto per GIORNO (non per timestamp): cosi' un singolo giorno
    // (dateFrom === dateTo) include tutti i trattamenti di quel giorno.
    // Con 'startedAt <= dateTo' (mezzanotte) si escludevano gli orari del
    // giorno stesso → la lista risultava vuota se non si allargava il range.
    if (filters.dateFrom) {
      qb.andWhere('DATE(t.startedAt) >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('DATE(t.startedAt) <= :dateTo', { dateTo: filters.dateTo });
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
  }
}

export interface TreatmentListingFilters {
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
}
