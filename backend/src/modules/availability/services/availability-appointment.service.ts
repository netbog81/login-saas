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
import { AppointmentType } from '../entities/appointment-type.enum';
import { GymPatternGroupService } from './gym-pattern-group.service';
import { CreateGymAppointmentInput } from '../dto/create-gym-appointment.input';
import { Patient } from '../../../entities/patient.entity';
import { WhatsappGatewayService } from '../../whatsapp/gateway/whatsapp-gateway.service';

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
}

export interface UpdateAvailabilityAppointmentInput {
  /** @deprecated Usa services invece */
  serviceId?: string;
  /** Lista dei servizi da associare all'appuntamento */
  services?: ServiceInputItem[];
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
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => GymPatternGroupService))
    private gymPatternGroupService: GymPatternGroupService,
    @Optional() @Inject(forwardRef(() => WhatsappGatewayService))
    private whatsappGateway?: WhatsappGatewayService,
  ) {}

  /**
   * Crea un nuovo appuntamento con eventuali strumenti
   * Se repeatConfig è presente, crea una serie di appuntamenti ricorrenti
   * Ritorna il primo appuntamento della serie (o l'unico se non ricorrente)
   */
  async create(input: CreateAvailabilityAppointmentInput): Promise<AvailabilityAppointment> {
    const { instruments, repeatConfig, ...appointmentData } = input;

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
  ): Promise<AvailabilityAppointment> {
    // Usa una transazione per garantire che l'appuntamento e gli strumenti
    // vengano creati insieme o nessuno dei due (atomicità)
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const appointmentRepo = manager.getRepository(AvailabilityAppointment);

      const appointment = appointmentRepo.create({
        ...appointmentData,
        bookingStatus: BookingStatus.SCHEDULED,
        hasConflict: false,
        isRecurring,
        recurringGroupId,
        repeatConfig: repeatConfig ? {
          type: repeatConfig.type,
          interval: repeatConfig.interval,
          selectedDays: repeatConfig.selectedDays,
          endType: repeatConfig.endType,
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
        const appointment = await this.createSingleAppointment(
          { ...baseData, appointmentDate: date },
          instruments,
          true,
          recurringGroupId,
          i === 0 ? repeatConfig : undefined, // Solo il primo appuntamento ha la config
        );

        // WhatsApp dispatch per OGNI appuntamento della serie
        this.dispatchWhatsappBooking(appointment);

        if (i === 0) {
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
  private async assignInstruments(
    appointmentId: string,
    appointmentDate: Date,
    appointmentStartTime: string,
    instruments: CreateAppointmentInstrumentInput[],
  ): Promise<void> {
    for (const instrumentInput of instruments) {
      // Trova uno strumento disponibile per la categoria e il time slot
      const availableInstrument = await this.findAvailableInstrument(
        instrumentInput.instrumentCategoryId,
        appointmentDate,
        appointmentStartTime,
        instrumentInput.startOffsetMinutes,
        instrumentInput.endOffsetMinutes,
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
  ): Promise<string[]> {
    // Formatta la data
    const dateStr = appointmentDate instanceof Date
      ? appointmentDate.toISOString().split('T')[0]
      : appointmentDate;

    // Query per trovare strumenti già prenotati che si sovrappongono
    const result = await this.appointmentInstrumentRepo
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
      relations: ['operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrument.category'],
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
      relations: ['operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrument.category'],
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

    const { instruments, services, ...updateData } = input;

    // Aggiorna i campi dell'appuntamento
    Object.assign(appointment, updateData);
    await this.appointmentRepo.save(appointment);

    // Se vengono passati strumenti, aggiorna le associazioni
    if (instruments !== undefined) {
      // Rimuovi le vecchie associazioni
      await this.appointmentInstrumentRepo.delete({ appointmentId: id });

      // Aggiungi le nuove
      if (instruments.length > 0) {
        await this.assignInstruments(
          id,
          appointment.appointmentDate,
          appointment.startTime,
          instruments,
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
      await this.incrementPatientCancellation(appointment.patientId);
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
      await this.incrementPatientNoShow(appointment.patientId);
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
   * Incrementa il contatore cancellazioni del paziente per l'anno corrente
   */
  private async incrementPatientCancellation(patientId: string): Promise<void> {
    const year = new Date().getFullYear().toString();

    // Query raw per aggiornare il JSONB direttamente
    await this.dataSource.query(`
      UPDATE patients
      SET "cancellationsByYear" = jsonb_set(
        COALESCE("cancellationsByYear", '{}'::jsonb),
        '{${year}}',
        to_jsonb(COALESCE(("cancellationsByYear"->>'${year}')::int, 0) + 1)
      )
      WHERE id = $1
    `, [patientId]);
  }

  /**
   * Incrementa il contatore no-show del paziente per l'anno corrente
   */
  private async incrementPatientNoShow(patientId: string): Promise<void> {
    const year = new Date().getFullYear().toString();

    // Query raw per aggiornare il JSONB direttamente
    await this.dataSource.query(`
      UPDATE patients
      SET "noShowsByYear" = jsonb_set(
        COALESCE("noShowsByYear", '{}'::jsonb),
        '{${year}}',
        to_jsonb(COALESCE(("noShowsByYear"->>'${year}')::int, 0) + 1)
      )
      WHERE id = $1
    `, [patientId]);
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
  ): Promise<AvailabilityAppointment> {
    const appointment = this.appointmentRepo.create({
      operatorId: data.operatorId,
      gymRoomId: data.gymRoomId,
      serviceId: data.serviceId,
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
      repeatConfig: repeatConfig ? {
        type: repeatConfig.type,
        interval: repeatConfig.interval,
        selectedDays: repeatConfig.selectedDays,
        endType: repeatConfig.endType,
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

        const appointment = await this.createSingleGymAppointment(
          { ...baseData, appointmentDate: date, operatorId: operator.id },
          gymRoom,
          true,
          recurringGroupId,
          i === 0 ? repeatConfig : undefined,
        );

        // WhatsApp dispatch per OGNI appuntamento della serie
        this.dispatchWhatsappBooking(appointment);

        if (i === 0) {
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
   * Never throws - errors are logged silently.
   */
  private dispatchWhatsappBooking(appointment: AvailabilityAppointment): void {
    if (!this.whatsappGateway || !appointment.patientId) return;

    this.patientRepo
      .findOne({ where: { id: appointment.patientId } })
      .then((patient) => {
        if (patient) {
          return this.whatsappGateway!.dispatchBooking(appointment, patient);
        }
      })
      .catch((err) => {
        this.logger.warn(`WhatsApp dispatch failed: ${err?.message}`);
      });
  }

  /**
   * Fire-and-forget: cancel WhatsApp booking notification.
   * Never throws - errors are logged silently.
   */
  private cancelWhatsappBooking(appointment: AvailabilityAppointment): void {
    this.logger.log(`[WA-CANCEL-HOOK] appointmentId=${appointment.id} patientId=${appointment.patientId} gateway=${!!this.whatsappGateway}`);
    if (!this.whatsappGateway) {
      this.logger.warn(`[WA-CANCEL-HOOK] SKIP: whatsappGateway not injected`);
      return;
    }
    if (!appointment.patientId) {
      this.logger.warn(`[WA-CANCEL-HOOK] SKIP: no patientId on appointment ${appointment.id}`);
      return;
    }

    this.patientRepo
      .findOne({ where: { id: appointment.patientId } })
      .then((patient) => {
        if (patient) {
          this.logger.log(`[WA-CANCEL-HOOK] Patient found: ${patient.nome} ${patient.cognome}, calling cancelBooking`);
          return this.whatsappGateway!.cancelBooking(appointment, patient);
        } else {
          this.logger.warn(`[WA-CANCEL-HOOK] Patient not found for id=${appointment.patientId}`);
        }
      })
      .catch((err) => {
        this.logger.warn(`WhatsApp cancel failed: ${err?.message}`);
      });
  }
}
