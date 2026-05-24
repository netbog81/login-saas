import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, forwardRef, Optional, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, Between, LessThanOrEqual, MoreThanOrEqual, DataSource, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AvailabilityAppointment, BookingStatus } from '../entities/availability-appointment.entity';
import { AppointmentInstrument } from '../entities/appointment-instrument.entity';
import { AppointmentService as AppointmentServiceEntity } from '../entities/appointment-service.entity';
import { Instrument } from '../entities/instrument.entity';
import { InstrumentCategory } from '../entities/instrument-category.entity';
import { InstrumentStatus } from '../entities/instrument-status.enum';
import { RecurringType, RecurringEndType, ServiceInputItem } from '../dto/create-availability-appointment.input';
import { GymRoom } from '../entities/gym-room.entity';
import { Site } from '../entities/site.entity';
import { AppointmentType } from '../entities/appointment-type.enum';
import { GymPatternGroupService } from './gym-pattern-group.service';
import { GymExceptionService } from './gym-exception.service';
import { ConflictReason } from '../entities/availability-appointment.entity';
import { CreateGymAppointmentInput } from '../dto/create-gym-appointment.input';
import { ClinicalSubjectIndex } from '../../../patients/entities/clinical-subject-index.entity';
import { ClinicalAttendanceService } from '../../../patients/services/clinical-attendance.service';
import { AttendanceEventType } from '../../../patients/entities/clinical-attendance-log.entity';
import { WhatsappGatewayService, WhatsappPatientContact } from '../../whatsapp/gateway/whatsapp-gateway.service';
import { RegistryClient } from '../../registry/registry.client';
import { RegistrySubjectResponse } from '../../registry/registry.types';
import { TenantSchemaContextService } from '../../../database/tenant-schema-context.service';
import { GeneralSettingsService } from '../../settings/services/general-settings.service';
import { AvailabilityService } from './availability.service';

export interface RepeatConfigInput {
  type: RecurringType;
  interval: number;
  selectedDays?: number[];
  endType: RecurringEndType;
  occurrences?: number;
  untilDate?: string;
}

export interface CreateAppointmentInstrumentInput {
  instrumentCategoryId: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  orderPosition?: number;
}

export interface CreateAvailabilityAppointmentInput {
  operatorId: string;
  /** @deprecated Usa services invece */
  serviceId?: string;
  /** Lista dei servizi da associare all'appuntamento */
  services?: ServiceInputItem[];
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  notes?: string;
  instrumentOrderMatters?: boolean;
  instruments?: CreateAppointmentInstrumentInput[];
  repeatConfig?: RepeatConfigInput;
  nonRetribuito?: boolean;
  forceOutsideAvailability?: boolean;
}

export interface UpdateAvailabilityAppointmentInput {
  /** @deprecated Usa services invece */
  serviceId?: string;
  /** Lista dei servizi da associare all'appuntamento */
  services?: ServiceInputItem[];
  /** Riassegna l'appuntamento a un altro operatore. */
  operatorId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: string;
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  bookingStatus?: BookingStatus;
  cancellationReason?: string;
  operatorNotes?: string;
  instrumentOrderMatters?: boolean;
  instruments?: CreateAppointmentInstrumentInput[];
  nonRetribuito?: boolean;
  forceOutsideAvailability?: boolean;
}

@Injectable()
export class AvailabilityAppointmentService {
  private readonly logger = new Logger(AvailabilityAppointmentService.name);

