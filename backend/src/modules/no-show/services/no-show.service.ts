import { Injectable, NotFoundException } from '@nestjs/common';
import { Brackets, In, SelectQueryBuilder } from 'typeorm';

import { TenantContextService } from '@curandis/tenant-datasource';

import {
  AvailabilityAppointment,
  BookingStatus,
} from '../../availability/entities/availability-appointment.entity';
import { AppointmentService as AppointmentServiceEntity } from '../../availability/entities/appointment-service.entity';
import { AppointmentType } from '../../availability/entities/appointment-type.enum';
import { ClinicalSubjectIndex } from '../../../patients/entities/clinical-subject-index.entity';
import { GeneralSettingsService } from '../../settings/services/general-settings.service';
import { NoShowDecision, NoShowReview } from '../entities/no-show-review.entity';
import {
  NoShowContext,
  NoShowCounts,
  NoShowEvent,
  NoShowEventPage,
  NoShowEventType,
  NoShowPatientGroup,
  NoShowPatientPage,
  NoShowSummary,
} from '../models/no-show.models';
import {
  NoShowFilterInput,
  NoShowPagingInput,
  UpsertNoShowReviewInput,
} from '../dto/no-show.input';

/** Tipologie incluse quando il chiamante non ne specifica nessuna. */
const DEFAULT_TYPES: NoShowEventType[] = [
  NoShowEventType.NO_SHOW,
  NoShowEventType.CANCELLED_LATE,
  NoShowEventType.CANCELLED_UNKNOWN,
];

/** Tipologie che contano come assenza ingiustificata vera e propria. */
const UNJUSTIFIED_TYPES = new Set<NoShowEventType>([
  NoShowEventType.NO_SHOW,
  NoShowEventType.CANCELLED_LATE,
  NoShowEventType.CANCELLED_UNKNOWN,
]);

/** Riga grezza del query builder, prima della mappatura a NoShowEvent. */
interface RawAppointmentRow {
  apt: AvailabilityAppointment;
  operatorName?: string;
  operatorMacroCategory?: string;
  originalOperatorName?: string;
  siteName?: string;
  gymRoomName?: string;
}

/**
 * GESTIONE ASSENZE INGIUSTIFICATE (Statistiche → No Show).
 *
 * Legge dagli APPUNTAMENTI, non da `clinical_attendance_log`: è l'unica
 * sorgente che ha già operatore, data/ora, ambito studio/palestra, sede,
 * motivo e ore di preavviso, ed è retroattiva sullo storico esistente
 * (il log, fino al fix di `markAsNoShow`, non registrava i no-show fatti
 * dal calendario). Il log resta la sorgente dei contatori sulla scheda
 * paziente.
 *
 * Studio e palestra vivono nella stessa tabella: cambia `appointmentType`
 * e la macro-categoria dell'operatore (istruttore vs medico/fisio), per
 * questo una sola query copre entrambi gli ambiti.
 */
