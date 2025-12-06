import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, Between, LessThanOrEqual, MoreThanOrEqual, DataSource, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AvailabilityAppointment, BookingStatus } from '../entities/availability-appointment.entity';
import { AppointmentInstrument } from '../entities/appointment-instrument.entity';
import { Instrument } from '../entities/instrument.entity';
import { InstrumentCategory } from '../entities/instrument-category.entity';
import { InstrumentStatus } from '../entities/instrument-status.enum';
import { RecurringType, RecurringEndType } from '../dto/create-availability-appointment.input';

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
  serviceId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: number;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  notes?: string;
  instrumentOrderMatters?: boolean;
  instruments?: CreateAppointmentInstrumentInput[];
  repeatConfig?: RepeatConfigInput;
}

export interface UpdateAvailabilityAppointmentInput {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  patientId?: number;
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  bookingStatus?: BookingStatus;
  cancellationReason?: string;
  operatorNotes?: string;
  instrumentOrderMatters?: boolean;
  instruments?: CreateAppointmentInstrumentInput[];
}

@Injectable()
export class AvailabilityAppointmentService {
  constructor(
    @InjectRepository(AvailabilityAppointment)
    private appointmentRepo: Repository<AvailabilityAppointment>,
    @InjectRepository(AppointmentInstrument)
    private appointmentInstrumentRepo: Repository<AppointmentInstrument>,
    @InjectRepository(Instrument)
    private instrumentRepo: Repository<Instrument>,
    @InjectRepository(InstrumentCategory)
    private instrumentCategoryRepo: Repository<InstrumentCategory>,
    private dataSource: DataSource,
  ) {}

  /**
   * Crea un nuovo appuntamento con eventuali strumenti
   * Se repeatConfig è presente, crea una serie di appuntamenti ricorrenti
   * Ritorna il primo appuntamento della serie (o l'unico se non ricorrente)
   */
  async create(input: CreateAvailabilityAppointmentInput): Promise<AvailabilityAppointment> {
    const { instruments, repeatConfig, ...appointmentData } = input;

    // Se c'è una configurazione di ricorrenza, crea appuntamenti multipli
    if (repeatConfig) {
      return this.createRecurringAppointments(appointmentData, instruments, repeatConfig);
    }

    // Crea singolo appuntamento
    return this.createSingleAppointment(appointmentData, instruments);
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

      // Ricarica l'appuntamento con le relazioni
      return this.findByIdWithManager(manager, savedAppointment.id);
    });
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
      relations: ['operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrument.category'],
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
      relations: ['operator', 'service', 'instruments', 'instruments.instrument', 'instruments.instrument.category'],
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
        bookingStatus: Not(In([BookingStatus.CANCELLED, BookingStatus.NO_SHOW])),
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
    const appointment = await this.findById(id);
    const { instruments, ...updateData } = input;

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

    return this.findById(id);
  }

  /**
   * Cancella un appuntamento (soft delete - imposta status a CANCELLED)
   */
  async cancel(id: string, cancellationReason?: string): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);
    appointment.bookingStatus = BookingStatus.CANCELLED;
    appointment.cancellationReason = cancellationReason;
    await this.appointmentRepo.save(appointment);
    return this.findById(id);
  }

  /**
   * Elimina definitivamente un appuntamento
   */
  async delete(id: string): Promise<boolean> {
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
   * Segna come no-show
   */
  async markAsNoShow(id: string): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);
    appointment.bookingStatus = BookingStatus.NO_SHOW;
    await this.appointmentRepo.save(appointment);
    return this.findById(id);
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
}
