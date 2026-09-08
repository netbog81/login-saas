import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, forwardRef, Optional, Logger } from '@nestjs/common';
import { In, Not, Between, LessThanOrEqual, MoreThanOrEqual, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AvailabilityAppointment, BookingStatus, ArrivalSource } from '../entities/availability-appointment.entity';
import { AppointmentInstrument } from '../entities/appointment-instrument.entity';
import { AppointmentService as AppointmentServiceEntity } from '../entities/appointment-service.entity';
import { Instrument } from '../entities/instrument.entity';
import { InstrumentCategory } from '../entities/instrument-category.entity';
import { InstrumentStatus } from '../entities/instrument-status.enum';
import { RecurringType, RecurringEndType, MonthlyMode, ServiceInputItem } from '../dto/create-availability-appointment.input';
import { GymRoom } from '../entities/gym-room.entity';
import { Site } from '../entities/site.entity';
import { AppointmentType } from '../entities/appointment-type.enum';
import { GymPatternGroupService } from './gym-pattern-group.service';
import { GymExceptionService } from './gym-exception.service';
import { TreatmentCascadeService } from './treatment-cascade.service';
import { EventsService } from '../../events/events.service';
import { ConflictReason } from '../entities/availability-appointment.entity';
import { AvailabilityException, ExceptionType } from '../entities/availability-exception.entity';
import { findBlockingException } from '../utils/day-exception-semantics.util';
import { toDateString } from '../utils/date-string.util';
import {
  RecurringOccurrenceConflict, RecurringOccurrencePreview,
} from '../dto/recurring-series-conflict.output';
import { RecurringOccurrenceInput } from '../dto/recurring-occurrence.input';
import {
  calculateRecurringDates,
  RecurrenceConfig,
} from '../utils/recurring-dates.util';
import { CreateGymAppointmentInput } from '../dto/create-gym-appointment.input';
import { ClinicalSubjectIndex } from '../../../patients/entities/clinical-subject-index.entity';
import { ClinicalAttendanceService } from '../../../patients/services/clinical-attendance.service';
import { AttendanceEventType } from '../../../patients/entities/clinical-attendance-log.entity';
import { WhatsappGatewayService, WhatsappPatientContact, AppointmentSlot } from '../../whatsapp/gateway/whatsapp-gateway.service';
import { WhatsappChatService } from '../../whatsapp/chat/services/whatsapp-chat.service';
import { RegistryClient } from '../../registry/registry.client';
import { RegistrySubjectResponse } from '../../registry/registry.types';
import { TenantContextService } from '@curandis/tenant-datasource';
import { GeneralSettingsService } from '../../settings/services/general-settings.service';
import { AvailabilityService } from './availability.service';
import { RoomConflictService } from './room-conflict.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';

/**
 * Ricorrenza come la vede il service. Gemella del DTO GraphQL omonimo in
 * `dto/create-availability-appointment.input.ts`, tenuta separata perche' il
 * service e' chiamato anche da percorsi non-GraphQL.
 */