@Injectable()
export class NoShowService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly settingsService: GeneralSettingsService,
  ) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get appointmentRepo() {
    return this.dataSource.getRepository(AvailabilityAppointment);
  }
  private get reviewRepo() {
    return this.dataSource.getRepository(NoShowReview);
  }
  private get subjectIndexRepo() {
    return this.dataSource.getRepository(ClinicalSubjectIndex);
  }
  private get appointmentServiceRepo() {
    return this.dataSource.getRepository(AppointmentServiceEntity);
  }

  // ======================================================================
  // QUERY BUILDER CONDIVISO
  // ======================================================================

  /**
   * Base comune: appuntamenti che rientrano in almeno una delle tipologie
   * richieste, più i filtri di ambito/operatore/sede/paziente.
   *
   * Le date sono filtrate su `appointmentDate` (quando il paziente sarebbe
   * dovuto venire), non su `cancelledAt`: allo staff interessa la seduta
   * persa, non il momento della telefonata.
   */
  private baseQuery(
    filter: NoShowFilterInput,
    lateArrivalTolerance: number,
  ): SelectQueryBuilder<AvailabilityAppointment> {
    const types = filter.types?.length ? filter.types : DEFAULT_TYPES;

    const qb = this.appointmentRepo
      .createQueryBuilder('apt')
      .leftJoin('apt.operator', 'op')
      .leftJoin('apt.originalOperator', 'origOp')
      .leftJoin('apt.site', 'site')
      .leftJoin('apt.gymRoom', 'gymRoom')
      // Gli appuntamenti non retribuiti (pausa pranzo, rappresentante…)
      // non hanno gestione degli stati: non sono assenze di nessuno.
      .where('apt.nonRetribuito = false');

    // --- tipologie (OR) ---
    qb.andWhere(
      new Brackets((qbb) => {
        let first = true;
        const add = (sql: string, params?: Record<string, unknown>) => {
          if (first) {
            qbb.where(sql, params);
            first = false;
          } else {
            qbb.orWhere(sql, params);
          }
        };

        for (const type of types) {
          switch (type) {
            case NoShowEventType.NO_SHOW:
              add('apt.bookingStatus = :stNoShow', { stNoShow: BookingStatus.NO_SHOW });
              break;
            case NoShowEventType.CANCELLED_LATE:
              add('apt.bookingStatus = :stLate', { stLate: BookingStatus.CANCELLED_LATE });
              break;
            case NoShowEventType.CANCELLED_EARLY:
              add('apt.bookingStatus = :stEarly', { stEarly: BookingStatus.CANCELLED_EARLY });
              break;
            case NoShowEventType.CANCELLED_UNKNOWN:
              add('apt.bookingStatus = :stCancelled', { stCancelled: BookingStatus.CANCELLED });
              break;
            case NoShowEventType.LATE_ARRIVAL:
              // Un ritardo esiste solo su un appuntamento che NON è finito
              // in assenza o disdetta.
              add(
                `(apt.bookingStatus NOT IN (:...stNotAbsent)
                  AND (apt."wasNoShowReverted" = true OR apt."lateMinutes" >= :tolerance))`,
                {
                  stNotAbsent: [
                    BookingStatus.NO_SHOW,
                    BookingStatus.CANCELLED,
                    BookingStatus.CANCELLED_EARLY,
                    BookingStatus.CANCELLED_LATE,
                  ],
                  tolerance: lateArrivalTolerance,
                },
              );
              break;
          }
        }
        // Nessuna tipologia riconosciuta → nessun risultato (invece di tutti).
        if (first) qbb.where('1 = 0');
      }),
    );

    // --- periodo ---
    if (filter.from) {
      qb.andWhere('apt.appointmentDate >= :from', { from: filter.from });
    }
    if (filter.to) {
      qb.andWhere('apt.appointmentDate <= :to', { to: filter.to });
    }

    // --- ambito studio / palestra ---
    if (filter.context === NoShowContext.STUDIO) {
      qb.andWhere('apt.appointmentType = :aptTypeStd', {
        aptTypeStd: AppointmentType.STANDARD,
      });
    } else if (filter.context === NoShowContext.GYM) {
      qb.andWhere('apt.appointmentType = :aptTypeGym', {
        aptTypeGym: AppointmentType.GYM,
      });
    }

    if (filter.operatorIds?.length) {
      qb.andWhere('apt.operatorId IN (:...operatorIds)', {
        operatorIds: filter.operatorIds,
      });
    }
    if (filter.siteIds?.length) {
      qb.andWhere('apt.siteId IN (:...siteIds)', { siteIds: filter.siteIds });
    }
    if (filter.patientId) {
      qb.andWhere('apt.patientId = :patientId', { patientId: filter.patientId });
    }
    if (!filter.includeWithoutPatient) {
      qb.andWhere('apt.patientId IS NOT NULL');
    }
    if (filter.search?.trim()) {
      const search = `%${filter.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((qbb) => {
          qbb
            .where(
              `EXISTS (
                 SELECT 1 FROM clinical_subject_index csi
                 WHERE csi.subject_id = apt."patientId"
                   AND csi.display_name_lower LIKE :search
               )`,
              { search },
            )
            .orWhere('LOWER(apt."clientName") LIKE :search', { search });
        }),
      );
    }

    // --- esito valutazione staff ---
    // I "giustificati" escono di default: un'assenza con certificato non
    // deve inquinare il conteggio su cui si decide un addebito.
    const excludeJustified = filter.excludeJustified ?? true;
    if (excludeJustified && !filter.decisions?.includes(NoShowDecision.JUSTIFIED)) {
      qb.andWhere(
        `NOT EXISTS (
           SELECT 1 FROM no_show_reviews r
           WHERE r."appointmentId" = apt.id AND r.decision = :justified
         )`,
        { justified: NoShowDecision.JUSTIFIED },
      );
    }

    if (filter.decisions?.length) {
      const decisions = filter.decisions;
      const includesPending = decisions.includes(NoShowDecision.PENDING);
      const explicit = decisions.filter((d) => d !== NoShowDecision.PENDING);

      qb.andWhere(
        new Brackets((qbb) => {
          let first = true;
          if (includesPending) {
            // "Da valutare" = review assente OPPURE esplicitamente PENDING.
            qbb.where(
              `NOT EXISTS (
                 SELECT 1 FROM no_show_reviews r
                 WHERE r."appointmentId" = apt.id AND r.decision <> :pending
               )`,
              { pending: NoShowDecision.PENDING },
            );
            first = false;
          }
          if (explicit.length) {
            const sql = `EXISTS (
              SELECT 1 FROM no_show_reviews r
              WHERE r."appointmentId" = apt.id AND r.decision IN (:...explicitDecisions)
            )`;
            if (first) qbb.where(sql, { explicitDecisions: explicit });
            else qbb.orWhere(sql, { explicitDecisions: explicit });
          }
        }),
      );
    }

    return qb;
  }

  private async thresholds() {
    return this.settingsService.getNoShowSettings();
  }

  // ======================================================================
  // ELENCO PIATTO
  // ======================================================================

  async findEvents(
    filter: NoShowFilterInput,
    paging?: NoShowPagingInput,
  ): Promise<NoShowEventPage> {
    const { lateArrivalToleranceMinutes } = await this.thresholds();
    const qb = this.baseQuery(filter, lateArrivalToleranceMinutes);

    const total = await qb.getCount();

    qb.select('apt')
      .addSelect(
        `TRIM(CONCAT(op.name, ' ', COALESCE(op.surname, '')))`,
        'operatorName',
      )
      .addSelect('op."macroCategory"', 'operatorMacroCategory')
      .addSelect(
        `TRIM(CONCAT(origOp.name, ' ', COALESCE(origOp.surname, '')))`,
        'originalOperatorName',
      )
      .addSelect('site.name', 'siteName')
      .addSelect('gymRoom.name', 'gymRoomName')
      .orderBy('apt.appointmentDate', 'DESC')
      .addOrderBy('apt.startTime', 'DESC')
      .limit(paging?.limit ?? 50)
      .offset(paging?.offset ?? 0);

    const rows = await this.fetchRows(qb);
    const events = await this.toEvents(rows, lateArrivalToleranceMinutes);
    return { events, total };
  }

  /**
   * Esegue la query e ricompone entity + colonne calcolate. `getRawAndEntities`
   * allinea raw[i] con entities[i], quindi l'accoppiamento per indice è
   * garantito da TypeORM.
   */
  private async fetchRows(
    qb: SelectQueryBuilder<AvailabilityAppointment>,
  ): Promise<RawAppointmentRow[]> {
    const { entities, raw } = await qb.getRawAndEntities();
    return entities.map((apt, i) => ({
      apt,
      operatorName: raw[i]?.operatorName || undefined,
      operatorMacroCategory: raw[i]?.operatorMacroCategory || undefined,
      originalOperatorName: raw[i]?.originalOperatorName || undefined,
      siteName: raw[i]?.siteName || undefined,
      gymRoomName: raw[i]?.gymRoomName || undefined,
    }));
  }

  // ======================================================================
  // VISTA AD ALBERO PER PAZIENTE
  // ======================================================================

  /**
   * Un nodo per paziente con i conteggi per tipologia, più due finestre
   * SCORREVOLI (ultimi N giorni e ultimi 12 mesi) calcolate a prescindere
   * dal periodo filtrato.
   *
   * Le finestre scorrevoli sono il punto della pagina: aggregare per anno
   * solare — come fa `clinical_attendance_log.year` — direbbe "1 e 1" per
   * due assenze a cavallo di Capodanno, che invece distano sei giorni.
   */
  async findByPatient(
    filter: NoShowFilterInput,
    paging?: NoShowPagingInput,
  ): Promise<NoShowPatientPage> {
    const { lateArrivalToleranceMinutes, recentWindowDays } = await this.thresholds();

    // 1. Aggregazione per paziente (in SQL: non carica gli eventi).
    const aggQb = this.baseQuery(filter, lateArrivalToleranceMinutes)
      .select('apt.patientId', 'patientId')
      .addSelect('COUNT(*)::int', 'total')
      .addSelect('MIN(apt.appointmentDate)', 'firstEventDate')
      .addSelect('MAX(apt.appointmentDate)', 'lastEventDate')
      .groupBy('apt.patientId');

    const minEvents = filter.minEvents ?? 1;
    if (minEvents > 1) {
      aggQb.having('COUNT(*) >= :minEvents', { minEvents });
    }

    const aggRows = await aggQb.getRawMany<{
      patientId: string | null;
      total: number;
      firstEventDate: string | Date;
      lastEventDate: string | Date;
    }>();

    // Ordinamento in memoria e non in SQL: le righe aggregate si caricano
    // comunque tutte (servono per `totalPatients` e per la paginazione a
    // fette), e un ORDER BY su espressione aggregata via QueryBuilder è
    // fragile. Prima i pazienti con più eventi, poi i più recenti.
    aggRows.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const aLast = NoShowService.isoDateOf(a.lastEventDate) ?? '';
      const bLast = NoShowService.isoDateOf(b.lastEventDate) ?? '';
      return bLast.localeCompare(aLast);
    });

    const totalPatients = aggRows.length;
    const offset = paging?.offset ?? 0;
    const limit = paging?.limit ?? 50;
    const page = aggRows.slice(offset, offset + limit);
    if (page.length === 0) {
      return { groups: [], totalPatients };
    }

    const patientIds = page
      .map((r) => r.patientId)
      .filter((id): id is string => !!id);

    // 2. Eventi dei soli pazienti della pagina.
    const eventsFilter: NoShowFilterInput = { ...filter, minEvents: undefined };
    const eventsQb = this.baseQuery(eventsFilter, lateArrivalToleranceMinutes);
    // La pagina può contenere sia pazienti veri sia il gruppo "senza
    // paziente" (clienti occasionali), quando il filtro li include.
    const hasNullGroup = page.some((r) => !r.patientId);
    eventsQb.andWhere(
      new Brackets((qbb) => {
        if (patientIds.length) {
          qbb.where('apt.patientId IN (:...pagePatientIds)', {
            pagePatientIds: patientIds,
          });
          if (hasNullGroup) qbb.orWhere('apt.patientId IS NULL');
        } else {
          qbb.where('apt.patientId IS NULL');
        }
      }),
    );
    eventsQb
      .select('apt')
      .addSelect(
        `TRIM(CONCAT(op.name, ' ', COALESCE(op.surname, '')))`,
        'operatorName',
      )
      .addSelect('op."macroCategory"', 'operatorMacroCategory')
      .addSelect(
        `TRIM(CONCAT(origOp.name, ' ', COALESCE(origOp.surname, '')))`,
        'originalOperatorName',
      )
      .addSelect('site.name', 'siteName')
      .addSelect('gymRoom.name', 'gymRoomName')
      .orderBy('apt.appointmentDate', 'DESC')
      .addOrderBy('apt.startTime', 'DESC');

    const rows = await this.fetchRows(eventsQb);
    const events = await this.toEvents(rows, lateArrivalToleranceMinutes);

    // 3. Finestre scorrevoli, indipendenti dal periodo filtrato ma con gli
    //    stessi criteri di ambito/tipologia.
    const today = new Date();
    const recentFrom = NoShowService.isoDate(
      NoShowService.addDays(today, -recentWindowDays),
    );
    const yearFrom = NoShowService.isoDate(NoShowService.addDays(today, -365));
    const todayIso = NoShowService.isoDate(today);

    const [recentCounts, yearCounts] = await Promise.all([
      this.countsForWindow(filter, patientIds, recentFrom, todayIso, lateArrivalToleranceMinutes),
      this.countsForWindow(filter, patientIds, yearFrom, todayIso, lateArrivalToleranceMinutes),
    ]);

    // 4. Composizione dei nodi.
    const eventsByPatient = new Map<string, NoShowEvent[]>();
    for (const ev of events) {
      const key = ev.patientId ?? '';
      const list = eventsByPatient.get(key) ?? [];
      list.push(ev);
      eventsByPatient.set(key, list);
    }

    const groups: NoShowPatientGroup[] = page.map((row) => {
      const key = row.patientId ?? '';
      const patientEvents = eventsByPatient.get(key) ?? [];
      return {
        patientId: row.patientId ?? undefined,
        patientName: patientEvents[0]?.patientName ?? 'Senza paziente',
        counts: NoShowService.countEvents(patientEvents),
        recent: recentCounts.get(key) ?? NoShowService.emptyCounts(),
        rollingYear: yearCounts.get(key) ?? NoShowService.emptyCounts(),
        firstEventDate: NoShowService.isoDateOf(row.firstEventDate),
        lastEventDate: NoShowService.isoDateOf(row.lastEventDate),
        pendingReviews: patientEvents.filter(
          (e) => !e.review || e.review.decision === NoShowDecision.PENDING,
        ).length,
        events: patientEvents,
      };
    });

    return { groups, totalPatients };
  }

  /**
   * Conteggi per tipologia su una finestra temporale arbitraria, per un
   * insieme di pazienti. Una sola query: raggruppa per paziente + stato e
   * traduce lo stato in tipologia in memoria.
   */
  private async countsForWindow(
    filter: NoShowFilterInput,
    patientIds: string[],
    from: string,
    to: string,
    tolerance: number,
  ): Promise<Map<string, NoShowCounts>> {
    const result = new Map<string, NoShowCounts>();
    if (patientIds.length === 0) return result;

    // Nella finestra scorrevole si guardano SEMPRE tutte le tipologie: il
    // senso è dare il quadro completo del paziente, non ripetere il filtro.
    const windowFilter: NoShowFilterInput = {
      ...filter,
      from,
      to,
      minEvents: undefined,
      search: undefined,
      patientId: undefined,
      types: [
        NoShowEventType.NO_SHOW,
        NoShowEventType.CANCELLED_LATE,
        NoShowEventType.CANCELLED_EARLY,
        NoShowEventType.CANCELLED_UNKNOWN,
        NoShowEventType.LATE_ARRIVAL,
      ],
    };

    const rows = await this.baseQuery(windowFilter, tolerance)
      .andWhere('apt.patientId IN (:...windowPatientIds)', {
        windowPatientIds: patientIds,
      })
      .select('apt.patientId', 'patientId')
      .addSelect('apt.bookingStatus', 'bookingStatus')
      .addSelect('apt."wasNoShowReverted"', 'wasNoShowReverted')
      .addSelect('apt."lateMinutes"', 'lateMinutes')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('apt.patientId')
      .addGroupBy('apt.bookingStatus')
      .addGroupBy('apt."wasNoShowReverted"')
      .addGroupBy('apt."lateMinutes"')
      .getRawMany<{
        patientId: string;
        bookingStatus: BookingStatus;
        wasNoShowReverted: boolean;
        lateMinutes: number | null;
        count: number;
      }>();

    for (const r of rows) {
      const counts = result.get(r.patientId) ?? NoShowService.emptyCounts();
      const type = NoShowService.deriveType(
        r.bookingStatus,
        r.wasNoShowReverted,
        r.lateMinutes,
        tolerance,
      );
      NoShowService.bump(counts, type, r.count);
      result.set(r.patientId, counts);
    }
    return result;
  }

  // ======================================================================
  // RIEPILOGO
  // ======================================================================

  async summary(filter: NoShowFilterInput): Promise<NoShowSummary> {
    const {
      lateCancellationHours,
      lateArrivalToleranceMinutes,
      recentWindowDays,
    } = await this.thresholds();

    const rows = await this.baseQuery(filter, lateArrivalToleranceMinutes)
      .select('apt.bookingStatus', 'bookingStatus')
      .addSelect('apt."wasNoShowReverted"', 'wasNoShowReverted')
      .addSelect('apt."lateMinutes"', 'lateMinutes')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('apt.bookingStatus')
      .addGroupBy('apt."wasNoShowReverted"')
      .addGroupBy('apt."lateMinutes"')
      .getRawMany<{
        bookingStatus: BookingStatus;
        wasNoShowReverted: boolean;
        lateMinutes: number | null;
        count: number;
      }>();

    const counts = NoShowService.emptyCounts();
    for (const r of rows) {
      NoShowService.bump(
        counts,
        NoShowService.deriveType(
          r.bookingStatus,
          r.wasNoShowReverted,
          r.lateMinutes,
          lateArrivalToleranceMinutes,
        ),
        r.count,
      );
    }

    // COUNT(DISTINCT) sui gruppi conta i pazienti più volte: serve una
    // query dedicata.
    const distinctRow = await this.baseQuery(filter, lateArrivalToleranceMinutes)
      .select('COUNT(DISTINCT apt."patientId")::int', 'patients')
      .getRawOne<{ patients: number }>();

    // Esiti delle valutazioni sugli eventi che rientrano nel filtro.
    const decisionRows = await this.baseQuery(filter, lateArrivalToleranceMinutes)
      .innerJoin(NoShowReview, 'rev', 'rev."appointmentId" = apt.id')
      .select('rev.decision', 'decision')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('rev.decision')
      .getRawMany<{ decision: NoShowDecision; count: number }>();

    const byDecision = new Map(decisionRows.map((r) => [r.decision, r.count]));
    const reviewed = decisionRows.reduce((acc, r) => acc + r.count, 0);

    return {
      counts,
      patientsInvolved: distinctRow?.patients ?? 0,
      // Mai valutati + valutati e lasciati in sospeso.
      pendingReviews:
        counts.total - reviewed + (byDecision.get(NoShowDecision.PENDING) ?? 0),
      toCharge: byDecision.get(NoShowDecision.TO_CHARGE) ?? 0,
      waived: byDecision.get(NoShowDecision.WAIVED) ?? 0,
      justified: byDecision.get(NoShowDecision.JUSTIFIED) ?? 0,
      lateCancellationHours,
      lateArrivalToleranceMinutes,
      recentWindowDays,
    };
  }

  // ======================================================================
  // VALUTAZIONE STAFF
  // ======================================================================

  async upsertReview(
    input: UpsertNoShowReviewInput,
    decidedBy?: { userId?: string; name?: string },
  ): Promise<NoShowReview> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: input.appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException(
        `Appuntamento ${input.appointmentId} non trovato`,
      );
    }

    const existing = await this.reviewRepo.findOne({
      where: { appointmentId: input.appointmentId },
    });

    const review = existing ?? this.reviewRepo.create({
      appointmentId: input.appointmentId,
    });

    review.patientId = appointment.patientId;
    review.decision = input.decision;
    review.notes = input.notes;
    review.chargedAmount = input.chargedAmount;
    review.decidedBy = decidedBy?.userId;
    review.decidedByName = decidedBy?.name;
    review.decidedAt = new Date();

    return this.reviewRepo.save(review);
  }

  async deleteReview(appointmentId: string): Promise<boolean> {
    const result = await this.reviewRepo.delete({ appointmentId });
    return (result.affected ?? 0) > 0;
  }

  // ======================================================================
  // MAPPATURA
  // ======================================================================

  private async toEvents(
    rows: RawAppointmentRow[],
    tolerance: number,
  ): Promise<NoShowEvent[]> {
    if (rows.length === 0) return [];

    const appointmentIds = rows.map((r) => r.apt.id);
    const patientIds = Array.from(
      new Set(
        rows.map((r) => r.apt.patientId).filter((id): id is string => !!id),
      ),
    );

    const [names, reviews, serviceNames] = await Promise.all([
      this.loadPatientNames(patientIds),
      this.loadReviews(appointmentIds),
      this.loadServiceNames(appointmentIds),
    ]);

    return rows.map(({ apt, ...extra }) => ({
      appointmentId: apt.id,
      patientId: apt.patientId,
      patientName:
        (apt.patientId ? names.get(apt.patientId) : undefined) ??
        apt.clientName ??
        'Sconosciuto',
      eventType: NoShowService.deriveType(
        apt.bookingStatus,
        apt.wasNoShowReverted,
        apt.lateMinutes ?? null,
        tolerance,
      ),
      bookingStatus: apt.bookingStatus,
      appointmentDate: NoShowService.isoDateOf(apt.appointmentDate) ?? '',
      startTime: apt.startTime,
      endTime: apt.endTime,
      appointmentType: apt.appointmentType,
      gymRoomName: extra.gymRoomName,
      siteId: apt.siteId,
      siteName: extra.siteName,
      operatorId: apt.operatorId,
      operatorName: extra.operatorName,
      operatorMacroCategory: extra.operatorMacroCategory as any,
      isSubstitution: apt.isSubstitution ?? false,
      originalOperatorName: extra.originalOperatorName,
      cancelledAt: apt.cancelledAt,
      cancellationHoursNotice:
        apt.cancellationHoursNotice != null
          ? Number(apt.cancellationHoursNotice)
          : undefined,
      cancellationReason: apt.cancellationReason,
      arrivedAt: apt.arrivedAt,
      lateMinutes: apt.lateMinutes,
      arrivalSource: apt.arrivalSource,
      wasNoShowReverted: apt.wasNoShowReverted ?? false,
      serviceNames: serviceNames.get(apt.id) ?? [],
      review: reviews.get(apt.id),
    }));
  }

  /** Display name dalla cache locale (niente PII: solo il nome visualizzato). */
  private async loadPatientNames(
    patientIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (patientIds.length === 0) return map;
    const rows = await this.subjectIndexRepo.find({
      where: { subjectId: In(patientIds) },
      select: ['subjectId', 'displayName'],
    });
    for (const r of rows) {
      if (r.displayName) map.set(r.subjectId, r.displayName);
    }
    return map;
  }

  private async loadReviews(
    appointmentIds: string[],
  ): Promise<Map<string, NoShowReview>> {
    const map = new Map<string, NoShowReview>();
    if (appointmentIds.length === 0) return map;
    const rows = await this.reviewRepo.find({
      where: { appointmentId: In(appointmentIds) },
    });
    for (const r of rows) map.set(r.appointmentId, r);
    return map;
  }

  private async loadServiceNames(
    appointmentIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (appointmentIds.length === 0) return map;

    const rows = await this.appointmentServiceRepo
      .createQueryBuilder('aps')
      .innerJoin('aps.service', 'svc')
      .select('aps.appointmentId', 'appointmentId')
      .addSelect('svc.name', 'serviceName')
      .where('aps.appointmentId IN (:...appointmentIds)', { appointmentIds })
      .orderBy('aps.orderPosition', 'ASC')
      .getRawMany<{ appointmentId: string; serviceName: string }>();

    for (const r of rows) {
      const list = map.get(r.appointmentId) ?? [];
      list.push(r.serviceName);
      map.set(r.appointmentId, list);
    }
    return map;
  }

  // ======================================================================
  // HELPER STATICI
  // ======================================================================

  /**
   * Traduce lo stato dell'appuntamento nella tipologia mostrata in pagina.
   * L'ordine conta: assenze e disdette vincono sul ritardo, perché un
   * appuntamento disdetto non è un ritardo anche se ha un `lateMinutes`
   * residuo da una correzione precedente.
   */
  private static deriveType(
    bookingStatus: BookingStatus,
    wasNoShowReverted: boolean | null,
    lateMinutes: number | null,
    tolerance: number,
  ): NoShowEventType {
    switch (bookingStatus) {
      case BookingStatus.NO_SHOW:
        return NoShowEventType.NO_SHOW;
      case BookingStatus.CANCELLED_LATE:
        return NoShowEventType.CANCELLED_LATE;
      case BookingStatus.CANCELLED_EARLY:
        return NoShowEventType.CANCELLED_EARLY;
      case BookingStatus.CANCELLED:
        return NoShowEventType.CANCELLED_UNKNOWN;
      default:
        if (wasNoShowReverted || (lateMinutes != null && lateMinutes >= tolerance)) {
          return NoShowEventType.LATE_ARRIVAL;
        }
        // Non dovrebbe capitare: la baseQuery non seleziona altri stati.
        return NoShowEventType.LATE_ARRIVAL;
    }
  }

  private static emptyCounts(): NoShowCounts {
    return {
      noShow: 0,
      cancelledLate: 0,
      cancelledEarly: 0,
      cancelledUnknown: 0,
      lateArrival: 0,
      unjustified: 0,
      total: 0,
    };
  }

  private static bump(
    counts: NoShowCounts,
    type: NoShowEventType,
    by = 1,
  ): void {
    switch (type) {
      case NoShowEventType.NO_SHOW:
        counts.noShow += by;
        break;
      case NoShowEventType.CANCELLED_LATE:
        counts.cancelledLate += by;
        break;
      case NoShowEventType.CANCELLED_EARLY:
        counts.cancelledEarly += by;
        break;
      case NoShowEventType.CANCELLED_UNKNOWN:
        counts.cancelledUnknown += by;
        break;
      case NoShowEventType.LATE_ARRIVAL:
        counts.lateArrival += by;
        break;
    }
    if (UNJUSTIFIED_TYPES.has(type)) counts.unjustified += by;
    counts.total += by;
  }

  private static countEvents(events: NoShowEvent[]): NoShowCounts {
    const counts = NoShowService.emptyCounts();
    for (const e of events) NoShowService.bump(counts, e.eventType);
    return counts;
  }

  private static addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private static isoDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Le colonne `date` arrivano da TypeORM come stringa o Date a seconda del
   * driver: normalizza a YYYY-MM-DD (GraphQLISODateTime rifiuterebbe la
   * stringa nuda, vedi utils/date-string.util.ts).
   */
  private static isoDateOf(value: string | Date | null | undefined): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return NoShowService.isoDate(value);
    return String(value).split('T')[0];
  }
}