  constructor(
    @InjectRepository(AvailabilityAppointment)
    private appointmentRepo: Repository<AvailabilityAppointment>,
    @InjectRepository(AppointmentInstrument)
    private appointmentInstrumentRepo: Repository<AppointmentInstrument>,
    @InjectRepository(AppointmentServiceEntity)
    private appointmentServiceRepo: Repository<AppointmentServiceEntity>,
    @InjectRepository(Instrument)
    private instrumentRepo: Repository<Instrument>,
    @InjectRepository(InstrumentCategory)
    private instrumentCategoryRepo: Repository<InstrumentCategory>,
    @InjectRepository(GymRoom)
    private gymRoomRepo: Repository<GymRoom>,
    @InjectRepository(Site)
    private siteRepo: Repository<Site>,
    @InjectRepository(ClinicalSubjectIndex)
    private subjectIndexRepo: Repository<ClinicalSubjectIndex>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => GymPatternGroupService))
    private gymPatternGroupService: GymPatternGroupService,
    @Inject(forwardRef(() => GymExceptionService))
    private gymExceptionService: GymExceptionService,
    private registryClient: RegistryClient,
    private tenantSchemaContext: TenantSchemaContextService,
    private attendanceService: ClinicalAttendanceService,
    private generalSettingsService: GeneralSettingsService,
    @Inject(forwardRef(() => AvailabilityService))
    private availabilityService: AvailabilityService,
    @Optional() @Inject(forwardRef(() => WhatsappGatewayService))
    private whatsappGateway?: WhatsappGatewayService,
  ) {}

  /**
   * Restituisce l'id della sede default attiva del tenant.
   * Usato come fallback per appuntamenti/trattamenti finche' la UI
   * non espone esplicitamente il selettore di sede.
   */
  async resolveDefaultSiteId(manager?: EntityManager): Promise<string> {
    const repo = manager ? manager.getRepository(Site) : this.siteRepo;
    const site = await repo.findOne({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
    if (!site) {
      throw new BadRequestException(
        'Nessuna sede attiva configurata. Contattare l\'amministratore.',
      );
    }
    return site.id;
  }

  /**
   * Verifica se un appointment GYM ricade in uno slot scoperto di un'eccezione
   * attiva (OPERATOR_ABSENT senza sostituto o con "palestra chiusa"). Se sì,
   * setta hasConflict=true e conflictReason. Chiamato dopo create/update.
   *
   * Fire-and-forget: non blocca il flusso, logga solo errori.
   */
  private async checkAndMarkConflictForGymAppointment(
    appointmentId: string,
    gymRoomId: string | undefined | null,
    operatorId: string | undefined | null,
    appointmentDate: Date,
    startTime: string,
  ): Promise<void> {
    if (!gymRoomId || !operatorId) return;

    try {
      const result = await this.gymExceptionService.getEffectiveOperator(
        gymRoomId,
        operatorId,
        appointmentDate,
        startTime,
      );

      if (result.isUncovered) {
        await this.appointmentRepo.update(appointmentId, {
          hasConflict: true,
          conflictReason: ConflictReason.OPERATOR_UNAVAILABLE,
          conflictDetectedAt: new Date(),
        });
        this.logger.warn(
          `Appuntamento ${appointmentId} creato/aggiornato in slot scoperto → hasConflict=true`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Errore check conflitto per appointment ${appointmentId}: ${err?.message}`,
      );
    }
  }

  /**
   * Prefisso del messaggio di errore quando un appuntamento viene rifiutato
   * perche' fuori dalla disponibilita' dell'operatore. Il frontend riconosce
   * questo prefisso per proporre la conferma di forzatura all'utente.
   */
  static readonly OUTSIDE_AVAILABILITY_ERROR =
    'APPOINTMENT_OUTSIDE_AVAILABILITY';

  /**
   * Guard: se l'impostazione "blocca appuntamenti fuori disponibilita'" e'
   * attiva, verifica che l'intervallo [startTime, endTime] sia interamente
   * coperto dalla disponibilita' dell'operatore in quella data.
   *
   * - Salta il controllo se il flag globale e' off, se l'utente ha forzato
   *   esplicitamente (forceOutsideAvailability), o per appuntamenti
   *   nonRetribuito (pausa pranzo & co. sono legittimamente fuori orario).
   * - In caso di violazione lancia ConflictException con un messaggio che
   *   inizia con OUTSIDE_AVAILABILITY_ERROR, cosi' il frontend puo'
   *   distinguere questo caso e offrire la forzatura.
   */
  private async assertWithinAvailability(params: {
    operatorId: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    appointmentType?: AppointmentType;
    nonRetribuito?: boolean;
    forceOutsideAvailability?: boolean;
    /** Appuntamento da escludere dal calcolo (in update: se stesso). */
    excludeAppointmentId?: string;
  }): Promise<void> {
    if (params.forceOutsideAvailability) return;
    if (params.nonRetribuito) return;
    // La disponibilita' palestra ha regole proprie (eccezioni/coperture);
    // questo guard riguarda solo gli appuntamenti su operatore.
    if (params.appointmentType === AppointmentType.GYM) return;

    const blockEnabled =
      await this.generalSettingsService.isBlockOutsideAvailabilityEnabled();
    if (!blockEnabled) return;

    // Usa la logica V3 (free-block reali). Esclude l'appuntamento corrente
    // cosi' lo spazio che gia' occupa non genera un falso positivo.
    const result = await this.availabilityService.getOperatorsAvailabilityV3(
      [params.operatorId],
      params.appointmentDate,
      params.appointmentDate,
      params.excludeAppointmentId,
    );
    const freeBlocks =
      result[0]?.days.find(d => d.date === params.appointmentDate)?.freeBlocks ?? [];

    if (!this.isIntervalCovered(params.startTime, params.endTime, freeBlocks)) {
      throw new ConflictException(
        `${AvailabilityAppointmentService.OUTSIDE_AVAILABILITY_ERROR}: ` +
          `l'orario ${params.startTime}-${params.endTime} è fuori dalla disponibilità dell'operatore`,
      );
    }
  }

  /**
   * Verifica che ogni minuto di [start, end) sia coperto da almeno uno slot
   * di disponibilita'. Gli slot adiacenti vengono uniti, quindi un
   * appuntamento a cavallo di piu' slot contigui e' considerato coperto.
   */
  private isIntervalCovered(
    start: string,
    end: string,
    slots: { startTime: string; endTime: string }[],
  ): boolean {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const startMin = toMin(start);
    const endMin = toMin(end);
    if (endMin <= startMin) return false;
    if (slots.length === 0) return false;

    // Ordina e fonde gli intervalli di disponibilita' contigui/sovrapposti.
    const ranges = slots
      .map(s => ({ s: toMin(s.startTime), e: toMin(s.endTime) }))
      .sort((a, b) => a.s - b.s);

    const merged: { s: number; e: number }[] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r.s <= last.e) {
        last.e = Math.max(last.e, r.e);
      } else {
        merged.push({ ...r });
      }
    }

    // L'appuntamento e' coperto se un singolo range merge-ato lo contiene.
    return merged.some(r => r.s <= startMin && r.e >= endMin);
  }

  /**
   * Crea un nuovo appuntamento con eventuali strumenti
   * Se repeatConfig è presente, crea una serie di appuntamenti ricorrenti
   * Ritorna il primo appuntamento della serie (o l'unico se non ricorrente)
   */
  async create(input: CreateAvailabilityAppointmentInput): Promise<AvailabilityAppointment> {
    const { instruments, repeatConfig, forceOutsideAvailability, ...appointmentData } = input;

    // Guard disponibilita': blocca la creazione fuori orario operatore se
    // l'impostazione e' attiva e l'utente non ha forzato esplicitamente.
    await this.assertWithinAvailability({
      operatorId: appointmentData.operatorId,
      appointmentDate: appointmentData.appointmentDate,
      startTime: appointmentData.startTime,
      endTime: appointmentData.endTime,
      nonRetribuito: appointmentData.nonRetribuito,
      forceOutsideAvailability,
    });

    let savedAppointment: AvailabilityAppointment;

    // Se c'è una configurazione di ricorrenza, crea appuntamenti multipli
    if (repeatConfig) {
      // Il dispatch WhatsApp avviene dentro createRecurringAppointments per ogni appuntamento
      savedAppointment = await this.createRecurringAppointments(appointmentData, instruments, repeatConfig);
    } else {
      // Crea singolo appuntamento
      savedAppointment = await this.createSingleAppointment(appointmentData, instruments);
      // Fire-and-forget WhatsApp dispatch solo per singolo
      this.dispatchWhatsappBooking(savedAppointment);
    }

    // Check proattivo conflitti per appointment GYM: se ricade in uno slot
    // scoperto di un'eccezione attiva, setta hasConflict=true.
    if (savedAppointment.appointmentType === AppointmentType.GYM) {
      // Fire-and-forget: non blocca il return
      this.checkAndMarkConflictForGymAppointment(
        savedAppointment.id,
        savedAppointment.gymRoomId,
        savedAppointment.operatorId,
        savedAppointment.appointmentDate,
        savedAppointment.startTime,
      ).catch(() => {});
    }

    return savedAppointment;
  }

  /**
   * Crea un singolo appuntamento usando una transazione per garantire atomicità
   * Se l'assegnazione strumenti fallisce, l'intero appuntamento viene annullato (rollback)
   */
  private async createSingleAppointment(
    appointmentData: Omit<CreateAvailabilityAppointmentInput, 'instruments' | 'repeatConfig'>,
    instruments?: CreateAppointmentInstrumentInput[],
    isRecurring: boolean = false,
    recurringGroupId?: string,
    repeatConfig?: RepeatConfigInput,
    isMaster: boolean = false,
    masterAppointmentId?: string,
  ): Promise<AvailabilityAppointment> {
    // Usa una transazione per garantire che l'appuntamento e gli strumenti
    // vengano creati insieme o nessuno dei due (atomicità)
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const appointmentRepo = manager.getRepository(AvailabilityAppointment);

      // Check sovrapposizione: verifica che l'operatore non abbia gia' un appuntamento
      // nella stessa fascia oraria (non si applica agli appuntamenti palestra che usano createSingleGymAppointment)
      if (appointmentData.operatorId) {
        const overlapping = await appointmentRepo
          .createQueryBuilder('a')
          .where('a.operatorId = :operatorId', { operatorId: appointmentData.operatorId })
          .andWhere('a.appointmentDate = :date', { date: appointmentData.appointmentDate })
          .andWhere('a.bookingStatus NOT IN (:...excluded)', { excluded: [BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW] })
          .andWhere('a.startTime < :endTime AND a.endTime > :startTime', {
            startTime: appointmentData.startTime,
            endTime: appointmentData.endTime,
          })
          .getCount();

        if (overlapping > 0) {
          throw new ConflictException(
            `L'operatore ha già un appuntamento in questa fascia oraria (${appointmentData.startTime} - ${appointmentData.endTime})`
          );
        }
      }

      const defaultSiteId = await this.resolveDefaultSiteId(manager);
      const appointment = appointmentRepo.create({
        ...appointmentData,
        siteId: defaultSiteId,
        bookingStatus: BookingStatus.SCHEDULED,
        hasConflict: false,
        isRecurring,
        recurringGroupId,
        isMaster,
        masterAppointmentId,
        // Normalizza case di type/endType (operator dialog manda UPPERCASE, gym lowercase)
        repeatConfig: repeatConfig ? {
          type: repeatConfig.type.toLowerCase() as any,
          interval: repeatConfig.interval,
          selectedDays: repeatConfig.selectedDays,
          endType: repeatConfig.endType.toLowerCase() as any,
          occurrences: repeatConfig.occurrences,
          untilDate: repeatConfig.untilDate,
        } : undefined,
      });

      const savedAppointment = await appointmentRepo.save(appointment);

      // Se ci sono strumenti, assegnali all'interno della stessa transazione
      // Se fallisce, tutto viene annullato (rollback automatico)
      if (instruments && instruments.length > 0) {
        await this.assignInstrumentsWithManager(
          manager,
          savedAppointment.id,
          savedAppointment.appointmentDate,
          savedAppointment.startTime,
          instruments,
        );
      }

      // Gestisci servizi multipli
      await this.saveAppointmentServicesWithManager(
        manager,
        savedAppointment.id,
        appointmentData.services,
        appointmentData.serviceId,
      );

      // Ricarica l'appuntamento con le relazioni
      return this.findByIdWithManager(manager, savedAppointment.id);
    });
  }

  /**
   * Salva i servizi associati all'appuntamento
   * Supporta sia il nuovo formato (services array) che il legacy (serviceId singolo)
   */
  private async saveAppointmentServicesWithManager(
    manager: EntityManager,
    appointmentId: string,
    services?: ServiceInputItem[],
    legacyServiceId?: string,
  ): Promise<void> {
    const appointmentServiceRepo = manager.getRepository(AppointmentServiceEntity);

    // Priorità: se c'è services array, usa quello; altrimenti usa serviceId legacy
    if (services && services.length > 0) {
      const servicesToSave = services.map((s, idx) => appointmentServiceRepo.create({
        appointmentId,
        serviceId: s.serviceId,
        customDuration: s.customDuration,
        customPrice: s.customPrice,
        orderPosition: s.orderPosition ?? idx,
      }));

      await appointmentServiceRepo.save(servicesToSave);
    } else if (legacyServiceId) {
      // Retrocompatibilità: se solo serviceId legacy, crea un record singolo
      const serviceRecord = appointmentServiceRepo.create({
        appointmentId,
        serviceId: legacyServiceId,
        orderPosition: 0,
      });

      await appointmentServiceRepo.save(serviceRecord);
    }
  }

  /**
   * Crea una serie di appuntamenti ricorrenti
   */
  private async createRecurringAppointments(
    baseData: Omit<CreateAvailabilityAppointmentInput, 'instruments' | 'repeatConfig'>,
    instruments?: CreateAppointmentInstrumentInput[],
    repeatConfig?: RepeatConfigInput,
  ): Promise<AvailabilityAppointment> {
    if (!repeatConfig) {
      throw new BadRequestException('Configurazione ricorrenza mancante');
    }

    // Calcola tutte le date della ricorrenza
    const dates = this.calculateRecurringDates(baseData.appointmentDate, repeatConfig);

    if (dates.length === 0) {
      throw new BadRequestException('Nessuna data valida per la ricorrenza');
    }

    // Genera un ID di gruppo per collegare tutti gli appuntamenti
    const recurringGroupId = uuidv4();

    // Crea tutti gli appuntamenti
    let firstAppointment: AvailabilityAppointment | null = null;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      try {
        const isFirst = firstAppointment === null;
        const appointment = await this.createSingleAppointment(
          { ...baseData, appointmentDate: date },
          instruments,
          true,
          recurringGroupId,
          isFirst ? repeatConfig : undefined, // Solo il master ha la config
          isFirst, // isMaster
          isFirst ? undefined : firstAppointment!.id, // masterAppointmentId
        );

        // WhatsApp dispatch per OGNI appuntamento della serie
        this.dispatchWhatsappBooking(appointment);

        if (isFirst) {
          firstAppointment = appointment;
        }
      } catch (error) {
        // Se fallisce l'assegnazione strumenti, continua con i prossimi
        // (l'appuntamento potrebbe essere in un giorno dove gli strumenti non sono disponibili)
        console.warn(`Impossibile creare appuntamento ricorrente per ${date}:`, error.message);
      }
    }

    if (!firstAppointment) {
      throw new BadRequestException('Impossibile creare appuntamenti ricorrenti');
    }

    return firstAppointment;
  }

  /**
   * Calcola le date per una ricorrenza
   */
  private calculateRecurringDates(startDate: string, config: RepeatConfigInput): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    let current = new Date(start);
    let count = 0;
    const maxOccurrences = config.endType === RecurringEndType.AFTER ? (config.occurrences || 1) : 52;
    const untilDate = config.endType === RecurringEndType.UNTIL && config.untilDate
      ? new Date(config.untilDate)
      : null;

    // Limita a 52 occorrenze per sicurezza
    while (count < maxOccurrences) {
      // Verifica data limite
      if (untilDate && current > untilDate) {
        break;
      }

      // Per ricorrenza settimanale, verifica se il giorno è selezionato
      if (config.type === RecurringType.WEEKLY && config.selectedDays && config.selectedDays.length > 0) {
        const dayOfWeek = current.getDay();
        if (config.selectedDays.includes(dayOfWeek)) {
          dates.push(this.formatDate(current));
          count++;
        }
      } else {
        dates.push(this.formatDate(current));
        count++;
      }

      // Avanza alla prossima data
      switch (config.type) {
        case RecurringType.DAILY:
          current.setDate(current.getDate() + config.interval);
          break;
        case RecurringType.WEEKLY:
          if (config.selectedDays && config.selectedDays.length > 0) {
            // Avanza di 1 giorno alla volta per verificare i giorni selezionati
            current.setDate(current.getDate() + 1);
            // Ma se abbiamo completato una settimana, aggiungi l'intervallo extra
            if (current.getDay() === start.getDay() && count > 0) {
              current.setDate(current.getDate() + (config.interval - 1) * 7);
            }
          } else {
            current.setDate(current.getDate() + config.interval * 7);
          }
          break;
        case RecurringType.MONTHLY:
          current.setMonth(current.getMonth() + config.interval);
          break;
      }

      // Safety check: non andare oltre 2 anni
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
      if (current > twoYearsFromNow) {
        break;
      }
    }

    return dates;
  }

  /**
   * Formatta una data in YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Assegna strumenti all'appuntamento, selezionando automaticamente quelli disponibili
   */
  /**
   * Verifica (senza scrivere nulla) che esista uno strumento libero per
   * ogni categoria richiesta nel time slot dato. Lancia BadRequestException
   * se una categoria non ha strumenti disponibili. Usato per validare
   * uno spostamento appuntamento prima di persisterlo.
   */
  private async assertInstrumentsAvailable(
    instruments: CreateAppointmentInstrumentInput[],
    appointmentDate: Date,
    appointmentStartTime: string,
    excludeAppointmentId?: string,
  ): Promise<void> {
    for (const instrumentInput of instruments) {
      const available = await this.findAvailableInstrument(
        instrumentInput.instrumentCategoryId,
        appointmentDate,
        appointmentStartTime,
        instrumentInput.startOffsetMinutes,
        instrumentInput.endOffsetMinutes,
        excludeAppointmentId,
      );
      if (!available) {
        const category = await this.instrumentCategoryRepo.findOne({
          where: { id: instrumentInput.instrumentCategoryId },
        });
        const categoryName = category?.name || 'Sconosciuta';
        throw new BadRequestException(
          `Nessuno strumento "${categoryName}" disponibile nel nuovo orario. ` +
          `Tutti gli strumenti di questa categoria sono già prenotati.`,
        );
      }
    }
  }

  private async assignInstruments(
    appointmentId: string,
    appointmentDate: Date,
    appointmentStartTime: string,
    instruments: CreateAppointmentInstrumentInput[],
    excludeAppointmentId?: string,
  ): Promise<void> {
    for (const instrumentInput of instruments) {
      // Trova uno strumento disponibile per la categoria e il time slot
      const availableInstrument = await this.findAvailableInstrument(
        instrumentInput.instrumentCategoryId,
        appointmentDate,
        appointmentStartTime,
        instrumentInput.startOffsetMinutes,
        instrumentInput.endOffsetMinutes,
        excludeAppointmentId,
      );

      if (!availableInstrument) {
        // Ottieni il nome della categoria per un messaggio di errore più chiaro
        const category = await this.instrumentCategoryRepo.findOne({
          where: { id: instrumentInput.instrumentCategoryId }
        });
        const categoryName = category?.name || 'Sconosciuta';

        throw new BadRequestException(
          `Nessuno strumento "${categoryName}" disponibile nel periodo richiesto. ` +
          `Tutti gli strumenti di questa categoria sono già prenotati per questo orario.`
        );
      }

      // Crea l'associazione
      const appointmentInstrument = this.appointmentInstrumentRepo.create({
        appointmentId,
        instrumentId: availableInstrument.id,
        startOffsetMinutes: instrumentInput.startOffsetMinutes,
        endOffsetMinutes: instrumentInput.endOffsetMinutes,
        orderPosition: instrumentInput.orderPosition,
      });

      await this.appointmentInstrumentRepo.save(appointmentInstrument);
    }
  }

  /**
   * Assegna strumenti all'appuntamento usando EntityManager (per transazioni)
   */
  private async assignInstrumentsWithManager(
    manager: EntityManager,
    appointmentId: string,
    appointmentDate: Date,
    appointmentStartTime: string,
    instruments: CreateAppointmentInstrumentInput[],
  ): Promise<void> {
    const appointmentInstrumentRepo = manager.getRepository(AppointmentInstrument);
    const instrumentCategoryRepo = manager.getRepository(InstrumentCategory);

    for (const instrumentInput of instruments) {
      // Trova uno strumento disponibile per la categoria e il time slot
      const availableInstrument = await this.findAvailableInstrumentWithManager(
        manager,
        instrumentInput.instrumentCategoryId,
        appointmentDate,
        appointmentStartTime,
        instrumentInput.startOffsetMinutes,
        instrumentInput.endOffsetMinutes,
      );

      if (!availableInstrument) {
        // Ottieni il nome della categoria per un messaggio di errore più chiaro
        const category = await instrumentCategoryRepo.findOne({
          where: { id: instrumentInput.instrumentCategoryId }
        });
        const categoryName = category?.name || 'Sconosciuta';

        throw new BadRequestException(
          `Nessuno strumento "${categoryName}" disponibile nel periodo richiesto. ` +
          `Tutti gli strumenti di questa categoria sono già prenotati per questo orario.`
        );
      }

      // Crea l'associazione
      const appointmentInstrument = appointmentInstrumentRepo.create({
        appointmentId,
        instrumentId: availableInstrument.id,
        startOffsetMinutes: instrumentInput.startOffsetMinutes,
        endOffsetMinutes: instrumentInput.endOffsetMinutes,
        orderPosition: instrumentInput.orderPosition,
      });

      await appointmentInstrumentRepo.save(appointmentInstrument);
    }
  }

  /**
   * Trova uno strumento disponibile usando EntityManager (per transazioni)
   */
  private async findAvailableInstrumentWithManager(
    manager: EntityManager,
    categoryId: string,
    appointmentDate: Date,
    appointmentStartTime: string,
    startOffsetMinutes: number,
    endOffsetMinutes: number,
  ): Promise<Instrument | null> {
    const instrumentRepo = manager.getRepository(Instrument);

    // Ottieni tutti gli strumenti attivi della categoria
    const instrumentsInCategory = await instrumentRepo.find({
      where: {
        categoryId,
        status: InstrumentStatus.ACTIVE,
        isActive: true,
      },
    });

    if (instrumentsInCategory.length === 0) {
      return null;
    }

    // Trova gli strumenti già prenotati per questo slot
    const bookedInstrumentIds = await this.getBookedInstrumentIdsWithManager(
      manager,
      categoryId,
      appointmentDate,
      appointmentStartTime,
      startOffsetMinutes,
      endOffsetMinutes,
    );

    // Trova il primo strumento non prenotato
    const availableInstrument = instrumentsInCategory.find(
      inst => !bookedInstrumentIds.includes(inst.id)
    );

    return availableInstrument || null;
  }

  /**
   * Ottiene gli ID degli strumenti già prenotati usando EntityManager (per transazioni)
   */
  private async getBookedInstrumentIdsWithManager(
    manager: EntityManager,
    categoryId: string,
    appointmentDate: Date,
    appointmentStartTime: string,
    startOffsetMinutes: number,
    endOffsetMinutes: number,
  ): Promise<string[]> {
    // Formatta la data
    const dateStr = appointmentDate instanceof Date
      ? appointmentDate.toISOString().split('T')[0]
      : appointmentDate;

    // Query per trovare strumenti già prenotati che si sovrappongono
    const result = await manager.getRepository(AppointmentInstrument)
      .createQueryBuilder('ai')
      .innerJoin('ai.appointment', 'a')
      .innerJoin('ai.instrument', 'i')
      .where('i.categoryId = :categoryId', { categoryId })
      .andWhere('a.appointmentDate = :appointmentDate', { appointmentDate: dateStr })
      .andWhere('a.bookingStatus NOT IN (:...excludedStatuses)', {
        excludedStatuses: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
      })
      // Controlla sovrapposizione usando tempi assoluti (startTime + offset)
      // Due slot si sovrappongono se: inizio_esistente < fine_nuovo AND inizio_nuovo < fine_esistente
      .andWhere(`
        EXTRACT(HOUR FROM a."startTime"::time) * 60 + EXTRACT(MINUTE FROM a."startTime"::time) + ai."startOffsetMinutes"
        <
        EXTRACT(HOUR FROM :appointmentStartTime::time) * 60 + EXTRACT(MINUTE FROM :appointmentStartTime::time) + :endOffset
        AND
        EXTRACT(HOUR FROM :appointmentStartTime::time) * 60 + EXTRACT(MINUTE FROM :appointmentStartTime::time) + :startOffset
        <
        EXTRACT(HOUR FROM a."startTime"::time) * 60 + EXTRACT(MINUTE FROM a."startTime"::time) + ai."endOffsetMinutes"
      `, {
        startOffset: startOffsetMinutes,
        endOffset: endOffsetMinutes,
        appointmentStartTime,
      })
      .select('ai.instrumentId')
      .getMany();

    return result.map(r => r.instrumentId);
  }

  /**
   * Trova un appuntamento per ID usando EntityManager (per transazioni)
   */
  private async findByIdWithManager(manager: EntityManager, id: string): Promise<AvailabilityAppointment> {
    const appointmentRepo = manager.getRepository(AvailabilityAppointment);

    const appointment = await appointmentRepo.findOne({
      where: { id },
      relations: [
        'operator',
        'service',
        'instruments',
        'instruments.instrument',
        'instruments.instrument.category',
        'appointmentServices',
        'appointmentServices.service',
      ],
    });

    if (!appointment) {
      throw new NotFoundException(`Appuntamento con ID ${id} non trovato`);
    }

    return appointment;
  }

  /**
   * Trova uno strumento disponibile per categoria e time slot
   */
  private async findAvailableInstrument(
    categoryId: string,
    appointmentDate: Date,
    appointmentStartTime: string,
    startOffsetMinutes: number,
    endOffsetMinutes: number,
    excludeAppointmentId?: string,
  ): Promise<Instrument | null> {
    // Ottieni tutti gli strumenti attivi della categoria
    const instrumentsInCategory = await this.instrumentRepo.find({
      where: {
        categoryId,
        status: InstrumentStatus.ACTIVE,
        isActive: true,
      },
    });

    if (instrumentsInCategory.length === 0) {
      return null;
    }

    // Calcola il time slot effettivo
    const slotStart = this.addMinutesToTime(appointmentStartTime, startOffsetMinutes);
    const slotEnd = this.addMinutesToTime(appointmentStartTime, endOffsetMinutes);

    // Trova gli strumenti già prenotati per questo slot
    const bookedInstrumentIds = await this.getBookedInstrumentIds(
      categoryId,
      appointmentDate,
      appointmentStartTime,
      startOffsetMinutes,
      endOffsetMinutes,
      excludeAppointmentId,
    );

    // Trova il primo strumento non prenotato
    const availableInstrument = instrumentsInCategory.find(
      inst => !bookedInstrumentIds.includes(inst.id)
    );

    return availableInstrument || null;
  }

  /**
   * Ottiene gli ID degli strumenti già prenotati per un dato slot
   */
  private async getBookedInstrumentIds(
    categoryId: string,
    appointmentDate: Date,
    appointmentStartTime: string,
    startOffsetMinutes: number,
    endOffsetMinutes: number,
    excludeAppointmentId?: string,
  ): Promise<string[]> {
    // Formatta la data
    const dateStr = appointmentDate instanceof Date
      ? appointmentDate.toISOString().split('T')[0]
      : appointmentDate;

    // Query per trovare strumenti già prenotati che si sovrappongono
    const qb = this.appointmentInstrumentRepo
      .createQueryBuilder('ai')
      .innerJoin('ai.appointment', 'a')
      .innerJoin('ai.instrument', 'i')
      .where('i.categoryId = :categoryId', { categoryId })
      .andWhere('a.appointmentDate = :appointmentDate', { appointmentDate: dateStr })
      .andWhere('a.bookingStatus NOT IN (:...excludedStatuses)', {
        excludedStatuses: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
      });

    // In update: escludi l'appuntamento stesso, altrimenti i suoi strumenti
    // risulterebbero "occupati" da se stessi.
    if (excludeAppointmentId) {
      qb.andWhere('a.id != :excludeAppointmentId', { excludeAppointmentId });
    }

    const result = await qb
      // Controlla sovrapposizione usando tempi assoluti (startTime + offset)
      // Due slot si sovrappongono se: inizio_esistente < fine_nuovo AND inizio_nuovo < fine_esistente
      .andWhere(`
        EXTRACT(HOUR FROM a."startTime"::time) * 60 + EXTRACT(MINUTE FROM a."startTime"::time) + ai."startOffsetMinutes"
        <
        EXTRACT(HOUR FROM :appointmentStartTime::time) * 60 + EXTRACT(MINUTE FROM :appointmentStartTime::time) + :endOffset
        AND
        EXTRACT(HOUR FROM :appointmentStartTime::time) * 60 + EXTRACT(MINUTE FROM :appointmentStartTime::time) + :startOffset
        <
        EXTRACT(HOUR FROM a."startTime"::time) * 60 + EXTRACT(MINUTE FROM a."startTime"::time) + ai."endOffsetMinutes"
      `, {
        startOffset: startOffsetMinutes,
        endOffset: endOffsetMinutes,
        appointmentStartTime,
      })
      .select('ai.instrumentId')
      .getMany();

    return result.map(r => r.instrumentId);
  }

  /**
   * Aggiunge minuti a un orario HH:mm
   */
  private addMinutesToTime(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  /**
   * Trova un appuntamento per ID
   */
  async findById(id: string): Promise<AvailabilityAppointment> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: [
        'operator',
        'service',
        'instruments',
        'instruments.instrument',
        'instruments.instrument.category',
        'appointmentServices',
        'appointmentServices.service',
      ],
    });

    if (!appointment) {
      throw new NotFoundException(`Appuntamento con ID ${id} non trovato`);
    }

    return appointment;
  }

  /**
   * Trova appuntamenti per operatore e range di date
   */
  async findByOperatorAndDateRange(
    operatorId: string,
    startDate: string,
    endDate: string,
  ): Promise<AvailabilityAppointment[]> {
    return this.appointmentRepo.find({
      where: {
        operatorId,
        appointmentDate: Between(new Date(startDate), new Date(endDate)),
        bookingStatus: Not(In([BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW])),
      },
      relations: ['operator', 'service', 'gymRoom', 'instruments', 'instruments.instrument', 'instruments.instrument.category'],
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Trova tutti gli appuntamenti per un range di date
   */
  async findByDateRange(
    startDate: string,
    endDate: string,
    operatorIds?: string[],
  ): Promise<AvailabilityAppointment[]> {
    const whereCondition: any = {
      appointmentDate: Between(new Date(startDate), new Date(endDate)),
      bookingStatus: Not(In([BookingStatus.CANCELLED, BookingStatus.NO_SHOW])),
    };

    if (operatorIds && operatorIds.length > 0) {
      whereCondition.operatorId = In(operatorIds);
    }

    return this.appointmentRepo.find({
      where: whereCondition,
      relations: ['operator', 'service', 'gymRoom', 'instruments', 'instruments.instrument', 'instruments.instrument.category'],
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Aggiorna un appuntamento
   */
  async update(id: string, input: UpdateAvailabilityAppointmentInput): Promise<AvailabilityAppointment> {
    // IMPORTANTE: Carica l'entity SENZA relazioni per evitare che l'Identity Map
    // mantenga cached le vecchie relazioni (service, operator, etc.)
    const appointment = await this.appointmentRepo.findOne({ where: { id } });
    if (!appointment) {
      throw new Error(`Appuntamento con ID ${id} non trovato`);
    }

    // Cambio operatore: riassegnazione a un altro operatore.
    const operatorChanged =
      !!input.operatorId && input.operatorId !== appointment.operatorId;

    // Se cambiano data, ora o operatore, resetta il flag conflitto:
    // verrà ricalcolato subito dopo il save.
    const positionChanged =
      (input.appointmentDate && String(input.appointmentDate) !== String(appointment.appointmentDate)) ||
      (input.startTime && input.startTime !== appointment.startTime) ||
      (input.endTime && input.endTime !== appointment.endTime);

    // I check vanno rieseguiti se cambia posizione (orario/data) O operatore:
    // un appuntamento riassegnato va verificato sul nuovo operatore anche a
    // parità di orario.
    const needsPositionChecks = positionChanged || operatorChanged;

    // Check sovrapposizione (solo per appuntamenti non-palestra).
    // L'operatore di riferimento e' quello NUOVO se cambia, altrimenti
    // quello corrente.
    const checkOperatorId = input.operatorId || appointment.operatorId;
    if (needsPositionChecks && appointment.appointmentType !== AppointmentType.GYM) {
      const checkDate = input.appointmentDate || appointment.appointmentDate;
      const checkStart = input.startTime || appointment.startTime;
      const checkEnd = input.endTime || appointment.endTime;

      const overlapping = await this.appointmentRepo
        .createQueryBuilder('a')
        .where('a.operatorId = :operatorId', { operatorId: checkOperatorId })
        .andWhere('a.appointmentDate = :date', { date: checkDate })
        .andWhere('a.id != :id', { id })
        .andWhere('a.bookingStatus NOT IN (:...excluded)', { excluded: [BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW] })
        .andWhere('a.startTime < :endTime AND a.endTime > :startTime', { startTime: checkStart, endTime: checkEnd })
        .getCount();

      if (overlapping > 0) {
        throw new ConflictException(
          `L'operatore ha già un appuntamento in questa fascia oraria (${checkStart} - ${checkEnd})`
        );
      }

      // Guard disponibilita': blocca lo spostamento fuori orario operatore
      // se l'impostazione e' attiva e l'utente non ha forzato. Esclude
      // l'appuntamento stesso dal calcolo (evita falso positivo).
      await this.assertWithinAvailability({
        operatorId: checkOperatorId,
        appointmentDate: typeof checkDate === 'string'
          ? checkDate
          : new Date(checkDate).toISOString().split('T')[0],
        startTime: checkStart,
        endTime: checkEnd,
        appointmentType: appointment.appointmentType,
        nonRetribuito: appointment.nonRetribuito,
        forceOutsideAvailability: input.forceOutsideAvailability,
        excludeAppointmentId: id,
      });
    }

    const { instruments, services, forceOutsideAvailability, ...updateData } = input;

    // ── Strumenti: determina la lista da (ri)assegnare ──────────────
    // (A) instruments passato (dialog modifica) → usa quella lista.
    // (B) instruments assente ma orario cambiato (drag/resize) → ri-ancora
    //     gli strumenti gia' assegnati al nuovo orario.
    // In entrambi i casi gli strumenti vanno RIVALIDATI ai nuovi orari.
    let instrumentsToAssign: CreateAppointmentInstrumentInput[] | null = null;
    if (instruments !== undefined) {
      instrumentsToAssign = instruments;
    } else if (needsPositionChecks) {
      const existing = await this.appointmentInstrumentRepo.find({
        where: { appointmentId: id },
        relations: ['instrument'],
      });
      if (existing.length > 0) {
        instrumentsToAssign = existing.map(ai => ({
          instrumentCategoryId: ai.instrument.categoryId,
          startOffsetMinutes: ai.startOffsetMinutes,
          endOffsetMinutes: ai.endOffsetMinutes,
          orderPosition: ai.orderPosition,
        }));
      }
    }

    // Valida la disponibilita' strumenti PRIMA di salvare l'appuntamento:
    // se uno strumento e' occupato nel nuovo orario, BadRequestException
    // interrompe qui senza lasciare l'appuntamento spostato a meta'.
    // (`update` non e' transazionale: niente save speculativo.)
    if (instrumentsToAssign && instrumentsToAssign.length > 0) {
      const newDate = (updateData.appointmentDate as any) ?? appointment.appointmentDate;
      const newStart = (updateData.startTime as any) ?? appointment.startTime;
      await this.assertInstrumentsAvailable(instrumentsToAssign, newDate, newStart, id);
    }

    // Aggiorna i campi dell'appuntamento
    if (needsPositionChecks && appointment.hasConflict) {
      // Azzera il flag: verrà rimarcato sotto se il nuovo slot è scoperto
      (updateData as any).hasConflict = false;
      (updateData as any).conflictReason = null;
      (updateData as any).conflictDetectedAt = null;
    }
    Object.assign(appointment, updateData);
    await this.appointmentRepo.save(appointment);

    // Ri-assegna gli strumenti ai nuovi orari (disponibilita' gia' validata
    // sopra). Sostituisce sempre le associazioni esistenti.
    if (instrumentsToAssign !== null) {
      await this.appointmentInstrumentRepo.delete({ appointmentId: id });
      if (instrumentsToAssign.length > 0) {
        await this.assignInstruments(
          id,
          appointment.appointmentDate,
          appointment.startTime,
          instrumentsToAssign,
          id,
        );
      }
    }

    // Se vengono passati servizi, aggiorna le associazioni
    if (services !== undefined) {
      // Rimuovi le vecchie associazioni
      await this.appointmentServiceRepo.delete({ appointmentId: id });

      // Aggiungi le nuove
      if (services.length > 0) {
        const servicesToSave = services.map((s, idx) => this.appointmentServiceRepo.create({
          appointmentId: id,
          serviceId: s.serviceId,
          customDuration: s.customDuration,
          customPrice: s.customPrice,
          orderPosition: s.orderPosition ?? idx,
        }));

        await this.appointmentServiceRepo.save(servicesToSave);
      }
    }

    // IMPORTANTE: Usa QueryBuilder per bypassare l'Identity Map di TypeORM
    // L'Identity Map mantiene cached le entity già caricate nella stessa "sessione"
    // findOne() ritornerebbe l'entity cached con le vecchie relazioni
    const result = await this.appointmentRepo
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.operator', 'operator')
      .leftJoinAndSelect('appointment.service', 'service')
      .leftJoinAndSelect('appointment.instruments', 'instruments')
      .leftJoinAndSelect('instruments.instrument', 'instrument')
      .leftJoinAndSelect('instrument.category', 'category')
      .leftJoinAndSelect('appointment.appointmentServices', 'appointmentServices')
      .leftJoinAndSelect('appointmentServices.service', 'appointmentService')
      .where('appointment.id = :id', { id })
      .getOne();

    if (!result) {
      throw new Error(`Appuntamento con ID ${id} non trovato dopo update`);
    }

    // Check proattivo conflitti per appointment GYM dopo update di posizione
    if (positionChanged && result.appointmentType === AppointmentType.GYM) {
      this.checkAndMarkConflictForGymAppointment(
        result.id,
        result.gymRoomId,
        result.operatorId,
        result.appointmentDate,
        result.startTime,
      ).catch(() => {});
    }

    return result;
  }

  /**
   * Cancella un appuntamento (soft delete - imposta status a CANCELLED)
   */
  async cancel(id: string, cancellationReason?: string): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);
    appointment.bookingStatus = BookingStatus.CANCELLED;
    appointment.cancellationReason = cancellationReason;
    await this.appointmentRepo.save(appointment);

    // Fire-and-forget WhatsApp cancel
    this.cancelWhatsappBooking(appointment);

    return this.findById(id);
  }

  /**
   * Elimina definitivamente un appuntamento
   */
  async delete(id: string): Promise<boolean> {
    // Caricare l'appuntamento prima della delete per notificare il gateway WhatsApp
    const appointment = await this.appointmentRepo.findOne({ where: { id } });
    if (appointment) {
      this.cancelWhatsappBooking(appointment);
    }
    // Le associazioni con gli strumenti vengono eliminate automaticamente (CASCADE)
    const result = await this.appointmentRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  /**
   * Conferma un appuntamento
   */
  async confirm(id: string): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);
    appointment.bookingStatus = BookingStatus.CONFIRMED;
    await this.appointmentRepo.save(appointment);
    return this.findById(id);
  }

  /**
   * Segna come no-show (legacy - usa markNoShow per la versione completa)
   */
  async markAsNoShow(id: string): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);
    appointment.bookingStatus = BookingStatus.NO_SHOW;
    await this.appointmentRepo.save(appointment);
    return this.findById(id);
  }

  // ==================== NUOVI METODI PER GESTIONE STATI ====================

  /**
   * Cancella un appuntamento calcolando automaticamente le ore di preavviso
   * Se preavviso >24h: CANCELLED_EARLY (nessuna penalità)
   * Se preavviso <24h: CANCELLED_LATE (incrementa contatore paziente)
   */
  async cancelAppointment(
    id: string,
    reason: string,
    cancelledBy: string,
  ): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);

    // Verifica che l'appuntamento sia in uno stato cancellabile
    if (![BookingStatus.SCHEDULED, BookingStatus.CONFIRMED].includes(appointment.bookingStatus)) {
      throw new BadRequestException(
        `L'appuntamento non può essere cancellato. Stato attuale: ${appointment.bookingStatus}`
      );
    }

    // Calcola le ore di preavviso
    const hoursNotice = this.calculateHoursNotice(
      appointment.appointmentDate,
      appointment.startTime,
    );

    // Determina il tipo di cancellazione
    const isCancelledLate = hoursNotice < 24;

    appointment.bookingStatus = isCancelledLate
      ? BookingStatus.CANCELLED_LATE
      : BookingStatus.CANCELLED_EARLY;
    appointment.cancellationReason = reason;
    appointment.cancelledAt = new Date();
    appointment.cancelledBy = cancelledBy;
    appointment.cancellationHoursNotice = hoursNotice;

    await this.appointmentRepo.save(appointment);

    // Se cancellazione tardiva e c'è un paziente, incrementa il contatore
    if (isCancelledLate && appointment.patientId) {
      await this.incrementPatientCancellation(appointment.patientId, appointment.id);
    }

    // Fire-and-forget WhatsApp cancel
    this.cancelWhatsappBooking(appointment);

    return this.findById(id);
  }

  /**
   * Segna un appuntamento come no-show e incrementa il contatore paziente
   */
  async markNoShow(id: string): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);

    // Blocca cambio stato per appuntamenti non retribuiti
    if (appointment.nonRetribuito) {
      throw new BadRequestException('Gli appuntamenti non retribuiti non hanno gestione degli stati');
    }

    // Verifica che l'appuntamento sia in uno stato appropriato
    if (![BookingStatus.SCHEDULED, BookingStatus.CONFIRMED].includes(appointment.bookingStatus)) {
      throw new BadRequestException(
        `L'appuntamento non può essere segnato come no-show. Stato attuale: ${appointment.bookingStatus}`
      );
    }

    appointment.bookingStatus = BookingStatus.NO_SHOW;
    await this.appointmentRepo.save(appointment);

    // Incrementa contatore no-show del paziente
    if (appointment.patientId) {
      await this.incrementPatientNoShow(appointment.patientId, appointment.id);
    }

    return this.findById(id);
  }

  /**
   * Segna un appuntamento come attended (paziente presentato)
   * Questo abilita la creazione di un trattamento
   */
  async markAttended(id: string): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);

    // Blocca cambio stato per appuntamenti non retribuiti
    if (appointment.nonRetribuito) {
      throw new BadRequestException('Gli appuntamenti non retribuiti non hanno gestione degli stati');
    }

    // Verifica che l'appuntamento sia in uno stato appropriato
    if (![BookingStatus.SCHEDULED, BookingStatus.CONFIRMED].includes(appointment.bookingStatus)) {
      throw new BadRequestException(
        `L'appuntamento non può essere segnato come presentato. Stato attuale: ${appointment.bookingStatus}`
      );
    }

    appointment.bookingStatus = BookingStatus.ATTENDED;
    await this.appointmentRepo.save(appointment);

    return this.findById(id);
  }

  /**
   * Annulla lo stato attended e ripristina a confirmed
   * Utile per correggere click accidentali.
   * Resetta anche il flag autoStatusChanged per permettere un nuovo cambio automatico.
   */
  async revertAttended(id: string): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);

    if (appointment.bookingStatus !== BookingStatus.ATTENDED) {
      throw new BadRequestException(
        `L'appuntamento non è in stato presentato. Stato attuale: ${appointment.bookingStatus}`
      );
    }

    appointment.bookingStatus = BookingStatus.CONFIRMED;
    // Reset del flag per permettere un nuovo cambio automatico se l'impostazione è attiva
    appointment.autoStatusChanged = false;
    await this.appointmentRepo.save(appointment);

    return this.findById(id);
  }

  /**
   * Calcola le ore di preavviso tra adesso e l'orario dell'appuntamento
   */
  private calculateHoursNotice(appointmentDate: Date, startTime: string): number {
    // Crea un Date con data e ora dell'appuntamento
    const dateStr = appointmentDate instanceof Date
      ? appointmentDate.toISOString().split('T')[0]
      : appointmentDate;

    const [hours, minutes] = startTime.split(':').map(Number);
    const appointmentDateTime = new Date(`${dateStr}T${startTime}:00`);

    // Calcola la differenza in ore
    const now = new Date();
    const diffMs = appointmentDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return Math.max(0, diffHours); // Non può essere negativo
  }

  /**
   * Registra una cancellazione tardiva del paziente nel log attendance.
   * (Sostituisce la vecchia logica jsonb su `patients.cancellationsByYear`,
   * tabella droppata col refactor registry-integration.)
   */
  private async incrementPatientCancellation(
    patientId: string,
    appointmentId?: string,
  ): Promise<void> {
    await this.attendanceService.recordEvent({
      subjectId: patientId,
      eventType: AttendanceEventType.CANCELLATION,
      appointmentId,
    });
  }

  /**
   * Registra un no-show del paziente nel log attendance.
   */
  private async incrementPatientNoShow(
    patientId: string,
    appointmentId?: string,
  ): Promise<void> {
    await this.attendanceService.recordEvent({
      subjectId: patientId,
      eventType: AttendanceEventType.NO_SHOW,
      appointmentId,
    });
  }

  /**
   * Verifica se uno strumento è disponibile per un dato slot
   */
  async isInstrumentAvailable(
    instrumentId: string,
    appointmentDate: string,
    startTime: string,
    startOffsetMinutes: number,
    endOffsetMinutes: number,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const query = this.appointmentInstrumentRepo
      .createQueryBuilder('ai')
      .innerJoin('ai.appointment', 'a')
      .where('ai.instrumentId = :instrumentId', { instrumentId })
      .andWhere('a.appointmentDate = :appointmentDate', { appointmentDate })
      .andWhere('a.bookingStatus NOT IN (:...excludedStatuses)', {
        excludedStatuses: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
      });

    if (excludeAppointmentId) {
      query.andWhere('a.id != :excludeId', { excludeId: excludeAppointmentId });
    }

    // Verifica sovrapposizione
    query.andWhere(`
      EXTRACT(HOUR FROM a."startTime"::time) * 60 + EXTRACT(MINUTE FROM a."startTime"::time) + ai."startOffsetMinutes"
      <
      EXTRACT(HOUR FROM :startTime::time) * 60 + EXTRACT(MINUTE FROM :startTime::time) + :endOffset
      AND
      EXTRACT(HOUR FROM :startTime::time) * 60 + EXTRACT(MINUTE FROM :startTime::time) + :startOffset
      <
      EXTRACT(HOUR FROM a."startTime"::time) * 60 + EXTRACT(MINUTE FROM a."startTime"::time) + ai."endOffsetMinutes"
    `, {
      startTime,
      startOffset: startOffsetMinutes,
      endOffset: endOffsetMinutes,
    });

    const count = await query.getCount();
    return count === 0;
  }

  // ==========================================
  // METODI PER APPUNTAMENTI PALESTRA (GYM)
  // ==========================================

  /**
   * Trova appuntamenti per una GymRoom in una data specifica
   */
  async findByGymRoomAndDate(
    gymRoomId: string,
    date: string,
  ): Promise<AvailabilityAppointment[]> {
    return this.appointmentRepo.find({
      where: {
        gymRoomId,
        appointmentDate: new Date(date),
        appointmentType: AppointmentType.GYM,
        bookingStatus: Not(In([BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW])),
      },
      relations: ['operator', 'gymRoom'],
      order: { startTime: 'ASC' },
    });
  }

  /**
   * Trova appuntamenti per più GymRoom in un range di date
   */
  async findByGymRoomsAndDateRange(
    gymRoomIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<AvailabilityAppointment[]> {
    if (gymRoomIds.length === 0) {
      return [];
    }

    return this.appointmentRepo.find({
      where: {
        gymRoomId: In(gymRoomIds),
        appointmentDate: Between(new Date(startDate), new Date(endDate)),
        appointmentType: AppointmentType.GYM,
        bookingStatus: Not(In([BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW])),
      },
      relations: ['operator', 'gymRoom'],
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Conta gli appuntamenti in uno slot specifico (per controllo capacità)
   */
  async countAppointmentsInSlot(
    gymRoomId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<number> {
    return this.appointmentRepo.count({
      where: {
        gymRoomId,
        appointmentDate: new Date(date),
        startTime,
        endTime,
        appointmentType: AppointmentType.GYM,
        bookingStatus: Not(In([BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW])),
      },
    });
  }

  /**
   * Crea un appuntamento palestra con validazione capacità
   */
  async createGymAppointment(input: CreateGymAppointmentInput): Promise<AvailabilityAppointment> {
    const { repeatConfig, ...appointmentData } = input;

    // 1. Verifica che la GymRoom esista
    const gymRoom = await this.gymRoomRepo.findOne({
      where: { id: input.gymRoomId, isActive: true },
    });

    if (!gymRoom) {
      throw new NotFoundException(`GymRoom con ID ${input.gymRoomId} non trovata o non attiva`);
    }

    // 2. Verifica capacità disponibile
    const currentCount = await this.countAppointmentsInSlot(
      input.gymRoomId,
      input.appointmentDate,
      input.startTime,
      input.endTime,
    );

    if (currentCount >= gymRoom.maxCapacity) {
      throw new ConflictException(
        `Capacità massima raggiunta per questo slot (${currentCount}/${gymRoom.maxCapacity})`
      );
    }

    // 3. Verifica se il paziente è già prenotato in questo slot
    if (input.patientId) {
      const existingAppointment = await this.appointmentRepo.findOne({
        where: {
          gymRoomId: input.gymRoomId,
          appointmentDate: new Date(input.appointmentDate),
          startTime: input.startTime,
          endTime: input.endTime,
          patientId: input.patientId,
          bookingStatus: Not(In([BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW])),
        },
      });

      if (existingAppointment) {
        throw new ConflictException(
          'Questo paziente è già prenotato in questo slot orario'
        );
      }
    }

    // 4. Ottieni operatore dal template (rinumerato da 3)
    const operator = await this.gymPatternGroupService.getOperatorForTimeSlot(
      input.gymRoomId,
      new Date(input.appointmentDate),
      input.startTime,
    );

    if (!operator) {
      throw new BadRequestException(
        `Nessun operatore assegnato per questo slot. Verificare i template della palestra.`
      );
    }

    // 4. Se ricorrente, crea appuntamenti multipli
    if (repeatConfig) {
      return this.createRecurringGymAppointments(
        { ...appointmentData, operatorId: operator.id },
        gymRoom,
        repeatConfig,
      );
    }

    // 5. Crea singolo appuntamento
    const savedGymAppointment = await this.createSingleGymAppointment(
      { ...appointmentData, operatorId: operator.id },
      gymRoom,
    );
    this.dispatchWhatsappBooking(savedGymAppointment);

    // Check proattivo conflitti: se lo slot è scoperto da un'eccezione attiva
    this.checkAndMarkConflictForGymAppointment(
      savedGymAppointment.id,
      savedGymAppointment.gymRoomId,
      savedGymAppointment.operatorId,
      savedGymAppointment.appointmentDate,
      savedGymAppointment.startTime,
    ).catch(() => {});

    return savedGymAppointment;
  }

  /**
   * Crea un singolo appuntamento palestra
   */
  private async createSingleGymAppointment(
    data: Omit<CreateGymAppointmentInput, 'repeatConfig'> & { operatorId: string },
    gymRoom: GymRoom,
    isRecurring: boolean = false,
    recurringGroupId?: string,
    repeatConfig?: RepeatConfigInput,
    isMaster: boolean = false,
    masterAppointmentId?: string,
  ): Promise<AvailabilityAppointment> {
    const defaultSiteId = await this.resolveDefaultSiteId();
    const appointment = this.appointmentRepo.create({
      operatorId: data.operatorId,
      gymRoomId: data.gymRoomId,
      serviceId: data.serviceId,
      siteId: defaultSiteId,
      appointmentType: AppointmentType.GYM,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone,
      patientId: data.patientId,
      appointmentDate: new Date(data.appointmentDate),
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes,
      bookingStatus: BookingStatus.SCHEDULED,
      hasConflict: false,
      participantCount: 1,
      maxParticipants: gymRoom.maxCapacity,
      isRecurring,
      recurringGroupId,
      isMaster,
      masterAppointmentId,
      repeatConfig: repeatConfig ? {
        type: repeatConfig.type.toLowerCase() as any,
        interval: repeatConfig.interval,
        selectedDays: repeatConfig.selectedDays,
        endType: repeatConfig.endType.toLowerCase() as any,
        occurrences: repeatConfig.occurrences,
        untilDate: repeatConfig.untilDate,
      } : undefined,
    });

    const savedAppointment = await this.appointmentRepo.save(appointment);

    // Gestisci servizi multipli per appuntamenti palestra
    if (data.services && data.services.length > 0) {
      const servicesToSave = data.services.map((s, idx) => this.appointmentServiceRepo.create({
        appointmentId: savedAppointment.id,
        serviceId: s.serviceId,
        customDuration: s.customDuration,
        customPrice: s.customPrice,
        orderPosition: s.orderPosition ?? idx,
      }));

      await this.appointmentServiceRepo.save(servicesToSave);
    } else if (data.serviceId) {
      // Retrocompatibilità: serviceId singolo
      const serviceRecord = this.appointmentServiceRepo.create({
        appointmentId: savedAppointment.id,
        serviceId: data.serviceId,
        orderPosition: 0,
      });

      await this.appointmentServiceRepo.save(serviceRecord);
    }

    return this.appointmentRepo.findOne({
      where: { id: savedAppointment.id },
      relations: ['operator', 'gymRoom', 'service', 'appointmentServices', 'appointmentServices.service'],
    });
  }

  /**
   * Crea appuntamenti palestra ricorrenti
   */
  private async createRecurringGymAppointments(
    baseData: Omit<CreateGymAppointmentInput, 'repeatConfig'> & { operatorId: string },
    gymRoom: GymRoom,
    repeatConfig: RepeatConfigInput,
  ): Promise<AvailabilityAppointment> {
    // Calcola tutte le date della ricorrenza
    const dates = this.calculateRecurringDates(baseData.appointmentDate, repeatConfig);

    if (dates.length === 0) {
      throw new BadRequestException('Nessuna data valida per la ricorrenza');
    }

    // Genera un ID di gruppo per collegare tutti gli appuntamenti
    const recurringGroupId = uuidv4();

    let firstAppointment: AvailabilityAppointment | null = null;
    let skippedCount = 0;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];

      try {
        // Verifica capacità per questa data
        const currentCount = await this.countAppointmentsInSlot(
          baseData.gymRoomId,
          date,
          baseData.startTime,
          baseData.endTime,
        );

        if (currentCount >= gymRoom.maxCapacity) {
          skippedCount++;
          continue; // Salta questa data se pieno
        }

        // Verifica operatore per questa data
        const operator = await this.gymPatternGroupService.getOperatorForTimeSlot(
          baseData.gymRoomId,
          new Date(date),
          baseData.startTime,
        );

        if (!operator) {
          skippedCount++;
          continue; // Salta se non c'è operatore
        }

        const isFirst = firstAppointment === null;
        const appointment = await this.createSingleGymAppointment(
          { ...baseData, appointmentDate: date, operatorId: operator.id },
          gymRoom,
          true,
          recurringGroupId,
          isFirst ? repeatConfig : undefined,
          isFirst, // isMaster
          isFirst ? undefined : firstAppointment!.id, // masterAppointmentId
        );

        // WhatsApp dispatch per OGNI appuntamento della serie
        this.dispatchWhatsappBooking(appointment);

        if (isFirst) {
          firstAppointment = appointment;
        }
      } catch (error) {
        console.warn(`Impossibile creare appuntamento palestra ricorrente per ${date}:`, error.message);
        skippedCount++;
      }
    }

    if (!firstAppointment) {
      throw new BadRequestException(
        `Impossibile creare appuntamenti ricorrenti. ${skippedCount} date saltate per capacità piena o mancanza operatore.`
      );
    }

    return firstAppointment;
  }

  /**
   * Ottiene gli appuntamenti raggruppati per slot per una GymRoom
   * Utile per visualizzare la capacità occupata in ogni slot
   */
  async getGymRoomSlotsWithOccupancy(
    gymRoomId: string,
    date: string,
  ): Promise<{ startTime: string; endTime: string; appointments: AvailabilityAppointment[]; count: number }[]> {
    const appointments = await this.findByGymRoomAndDate(gymRoomId, date);

    // Raggruppa per slot (startTime + endTime)
    const slotMap = new Map<string, AvailabilityAppointment[]>();

    for (const apt of appointments) {
      const key = `${apt.startTime}-${apt.endTime}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, []);
      }
      slotMap.get(key)!.push(apt);
    }

    // Converti in array
    return Array.from(slotMap.entries())
      .map(([key, apps]) => {
        const [startTime, endTime] = key.split('-');
        return {
          startTime,
          endTime,
          appointments: apps,
          count: apps.length,
        };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  // ==================== WHATSAPP INTEGRATION ====================

  /**
   * Fire-and-forget: dispatch WhatsApp booking notification.
   *
   * TODO[registry-integration]: i campi telefono/nome/cognome del paziente
   * vivono ora nel registry. Per chiamarlo dal background (fire-and-forget,
   * senza JWT utente) serve service-account Keycloak (roadmap §11 doc).
   * Fino a quel momento le notifiche WhatsApp sono disabilitate per appointment
   * con patientId. Le notifiche di walk-in con clientName/clientPhone valorizzati
   * direttamente nell'appointment continueranno a funzionare quando il caller
   * passa esplicitamente il PatientContact.
   */
  private dispatchWhatsappBooking(appointment: AvailabilityAppointment): void {
    if (!this.whatsappGateway) return;

    // Walk-in puro: l'appointment ha già telefono → usiamo direttamente i campi
    // dell'appointment. NB: se c'è solo clientName ma non clientPhone, NON è
    // walk-in usabile (manca il telefono!) — e se c'è patientId andiamo al
    // registry a cercarlo. Se non c'è patientId nemmeno, niente notifica.
    if (appointment.clientPhone) {
      this.whatsappGateway
        .dispatchBooking(appointment, this.walkInToContact(appointment))
        .catch((err) => this.logger.warn(`WhatsApp dispatch failed: ${err?.message}`));
      return;
    }

    if (!appointment.patientId) {
      this.logger.warn(
        `[WA-DISPATCH] SKIP appointmentId=${appointment.id}: né clientPhone né patientId`,
      );
      return;
    }

    // Paziente da registry: fetch S2S via service-account Keycloak
    const tenantAlias = this.tenantSchemaContext.getTenantAlias();
    if (!tenantAlias) {
      this.logger.warn(
        `[WA-DISPATCH] SKIP appointmentId=${appointment.id}: tenantAlias non disponibile`,
      );
      return;
    }

    this.fetchPatientContactAsService(appointment.patientId, tenantAlias)
      .then((contact) => {
        if (!contact) {
          this.logger.warn(
            `[WA-DISPATCH] SKIP appointmentId=${appointment.id}: subject ${appointment.patientId} non trovato nel registry`,
          );
          return;
        }
        return this.whatsappGateway!.dispatchBooking(appointment, contact);
      })
      .catch((err) => this.logger.warn(`WhatsApp dispatch failed: ${err?.message}`));
  }

  /**
   * Fire-and-forget: cancel WhatsApp booking notification.
   */
  private cancelWhatsappBooking(appointment: AvailabilityAppointment): void {
    if (!this.whatsappGateway) return;

    if (appointment.clientPhone) {
      this.whatsappGateway
        .cancelBooking(appointment, this.walkInToContact(appointment))
        .catch((err) => this.logger.warn(`WhatsApp cancel failed: ${err?.message}`));
      return;
    }

    if (!appointment.patientId) {
      this.logger.warn(
        `[WA-CANCEL] SKIP appointmentId=${appointment.id}: né clientPhone né patientId`,
      );
      return;
    }

    const tenantAlias = this.tenantSchemaContext.getTenantAlias();
    if (!tenantAlias) {
      this.logger.warn(
        `[WA-CANCEL] SKIP appointmentId=${appointment.id}: tenantAlias non disponibile`,
      );
      return;
    }

    this.fetchPatientContactAsService(appointment.patientId, tenantAlias)
      .then((contact) => {
        if (!contact) {
          this.logger.warn(
            `[WA-CANCEL] SKIP appointmentId=${appointment.id}: subject ${appointment.patientId} non trovato nel registry`,
          );
          return;
        }
        return this.whatsappGateway!.cancelBooking(appointment, contact);
      })
      .catch((err) => this.logger.warn(`WhatsApp cancel failed: ${err?.message}`));
  }

  // ==================== HELPERS PER WHATSAPP ====================

  private walkInToContact(appointment: AvailabilityAppointment): WhatsappPatientContact {
    const [nome, ...rest] = (appointment.clientName || '').split(' ');
    return {
      id: appointment.patientId || appointment.id,
      nome: nome || undefined,
      cognome: rest.join(' ') || undefined,
      cellulare: appointment.clientPhone,
    };
  }

  /**
   * Fetch del subject dal registry usando il service-account Keycloak.
   * Costruisce il PatientContact minimo per il gateway WhatsApp.
   */
  private async fetchPatientContactAsService(
    subjectId: string,
    tenantAlias: string,
  ): Promise<WhatsappPatientContact | null> {
    try {
      const subject = await this.registryClient.getSubjectAsService(subjectId, tenantAlias);
      if (!subject) return null;
      return {
        id: subject.id,
        nome: subject.firstName,
        cognome: subject.lastName,
        // Cellulare = STRICTLY MOBILE; Telefono = STRICTLY PHONE.
        // (no fallback incrociato: il gateway WhatsApp ne riceve uno solo per
        // chiamata, quindi se manca MOBILE il dispatch userà PHONE come fallback
        // dentro il gateway stesso)
        cellulare: this.primaryContactValue(subject, ['MOBILE']),
        telefono: this.primaryContactValue(subject, ['PHONE']),
      };
    } catch (err) {
      this.logger.warn(
        `Registry getSubjectAsService(${subjectId}, ${tenantAlias}) failed: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private primaryContactValue(
    subject: RegistrySubjectResponse,
    types: string[],
  ): string | undefined {
    for (const t of types) {
      const primary = subject.contacts?.find((c) => c.isPrimary && c.contactType === t);
      if (primary) return primary.value;
    }
    for (const t of types) {
      const any = subject.contacts?.find((c) => c.contactType === t);
      if (any) return any.value;
    }
    return undefined;
  }

  /**
   * Trova appuntamenti futuri di un paziente a partire da una data,
   * escludendo quelli cancellati.
   */
  async findByPatientFromDate(patientId: string, startDate: string): Promise<AvailabilityAppointment[]> {
    return this.appointmentRepo.find({
      where: {
        patientId,
        appointmentDate: MoreThanOrEqual(new Date(startDate)),
        bookingStatus: Not(In([
          BookingStatus.CANCELLED,
          BookingStatus.CANCELLED_EARLY,
          BookingStatus.CANCELLED_LATE,
        ])),
      },
      relations: [
        'operator',
        'service',
        'instruments',
        'instruments.instrument',
        'instruments.instrument.category',
      ],
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Re-invia il messaggio WhatsApp di recap per un appuntamento esistente.
   * Usa il service-account Keycloak per fetchare le PII paziente dal registry.
   */
  async sendRecap(appointmentId: string): Promise<boolean> {
    const appointment = await this.findById(appointmentId);
    if (!appointment.patientId) {
      throw new BadRequestException("L'appuntamento non ha un paziente associato");
    }
    if (!this.whatsappGateway) {
      throw new BadRequestException('Gateway WhatsApp non configurato');
    }

    const tenantAlias = this.tenantSchemaContext.getTenantAlias();
    if (!tenantAlias) {
      throw new BadRequestException('Tenant non risolto: impossibile contattare il registry');
    }

    const contact = await this.fetchPatientContactAsService(appointment.patientId, tenantAlias);
    if (!contact) {
      throw new NotFoundException(
        `Paziente ${appointment.patientId} non trovato nel registry`,
      );
    }

    await this.whatsappGateway.dispatchBooking(appointment, contact);
    return true;
  }

  // ==================== RECURRING SERIES MANAGEMENT ====================

  /**
   * Ottiene tutti gli appuntamenti di una serie ricorrente
   */
  async getRecurringSeries(recurringGroupId: string): Promise<AvailabilityAppointment[]> {
    return this.appointmentRepo.find({
      where: { recurringGroupId },
      relations: ['operator', 'gymRoom', 'service'],
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Cancella (soft) appuntamenti di una serie ricorrente
   */
  async cancelRecurringSeries(
    appointmentId: string,
    fromDate: string,
    reason: string,
    cancelledBy: string,
    scope: 'this_and_following' | 'all',
  ): Promise<number> {
    const appointment = await this.appointmentRepo.findOne({ where: { id: appointmentId } });
    if (!appointment || !appointment.recurringGroupId) {
      throw new BadRequestException('Appuntamento non trovato o non ricorrente');
    }

    const qb = this.appointmentRepo
      .createQueryBuilder()
      .update(AvailabilityAppointment)
      .set({
        bookingStatus: BookingStatus.CANCELLED_EARLY,
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledBy,
      })
      .where('"recurringGroupId" = :groupId', { groupId: appointment.recurringGroupId })
      .andWhere('"bookingStatus" NOT IN (:...cancelled)', {
        cancelled: [BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE],
      });

    if (scope === 'this_and_following') {
      qb.andWhere('"appointmentDate" >= :fromDate', { fromDate });
    }

    const result = await qb.execute();
    return result.affected || 0;
  }

  /**
   * Elimina (hard delete) appuntamenti di una serie ricorrente
   */
  async deleteRecurringSeries(
    appointmentId: string,
    fromDate: string,
    scope: 'this_and_following' | 'all',
  ): Promise<number> {
    const appointment = await this.appointmentRepo.findOne({ where: { id: appointmentId } });
    if (!appointment || !appointment.recurringGroupId) {
      throw new BadRequestException('Appuntamento non trovato o non ricorrente');
    }

    const qb = this.appointmentRepo
      .createQueryBuilder()
      .delete()
      .from(AvailabilityAppointment)
      .where('"recurringGroupId" = :groupId', { groupId: appointment.recurringGroupId });

    if (scope === 'this_and_following') {
      qb.andWhere('"appointmentDate" >= :fromDate', { fromDate });
    }

    const result = await qb.execute();
    return result.affected || 0;
  }
}