export interface RepeatConfigInput {
  type: RecurringType;
  interval: number;
  selectedDays?: number[];
  endType: RecurringEndType;
  occurrences?: number;
  untilDate?: string;
  /** Solo per type=MONTHLY. Assente = per data del mese (comportamento storico). */
  monthlyMode?: MonthlyMode;
  /** Fasce mensili "il <ordinal> <weekday>" quando monthlyMode = DAY_OF_WEEK. */
  monthlyRules?: { ordinal: number; weekday: number }[];
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
  /**
   * Piano risolto dal riquadro conflitti: le occorrenze da creare davvero.
   * Quando c'è, sostituisce la generazione dalle regole.
   */
  occurrences?: RecurringOccurrenceInput[];
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
  /**
   * Sposta una prenotazione palestra in un'altra sala. L'istruttore e la
   * capienza NON si passano: li ricava `update()` dal template della sala di
   * destinazione, perché in palestra sono una conseguenza della sala e non
   * una scelta di chi sposta.
   */
  gymRoomId?: string;
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
    private tenantSchemaContext: TenantContextService,
    @Inject(forwardRef(() => GymPatternGroupService))
    private gymPatternGroupService: GymPatternGroupService,
    @Inject(forwardRef(() => GymExceptionService))
    private gymExceptionService: GymExceptionService,
    private registryClient: RegistryClient,
    private attendanceService: ClinicalAttendanceService,
    private generalSettingsService: GeneralSettingsService,
    @Inject(forwardRef(() => AvailabilityService))
    private availabilityService: AvailabilityService,
    @Inject(forwardRef(() => TreatmentCascadeService))
    private treatmentCascade: TreatmentCascadeService,
    private eventsService: EventsService,
    private roomConflictService: RoomConflictService,
    @Optional() @Inject(forwardRef(() => WhatsappGatewayService))
    private whatsappGateway?: WhatsappGatewayService,
    @Optional() @Inject(forwardRef(() => WhatsappChatService))
    private whatsappChat?: WhatsappChatService,
    /**
     * Sincronizzazione Google Calendar: opzionale e sempre fire-and-forget.
     * Un problema con Google non deve mai impedire di salvare un appuntamento.
     */
    @Optional() @Inject(forwardRef(() => GoogleCalendarSyncService))
    private googleSync?: GoogleCalendarSyncService,
  ) {}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantSchemaContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get appointmentRepo() { return this.dataSource.getRepository(AvailabilityAppointment); }
  private get appointmentInstrumentRepo() { return this.dataSource.getRepository(AppointmentInstrument); }
  private get appointmentServiceRepo() { return this.dataSource.getRepository(AppointmentServiceEntity); }
  private get instrumentRepo() { return this.dataSource.getRepository(Instrument); }
  private get instrumentCategoryRepo() { return this.dataSource.getRepository(InstrumentCategory); }
  private get gymRoomRepo() { return this.dataSource.getRepository(GymRoom); }
  private get siteRepo() { return this.dataSource.getRepository(Site); }
  private get subjectIndexRepo() { return this.dataSource.getRepository(ClinicalSubjectIndex); }

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
   * Prefisso d'errore per i conflitti su serie ricorrenti (creazione o
   * modifica): il messaggio contiene il JSON dell'elenco conflitti, cosi'
   * il frontend lo intercetta e mostra il riepilogo.
   */
  static readonly RECURRING_CONFLICT_ERROR =
    'RECURRING_SERIES_CONFLICT';

  /**
   * Guard: se l'impostazione "blocca appuntamenti fuori disponibilita'" e'
   * attiva, verifica che l'intervallo [startTime, endTime] sia interamente
   * coperto dalla disponibilita' dell'operatore in quella data.
   *
   * - Salta il controllo se il flag globale e' off o se l'utente ha forzato
   *   esplicitamente (forceOutsideAvailability).
   * - Vale anche per i nonRetribuito. Pausa pranzo & co. sono legittimamente
   *   fuori orario, ma fino al 19/08/2026 venivano creati in silenzio: chi
   *   sbagliava fascia non se ne accorgeva. Ora il frontend chiede conferma e
   *   passa la forzatura, quindi il caso legittimo resta possibile ma
   *   consapevole.
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
    forceOutsideAvailability?: boolean;
    /** Appuntamento da escludere dal calcolo (in update: se stesso). */
    excludeAppointmentId?: string;
  }): Promise<void> {
    if (params.forceOutsideAvailability) return;
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
    const {
      instruments, repeatConfig, forceOutsideAvailability, occurrences, ...appointmentData
    } = input;

    // Guard disponibilita': blocca la creazione fuori orario operatore se
    // l'impostazione e' attiva e l'utente non ha forzato esplicitamente.
    //
    // Col piano risolto il guard non serve: l'utente ha appena visto ogni
    // singola occorrenza con il suo conflitto e ha deciso. Riproporgli qui
    // una domanda sulla prima data sarebbe chiedere due volte la stessa cosa.
    if (!occurrences?.length) {
      await this.assertWithinAvailability({
        operatorId: appointmentData.operatorId,
        appointmentDate: appointmentData.appointmentDate,
        startTime: appointmentData.startTime,
        endTime: appointmentData.endTime,
        forceOutsideAvailability,
      });
    }

    let savedAppointment: AvailabilityAppointment;

    // Se c'è una configurazione di ricorrenza, crea appuntamenti multipli
    if (repeatConfig) {
      // Il dispatch WhatsApp avviene dentro createRecurringAppointments per ogni appuntamento
      savedAppointment = await this.createRecurringAppointments(
        appointmentData, instruments, repeatConfig, occurrences,
      );
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

      // Snapshot studio/poltrona ereditati dall'assegnazione template
      // dell'operatore alla data/ora della prenotazione. Gli appuntamenti
      // palestra passano da createSingleGymAppointment e non arrivano qui.
      let roomSnapshot: { roomId: string | null; chairId: string | null } = {
        roomId: null,
        chairId: null,
      };
      if (appointmentData.operatorId) {
        const snapDate = appointmentData.appointmentDate as any;
        roomSnapshot = await this.roomConflictService.resolveRoomForSlot(
          appointmentData.operatorId,
          snapDate instanceof Date
            ? snapDate.toISOString().split('T')[0]
            : String(snapDate).slice(0, 10),
          appointmentData.startTime,
        );
      }

      const appointment = appointmentRepo.create({
        ...appointmentData,
        siteId: defaultSiteId,
        roomId: roomSnapshot.roomId ?? undefined,
        chairId: roomSnapshot.chairId ?? undefined,
        bookingStatus: BookingStatus.SCHEDULED,
        hasConflict: false,
        isRecurring,
        recurringGroupId,
        isMaster,
        masterAppointmentId,
        repeatConfig: repeatConfig
          ? this.normalizeRepeatConfigForStorage(repeatConfig)
          : undefined,
      });

      const savedAppointment = await appointmentRepo.save(appointment);
      // Push su Google: non attende, non blocca, e se fallisce ci pensa la
      // riconciliazione periodica.
      this.googleSync?.schedulePush(savedAppointment.id);

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
    /**
     * Piano risolto dall'utente nel riquadro conflitti. Quando c'è, comanda
     * lui: queste sono le occorrenze da creare, con gli spostamenti già
     * decisi (data, orario, perfino operatore diverso) e le occorrenze
     * saltate semplicemente assenti. Quando manca, le date si generano dalla
     * regola come sempre — è il caso della palestra e dei client che non
     * passano dal riquadro.
     */
    plan?: RecurringOccurrenceInput[],
  ): Promise<AvailabilityAppointment> {
    if (!repeatConfig) {
      throw new BadRequestException('Configurazione ricorrenza mancante');
    }

    const occurrences: RecurringOccurrenceInput[] = plan?.length
      ? plan
      : this.calculateRecurringDates(baseData.appointmentDate, repeatConfig).map(date => ({
          date,
          startTime: baseData.startTime,
          endTime: baseData.endTime,
        }));

    if (occurrences.length === 0) {
      throw new BadRequestException('Nessuna data valida per la ricorrenza');
    }

    // Senza piano risolto resta la validazione avvisa-e-blocca storica: se
    // anche una sola occorrenza è in conflitto non si crea niente. Le serie
    // palestra hanno regole proprie (slot condiviso) e restano fuori.
    //
    // Col piano risolto la validazione è già avvenuta nel riquadro; qui si
    // ricontrollano solo le sovrapposizioni, perché sono l'unica cosa che
    // può essere cambiata da qualcun altro nel frattempo.
    const isGym = (baseData as any).appointmentType === AppointmentType.GYM;
    const operatorId = (baseData as any).operatorId;

    if (!isGym && operatorId) {
      const conflicts = plan?.length
        ? await this.recheckResolvedOccurrences(
            occurrences.map(o => ({
              operatorId: o.operatorId ?? operatorId,
              date: o.date,
              startTime: o.startTime,
              endTime: o.endTime,
            })),
          )
        : await this.validateRecurringOccurrences(
            occurrences.map(o => ({
              operatorId,
              date: o.date,
              startTime: o.startTime,
              endTime: o.endTime,
            })),
          );

      if (conflicts.length > 0) {
        throw new ConflictException(
          `${AvailabilityAppointmentService.RECURRING_CONFLICT_ERROR}: ${JSON.stringify(conflicts)}`,
        );
      }
    }

    // Genera un ID di gruppo per collegare tutti gli appuntamenti
    const recurringGroupId = uuidv4();

    // Crea tutti gli appuntamenti
    let firstAppointment: AvailabilityAppointment | null = null;

    for (const occ of occurrences) {
      try {
        const isFirst = firstAppointment === null;
        const appointment = await this.createSingleAppointment(
          {
            ...baseData,
            appointmentDate: occ.date,
            startTime: occ.startTime,
            endTime: occ.endTime,
            ...(occ.operatorId ? { operatorId: occ.operatorId } : {}),
          },
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
        console.warn(`Impossibile creare appuntamento ricorrente per ${occ.date}:`, error.message);
      }
    }

    if (!firstAppointment) {
      throw new BadRequestException('Impossibile creare appuntamenti ricorrenti');
    }

    return firstAppointment;
  }

  /**
   * Config di ricorrenza nella forma in cui va persistita sul master della
   * serie: enum in minuscolo (il dialog operatore li manda in maiuscolo, il
   * flusso palestra in minuscolo) e fasce mensili incluse.
   */
  private normalizeRepeatConfigForStorage(
    repeatConfig: RepeatConfigInput,
  ): AvailabilityAppointment['repeatConfig'] {
    return {
      type: String(repeatConfig.type).toLowerCase() as any,
      interval: repeatConfig.interval,
      selectedDays: repeatConfig.selectedDays,
      endType: String(repeatConfig.endType).toLowerCase() as any,
      occurrences: repeatConfig.occurrences,
      untilDate: repeatConfig.untilDate,
      monthlyMode: repeatConfig.monthlyMode
        ? (String(repeatConfig.monthlyMode).toLowerCase() as any)
        : undefined,
      monthlyRules: repeatConfig.monthlyRules,
    };
  }

  /**
   * Date di una serie ricorrente, con la data di partenza sempre inclusa
   * come prima occorrenza.
   *
   * Il calcolo vive in `recurring-dates.util.ts`: e' pura aritmetica sulle
   * date, senza repository ne' Nest, e come tale si puo' ragionare e provare
   * da sola. Qui resta solo la normalizzazione degli enum GraphQL, che i
   * client mandano indifferentemente in maiuscolo o minuscolo.
   */
  private calculateRecurringDates(startDate: string, config: RepeatConfigInput): string[] {
    return calculateRecurringDates(startDate, {
      type: String(config.type).toLowerCase() as RecurrenceConfig['type'],
      interval: config.interval,
      selectedDays: config.selectedDays,
      endType: String(config.endType).toLowerCase() as RecurrenceConfig['endType'],
      occurrences: config.occurrences,
      untilDate: config.untilDate,
      monthlyMode: config.monthlyMode
        ? (String(config.monthlyMode).toLowerCase() as RecurrenceConfig['monthlyMode'])
        : undefined,
      monthlyRules: config.monthlyRules,
    });
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
    endDate?: string,
  ): Promise<AvailabilityAppointment[]> {
    return this.appointmentRepo.find({
      where: {
        operatorId,
        // Senza `endDate` l'intervallo è APERTO: "da questa data in poi",
        // senza limite. Serve al filtro "Da oggi in poi", dove imporre una
        // fine arbitraria taglierebbe fuori proprio gli appuntamenti lontani
        // che si stanno cercando.
        appointmentDate: endDate
          ? Between(new Date(startDate), new Date(endDate))
          : MoreThanOrEqual(new Date(startDate)),
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
    // Il NO_SHOW resta in lista: l'assenza deve restare VISIBILE sul
    // calendario (chip sbiadito con l'icona della persona barrata), non
    // sparire come se l'appuntamento non fosse mai esistito. La segreteria
    // deve poter ripescare la fascia per correggerla se il paziente arriva
    // in ritardo. Lo slot resta comunque prenotabile: il calcolo delle
    // disponibilita' (`availability.service`) esclude i no-show per conto suo.
    const whereCondition: any = {
      appointmentDate: Between(new Date(startDate), new Date(endDate)),
      bookingStatus: Not(In([BookingStatus.CANCELLED])),
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
    //
    // Il confronto va NORMALIZZATO su entrambi i lati: le colonne `time`
    // tornano "14:00:00" mentre il client manda "14:00", e la colonna `date`
    // può arrivare come stringa o come Date. Confrontandoli grezzi risultava
    // sempre uno spostamento, e ogni salvataggio — anche di una sola nota —
    // faceva partire al paziente la notifica di appuntamento spostato.
    const dayChanged =
      !!input.appointmentDate &&
      this.toIsoDay(input.appointmentDate) !== this.toIsoDay(appointment.appointmentDate);
    const startChanged =
      !!input.startTime && this.toHhMm(input.startTime) !== this.toHhMm(appointment.startTime);
    const endChanged =
      !!input.endTime && this.toHhMm(input.endTime) !== this.toHhMm(appointment.endTime);

    const positionChanged = dayChanged || startChanged || endChanged;

    // Da dove l'appuntamento si sposta. Va letto PRIMA del salvataggio: dopo
    // l'entità porta i valori nuovi, e il messaggio al paziente direbbe
    // "spostato dal 22 al 22". Con più spostamenti in un solo messaggio è
    // l'unica cosa che gli fa riconoscere quale appuntamento si è mosso.
    const previousSlot: AppointmentSlot = {
      appointmentDate: appointment.appointmentDate,
      startTime: appointment.startTime,
    };

    /**
     * L'operatore di PARTENZA, letto anche lui prima del salvataggio.
     *
     * Se l'appuntamento viene riassegnato, `schedulePush` lo scrive sul
     * calendario nuovo ma del vecchio non sa più niente: dopo il salvataggio
     * l'`operatorId` è cambiato e non risulta da nessuna parte che l'evento
     * fosse finito là. Senza questo, il collega si ritrovava sull'agenda un
     * appuntamento che non era più suo, e nessuno lo toglieva mai.
     */
    const previousOperatorId = appointment.operatorId;

    /**
     * Cosa fa cambiare idea al PAZIENTE: il giorno e l'ora in cui deve
     * presentarsi. Un endTime diverso (un servizio aggiunto, una durata
     * ritoccata) allunga l'appuntamento ma non lo sposta, e il messaggio di
     * spostamento gli ripeterebbe la stessa data e la stessa ora.
     */
    const scheduleChangedForPatient = dayChanged || startChanged;

    /**
     * Cambio di SALA di una prenotazione palestra. Conta come spostamento
     * quanto un cambio di orario: la sala nuova ha un proprio template (e
     * quindi un proprio istruttore per quella fascia), proprie chiusure e
     * una propria capienza. Senza questo, spostare la stessa fascia da una
     * palestra all'altra passava tutti i controlli e lasciava la
     * prenotazione intestata all'istruttore della sala di partenza.
     */
    const gymRoomChanged =
      !!input.gymRoomId && input.gymRoomId !== appointment.gymRoomId;

    // I check vanno rieseguiti se cambia posizione (orario/data/sala) O
    // operatore: un appuntamento riassegnato va verificato sul nuovo
    // operatore anche a parità di orario.
    const needsPositionChecks = positionChanged || operatorChanged || gymRoomChanged;

    // Spostamento di un appuntamento PALESTRA: blocca se la nuova posizione
    // cade in uno slot chiuso (chiusura, slot isClosed, fuori orari modificati).
    if (needsPositionChecks && appointment.appointmentType === AppointmentType.GYM) {
      const gymRoomId = input.gymRoomId || appointment.gymRoomId;
      if (gymRoomId) {
        const gymCheckDate = input.appointmentDate || appointment.appointmentDate;
        const closure = await this.gymExceptionService.getSlotClosure(
          gymRoomId,
          gymCheckDate instanceof Date ? gymCheckDate : new Date(gymCheckDate),
          input.startTime || appointment.startTime,
          input.endTime || appointment.endTime,
        );
        if (closure.closed) {
          throw new ConflictException(
            closure.reason || 'La palestra è chiusa in questa fascia oraria',
          );
        }

        // Capienza della sala di destinazione. In palestra non esiste la
        // sovrapposizione per operatore — lo slot è condiviso — ma i posti
        // sono finiti: senza questo check uno spostamento poteva far entrare
        // un undicesimo paziente in una sala da dieci, cosa che la
        // prenotazione diretta ha sempre impedito.
        const capacity = input.gymRoomId
          ? (await this.gymRoomRepo.findOne({ where: { id: gymRoomId } }))?.maxCapacity ?? null
          : appointment.maxParticipants ?? null;
        if (capacity !== null) {
          const inSlot = await this.countAppointmentsInSlot(
            gymRoomId,
            // toDateString e non toISOString: la colonna è di tipo `date` e
            // TypeORM la restituisce a mezzanotte LOCALE — convertirla in UTC
            // in un fuso a est di Greenwich la manda al giorno prima, e il
            // conteggio guarderebbe lo slot sbagliato.
            toDateString(gymCheckDate as unknown as Date | string),
            input.startTime || appointment.startTime,
            input.endTime || appointment.endTime,
            id,
          );
          if (inSlot >= capacity) {
            throw new ConflictException(
              `Capacità massima della sala raggiunta per questo slot (${inSlot}/${capacity})`,
            );
          }
        }

        // Istruttore e capienza della DESTINAZIONE. In palestra l'operatore
        // non lo sceglie chi sposta: lo assegna il template della sala per
        // quella fascia. Conservare quello di partenza intesterebbe la
        // prenotazione (e quindi il trattamento, e quindi la fatturazione) a
        // un istruttore che quel giorno in quella sala non c'è.
        const destDate =
          gymCheckDate instanceof Date ? gymCheckDate : new Date(gymCheckDate);
        const destOperator = await this.gymPatternGroupService.getOperatorForTimeSlot(
          gymRoomId,
          destDate,
          input.startTime || appointment.startTime,
        );
        if (!destOperator) {
          throw new ConflictException(
            'Nessun istruttore assegnato alla fascia di destinazione (verificare i template della palestra)',
          );
        }
        const effective = await this.resolveEffectiveGymOperatorFields(
          gymRoomId,
          destOperator.id,
          destDate,
          input.startTime || appointment.startTime,
        );
        (input as any).operatorId = effective.operatorId ?? destOperator.id;
        (input as any).originalOperatorId = effective.originalOperatorId ?? null;
        (input as any).isSubstitution = effective.isSubstitution ?? false;
        (input as any).reassignedByGymExceptionId =
          effective.reassignedByGymExceptionId ?? null;

        // Cambio sala: la capienza massima è un dato denormalizzato
        // sull'appuntamento e va riallineata alla sala nuova.
        if (input.gymRoomId) {
          const destRoom = await this.gymRoomRepo.findOne({ where: { id: gymRoomId } });
          if (destRoom) (input as any).maxParticipants = destRoom.maxCapacity;
        }
      }
    }

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
      (updateData as any).conflictSourceExceptionId = null;
    }

    // Snapshot studio/poltrona: ricalcolato quando cambiano data, ora o
    // operatore (l'assegnazione template valida può essere diversa).
    if (
      needsPositionChecks &&
      appointment.appointmentType !== AppointmentType.GYM &&
      checkOperatorId
    ) {
      const snapDate = (input.appointmentDate as any) ?? appointment.appointmentDate;
      const snap = await this.roomConflictService.resolveRoomForSlot(
        checkOperatorId,
        snapDate instanceof Date
          ? snapDate.toISOString().split('T')[0]
          : String(snapDate).slice(0, 10),
        input.startTime || appointment.startTime,
      );
      (updateData as any).roomId = snap.roomId;
      (updateData as any).chairId = snap.chairId;
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
    // (sala compresa: la nuova sala può avere lo slot scoperto da un'eccezione)
    if ((positionChanged || gymRoomChanged) && result.appointmentType === AppointmentType.GYM) {
      this.checkAndMarkConflictForGymAppointment(
        result.id,
        result.gymRoomId,
        result.operatorId,
        result.appointmentDate,
        result.startTime,
      ).catch(() => {});
    }

    // Check proattivo per appuntamenti NON palestra: se la nuova posizione
    // (o il nuovo operatore) ricade in un'assenza operatore, rimarca il
    // conflitto. Copre il caso "spostato dentro un'altra assenza".
    if (needsPositionChecks && result.appointmentType !== AppointmentType.GYM) {
      this.checkAndMarkConflictForOperatorAppointment(result).catch(() => {});
    }

    // Notifica WhatsApp di spostamento: solo se è cambiata data/ora (un cambio
    // di solo operatore non interessa il paziente) e l'appuntamento è ancora
    // attivo. Fire-and-forget: non deve mai bloccare l'update.
    const cancelledStatuses: BookingStatus[] = [
      BookingStatus.CANCELLED,
      BookingStatus.CANCELLED_EARLY,
      BookingStatus.CANCELLED_LATE,
    ];
    if (scheduleChangedForPatient && !cancelledStatuses.includes(result.bookingStatus)) {
      this.dispatchWhatsappUpdate(result, previousSlot);
    }

    // Allinea l'evento su Google. `schedulePush` decide da sé se l'evento va
    // aggiornato o rimosso, così anche un update che disdice l'appuntamento
    // lo toglie dal calendario dell'operatore.
    this.googleSync?.schedulePush(result.id);

    // Riassegnato: va tolto anche dal calendario di chi lo aveva prima. Se
    // questa dovesse perdersi — è fire-and-forget come il push — ci pensa la
    // riversata integrale, che gli strascichi li scova confrontandosi con
    // Google invece che ricordandoseli.
    if (previousOperatorId && previousOperatorId !== result.operatorId) {
      this.googleSync?.scheduleRemoval(result.id, previousOperatorId);
    }

    return result;
  }

  /**
   * Verifica se un appuntamento (non palestra) ricade in un'assenza del suo
   * operatore (AvailabilityException) e in tal caso marca il conflitto con
   * il riferimento all'eccezione sorgente. Fire-and-forget.
   */
  private async checkAndMarkConflictForOperatorAppointment(
    appointment: AvailabilityAppointment,
  ): Promise<void> {
    if (!appointment.operatorId || appointment.nonRetribuito) return;

    try {
      const exceptions = await this.dataSource
        .getRepository(AvailabilityException)
        .find({
          where: {
            operatorId: appointment.operatorId,
            exceptionDate: appointment.appointmentDate,
          },
        });
      if (exceptions.length === 0) return;

      // Predicato condiviso: una disponibilità straordinaria che copre
      // l'appuntamento lo mette al riparo (vedi day-exception-semantics.util).
      const hit = findBlockingException(
        exceptions,
        appointment.startTime,
        appointment.endTime,
      );

      if (hit) {
        const reason =
          hit.exceptionType === ExceptionType.SICK
            ? ConflictReason.OPERATOR_SICK
            : hit.exceptionType === ExceptionType.VACATION
              ? ConflictReason.OPERATOR_VACATION
              : ConflictReason.OPERATOR_UNAVAILABLE;
        await this.appointmentRepo.update(appointment.id, {
          hasConflict: true,
          conflictReason: reason,
          conflictDetectedAt: new Date(),
          conflictSourceExceptionId: hit.id,
        });
        this.logger.warn(
          `Appuntamento ${appointment.id} spostato dentro un'assenza operatore → hasConflict=true`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Errore check assenza per appointment ${appointment.id}: ${err?.message}`,
      );
    }
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
    // Un appuntamento disdetto non deve restare sul calendario dell'operatore.
    this.googleSync?.scheduleRemoval(appointment.id, appointment.operatorId);

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
      this.googleSync?.scheduleRemoval(appointment.id, appointment.operatorId);
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
   * Segna come no-show, senza vincoli sullo stato di partenza.
   *
   * È il metodo che usano TUTTE le UI (calendario, dialog appuntamento,
   * dialog palestra): a differenza di `markNoShow` accetta qualunque stato
   * di partenza, il che è necessario perché col cron auto-attendance
   * l'appuntamento è già passato ad ATTENDED quando la segreteria si
   * accorge che il paziente non è venuto.
   *
   * Fino alla gestione assenze questo metodo NON scriveva il log
   * `clinical_attendance_log`: i contatori no-show del paziente restavano
   * quindi a zero anche dopo decine di assenze. Ora registra l'evento in
   * modo idempotente (nessun doppio conteggio se lo stato viene corretto
   * avanti e indietro).
   */
  async markAsNoShow(id: string): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);
    appointment.bookingStatus = BookingStatus.NO_SHOW;
    // Una decisione presa a mano batte l'automatismo: con il flag alzato il
    // cron auto-attendance non ha piu' titolo per rimettere l'appuntamento a
    // "presentato". E' la seconda rete di sicurezza dopo il fix delle
    // parentesi nella query del cron (vedi `AutoAttendanceService`), che per
    // mesi ha silenziosamente riportato ad ATTENDED ogni no-show del giorno.
    appointment.autoStatusChanged = true;
    await this.appointmentRepo.save(appointment);

    if (appointment.patientId) {
      await this.attendanceService.markNoShowForAppointment({
        subjectId: appointment.patientId,
        appointmentId: appointment.id,
        operatorId: appointment.operatorId,
      });
    }

    // SSE: notifica le UI aperte del cambio stato.
    this.eventsService.emit({
      type: 'appointment_status_changed',
      appointmentIds: [appointment.id],
      newStatus: BookingStatus.NO_SHOW,
      timestamp: new Date(),
    });

    // Cascata: annulla il trattamento collegato se in corso e non fatturato.
    await this.treatmentCascade.onAppointmentNoShow(appointment);

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
    /**
     * `AppUser.id` di chi disdice, risolto dal JWT nel resolver. Null se non
     * risolvibile: la colonna è nullable e un valore inventato romperebbe il
     * cast a uuid (era il caso dei client che mandavano 'secretary'/'system').
     */
    cancelledBy: string | null,
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

    // Soglia configurabile (default 24h = comportamento storico).
    const { lateCancellationHours } =
      await this.generalSettingsService.getNoShowSettings();

    // Determina il tipo di cancellazione
    const isCancelledLate = hoursNotice < lateCancellationHours;

    appointment.bookingStatus = isCancelledLate
      ? BookingStatus.CANCELLED_LATE
      : BookingStatus.CANCELLED_EARLY;
    appointment.cancellationReason = reason;
    appointment.cancelledAt = new Date();
    appointment.cancelledBy = cancelledBy ?? undefined;
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

    // SSE: notifica le UI aperte del cambio stato.
    this.eventsService.emit({
      type: 'appointment_status_changed',
      appointmentIds: [appointment.id],
      newStatus: BookingStatus.NO_SHOW,
      timestamp: new Date(),
    });

    // Cascata: annulla il trattamento collegato se in corso e non fatturato.
    await this.treatmentCascade.onAppointmentNoShow(appointment);

    return this.findById(id);
  }

  /**
   * Segna un appuntamento come attended (paziente presentato)
   * Questo abilita la creazione di un trattamento.
   *
   * Registra anche l'ARRIVO (`arrivedAt` / `lateMinutes`): questo metodo è
   * sempre un gesto MANUALE (il cron auto-attendance scrive `bookingStatus`
   * direttamente sul repository e non passa di qui), quindi il timestamp
   * misura un arrivo vero e non l'orario teorico dell'appuntamento.
   */
  async markAttended(
    id: string,
    markedBy?: { userId?: string; source?: ArrivalSource },
  ): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);

    // Blocca cambio stato per appuntamenti non retribuiti
    if (appointment.nonRetribuito) {
      throw new BadRequestException('Gli appuntamenti non retribuiti non hanno gestione degli stati');
    }

    // Stati da cui si può passare a "presentato". Includiamo NO_SHOW per il
    // caso "ritardatario": il paziente segnato non presentato arriva in ritardo
    // e viene fatto passare → si corregge lo stato e si riapre il trattamento.
    const allowedFrom = [
      BookingStatus.SCHEDULED,
      BookingStatus.CONFIRMED,
      BookingStatus.NO_SHOW,
    ];
    if (!allowedFrom.includes(appointment.bookingStatus)) {
      throw new BadRequestException(
        `L'appuntamento non può essere segnato come presentato. Stato attuale: ${appointment.bookingStatus}`
      );
    }

    const wasNoShow = appointment.bookingStatus === BookingStatus.NO_SHOW;
    const arrivedAt = new Date();

    appointment.bookingStatus = BookingStatus.ATTENDED;

    // Ritardatario conclamato: era stato dato per assente e invece è venuto.
    // Il flag non si azzera più — è storia del paziente.
    if (wasNoShow) {
      appointment.wasNoShowReverted = true;
    }

    // Registra l'arrivo solo la prima volta: se la segreteria corregge lo
    // stato avanti e indietro il primo timestamp resta quello buono.
    if (!appointment.arrivedAt) {
      appointment.arrivedAt = arrivedAt;
      appointment.lateMinutes = this.calculateLateMinutes(
        appointment.appointmentDate,
        appointment.startTime,
        arrivedAt,
      );
      appointment.arrivalMarkedBy = markedBy?.userId;
      appointment.arrivalSource = wasNoShow
        ? ArrivalSource.NO_SHOW_REVERT
        : markedBy?.source ?? ArrivalSource.MANUAL_SECRETARY;
    }

    await this.appointmentRepo.save(appointment);

    // Se stiamo correggendo un no-show, il log NON va cancellato: va
    // degradato a LATE_ARRIVAL, così non pesa sui no-show ma la traccia del
    // ritardatario resta (prima qui si perdeva il dato).
    if (wasNoShow && appointment.patientId) {
      await this.attendanceService.demoteNoShowToLateArrival(appointment.id);
    }

    // SSE: notifica le UI aperte del cambio stato (es. pagina operatori).
    this.eventsService.emit({
      type: 'appointment_status_changed',
      appointmentIds: [appointment.id],
      newStatus: BookingStatus.ATTENDED,
      timestamp: new Date(),
    });

    // Cascata: auto-start / riapertura trattamento (best-effort, non blocca).
    // Eventuali treatment_created/status_changed vengono emessi dalla cascata.
    await this.treatmentCascade.onAppointmentAttended(appointment, false);

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
    // Il flag si azzera SOLO se l'appuntamento deve ancora iniziare: li' un
    // nuovo passaggio automatico ha senso. Su un appuntamento gia' iniziato
    // azzerarlo rendeva il gesto inutile — il cron rimetteva "presentato"
    // entro un minuto e la segreteria si ritrovava al punto di partenza.
    if (!this.hasAlreadyStarted(appointment)) {
      appointment.autoStatusChanged = false;
    }
    await this.appointmentRepo.save(appointment);

    // SSE: notifica le UI aperte del cambio stato.
    this.eventsService.emit({
      type: 'appointment_status_changed',
      appointmentIds: [appointment.id],
      newStatus: BookingStatus.CONFIRMED,
      timestamp: new Date(),
    });

    return this.findById(id);
  }

  /**
   * True se l'orario di inizio dell'appuntamento e' gia' passato.
   * Serve a decidere se un automatismo (cron auto-attendance) abbia ancora
   * titolo per intervenire dopo una correzione manuale.
   */
  private hasAlreadyStarted(appointment: AvailabilityAppointment): boolean {
    const dateStr =
      appointment.appointmentDate instanceof Date
        ? appointment.appointmentDate.toISOString().split('T')[0]
        : String(appointment.appointmentDate).split('T')[0];
    const start = new Date(`${dateStr}T${appointment.startTime}`);
    if (Number.isNaN(start.getTime())) return true; // in dubbio, non riarmare
    return start.getTime() <= Date.now();
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
   * Minuti di ritardo dell'arrivo rispetto all'orario di inizio previsto.
   * Mai negativo: chi arriva in anticipo è semplicemente puntuale.
   */
  private calculateLateMinutes(
    appointmentDate: Date | string,
    startTime: string,
    arrivedAt: Date,
  ): number {
    const dateStr =
      appointmentDate instanceof Date
        ? appointmentDate.toISOString().split('T')[0]
        : String(appointmentDate).split('T')[0];

    const scheduled = new Date(`${dateStr}T${startTime}`);
    if (Number.isNaN(scheduled.getTime())) return 0;

    const diffMinutes = Math.round(
      (arrivedAt.getTime() - scheduled.getTime()) / 60000,
    );
    return Math.max(0, diffMinutes);
  }

  /**
   * Registra a posteriori l'arrivo (in ritardo) del paziente.
   *
   * Serve al caso che `markAttended` non intercetta: col cron
   * auto-attendance acceso l'appuntamento è già ATTENDED all'orario
   * teorico, quindi quando il paziente entra con 25 minuti di ritardo
   * nessuno tocca più nulla e il ritardo resterebbe invisibile.
   *
   * NON è un'azione di fatturazione: è un fatto osservato, e chi lo osserva
   * è l'operatore in sala prima ancora della segreteria. Per questo è
   * aperto a entrambi (nessun BillingWriteGuard) e traccia `arrivalSource`
   * per distinguere in statistica chi l'ha registrato.
   */
  async markLateArrival(
    id: string,
    input: {
      lateMinutes?: number;
      arrivedAt?: Date;
      userId?: string;
      source?: ArrivalSource;
    },
  ): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(id);

    if (appointment.nonRetribuito) {
      throw new BadRequestException(
        'Gli appuntamenti non retribuiti non hanno gestione degli stati',
      );
    }

    // Un paziente disdetto o assente non può essere "arrivato in ritardo":
    // per quel caso esiste già la correzione a "presentato".
    const blocked: BookingStatus[] = [
      BookingStatus.CANCELLED,
      BookingStatus.CANCELLED_EARLY,
      BookingStatus.CANCELLED_LATE,
      BookingStatus.NO_SHOW,
    ];
    if (blocked.includes(appointment.bookingStatus)) {
      throw new BadRequestException(
        `Non si può registrare un ritardo su un appuntamento in stato ${appointment.bookingStatus}. ` +
          'Riporta prima il paziente a "presentato".',
      );
    }

    const arrivedAt = input.arrivedAt ?? new Date();

    appointment.arrivedAt = arrivedAt;
    appointment.lateMinutes =
      input.lateMinutes ??
      this.calculateLateMinutes(
        appointment.appointmentDate,
        appointment.startTime,
        arrivedAt,
      );
    appointment.arrivalMarkedBy = input.userId;
    appointment.arrivalSource = input.source ?? ArrivalSource.MANUAL_SECRETARY;

    await this.appointmentRepo.save(appointment);
    return this.findById(id);
  }

  /**
   * Annulla la registrazione del ritardo (click sbagliato).
   * Non tocca `wasNoShowReverted`: quello è un fatto di stato, non una
   * misura, e resta.
   */
  async clearLateArrival(id: string): Promise<AvailabilityAppointment> {
    await this.findById(id); // 404 se non esiste
    // `save()` ignora le proprietà undefined: per azzerare davvero le
    // colonne serve un update esplicito a NULL.
    await this.appointmentRepo.update(id, {
      arrivedAt: null,
      lateMinutes: null,
      arrivalMarkedBy: null,
      arrivalSource: null,
    } as any);
    return this.findById(id);
  }

  /**
   * Registra una cancellazione tardiva del paziente nel log attendance.
   * (Sostituisce la vecchia logica jsonb su `patients.cancellationsByYear`,
   * tabella droppata col refactor registry-integration.)
   */
  private async incrementPatientCancellation(
    patientId: string,
    appointmentId: string,
  ): Promise<void> {
    await this.attendanceService.recordEventOnce({
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
    appointmentId: string,
  ): Promise<void> {
    await this.attendanceService.markNoShowForAppointment({
      subjectId: patientId,
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
        // Il NO_SHOW resta in lista anche in palestra: l'assenza si vede
        // sul calendario invece di sparire (lo slot resta prenotabile —
        // `countAppointmentsInSlot` continua a non contarlo).
        bookingStatus: Not(In([BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE])),
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
        // Il NO_SHOW resta in lista anche in palestra: l'assenza si vede
        // sul calendario invece di sparire (lo slot resta prenotabile —
        // `countAppointmentsInSlot` continua a non contarlo).
        bookingStatus: Not(In([BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE])),
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
    /**
     * Appuntamento da NON contare: sé stesso, quando il conteggio serve a
     * validare lo spostamento di una prenotazione già esistente. Senza
     * questa esclusione una sala piena rifiuterebbe di spostare al suo
     * interno una prenotazione che quel posto lo occupa già.
     */
    excludeAppointmentId?: string,
  ): Promise<number> {
    return this.appointmentRepo.count({
      where: {
        gymRoomId,
        appointmentDate: new Date(date),
        startTime,
        endTime,
        appointmentType: AppointmentType.GYM,
        bookingStatus: Not(In([BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW])),
        ...(excludeAppointmentId ? { id: Not(excludeAppointmentId) } : {}),
      },
    });
  }

  /**
   * Crea un appuntamento palestra con validazione capacità.
   * Wrapper retro-compat: ritorna solo l'appuntamento (il master per le
   * serie). Per il report delle occorrenze saltate usare
   * `createGymAppointmentWithReport`.
   */
  async createGymAppointment(input: CreateGymAppointmentInput): Promise<AvailabilityAppointment> {
    return (await this.createGymAppointmentWithReport(input)).appointment;
  }

  /**
   * Crea un appuntamento palestra (singolo o serie ricorrente) con report:
   * per le serie, le occorrenze in conflitto (slot chiuso, capienza piena,
   * nessun istruttore) vengono saltate ma ELENCATE in `conflicts` così il
   * frontend può avvisare l'utente (parità con la modalità operatori, dove
   * però il conflitto blocca l'intera serie). Se nessuna occorrenza è
   * creabile, lancia RECURRING_SERIES_CONFLICT con l'elenco.
   */
  async createGymAppointmentWithReport(input: CreateGymAppointmentInput): Promise<{
    appointment: AvailabilityAppointment;
    createdCount: number;
    skippedCount: number;
    conflicts: {
      date: string; startTime: string; endTime: string;
      type: string; reason: string;
    }[];
  }> {
    const { repeatConfig, occurrences, ...appointmentData } = input;

    // 1. Verifica che la GymRoom esista
    const gymRoom = await this.gymRoomRepo.findOne({
      where: { id: input.gymRoomId, isActive: true },
    });

    if (!gymRoom) {
      throw new NotFoundException(`GymRoom con ID ${input.gymRoomId} non trovata o non attiva`);
    }

    // 2. Blocco prenotazione su slot chiuso: chiusura palestra (giornata o
    // fascia), slot "palestra chiusa" di un'assenza istruttore, o fuori
    // dagli orari modificati. La vista mostra lo slot rosso, ma senza
    // questa guardia il booking passava comunque.
    const closure = await this.gymExceptionService.getSlotClosure(
      input.gymRoomId,
      new Date(input.appointmentDate),
      input.startTime,
      input.endTime,
    );
    if (closure.closed) {
      throw new ConflictException(
        closure.reason || 'La palestra è chiusa in questa fascia oraria',
      );
    }

    // 2b. Verifica capacità disponibile
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
        occurrences,
      );
    }

    // 4b. Se per quella data/ora è attiva un'eccezione con sostituto,
    // l'appuntamento nasce già intestato al sostituto (l'operatore del
    // trattamento — e quindi la fatturazione — segue l'appuntamento).
    const effectiveFields = await this.resolveEffectiveGymOperatorFields(
      input.gymRoomId,
      operator.id,
      new Date(input.appointmentDate),
      input.startTime,
    );

    // 5. Crea singolo appuntamento
    const savedGymAppointment = await this.createSingleGymAppointment(
      { ...appointmentData, ...effectiveFields },
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

    return { appointment: savedGymAppointment, createdCount: 1, skippedCount: 0, conflicts: [] };
  }

  /**
   * Crea un singolo appuntamento palestra
   */
  private async createSingleGymAppointment(
    data: Omit<CreateGymAppointmentInput, 'repeatConfig'> & {
      operatorId: string;
      originalOperatorId?: string;
      isSubstitution?: boolean;
      reassignedByGymExceptionId?: string;
    },
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
      originalOperatorId: data.originalOperatorId,
      isSubstitution: data.isSubstitution ?? false,
      reassignedByGymExceptionId: data.reassignedByGymExceptionId,
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
      repeatConfig: repeatConfig
        ? this.normalizeRepeatConfigForStorage(repeatConfig)
        : undefined,
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
   * Crea appuntamenti palestra ricorrenti. Le occorrenze in conflitto (slot
   * chiuso, capienza piena, nessun istruttore, errore di creazione) vengono
   * SALTATE ma raccolte in `conflicts` per l'avviso lato frontend. Se nessuna
   * occorrenza è creabile, lancia RECURRING_SERIES_CONFLICT con l'elenco
   * (stesso marker della modalità operatori → stesso dialog di riepilogo).
   */
  private async createRecurringGymAppointments(
    baseData: Omit<CreateGymAppointmentInput, 'repeatConfig' | 'occurrences'> & { operatorId: string },
    gymRoom: GymRoom,
    repeatConfig: RepeatConfigInput,
    /**
     * Piano risolto dall'utente nel riquadro conflitti. Quando c'è, SOSTITUISCE
     * le date generate dalla regola: contiene già gli spostamenti decisi (anche
     * di sala) e non contiene le occorrenze saltate.
     */
    plan?: RecurringOccurrenceInput[],
  ): Promise<{
    appointment: AvailabilityAppointment;
    createdCount: number;
    skippedCount: number;
    conflicts: { date: string; startTime: string; endTime: string; type: string; reason: string }[];
  }> {
    // Occorrenze da creare: il piano risolto se c'è, altrimenti le date
    // generate dalla regola nella fascia oraria di partenza.
    const planned: RecurringOccurrenceInput[] = plan?.length
      ? plan
      : this.calculateRecurringDates(baseData.appointmentDate, repeatConfig).map((date) => ({
          date,
          startTime: baseData.startTime,
          endTime: baseData.endTime,
        }));

    if (planned.length === 0) {
      throw new BadRequestException('Nessuna data valida per la ricorrenza');
    }

    // Genera un ID di gruppo per collegare tutti gli appuntamenti
    const recurringGroupId = uuidv4();

    let firstAppointment: AvailabilityAppointment | null = null;
    let createdCount = 0;
    const conflicts: { date: string; startTime: string; endTime: string; type: string; reason: string }[] = [];
    const asConflict = (
      occ: RecurringOccurrenceInput, type: string, reason: string,
    ) => ({
      date: occ.date, startTime: occ.startTime, endTime: occ.endTime, type, reason,
    });

    for (const occ of planned) {
      const date = occ.date;
      // Ogni occorrenza porta la propria fascia e la propria sala: nel piano
      // risolto possono essere diverse da quelle di partenza, perché l'utente
      // ha spostato quella singola data.
      const occStartTime = occ.startTime;
      const occEndTime = occ.endTime;
      const occRoomId = occ.gymRoomId ?? baseData.gymRoomId;
      const occRoom =
        occRoomId === gymRoom.id
          ? gymRoom
          : await this.gymRoomRepo.findOne({ where: { id: occRoomId, isActive: true } });

      try {
        if (!occRoom) {
          conflicts.push(asConflict(occ, 'error', 'Sala di destinazione non trovata o non attiva'));
          continue;
        }
        // Slot chiuso per eccezione in questa data → salta l'occorrenza
        const closure = await this.gymExceptionService.getSlotClosure(
          occRoomId,
          new Date(date),
          occStartTime,
          occEndTime,
        );
        if (closure.closed) {
          conflicts.push(asConflict(occ, 'unavailable',
            closure.reason || 'La palestra è chiusa in questa fascia oraria'));
          continue;
        }

        // Verifica capacità per questa data
        const currentCount = await this.countAppointmentsInSlot(
          occRoomId,
          date,
          occStartTime,
          occEndTime,
        );

        if (currentCount >= occRoom.maxCapacity) {
          conflicts.push(asConflict(occ, 'overlap',
            `Capacità massima della sala raggiunta (${currentCount}/${occRoom.maxCapacity})`));
          continue; // Salta questa data se pieno
        }

        // Verifica operatore per questa data
        const operator = await this.gymPatternGroupService.getOperatorForTimeSlot(
          occRoomId,
          new Date(date),
          occStartTime,
        );

        if (!operator) {
          conflicts.push(asConflict(occ, 'unavailable',
            'Nessun istruttore assegnato allo slot (verificare i template della palestra)'));
          continue; // Salta se non c'è operatore
        }

        // Applica l'eventuale sostituzione attiva per QUESTA data della serie
        const effectiveFields = await this.resolveEffectiveGymOperatorFields(
          occRoomId,
          operator.id,
          new Date(date),
          occStartTime,
        );

        const isFirst = firstAppointment === null;
        const appointment = await this.createSingleGymAppointment(
          {
            ...baseData,
            gymRoomId: occRoomId,
            appointmentDate: date,
            startTime: occStartTime,
            endTime: occEndTime,
            ...effectiveFields,
          },
          occRoom,
          true,
          recurringGroupId,
          isFirst ? repeatConfig : undefined,
          isFirst, // isMaster
          isFirst ? undefined : firstAppointment!.id, // masterAppointmentId
        );

        // WhatsApp dispatch per OGNI appuntamento della serie
        this.dispatchWhatsappBooking(appointment);
        createdCount++;

        if (isFirst) {
          firstAppointment = appointment;
        }
      } catch (error) {
        console.warn(`Impossibile creare appuntamento palestra ricorrente per ${date}:`, error.message);
        conflicts.push(asConflict(occ, 'error',
          error?.message || 'Errore durante la creazione dell\'occorrenza'));
      }
    }

    if (!firstAppointment) {
      // Nessuna occorrenza creabile: avvisa-e-blocca con l'elenco conflitti
      // (il frontend riconosce il marker e mostra il riepilogo).
      throw new ConflictException(
        `${AvailabilityAppointmentService.RECURRING_CONFLICT_ERROR}: ${JSON.stringify(conflicts)}`,
      );
    }

    return { appointment: firstAppointment, createdCount, skippedCount: conflicts.length, conflicts };
  }

  /**
   * Risolve l'operatore EFFETTIVO per un booking palestra: se per
   * (gymRoom, data, ora) è attiva un'eccezione OPERATOR_ABSENT con sostituto,
   * l'appuntamento va intestato al sostituto (con originalOperatorId e marker
   * dell'eccezione, così il ripristino su cancellazione eccezione lo trova).
   * Se lo slot è scoperto o il check fallisce, resta l'operatore del template
   * (il conflitto viene marcato dal check post-creazione).
   */
  private async resolveEffectiveGymOperatorFields(
    gymRoomId: string,
    templateOperatorId: string,
    date: Date,
    startTime: string,
  ): Promise<{
    operatorId: string;
    originalOperatorId?: string;
    isSubstitution?: boolean;
    reassignedByGymExceptionId?: string;
  }> {
    try {
      const effective = await this.gymExceptionService.getEffectiveOperator(
        gymRoomId,
        templateOperatorId,
        date,
        startTime,
      );
      if (effective.isSubstitute && effective.operator) {
        return {
          operatorId: effective.operator.id,
          originalOperatorId: templateOperatorId,
          isSubstitution: true,
          reassignedByGymExceptionId: effective.exception?.id,
        };
      }
    } catch (err: any) {
      this.logger.warn(
        `resolveEffectiveGymOperatorFields fallito (${err?.message}), uso operatore template`,
      );
    }
    return { operatorId: templateOperatorId };
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
  /** Orario a "HH:mm": le colonne `time` tornano con i secondi, il client no. */
  private toHhMm(value: string | null | undefined): string {
    return String(value ?? '').slice(0, 5);
  }

  /**
   * Giorno a "YYYY-MM-DD". La colonna `date` arriva come stringa dal driver ma
   * l'entità la dichiara `Date`, e a seconda del percorso può essere l'una o
   * l'altra: si normalizza sempre, usando i getter locali per non far slittare
   * la data di un giorno passando dal fuso.
   */
  private toIsoDay(value: Date | string | null | undefined): string {
    if (!value) return '';

    if (value instanceof Date) {
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${value.getFullYear()}-${month}-${day}`;
    }

    return String(value).slice(0, 10);
  }

  /**
   * Il telefono scritto sull'appuntamento, ma solo se e' davvero un numero.
   *
   * Serve perche' quel campo e' testo libero e ci finisce di tutto — "349…
   * moglie", un nome, un appunto. Prima bastava che fosse non vuoto per
   * prendere la strada del walk-in, e da li' non si torna indietro: il
   * messaggio moriva sul formato e l'anagrafica non veniva mai consultata,
   * nemmeno per un paziente che nel registry ha un recapito perfetto.
   *
   * Chiedendolo al gateway si usa lo stesso identico giudizio che dara' lui
   * al momento di spedire: un secondo controllo scritto qui divergerebbe al
   * primo prefisso gestito diversamente.
   */
  private walkInPhone(appointment: AvailabilityAppointment): string | null {
    if (!appointment.clientPhone) return null;
    return this.whatsappGateway?.formatPhoneNumber(appointment.clientPhone) ?? null;
  }

  private dispatchWhatsappBooking(appointment: AvailabilityAppointment): void {
    if (!this.whatsappGateway) return;

    // Walk-in puro: l'appointment ha già telefono → usiamo direttamente i campi
    // dell'appointment. NB: se c'è solo clientName ma non clientPhone, NON è
    // walk-in usabile (manca il telefono!) — e se c'è patientId andiamo al
    // registry a cercarlo. Se non c'è patientId nemmeno, niente notifica.
    // Il numero sull'appuntamento vale solo se e' utilizzabile: altrimenti si
    // prosegue verso l'anagrafica invece di fermarsi qui.
    if (this.walkInPhone(appointment)) {
      this.whatsappGateway
        .dispatchBooking(appointment, this.walkInToContact(appointment))
        .catch((err) => this.logger.warn(`WhatsApp dispatch failed: ${err?.message}`));
      return;
    }

    if (!appointment.patientId) {
      this.logger.warn(
        appointment.clientPhone
          ? `[WA-DISPATCH] SKIP appointmentId=${appointment.id}: telefono "${appointment.clientPhone}" non è un numero valido e non c'è anagrafica`
          : `[WA-DISPATCH] SKIP appointmentId=${appointment.id}: né clientPhone né patientId`,
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

    // Il numero sull'appuntamento vale solo se e' utilizzabile: altrimenti si
    // prosegue verso l'anagrafica invece di fermarsi qui.
    if (this.walkInPhone(appointment)) {
      this.whatsappGateway
        .cancelBooking(appointment, this.walkInToContact(appointment))
        .catch((err) => this.logger.warn(`WhatsApp cancel failed: ${err?.message}`));
      return;
    }

    if (!appointment.patientId) {
      this.logger.warn(
        appointment.clientPhone
          ? `[WA-CANCEL] SKIP appointmentId=${appointment.id}: telefono "${appointment.clientPhone}" non è un numero valido e non c'è anagrafica`
          : `[WA-CANCEL] SKIP appointmentId=${appointment.id}: né clientPhone né patientId`,
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

  /**
   * Fire-and-forget: notifica WhatsApp di spostamento appuntamento.
   *
   * Il gateway, oltre a inviare il messaggio, rimuove il reminder programmato
   * sul vecchio orario e lo riprogramma sul nuovo.
   */
  private dispatchWhatsappUpdate(
    appointment: AvailabilityAppointment,
    previous?: AppointmentSlot,
  ): void {
    if (!this.whatsappGateway) return;

    // Il numero sull'appuntamento vale solo se e' utilizzabile: altrimenti si
    // prosegue verso l'anagrafica invece di fermarsi qui.
    if (this.walkInPhone(appointment)) {
      this.whatsappGateway
        .updateBooking(appointment, this.walkInToContact(appointment), previous)
        .catch((err) => this.logger.warn(`WhatsApp update failed: ${err?.message}`));
      return;
    }

    if (!appointment.patientId) {
      this.logger.warn(
        appointment.clientPhone
          ? `[WA-UPDATE] SKIP appointmentId=${appointment.id}: telefono "${appointment.clientPhone}" non è un numero valido e non c'è anagrafica`
          : `[WA-UPDATE] SKIP appointmentId=${appointment.id}: né clientPhone né patientId`,
      );
      return;
    }

    const tenantAlias = this.tenantSchemaContext.getTenantAlias();
    if (!tenantAlias) {
      this.logger.warn(
        `[WA-UPDATE] SKIP appointmentId=${appointment.id}: tenantAlias non disponibile`,
      );
      return;
    }

    this.fetchPatientContactAsService(appointment.patientId, tenantAlias)
      .then((contact) => {
        if (!contact) {
          this.logger.warn(
            `[WA-UPDATE] SKIP appointmentId=${appointment.id}: subject ${appointment.patientId} non trovato nel registry`,
          );
          return;
        }
        return this.whatsappGateway!.updateBooking(appointment, contact, previous);
      })
      .catch((err) => this.logger.warn(`WhatsApp update failed: ${err?.message}`));
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
        // Serve al canale email delle notifiche. Senza, il gateway salta
        // quel canale invece di fallire: un paziente senza email non e' un
        // guasto.
        email: this.primaryContactValue(subject, ['EMAIL']),
        canalePreferito: (subject as any).notificationChannel ?? null,
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
  async sendRecap(
    appointmentId: string,
    options?: { immediate?: boolean },
  ): Promise<boolean> {
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

    // Reinvio chiesto a mano su UN appuntamento: parte subito, senza la
    // finestra di raggruppamento. Chi preme il pulsante si aspetta che il
    // messaggio parta ora, non fra qualche minuto insieme ad altri.
    //
    // Il recupero in blocco fa l'opposto (`immediate: false`): lì gli
    // appuntamenti dello stesso paziente sono molti e devono ricomporsi in un
    // riepilogo solo, che è precisamente il mestiere del buffer del gateway.
    // Forzare l'invio immediato produrrebbe otto messaggi a chi ne aspetta uno.
    await this.whatsappGateway.dispatchBooking(appointment, contact, {
      immediateRecap: options?.immediate ?? true,
    });
    return true;
  }

  /**
   * Comunica a posteriori una disdetta che non e' mai stata annunciata.
   *
   * Serve al recupero: un appuntamento annullato di cui il paziente non sa
   * niente non si ripara con una conferma — quella direbbe l'opposto della
   * verita' — ma con l'avviso di disdetta che allora non e' partito.
   *
   * La chiamata al gateway toglie anche il promemoria ancora in coda, che
   * altrimenti arriverebbe il giorno prima per un appuntamento che non esiste.
   * E' il motivo per cui passa da `cancelBooking` e non da un invio di testo
   * qualunque.
   */
  async sendCancellationNotice(appointmentId: string): Promise<boolean> {
    const appointment = await this.findById(appointmentId);
    if (!this.whatsappGateway) {
      throw new BadRequestException('Gateway WhatsApp non configurato');
    }

    if (appointment.clientPhone) {
      await this.whatsappGateway.cancelBooking(
        appointment,
        this.walkInToContact(appointment),
      );
      return true;
    }

    if (!appointment.patientId) {
      throw new BadRequestException("L'appuntamento non ha un paziente associato");
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

    await this.whatsappGateway.cancelBooking(appointment, contact);
    return true;
  }

  /**
   * Invia SUBITO un unico messaggio WhatsApp con il riepilogo degli
   * appuntamenti indicati (scheda paziente → lista filtrata). Passa dalla
   * chat, non dal buffer del gateway: il messaggio parte ora e resta in
   * cronologia conversazione. Usa gli stessi template dei recap automatici
   * (RECAP_SINGLE / RECAP_MULTI).
   */
  async sendAppointmentsRecap(
    patientId: string,
    appointmentIds: string[],
    actor?: { userId?: string; userName?: string },
  ): Promise<boolean> {
    if (appointmentIds.length === 0) {
      throw new BadRequestException('Nessun appuntamento selezionato');
    }
    if (!this.whatsappChat) {
      throw new BadRequestException('Modulo chat WhatsApp non disponibile');
    }

    const appointments = await this.appointmentRepo.find({
      where: { id: In(appointmentIds) },
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });
    if (appointments.length === 0) {
      throw new NotFoundException('Appuntamenti non trovati');
    }
    if (appointments.some((a) => a.patientId !== patientId)) {
      throw new BadRequestException(
        'Tutti gli appuntamenti del recap devono appartenere allo stesso paziente',
      );
    }

    // Solo gli appuntamenti ancora attivi: un recap elenca ciò che il
    // paziente deve ancora fare, non disdette o no-show.
    const active = appointments.filter((a) =>
      [BookingStatus.SCHEDULED, BookingStatus.CONFIRMED].includes(a.bookingStatus),
    );
    if (active.length === 0) {
      throw new BadRequestException(
        'Nessun appuntamento attivo tra quelli selezionati',
      );
    }

    const tenantAlias = this.tenantSchemaContext.getTenantAlias();
    if (!tenantAlias) {
      throw new BadRequestException('Tenant non risolto: impossibile contattare il registry');
    }
    const contact = await this.fetchPatientContactAsService(patientId, tenantAlias);
    if (!contact) {
      throw new NotFoundException(`Paziente ${patientId} non trovato nel registry`);
    }
    const phone = contact.cellulare || contact.telefono;
    if (!phone) {
      throw new BadRequestException('Il paziente non ha un numero di telefono');
    }

    const formatted = active.map((a) => {
      const raw = a.appointmentDate as unknown;
      const dateStr =
        raw instanceof Date ? raw.toISOString().split('T')[0] : String(raw).slice(0, 10);
      const [y, m, d] = dateStr.split('-');
      return { date: `${d}/${m}/${y}`, time: String(a.startTime).substring(0, 5) };
    });

    await this.whatsappChat.sendAppointmentsRecap({
      patientId,
      patientName: `${contact.nome || ''} ${contact.cognome || ''}`.trim(),
      phone,
      appointments: formatted,
      userId: actor?.userId,
      userName: actor?.userName,
    });
    return true;
  }

  /**
   * Trasforma un appuntamento singolo esistente nel master di una nuova
   * serie ricorrente: l'appuntamento resta invariato (stessa data/ora) e le
   * occorrenze successive vengono create copiando servizi e strumenti.
   *
   * Con un piano risolto (`plan`) crea esattamente le occorrenze indicate,
   * spostamenti compresi. Senza piano resta la validazione avvisa-e-blocca:
   * se una sola nuova occorrenza è in conflitto, non viene creato nulla.
   */
  async makeRecurring(
    appointmentId: string,
    repeatConfig: RepeatConfigInput,
    force = false,
    plan?: RecurringOccurrenceInput[],
  ): Promise<AvailabilityAppointment> {
    const appointment = await this.findById(appointmentId);

    if (appointment.recurringGroupId) {
      throw new BadRequestException("L'appuntamento fa già parte di una serie ricorrente");
    }
    const isGym = appointment.appointmentType === AppointmentType.GYM;
    if (isGym && !appointment.gymRoomId) {
      throw new BadRequestException(
        'Appuntamento palestra senza sala: impossibile renderlo ricorrente',
      );
    }
    if (![BookingStatus.SCHEDULED, BookingStatus.CONFIRMED].includes(appointment.bookingStatus)) {
      throw new BadRequestException('Solo un appuntamento attivo può diventare ricorrente');
    }

    const rawDate = appointment.appointmentDate as unknown;
    const baseDateStr =
      rawDate instanceof Date ? rawDate.toISOString().split('T')[0] : String(rawDate).slice(0, 10);

    // L'appuntamento esistente È la prima occorrenza: si creano solo le date
    // successive generate dalla ricorrenza.
    const dates = this.calculateRecurringDates(baseDateStr, repeatConfig).filter(
      (d) => d !== baseDateStr,
    );
    if (dates.length === 0) {
      throw new BadRequestException(
        'La ricorrenza non genera nuove date oltre a quella esistente',
      );
    }

    // Occorrenze da creare: quelle risolte nel riquadro, oppure le date
    // generate dalla regola. In entrambi i casi escludono la data di partenza,
    // che è l'appuntamento già esistente promosso a master.
    const newOccurrences: RecurringOccurrenceInput[] = plan?.length
      ? plan.filter((o) => o.date !== baseDateStr)
      : dates.map((date) => ({
          date,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
        }));

    if (newOccurrences.length === 0) {
      throw new BadRequestException(
        'La ricorrenza non genera nuove date oltre a quella esistente',
      );
    }

    // Validazione preventiva. In palestra i predicati sono altri (chiusura
    // fascia, istruttore da template, capienza) e non c'è ricontrollo
    // ristretto alle sole sovrapposizioni: la capienza è esattamente il dato
    // che può cambiare fra anteprima e conferma, quindi il piano risolto va
    // rivalidato per intero.
    if (isGym) {
      const conflicts = force
        ? []
        : await this.validateGymRecurringOccurrences(
            newOccurrences.map((o) => ({
              gymRoomId: o.gymRoomId ?? appointment.gymRoomId!,
              date: o.date,
              startTime: o.startTime,
              endTime: o.endTime,
            })),
            appointment.patientId ?? undefined,
          );

      if (conflicts.length > 0) {
        throw new ConflictException(
          `${AvailabilityAppointmentService.RECURRING_CONFLICT_ERROR}: ${JSON.stringify(conflicts)}`,
        );
      }
    } else if (appointment.operatorId) {
      const conflicts = plan?.length
        ? await this.recheckResolvedOccurrences(
            newOccurrences.map((o) => ({
              operatorId: o.operatorId ?? appointment.operatorId!,
              date: o.date,
              startTime: o.startTime,
              endTime: o.endTime,
            })),
            [appointment.id],
          )
        : force
          ? []
          : await this.validateRecurringOccurrences(
              newOccurrences.map((o) => ({
                operatorId: appointment.operatorId!,
                date: o.date,
                startTime: o.startTime,
                endTime: o.endTime,
              })),
            );

      if (conflicts.length > 0) {
        throw new ConflictException(
          `${AvailabilityAppointmentService.RECURRING_CONFLICT_ERROR}: ${JSON.stringify(conflicts)}`,
        );
      }
    }

    // Promuovi l'esistente a master della serie.
    const recurringGroupId = uuidv4();
    await this.appointmentRepo.update(appointment.id, {
      isRecurring: true,
      recurringGroupId,
      isMaster: true,
      repeatConfig: this.normalizeRepeatConfigForStorage(repeatConfig) as any,
    });

    // Dati base per le nuove occorrenze: copia dell'appuntamento esistente,
    // servizi e strumenti inclusi.
    const services: ServiceInputItem[] = (appointment.appointmentServices ?? []).map((s) => ({
      serviceId: s.serviceId,
      customDuration: s.customDuration ?? undefined,
      customPrice: s.customPrice ?? undefined,
      orderPosition: s.orderPosition ?? undefined,
    }));
    const instruments: CreateAppointmentInstrumentInput[] = (appointment.instruments ?? [])
      .filter((ai) => !!ai.instrument?.categoryId)
      .map((ai) => ({
        instrumentCategoryId: ai.instrument.categoryId,
        startOffsetMinutes: ai.startOffsetMinutes,
        endOffsetMinutes: ai.endOffsetMinutes,
        orderPosition: ai.orderPosition ?? undefined,
      }));

    const baseData: Omit<CreateAvailabilityAppointmentInput, 'instruments' | 'repeatConfig'> = {
      operatorId: appointment.operatorId!,
      services: services.length > 0 ? services : undefined,
      clientName: appointment.clientName,
      clientEmail: appointment.clientEmail,
      clientPhone: appointment.clientPhone,
      patientId: appointment.patientId ?? undefined,
      appointmentDate: baseDateStr,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      notes: appointment.notes ?? undefined,
      nonRetribuito: appointment.nonRetribuito,
    };

    for (const occ of newOccurrences) {
      try {
        const created = isGym
          ? await this.createGymOccurrenceFrom(
              appointment, occ, recurringGroupId,
            )
          : await this.createSingleAppointment(
              {
                ...baseData,
                appointmentDate: occ.date,
                startTime: occ.startTime,
                endTime: occ.endTime,
                ...(occ.operatorId ? { operatorId: occ.operatorId } : {}),
              },
              instruments.length > 0 ? instruments : undefined,
              true,
              recurringGroupId,
              undefined,
              false,
              appointment.id,
            );
        // Stesso comportamento della creazione serie: recap per ogni occorrenza
        this.dispatchWhatsappBooking(created);
      } catch (error) {
        // Occorrenza non creabile (es. strumenti non disponibili quel giorno):
        // si continua con le successive, come alla creazione serie.
        console.warn(`Impossibile creare occorrenza ricorrente per ${occ.date}:`, error.message);
      }
    }

    return this.findById(appointment.id);
  }

  /**
   * Crea una occorrenza palestra copiando un appuntamento esistente (il
   * master appena promosso), per la data/orario/sala della singola occorrenza.
   *
   * L'istruttore NON viene copiato dal master: viene risolto dal template
   * della sala per QUELLA data, e poi passato per l'eventuale sostituzione
   * attiva. Copiarlo sarebbe sbagliato in due modi — una serie che attraversa
   * un cambio di template resterebbe intestata all'istruttore vecchio, e una
   * occorrenza spostata in un'altra sala erediterebbe l'istruttore della sala
   * di partenza.
   */
  private async createGymOccurrenceFrom(
    master: AvailabilityAppointment,
    occ: RecurringOccurrenceInput,
    recurringGroupId: string,
  ): Promise<AvailabilityAppointment> {
    const gymRoomId = occ.gymRoomId ?? master.gymRoomId!;
    const gymRoom = await this.gymRoomRepo.findOne({
      where: { id: gymRoomId, isActive: true },
    });
    if (!gymRoom) {
      throw new NotFoundException(`GymRoom con ID ${gymRoomId} non trovata o non attiva`);
    }

    const occDate = new Date(occ.date);
    const operator = await this.gymPatternGroupService.getOperatorForTimeSlot(
      gymRoomId, occDate, occ.startTime,
    );
    if (!operator) {
      throw new BadRequestException(
        'Nessun istruttore assegnato allo slot (verificare i template della palestra)',
      );
    }

    const effectiveFields = await this.resolveEffectiveGymOperatorFields(
      gymRoomId, operator.id, occDate, occ.startTime,
    );

    const services: ServiceInputItem[] = (master.appointmentServices ?? []).map((sv) => ({
      serviceId: sv.serviceId,
      customDuration: sv.customDuration ?? undefined,
      customPrice: sv.customPrice ?? undefined,
      orderPosition: sv.orderPosition ?? undefined,
    }));

    return this.createSingleGymAppointment(
      {
        gymRoomId,
        operatorId: operator.id,
        ...effectiveFields,
        clientName: master.clientName,
        clientEmail: master.clientEmail ?? undefined,
        clientPhone: master.clientPhone ?? undefined,
        patientId: master.patientId ?? undefined,
        appointmentDate: occ.date,
        startTime: occ.startTime,
        endTime: occ.endTime,
        notes: master.notes ?? undefined,
        services: services.length > 0 ? services : undefined,
      },
      gymRoom,
      true,
      recurringGroupId,
      undefined,
      false,
      master.id,
    );
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
    scope: 'current_only' | 'this_and_following' | 'all' | 'date_range',
  ): Promise<number> {
    const appointment = await this.appointmentRepo.findOne({ where: { id: appointmentId } });
    if (!appointment || !appointment.recurringGroupId) {
      throw new BadRequestException('Appuntamento non trovato o non ricorrente');
    }

    // Chi viene disdetto va letto PRIMA: dopo l'update lo stato è cambiato per
    // tutti e non si distinguerebbe più chi era ancora attivo.
    const affected = await this.selectSeriesOccurrences(
      appointment.recurringGroupId, appointment.id, appointment.appointmentDate, scope,
    );

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

    this.applyScopeWhere(qb, scope, { appointmentId, fromDate });

    const result = await qb.execute();

    // Senza questo il paziente non veniva avvisato di NIENTE, e soprattutto
    // restava programmato il promemoria del giorno prima: si sarebbe visto
    // arrivare "il suo appuntamento è domani" per una seduta disdetta.
    // Il gateway raggruppa l'intera serie in un unico messaggio.
    this.notifyWhatsappCancellations(affected);

    return result.affected || 0;
  }

  /**
   * Notifica al gateway la disdetta di più appuntamenti insieme.
   *
   * Il messaggio unico lo compone il GATEWAY, dentro la finestra configurata
   * dal tenant: qui non si accorpa niente, perché quella stessa finestra deve
   * poter accogliere anche le disdette fatte a mano dalla segreteria negli
   * stessi minuti. Si mandano quindi N notifiche, una per appuntamento.
   *
   * Quello che si evita è di chiedere N volte al registry la stessa
   * anagrafica: una serie da 52 sedute è tutta dello stesso paziente.
   */
  /**
   * Come `notifyWhatsappCancellations`, per gli spostamenti: stessa economia
   * sulle letture dal registry e stesso invio in sequenza. Ogni voce porta con
   * sé la posizione da cui l'appuntamento si è mosso, che è quello che nel
   * messaggio permette al paziente di riconoscerlo.
   */
  private notifyWhatsappUpdates(
    moves: { appointment: AvailabilityAppointment; previous: AppointmentSlot }[],
  ): void {
    if (!this.whatsappGateway || moves.length === 0) return;

    for (const move of moves.filter((m) => m.appointment.clientPhone)) {
      this.dispatchWhatsappUpdate(move.appointment, move.previous);
    }

    const fromRegistry = moves.filter(
      (m) => !m.appointment.clientPhone && m.appointment.patientId,
    );
    if (fromRegistry.length === 0) return;

    const tenantAlias = this.tenantSchemaContext.getTenantAlias();
    if (!tenantAlias) {
      this.logger.warn('[WA-UPDATE] SKIP serie: tenantAlias non disponibile');
      return;
    }

    const byPatient = new Map<string, typeof fromRegistry>();
    for (const move of fromRegistry) {
      const group = byPatient.get(move.appointment.patientId!) ?? [];
      group.push(move);
      byPatient.set(move.appointment.patientId!, group);
    }

    for (const [patientId, group] of byPatient) {
      this.fetchPatientContactAsService(patientId, tenantAlias)
        .then((contact) => {
          if (!contact) {
            this.logger.warn(
              `[WA-UPDATE] SKIP serie: subject ${patientId} non trovato nel registry`,
            );
            return;
          }
          return group.reduce(
            (chain, move) =>
              chain.then(() =>
                this.whatsappGateway!.updateBooking(move.appointment, contact, move.previous),
              ),
            Promise.resolve(),
          );
        })
        .catch((err) =>
          this.logger.warn(`WhatsApp update serie failed: ${err?.message}`),
        );
    }
  }

  private notifyWhatsappCancellations(appointments: AvailabilityAppointment[]): void {
    if (!this.whatsappGateway || appointments.length === 0) return;

    // I walk-in hanno il telefono addosso: nessuna anagrafica da risolvere.
    for (const appointment of appointments.filter((a) => a.clientPhone)) {
      this.cancelWhatsappBooking(appointment);
    }

    const fromRegistry = appointments.filter((a) => !a.clientPhone && a.patientId);
    if (fromRegistry.length === 0) return;

    const tenantAlias = this.tenantSchemaContext.getTenantAlias();
    if (!tenantAlias) {
      this.logger.warn('[WA-CANCEL] SKIP serie: tenantAlias non disponibile');
      return;
    }

    const byPatient = new Map<string, AvailabilityAppointment[]>();
    for (const appointment of fromRegistry) {
      const group = byPatient.get(appointment.patientId!) ?? [];
      group.push(appointment);
      byPatient.set(appointment.patientId!, group);
    }

    for (const [patientId, group] of byPatient) {
      this.fetchPatientContactAsService(patientId, tenantAlias)
        .then((contact) => {
          if (!contact) {
            this.logger.warn(
              `[WA-CANCEL] SKIP serie: subject ${patientId} non trovato nel registry`,
            );
            return;
          }
          // In sequenza e non in parallelo: il gateway riarma il timer del
          // raggruppamento a ogni arrivo, e N richieste simultanee sullo
          // stesso numero se lo contenderebbero. L'ordine delle righe lo
          // decide comunque lui, per data.
          return group.reduce(
            (chain, appointment) =>
              chain.then(() => this.whatsappGateway!.cancelBooking(appointment, contact)),
            Promise.resolve(),
          );
        })
        .catch((err) =>
          this.logger.warn(`WhatsApp cancel serie failed: ${err?.message}`),
        );
    }
  }

  /**
   * Elimina (hard delete) appuntamenti di una serie ricorrente.
   * Scope supportati:
   *  - 'current_only': solo l'appuntamento corrente (per data === fromDate)
   *  - 'this_and_following': dalla data corrente in poi
   *  - 'all': intera serie
   *  - 'date_range': intervallo [rangeFrom, rangeTo]; se includeCurrent===false
   *    esclude esplicitamente l'occorrenza corrente (fromDate)
   */
  async deleteRecurringSeries(
    appointmentId: string,
    fromDate: string,
    scope: 'current_only' | 'this_and_following' | 'all' | 'date_range',
    rangeFrom?: string,
    rangeTo?: string,
    includeCurrent?: boolean,
  ): Promise<number> {
    const appointment = await this.appointmentRepo.findOne({ where: { id: appointmentId } });
    if (!appointment || !appointment.recurringGroupId) {
      throw new BadRequestException('Appuntamento non trovato o non ricorrente');
    }

    // Letti prima della delete: dopo non esistono più, e con loro sparirebbe
    // anche il modo di sapere chi avvisare.
    const affected = await this.selectSeriesOccurrences(
      appointment.recurringGroupId, appointment.id, appointment.appointmentDate,
      scope, rangeFrom, rangeTo, includeCurrent,
    );

    const qb = this.appointmentRepo
      .createQueryBuilder()
      .delete()
      .from(AvailabilityAppointment)
      .where('"recurringGroupId" = :groupId', { groupId: appointment.recurringGroupId });

    this.applyScopeWhere(qb, scope, { appointmentId, fromDate, rangeFrom, rangeTo, includeCurrent });

    const result = await qb.execute();

    // Come per la disdetta della serie: senza questo restavano in piedi i
    // promemoria di appuntamenti eliminati.
    this.notifyWhatsappCancellations(affected);

    return result.affected || 0;
  }

  /**
   * Applica al QueryBuilder (update/delete) il filtro di scope sulla serie.
   * `recurringGroupId = :groupId` deve essere già impostato dal chiamante.
   */
  private applyScopeWhere(
    qb: import('typeorm').UpdateQueryBuilder<AvailabilityAppointment> | import('typeorm').DeleteQueryBuilder<AvailabilityAppointment>,
    scope: 'current_only' | 'this_and_following' | 'all' | 'date_range',
    params: { appointmentId: string; fromDate: string; rangeFrom?: string; rangeTo?: string; includeCurrent?: boolean },
  ): void {
    if (scope === 'current_only') {
      qb.andWhere('id = :selfId', { selfId: params.appointmentId });
    } else if (scope === 'this_and_following') {
      qb.andWhere('"appointmentDate" >= :fromDate', { fromDate: params.fromDate });
    } else if (scope === 'date_range') {
      if (!params.rangeFrom || !params.rangeTo) {
        throw new BadRequestException('Intervallo date mancante per scope DATE_RANGE');
      }
      qb.andWhere('"appointmentDate" BETWEEN :rangeFrom AND :rangeTo', {
        rangeFrom: params.rangeFrom,
        rangeTo: params.rangeTo,
      });
      if (params.includeCurrent === false) {
        qb.andWhere('id <> :selfId', { selfId: params.appointmentId });
      }
    }
    // 'all': nessun filtro aggiuntivo (intera serie)
  }

  /**
   * Seleziona le occorrenze di una serie ricorrente coinvolte da uno scope.
   * Usata sia per la modifica orario sia per il calcolo conflitti.
   */
  private async selectSeriesOccurrences(
    recurringGroupId: string,
    selfId: string,
    selfDate: Date | string,
    scope: 'current_only' | 'this_and_following' | 'all' | 'date_range',
    rangeFrom?: string,
    rangeTo?: string,
    includeCurrent?: boolean,
  ): Promise<AvailabilityAppointment[]> {
    const all = await this.appointmentRepo.find({
      where: { recurringGroupId },
      relations: ['operator'],
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });
    const active = all.filter(a => ![
      BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY,
      BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW,
    ].includes(a.bookingStatus));

    // appointmentDate è un column DATE: a runtime puo' arrivare come stringa
    // 'YYYY-MM-DD' o come Date a seconda del driver. Normalizziamo a stringa.
    const ds = (d: Date | string): string =>
      d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const selfDateStr = ds(selfDate as any);

    if (scope === 'current_only') {
      return active.filter(a => a.id === selfId);
    }
    if (scope === 'this_and_following') {
      return active.filter(a => ds(a.appointmentDate) >= selfDateStr);
    }
    if (scope === 'date_range') {
      if (!rangeFrom || !rangeTo) {
        throw new BadRequestException('Intervallo date mancante per scope DATE_RANGE');
      }
      return active.filter(a =>
        ds(a.appointmentDate) >= rangeFrom && ds(a.appointmentDate) <= rangeTo &&
        (includeCurrent !== false || a.id !== selfId),
      );
    }
    return active; // 'all'
  }

  /**
   * Valida una lista di occorrenze (operatore/data/orario) verificando per
   * ciascuna disponibilità operatore e sovrapposizioni con altri appuntamenti.
   * NON lancia: ritorna l'elenco dei conflitti (vuoto se tutto ok). Riusata
   * dalla creazione serie, dalla modifica serie e dall'anteprima.
   *
   * DUE QUERY IN TUTTO, non due per occorrenza. Una serie arriva a 52
   * occorrenze: interrogare disponibilità e sovrapposizioni una data alla
   * volta significava un centinaio di round-trip, che si sentono tutti
   * quando il riquadro di anteprima deve aprirsi subito.
   *
   * TEMPLATE CHE CAMBIANO NEL PERIODO: la disponibilità viene chiesta per
   * l'intero intervallo in una volta, ma `getOperatorsAvailabilityV3`
   * risolve l'assegnazione template valida **giorno per giorno** (gli
   * assignment sono una timeline con validFrom/validUntil). Quindi una serie
   * agosto→ottobre che attraversa un cambio di template a metà settembre
   * viene valutata con l'orario giusto in ogni sua parte.
   *
   * @param occurrences occorrenze da validare; `selfId` esclude un appuntamento
   *   esistente (sé stesso) dai controlli di overlap/availability.
   */
  async validateRecurringOccurrences(
    occurrences: { selfId?: string; operatorId: string; date: string; startTime: string; endTime: string }[],
  ): Promise<RecurringOccurrenceConflict[]> {
    if (occurrences.length === 0) return [];

    const conflicts: RecurringOccurrenceConflict[] = [];
    const blockEnabled = await this.generalSettingsService.isBlockOutsideAvailabilityEnabled();

    const dates = occurrences.map(o => o.date).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const operatorIds = Array.from(new Set(occurrences.map(o => o.operatorId).filter(Boolean)));
    // Tutte le occorrenze della serie si escludono a vicenda: durante uno
    // spostamento si "scambiano" gli slot, e senza questo ognuna risulterebbe
    // in conflitto con le sorelle che sta lasciando.
    const selfIds = occurrences.map(o => o.selfId).filter((id): id is string => !!id);

    // ── Sovrapposizioni: un solo giro sull'intero intervallo ──
    const existing = await this.appointmentRepo.find({
      where: {
        operatorId: In(operatorIds),
        appointmentDate: Between(new Date(minDate), new Date(maxDate)),
        bookingStatus: Not(In([
          BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY,
          BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW,
        ])),
      },
      select: ['id', 'operatorId', 'appointmentDate', 'startTime', 'endTime'],
    });

    const selfIdSet = new Set(selfIds);
    const existingByOpDate = new Map<string, { id: string; startTime: string; endTime: string }[]>();
    for (const apt of existing) {
      if (selfIdSet.has(apt.id)) continue;
      const key = `${apt.operatorId}|${toDateString(apt.appointmentDate as unknown as Date | string)}`;
      const list = existingByOpDate.get(key) ?? [];
      list.push({ id: apt.id, startTime: apt.startTime, endTime: apt.endTime });
      existingByOpDate.set(key, list);
    }

    // ── Disponibilità: un solo giro sull'intero intervallo ──
    const freeBlocksByOpDate = new Map<string, { startTime: string; endTime: string }[]>();
    if (blockEnabled) {
      const availability = await this.availabilityService.getOperatorsAvailabilityV3(
        operatorIds, minDate, maxDate, selfIds,
      );
      for (const op of availability) {
        for (const day of op.days) {
          freeBlocksByOpDate.set(`${op.operatorId}|${day.date}`, day.freeBlocks);
        }
      }
    }

    // Il confronto degli orari si fa in MINUTI, non fra stringhe: dal DB le
    // colonne `time` arrivano come '14:15:00', dall'input come '14:15', e
    // '14:15:00' > '14:15' è vero per l'ordinamento lessicografico. Con il
    // confronto fra stringhe un appuntamento che finisce alle 14:15 risultava
    // sovrapposto a quello che inizia alle 14:15. Finché il controllo stava
    // in SQL il problema non si poneva (era Postgres a confrontare due `time`).
    const toMinutes = (t: string): number => {
      const [h, m] = String(t ?? '').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    for (const occ of occurrences) {
      const key = `${occ.operatorId}|${occ.date}`;
      const occStart = toMinutes(occ.startTime);
      const occEnd = toMinutes(occ.endTime);

      // 1) Sovrapposizione con un altro appuntamento dello stesso operatore.
      //    Estremi esclusivi: appuntamenti adiacenti (fine == inizio) non si
      //    sovrappongono.
      const overlapping = (existingByOpDate.get(key) ?? []).find(
        a => toMinutes(a.startTime) < occEnd && toMinutes(a.endTime) > occStart,
      );
      if (overlapping) {
        const hhmm = (t: string): string => String(t ?? '').slice(0, 5);
        conflicts.push({
          appointmentId: occ.selfId,
          date: occ.date, startTime: occ.startTime, endTime: occ.endTime,
          type: 'overlap',
          reason: `Sovrapposto ad un altro appuntamento (${hhmm(overlapping.startTime)}-${hhmm(overlapping.endTime)})`,
          conflictingStartTime: hhmm(overlapping.startTime),
          conflictingEndTime: hhmm(overlapping.endTime),
        });
        continue; // un conflitto per occorrenza è sufficiente per il riepilogo
      }

      // 2) Fuori disponibilità operatore (solo se il blocco è attivo).
      if (blockEnabled) {
        const freeBlocks = freeBlocksByOpDate.get(key) ?? [];
        if (!this.isIntervalCovered(occ.startTime, occ.endTime, freeBlocks)) {
          conflicts.push({
            appointmentId: occ.selfId,
            date: occ.date, startTime: occ.startTime, endTime: occ.endTime,
            type: 'unavailable',
            reason: `L'operatore non è disponibile nell'orario ${occ.startTime}-${occ.endTime}`,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Analogo palestra di `validateRecurringOccurrences`.
   *
   * PERCHÉ UN METODO SEPARATO E NON UN FLAG SUL PRIMO: in palestra i tre
   * predicati sono altri. Non esiste la sovrapposizione per operatore — lo
   * slot è condiviso per definizione, dieci pazienti nello stesso orario sono
   * la normalità — e al suo posto contano la capienza della sala e la
   * chiusura della fascia. L'operatore non è un vincolo ma una conseguenza:
   * lo assegna il template della palestra, e se per quella fascia non ne
   * assegna nessuno lo slot semplicemente non è prenotabile.
   *
   * NON lancia: ritorna l'elenco dei conflitti (vuoto se tutto ok).
   *
   * @param occurrences occorrenze da validare; `selfId` esclude un
   *   appuntamento esistente (sé stesso) dal conteggio capienza.
   */
  async validateGymRecurringOccurrences(
    occurrences: { selfId?: string; gymRoomId: string; date: string; startTime: string; endTime: string }[],
    /** Paziente della serie: segnala le date in cui è già prenotato. */
    patientId?: string,
  ): Promise<RecurringOccurrenceConflict[]> {
    if (occurrences.length === 0) return [];

    const conflicts: RecurringOccurrenceConflict[] = [];
    const dates = occurrences.map(o => o.date).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const roomIds = Array.from(new Set(occurrences.map(o => o.gymRoomId).filter(Boolean)));

    // Capienza delle sale coinvolte, in un colpo solo.
    const rooms = await this.gymRoomRepo.find({ where: { id: In(roomIds) } });
    const capacityByRoom = new Map(rooms.map(r => [r.id, r.maxCapacity]));

    // Le occorrenze della serie si escludono a vicenda dal conteggio: durante
    // uno spostamento si scambiano gli slot, e senza questo ognuna vedrebbe le
    // sorelle che sta lasciando come posti ancora occupati.
    const selfIdSet = new Set(
      occurrences.map(o => o.selfId).filter((id): id is string => !!id),
    );

    // ── Prenotazioni esistenti nelle sale coinvolte: un solo giro ──
    const existing = await this.appointmentRepo.find({
      where: {
        gymRoomId: In(roomIds),
        appointmentType: AppointmentType.GYM,
        appointmentDate: Between(new Date(minDate), new Date(maxDate)),
        bookingStatus: Not(In([
          BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY,
          BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW,
        ])),
      },
      select: ['id', 'gymRoomId', 'patientId', 'appointmentDate', 'startTime', 'endTime'],
    });

    const existingByRoomDate = new Map<
      string,
      { id: string; patientId?: string; startTime: string; endTime: string }[]
    >();
    for (const apt of existing) {
      if (selfIdSet.has(apt.id)) continue;
      const key = `${apt.gymRoomId}|${toDateString(apt.appointmentDate as unknown as Date | string)}`;
      const list = existingByRoomDate.get(key) ?? [];
      list.push({
        id: apt.id,
        patientId: apt.patientId ?? undefined,
        startTime: apt.startTime,
        endTime: apt.endTime,
      });
      existingByRoomDate.set(key, list);
    }

    const hhmm = (t: string): string => t.slice(0, 5);

    for (const occ of occurrences) {
      const occDate = new Date(occ.date);

      // 1) Fascia chiusa: chiusura palestra (giornata o fascia), slot chiuso
      //    da un'assenza istruttore, o fuori dagli orari modificati.
      const closure = await this.gymExceptionService.getSlotClosure(
        occ.gymRoomId, occDate, occ.startTime, occ.endTime,
      );
      if (closure.closed) {
        conflicts.push({
          appointmentId: occ.selfId,
          date: occ.date, startTime: occ.startTime, endTime: occ.endTime,
          type: 'unavailable',
          reason: closure.reason || 'La palestra è chiusa in questa fascia oraria',
        });
        continue; // un conflitto per occorrenza basta al riepilogo
      }

      // 2) Nessun istruttore assegnato dal template per quella fascia: lo
      //    slot non esiste proprio, non è "pieno".
      const operator = await this.gymPatternGroupService.getOperatorForTimeSlot(
        occ.gymRoomId, occDate, occ.startTime,
      );
      if (!operator) {
        conflicts.push({
          appointmentId: occ.selfId,
          date: occ.date, startTime: occ.startTime, endTime: occ.endTime,
          type: 'unavailable',
          reason: 'Nessun istruttore assegnato a questa fascia oraria',
        });
        continue;
      }

      const inSlot = (existingByRoomDate.get(`${occ.gymRoomId}|${occ.date}`) ?? []).filter(
        a => hhmm(a.startTime) < hhmm(occ.endTime) && hhmm(a.endTime) > hhmm(occ.startTime),
      );

      // 3) Paziente già prenotato in quello slot: prenotarlo due volte non ha
      //    senso, ed è l'errore tipico di una serie che si sovrappone a
      //    prenotazioni singole fatte a mano.
      if (patientId && inSlot.some(a => a.patientId === patientId)) {
        conflicts.push({
          appointmentId: occ.selfId,
          date: occ.date, startTime: occ.startTime, endTime: occ.endTime,
          type: 'overlap',
          reason: 'Il paziente è già prenotato in questo slot',
        });
        continue;
      }

      // 4) Capienza esaurita.
      const capacity = capacityByRoom.get(occ.gymRoomId) ?? null;
      if (capacity !== null && inSlot.length >= capacity) {
        conflicts.push({
          appointmentId: occ.selfId,
          date: occ.date, startTime: occ.startTime, endTime: occ.endTime,
          type: 'overlap',
          reason: `Capacità massima della sala raggiunta per questo slot (${inSlot.length}/${capacity})`,
        });
      }
    }

    return conflicts;
  }

  /**
   * Piano di una serie ricorrente PRIMA di crearla: le date che verrebbero
   * generate, ciascuna con l'eventuale conflitto.
   *
   * Non scrive niente. Serve al riquadro di risoluzione, dove l'utente decide
   * occorrenza per occorrenza se confermare, spostare o saltare. È il motivo
   * per cui la creazione non ha più bisogno di un flag "forza": la forzatura
   * era un sì/no unico per una decisione che riguarda N date diverse, ognuna
   * con la propria storia (template cambiato a metà periodo, ferie, uno slot
   * occupato da qualcun altro).
   */
  async previewRecurringSeries(input: {
    operatorId?: string;
    gymRoomId?: string;
    patientId?: string;
    startDate: string;
    startTime: string;
    endTime: string;
    repeatConfig: RepeatConfigInput;
    excludeAppointmentId?: string;
  }): Promise<RecurringOccurrencePreview[]> {
    const dates = this.calculateRecurringDates(input.startDate, input.repeatConfig);
    if (dates.length === 0) {
      throw new BadRequestException('La ricorrenza non genera nessuna data');
    }

    if (!input.gymRoomId && !input.operatorId) {
      throw new BadRequestException(
        "L'anteprima richiede un operatore (serie standard) o una sala (serie palestra)",
      );
    }

    // La sala vince sull'operatore: una serie palestra va valutata con i
    // predicati della palestra anche quando l'operatore è noto, perché lì
    // l'istruttore non è un vincolo ma il risultato del template.
    const conflicts = input.gymRoomId
      ? await this.validateGymRecurringOccurrences(
          dates.map(date => ({
            selfId: input.excludeAppointmentId,
            gymRoomId: input.gymRoomId!,
            date,
            startTime: input.startTime,
            endTime: input.endTime,
          })),
          input.patientId,
        )
      : await this.validateRecurringOccurrences(
          dates.map(date => ({
            selfId: input.excludeAppointmentId,
            operatorId: input.operatorId!,
            date,
            startTime: input.startTime,
            endTime: input.endTime,
          })),
        );

    const conflictByDate = new Map(conflicts.map(c => [c.date, c]));
    return dates.map(date => ({
      date,
      startTime: input.startTime,
      endTime: input.endTime,
      conflict: conflictByDate.get(date),
    }));
  }

  /**
   * Ricontrolla un piano risolto dall'utente subito prima di applicarlo.
   *
   * Fra l'anteprima e la conferma passano secondi, ma bastano perché qualcun
   * altro prenoti uno di quegli slot. Qui si ricontrollano SOLO le
   * sovrapposizioni: sono l'unica cosa che può cambiare sotto i piedi
   * dell'utente in quel lasso di tempo, e sono anche l'unica che non gli è
   * mai stato permesso di forzare. Le occorrenze fuori disponibilità invece
   * le ha viste e confermate: non vanno rimesse in discussione.
   *
   * Ritorna i conflitti nuovi (vuoto = si può procedere).
   */
  private async recheckResolvedOccurrences(
    occurrences: { appointmentId?: string; operatorId: string; date: string; startTime: string; endTime: string }[],
    seriesAppointmentIds: string[] = [],
  ): Promise<RecurringOccurrenceConflict[]> {
    const found = await this.validateRecurringOccurrences(
      occurrences.map(o => ({
        selfId: o.appointmentId ?? seriesAppointmentIds[0],
        operatorId: o.operatorId,
        date: o.date,
        startTime: o.startTime,
        endTime: o.endTime,
      })),
    );
    return found.filter(c => c.type === 'overlap');
  }

  /**
   * Modifica SOLO orario/durata (startTime/endTime) delle occorrenze di una
   * serie ricorrente nello scope scelto. Valida prima ogni occorrenza:
   * se c'è anche un solo conflitto, NON applica nulla e ritorna i conflitti
   * (avvisa-e-blocca). I cambi di data/giorno non sono supportati qui (vanno
   * gestiti eliminando e ricreando la serie).
   */
  async updateRecurringSeriesTime(input: {
    appointmentId: string;
    scope: 'current_only' | 'this_and_following' | 'all' | 'date_range';
    startTime: string;
    endTime: string;
    rangeFrom?: string;
    rangeTo?: string;
    includeCurrent?: boolean;
  }): Promise<{ applied: boolean; affectedCount: number; conflicts: any[] }> {
    const current = await this.appointmentRepo.findOne({ where: { id: input.appointmentId } });
    if (!current || !current.recurringGroupId) {
      throw new BadRequestException('Appuntamento non trovato o non ricorrente');
    }

    const occurrences = await this.selectSeriesOccurrences(
      current.recurringGroupId, current.id, current.appointmentDate,
      input.scope, input.rangeFrom, input.rangeTo, input.includeCurrent,
    );

    if (occurrences.length === 0) {
      return { applied: false, affectedCount: 0, conflicts: [] };
    }

    // Valida ogni occorrenza con il NUOVO orario, escludendo sé stessa.
    const toDateStr = (d: Date | string): string =>
      d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const conflicts = await this.validateRecurringOccurrences(
      occurrences.map(o => ({
        selfId: o.id,
        operatorId: o.operatorId,
        date: toDateStr(o.appointmentDate),
        startTime: input.startTime,
        endTime: input.endTime,
      })),
    );

    if (conflicts.length > 0) {
      // Avvisa e blocca: niente modifiche.
      return { applied: false, affectedCount: 0, conflicts };
    }

    // Applica il nuovo orario a tutte le occorrenze coinvolte.
    const ids = occurrences.map(o => o.id);
    await this.appointmentRepo
      .createQueryBuilder()
      .update(AvailabilityAppointment)
      .set({ startTime: input.startTime, endTime: input.endTime })
      .whereInIds(ids)
      .execute();

    // Notifica SSE per refresh calendario.
    try {
      this.eventsService.emit({
        type: 'appointment_status_changed',
        appointmentIds: ids,
        timestamp: new Date(),
      });
    } catch { /* best-effort */ }

    // Notifica WhatsApp di spostamento, una per occorrenza davvero mossa: il
    // gateway le raggruppa in un unico messaggio e riprogramma i promemoria
    // sul nuovo orario. Prima di questo passaggio la serie si spostava in
    // silenzio e i promemoria restavano sul vecchio orario.
    const hhmm = (t: string | null | undefined): string => String(t ?? '').slice(0, 5);
    this.notifyWhatsappUpdates(
      occurrences
        .filter((occ) => hhmm(occ.startTime) !== hhmm(input.startTime))
        .map((occ) => ({
          appointment: {
            ...occ,
            startTime: input.startTime,
            endTime: input.endTime,
          } as AvailabilityAppointment,
          previous: { appointmentDate: occ.appointmentDate, startTime: occ.startTime },
        })),
    );

    return { applied: true, affectedCount: ids.length, conflicts: [] };
  }

  /** Differenza in giorni tra due date YYYY-MM-DD (calcolo in UTC, DST-safe). */
  private diffInDays(fromStr: string, toStr: string): number {
    const from = new Date(`${fromStr}T00:00:00Z`).getTime();
    const to = new Date(`${toStr}T00:00:00Z`).getTime();
    return Math.round((to - from) / 86400000);
  }

  /** Somma `days` a una data YYYY-MM-DD e ritorna YYYY-MM-DD (UTC, DST-safe). */
  private addDays(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Modifica COMPLETA (tutti i campi + eventuale spostamento di data) delle
   * occorrenze di una serie ricorrente nello scope scelto. A differenza di
   * `updateRecurringSeriesTime` (solo orario), propaga operatore, paziente,
   * servizi, strumenti, note, non-retribuito e un eventuale shift di data.
   *
   * Spostamento data: se `newDate` differisce dalla data attuale dell'occorrenza
   * corrente, l'intera serie nello scope viene traslata dello STESSO numero di
   * giorni (preserva la spaziatura della ricorrenza).
   *
   * Validazione preventiva "avvisa-e-blocca": se una qualsiasi occorrenza, alla
   * nuova posizione, si sovrappone a un appuntamento ESTERNO alla serie, NON
   * applica nulla e ritorna i conflitti. Le occorrenze della serie sono escluse
   * dal controllo (si "scambiano" gli slot durante lo shift). Il vincolo di
   * disponibilità operatore NON blocca qui: l'applicazione forza il salvataggio
   * (l'utente ha scelto esplicitamente di modificare la serie).
   *
   * Serie PALESTRA (appointmentType GYM): lo slot è condiviso per natura
   * (stesso istruttore, più pazienti), quindi il controllo di sovrapposizione
   * per operatore NON si applica. Se la posizione cambia, si validano invece
   * chiusura slot e capienza della sala nella nuova posizione.
   */
  async updateRecurringSeries(input: {
    appointmentId: string;
    scope: 'current_only' | 'this_and_following' | 'all' | 'date_range';
    rangeFrom?: string;
    rangeTo?: string;
    includeCurrent?: boolean;
    newDate?: string;
    startTime: string;
    endTime: string;
    operatorId?: string;
    /** Sala di destinazione per le occorrenze palestra dello scope. */
    gymRoomId?: string;
    patientId?: string;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    notes?: string;
    nonRetribuito?: boolean;
    instrumentOrderMatters?: boolean;
    services?: ServiceInputItem[];
    instruments?: CreateAppointmentInstrumentInput[];
    /** Occorrenze da lasciare intatte (decise nel riquadro conflitti). */
    skipAppointmentIds?: string[];
    /** Destinazioni decise a mano per singole occorrenze. */
    occurrenceOverrides?: RecurringOccurrenceInput[];
  }): Promise<{ applied: boolean; affectedCount: number; conflicts: any[] }> {
    const current = await this.appointmentRepo.findOne({ where: { id: input.appointmentId } });
    if (!current || !current.recurringGroupId) {
      throw new BadRequestException('Appuntamento non trovato o non ricorrente');
    }

    const occurrences = await this.selectSeriesOccurrences(
      current.recurringGroupId, current.id, current.appointmentDate,
      input.scope, input.rangeFrom, input.rangeTo, input.includeCurrent,
    );
    if (occurrences.length === 0) {
      return { applied: false, affectedCount: 0, conflicts: [] };
    }

    const ds = (d: Date | string): string =>
      d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

    // Delta uniforme dallo spostamento della sola occorrenza corrente.
    const baseStr = ds(current.appointmentDate);
    const deltaDays = input.newDate ? this.diffInDays(baseStr, input.newDate) : 0;

    // Il riquadro conflitti può aver deciso di lasciare intatte alcune
    // occorrenze e di mandarne altre a una destinazione tutta loro: qui le
    // due decisioni diventano il piano da applicare. Senza riquadro il
    // comportamento resta quello di sempre — stesso spostamento per tutte.
    const skipIds = new Set(input.skipAppointmentIds ?? []);
    const overrideById = new Map(
      (input.occurrenceOverrides ?? [])
        .filter(o => !!o.appointmentId)
        .map(o => [o.appointmentId!, o]),
    );

    const targets = occurrences
      .filter(o => !skipIds.has(o.id))
      .map(o => {
        const override = overrideById.get(o.id);
        return {
          occ: o,
          newDate: override?.date
            ?? (deltaDays === 0 ? ds(o.appointmentDate) : this.addDays(ds(o.appointmentDate), deltaDays)),
          newStartTime: override?.startTime ?? input.startTime,
          newEndTime: override?.endTime ?? input.endTime,
          newOperatorId: override?.operatorId ?? input.operatorId,
          // Sala di destinazione: quella decisa per la singola occorrenza,
          // altrimenti quella dell'intera serie, altrimenti resta la sua.
          //
          // Solo per le occorrenze PALESTRA: su un appuntamento standard la
          // sala non ha significato, e un `gymRoomId` passato per errore
          // finirebbe scritto sulla riga senza che nessun controllo lo veda.
          newGymRoomId:
            o.appointmentType === AppointmentType.GYM
              ? (override?.gymRoomId ?? input.gymRoomId ?? o.gymRoomId ?? undefined)
              : undefined,
        };
      });

    if (targets.length === 0) {
      return { applied: false, affectedCount: 0, conflicts: [] };
    }

    // Le occorrenze saltate restano dove sono, quindi continuano a occupare
    // il loro slot: NON vanno escluse dal controllo sovrapposizioni, o una
    // occorrenza spostata potrebbe finirci sopra.
    const batchIds = targets.map(t => t.occ.id);

    // ── Validazione preventiva: solo sovrapposizioni con appuntamenti ESTERNI
    //    alla serie (la serie in movimento è esclusa via NOT IN batchIds).
    //    Per le occorrenze PALESTRA il check per operatore non ha senso (slot
    //    condiviso): si valida chiusura slot + capienza sala, e solo se la
    //    posizione cambia davvero. ──
    const hhmm = (t: string | undefined | null): string => (t ?? '').slice(0, 5);
    const conflicts: any[] = [];
    for (const t of targets) {
      if (t.occ.appointmentType === AppointmentType.GYM) {
        const destRoomId = t.newGymRoomId ?? t.occ.gymRoomId;
        const roomChanged = !!destRoomId && destRoomId !== t.occ.gymRoomId;
        const positionChanged =
          roomChanged ||
          t.newDate !== ds(t.occ.appointmentDate) ||
          hhmm(t.newStartTime) !== hhmm(t.occ.startTime) ||
          hhmm(t.newEndTime) !== hhmm(t.occ.endTime);
        if (!positionChanged || !destRoomId) continue;

        const destRoom = await this.gymRoomRepo.findOne({
          where: { id: destRoomId, isActive: true },
        });
        if (!destRoom) {
          conflicts.push({
            appointmentId: t.occ.id,
            date: t.newDate, startTime: t.newStartTime, endTime: t.newEndTime,
            type: 'unavailable',
            reason: 'Sala di destinazione non trovata o non attiva',
          });
          continue;
        }

        const closure = await this.gymExceptionService.getSlotClosure(
          destRoomId, new Date(t.newDate), t.newStartTime, t.newEndTime,
        );
        if (closure.closed) {
          conflicts.push({
            appointmentId: t.occ.id,
            date: t.newDate, startTime: t.newStartTime, endTime: t.newEndTime,
            type: 'unavailable',
            reason: closure.reason || 'La palestra è chiusa in questa fascia oraria',
          });
          continue;
        }

        // Istruttore assegnato dal template della sala di DESTINAZIONE per
        // quella data e quella fascia. Va verificato qui e non solo
        // occorrenza per occorrenza in fase di applicazione: se manca anche
        // per una sola data, la serie non è spostabile e nulla deve partire.
        const destOperator = await this.gymPatternGroupService.getOperatorForTimeSlot(
          destRoomId, new Date(t.newDate), t.newStartTime,
        );
        if (!destOperator) {
          conflicts.push({
            appointmentId: t.occ.id,
            date: t.newDate, startTime: t.newStartTime, endTime: t.newEndTime,
            type: 'unavailable',
            reason: `Nessun istruttore assegnato a questa fascia in ${destRoom.name}`,
          });
          continue;
        }

        const inSlot = await this.appointmentRepo
          .createQueryBuilder('a')
          .where('a.gymRoomId = :roomId', { roomId: destRoomId })
          .andWhere('a.appointmentType = :gymType', { gymType: AppointmentType.GYM })
          .andWhere('a.appointmentDate = :date', { date: t.newDate })
          .andWhere('a.bookingStatus NOT IN (:...excluded)', {
            excluded: [BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW],
          })
          .andWhere('a.startTime < :endTime AND a.endTime > :startTime', {
            startTime: t.newStartTime, endTime: t.newEndTime,
          })
          .andWhere('a.id NOT IN (:...batchIds)', { batchIds })
          .getCount();
        // Capienza della sala di DESTINAZIONE, non `maxParticipants`
        // dell'occorrenza: quello è un valore denormalizzato al momento della
        // prenotazione e descrive la sala di partenza, che può essere più
        // capiente di quella dove si sta andando.
        const capacity = destRoom.maxCapacity ?? null;
        if (capacity !== null && inSlot >= capacity) {
          conflicts.push({
            appointmentId: t.occ.id,
            date: t.newDate, startTime: t.newStartTime, endTime: t.newEndTime,
            type: 'overlap',
            reason: `Capacità massima di ${destRoom.name} raggiunta per questo slot (${inSlot}/${capacity})`,
          });
        }
        continue;
      }

      const opId = t.newOperatorId ?? t.occ.operatorId;
      const overlap = await this.appointmentRepo
        .createQueryBuilder('a')
        .where('a.operatorId = :opId', { opId })
        .andWhere('a.appointmentDate = :date', { date: t.newDate })
        .andWhere('a.bookingStatus NOT IN (:...excluded)', {
          excluded: [BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW],
        })
        .andWhere('a.startTime < :endTime AND a.endTime > :startTime', {
          startTime: t.newStartTime, endTime: t.newEndTime,
        })
        .andWhere('a.id NOT IN (:...batchIds)', { batchIds })
        .getOne();
      if (overlap) {
        conflicts.push({
          appointmentId: t.occ.id,
          date: t.newDate, startTime: t.newStartTime, endTime: t.newEndTime,
          type: 'overlap',
          reason: `Sovrapposto ad un altro appuntamento (${overlap.startTime}-${overlap.endTime})`,
          conflictingStartTime: overlap.startTime,
          conflictingEndTime: overlap.endTime,
        });
      }
    }
    if (conflicts.length > 0) {
      return { applied: false, affectedCount: 0, conflicts };
    }

    // Ordine di applicazione: con shift in avanti si parte dall'ultima
    // occorrenza (lo slot di destinazione è già libero), all'indietro dalla
    // prima. Evita che il controllo sovrapposizioni interno a `update()`
    // scatti tra occorrenze della stessa serie durante lo spostamento.
    const ordered = [...targets].sort((a, b) =>
      deltaDays > 0
        ? ds(b.occ.appointmentDate).localeCompare(ds(a.occ.appointmentDate))
        : ds(a.occ.appointmentDate).localeCompare(ds(b.occ.appointmentDate)),
    );

    const failed: any[] = [];
    let affected = 0;
    for (const t of ordered) {
      try {
        await this.update(t.occ.id, {
          appointmentDate: t.newDate,
          startTime: t.newStartTime,
          endTime: t.newEndTime,
          operatorId: t.newOperatorId,
          // Solo se la sala cambia davvero: passarla identica farebbe
          // scattare inutilmente il riallineamento di istruttore e capienza
          // che `update()` esegue a ogni cambio di sala.
          gymRoomId:
            t.newGymRoomId && t.newGymRoomId !== t.occ.gymRoomId
              ? t.newGymRoomId
              : undefined,
          patientId: input.patientId,
          clientName: input.clientName,
          clientPhone: input.clientPhone,
          clientEmail: input.clientEmail,
          notes: input.notes,
          nonRetribuito: input.nonRetribuito,
          instrumentOrderMatters: input.instrumentOrderMatters,
          services: input.services,
          instruments: input.instruments,
          // Disponibilità già decisa a monte: forziamo per non ri-bloccare la
          // guardia "fuori disponibilità" occorrenza per occorrenza.
          forceOutsideAvailability: true,
        });
        affected++;
      } catch (e: any) {
        failed.push({
          appointmentId: t.occ.id,
          date: t.newDate, startTime: t.newStartTime, endTime: t.newEndTime,
          type: 'error',
          reason: e?.message || 'Errore durante l\'aggiornamento dell\'occorrenza',
        });
      }
    }

    try {
      this.eventsService.emit({
        type: 'appointment_status_changed',
        appointmentIds: batchIds,
        timestamp: new Date(),
      });
    } catch { /* best-effort */ }

    return { applied: affected > 0, affectedCount: affected, conflicts: failed };
  }
}
