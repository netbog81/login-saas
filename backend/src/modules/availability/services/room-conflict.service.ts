import { Injectable, BadRequestException } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';
import { Room } from '../entities/room.entity';
import { Chair } from '../entities/chair.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { PatternGroup } from '../entities/pattern-group.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';
import { getPatternDay } from '../utils/pattern-day.util';
import { toDateString } from '../utils/date-string.util';
import {
  DayBand,
  applyDayExceptions,
  classifyDayExceptions,
} from '../utils/day-exception-semantics.util';

/** Fascia occupata in uno studio in un giorno specifico. */
interface OccupancyInterval {
  start: number; // minuti da mezzanotte
  end: number;
  roomId: string;
  chairId: string | null;
}

/** Candidato alla validazione: assegnazione nuova o modificata, non ancora salvata. */
export interface RoomAssignmentCandidate {
  operatorId: string;
  patternStartDate: Date;
  validFrom: Date;
  validUntil: Date | null;
  roomId?: string | null;
  chairId?: string | null;
  patternGroup: PatternGroup; // con patterns caricati
  roomOverrides: {
    dayInPattern: number;
    startTime?: string | null;
    endTime?: string | null;
    roomId: string;
    chairId?: string | null;
  }[];
}

export interface RoomConflictResult {
  blocking: string[];
  warnings: string[];
}

const DAY_NAMES = [
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato',
  'domenica',
];

/** Orizzonte massimo di espansione per il confronto giorno-per-giorno. */
const MAX_HORIZON_DAYS = 366;
const MAX_MESSAGES = 10;

/**
 * Conflitti di occupazione studi/poltrone tra assegnazioni template.
 *
 * Regole (decise con il cliente):
 *  - stessa poltrona in ore sovrapposte → SEMPRE bloccante;
 *  - stesso studio in ore sovrapposte → bloccante solo se gli occupanti
 *    concorrenti superano la capacità dello studio (poltrone attive, o il
 *    campo capacity se lo studio non ha poltrone configurate);
 *  - condivisione entro la capacità → warning informativo.
 */
@Injectable()
export class RoomConflictService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get roomRepo() { return this.dataSource.getRepository(Room); }

  private get chairRepo() { return this.dataSource.getRepository(Chair); }

  private get assignmentRepo() { return this.dataSource.getRepository(TemplateAssignment); }

  // ==================== VALIDAZIONE COERENZA ====================

  /**
   * Verifica che studi e poltrone del candidato esistano, siano attivi e che
   * ogni poltrona appartenga allo studio indicato. Lancia BadRequestException.
   */
  async validateRoomChairCoherence(candidate: RoomAssignmentCandidate): Promise<void> {
    const pairs: { roomId?: string | null; chairId?: string | null; label: string }[] = [
      { roomId: candidate.roomId, chairId: candidate.chairId, label: 'assegnazione' },
      ...candidate.roomOverrides.map((o, i) => ({
        roomId: o.roomId,
        chairId: o.chairId,
        label: `override ${i + 1} (${DAY_NAMES[o.dayInPattern % 7] ?? 'giorno ' + o.dayInPattern})`,
      })),
    ];

    for (const pair of pairs) {
      if (pair.chairId && !pair.roomId) {
        throw new BadRequestException(
          `Nella ${pair.label} è indicata una poltrona senza lo studio.`,
        );
      }
      if (pair.roomId) {
        const room = await this.roomRepo.findOne({ where: { id: pair.roomId } });
        if (!room) {
          throw new BadRequestException(`Studio non trovato (${pair.label}).`);
        }
        if (!room.isActive) {
          throw new BadRequestException(
            `Lo studio "${room.name}" è disattivato e non può essere usato (${pair.label}).`,
          );
        }
      }
      if (pair.chairId) {
        const chair = await this.chairRepo.findOne({ where: { id: pair.chairId } });
        if (!chair) {
          throw new BadRequestException(`Poltrona non trovata (${pair.label}).`);
        }
        if (chair.roomId !== pair.roomId) {
          throw new BadRequestException(
            `La poltrona "${chair.name}" non appartiene allo studio indicato (${pair.label}).`,
          );
        }
        if (!chair.isActive) {
          throw new BadRequestException(
            `La poltrona "${chair.name}" è disattivata e non può essere usata (${pair.label}).`,
          );
        }
      }
    }

    for (const o of candidate.roomOverrides) {
      const hasStart = !!o.startTime;
      const hasEnd = !!o.endTime;
      if (hasStart !== hasEnd) {
        throw new BadRequestException(
          'Gli override con fascia oraria devono avere sia ora di inizio che di fine.',
        );
      }
      if (hasStart && hasEnd && this.toMinutes(o.endTime!) <= this.toMinutes(o.startTime!)) {
        throw new BadRequestException(
          "Negli override l'ora di fine deve essere successiva a quella di inizio.",
        );
      }
    }
  }

  // ==================== VALIDAZIONE CONFLITTI ====================

  /**
   * Pre-check per la UI a partire dall'input GraphQL dell'assegnazione:
   * carica il pattern group e restituisce blocking/warnings senza lanciare
   * (gli errori di coerenza confluiscono in blocking).
   */
  async checkForInput(
    input: {
      operatorId: string;
      patternGroupId: string;
      patternStartDate: string;
      validFrom: string;
      validUntil?: string | null;
      roomId?: string | null;
      chairId?: string | null;
      overrides?: {
        dayInPattern: number;
        startTime?: string | null;
        endTime?: string | null;
        roomId: string;
        chairId?: string | null;
      }[] | null;
    },
    excludeAssignmentId?: string,
  ): Promise<RoomConflictResult> {
    const patternGroup = await this.dataSource
      .getRepository(PatternGroup)
      .findOne({ where: { id: input.patternGroupId }, relations: ['patterns'] });
    if (!patternGroup) {
      return { blocking: ['Template non trovato.'], warnings: [] };
    }

    const candidate: RoomAssignmentCandidate = {
      operatorId: input.operatorId,
      patternStartDate: new Date(input.patternStartDate),
      validFrom: new Date(input.validFrom),
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      roomId: input.roomId ?? null,
      chairId: input.chairId ?? null,
      patternGroup,
      roomOverrides: (input.overrides ?? []).map((o) => ({
        dayInPattern: o.dayInPattern,
        startTime: o.startTime ?? null,
        endTime: o.endTime ?? null,
        roomId: o.roomId,
        chairId: o.chairId ?? null,
      })),
    };

    try {
      await this.validateRoomChairCoherence(candidate);
    } catch (e: any) {
      return { blocking: [e?.message ?? 'Configurazione studi/poltrone non valida.'], warnings: [] };
    }
    return this.validateAssignment(candidate, excludeAssignmentId);
  }

  async validateAssignment(
    candidate: RoomAssignmentCandidate,
    excludeAssignmentId?: string,
  ): Promise<RoomConflictResult> {
    const usesRooms = !!candidate.roomId || candidate.roomOverrides.length > 0;
    if (!usesRooms) return { blocking: [], warnings: [] };

    // Capacità e nomi di studi/poltrone
    const rooms = await this.roomRepo.find({ relations: ['chairs'] });
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const chairNameById = new Map<string, string>();
    rooms.forEach((r) => (r.chairs || []).forEach((c) => chairNameById.set(c.id, c.name)));

    const capacityOf = (roomId: string): number => {
      const room = roomById.get(roomId);
      if (!room) return 1;
      const activeChairs = (room.chairs || []).filter((c) => c.isActive).length;
      return activeChairs > 0 ? activeChairs : room.capacity || 1;
    };
    const roomName = (roomId: string) => roomById.get(roomId)?.name ?? 'studio';

    // Altre assegnazioni potenzialmente in conflitto (altri operatori, con
    // studi, validità sovrapposta). Quelle dello stesso operatore sono già
    // escluse dalla regola di non-sovrapposizione delle validità.
    const fromStr = toDateString(candidate.validFrom);
    const untilStr = candidate.validUntil ? toDateString(candidate.validUntil) : null;

    const qb = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patternGroup', 'pg')
      .leftJoinAndSelect('pg.patterns', 'p')
      .leftJoinAndSelect('a.roomOverrides', 'ov')
      .leftJoinAndSelect('a.operator', 'op')
      .where('a.isCurrent = true')
      .andWhere('a.operatorId != :operatorId', { operatorId: candidate.operatorId })
      .andWhere('(a.validUntil IS NULL OR CAST(a.validUntil AS date) >= :fromStr)', { fromStr })
      .andWhere('(a."roomId" IS NOT NULL OR ov.id IS NOT NULL)');
    if (untilStr) {
      qb.andWhere('CAST(a.validFrom AS date) <= :untilStr', { untilStr });
    }
    if (excludeAssignmentId) {
      qb.andWhere('a.id != :excludeAssignmentId', { excludeAssignmentId });
    }
    const others = await qb.getMany();
    if (others.length === 0) return { blocking: [], warnings: [] };

    // Espansione giorno-per-giorno sull'orizzonte del candidato
    let horizonDays = MAX_HORIZON_DAYS;
    if (untilStr) {
      const diff =
        Math.floor(
          (new Date(untilStr).getTime() - new Date(fromStr).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1;
      horizonDays = Math.min(Math.max(diff, 1), MAX_HORIZON_DAYS);
    }

    const blocking = new Map<string, string>();
    const warnings = new Map<string, string>();

    const cursor = new Date(fromStr);
    for (let i = 0; i < horizonDays; i++) {
      const dateStr = toDateString(cursor);
      const weekday = DAY_NAMES[cursor.getDay() === 0 ? 6 : cursor.getDay() - 1];

      const mine = this.computeDayIntervals(candidate, cursor);
      if (mine.length > 0) {
        const active = others.filter(
          (o) =>
            dateStr >= toDateString(o.validFrom) &&
            (!o.validUntil || dateStr <= toDateString(o.validUntil)),
        );

        if (active.length > 0) {
          const theirs = active.flatMap((o) =>
            this.computeDayIntervals(this.toCandidate(o), cursor).map((iv) => ({
              ...iv,
              operatorName: o.operator
                ? `${o.operator.name} ${o.operator.surname ?? ''}`.trim()
                : 'altro operatore',
            })),
          );

          this.collectConflicts(
            mine,
            theirs,
            { weekday, dateStr, capacityOf, roomName, chairNameById },
            blocking,
            warnings,
          );
        }
      }

      cursor.setDate(cursor.getDate() + 1);
      if (blocking.size >= MAX_MESSAGES && warnings.size >= MAX_MESSAGES) break;
    }

    return {
      blocking: Array.from(blocking.values()).slice(0, MAX_MESSAGES),
      warnings: Array.from(warnings.values()).slice(0, MAX_MESSAGES),
    };
  }

  private collectConflicts(
    mine: OccupancyInterval[],
    theirs: (OccupancyInterval & { operatorName: string })[],
    ctx: {
      weekday: string;
      dateStr: string;
      capacityOf: (roomId: string) => number;
      roomName: (roomId: string) => string;
      chairNameById: Map<string, string>;
    },
    blocking: Map<string, string>,
    warnings: Map<string, string>,
  ): void {
    const fmtDate = (d: string) => {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    };
    const fmtTime = (min: number) =>
      `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

    const myRooms = new Set(mine.map((m) => m.roomId));
    for (const roomId of myRooms) {
      const myIv = mine.filter((m) => m.roomId === roomId);
      const theirIv = theirs.filter((t) => t.roomId === roomId);
      if (theirIv.length === 0) continue;

      // 1. Stessa poltrona in ore sovrapposte → sempre bloccante
      for (const m of myIv) {
        if (!m.chairId) continue;
        for (const t of theirIv) {
          if (t.chairId === m.chairId && m.start < t.end && t.start < m.end) {
            const key = `chair|${m.chairId}|${ctx.weekday}|${t.operatorName}`;
            if (!blocking.has(key)) {
              blocking.set(
                key,
                `Poltrona "${ctx.chairNameById.get(m.chairId) ?? 'poltrona'}" dello studio ` +
                  `"${ctx.roomName(roomId)}" già occupata da ${t.operatorName} il ${ctx.weekday} ` +
                  `${fmtTime(Math.max(m.start, t.start))}-${fmtTime(Math.min(m.end, t.end))} ` +
                  `(a partire dal ${fmtDate(ctx.dateStr)})`,
              );
            }
          }
        }
      }

      // 2. Capacità dello studio: sweep sugli estremi degli intervalli
      const capacity = ctx.capacityOf(roomId);
      const all = [
        ...myIv.map((iv) => ({ ...iv, mine: true, operatorName: '' })),
        ...theirIv.map((iv) => ({ ...iv, mine: false })),
      ];
      const points = Array.from(new Set(all.flatMap((iv) => [iv.start, iv.end]))).sort(
        (a, b) => a - b,
      );

      for (let i = 0; i < points.length - 1; i++) {
        const s = points[i];
        const e = points[i + 1];
        const activeIv = all.filter((iv) => iv.start <= s && iv.end >= e);
        const myActive = activeIv.some((iv) => iv.mine);
        if (!myActive) continue;
        const occupantNames = activeIv
          .filter((iv) => !iv.mine)
          .map((iv) => (iv as any).operatorName as string);
        if (occupantNames.length === 0) continue;

        const names = Array.from(new Set(occupantNames)).join(', ');
        if (activeIv.length > capacity) {
          const key = `cap|${roomId}|${ctx.weekday}|${names}`;
          if (!blocking.has(key)) {
            blocking.set(
              key,
              `Studio "${ctx.roomName(roomId)}" pieno (${capacity} post${capacity === 1 ? 'o' : 'i'}) ` +
                `il ${ctx.weekday} ${fmtTime(s)}-${fmtTime(e)}: già occupato da ${names} ` +
                `(a partire dal ${fmtDate(ctx.dateStr)})`,
            );
          }
        } else {
          const key = `share|${roomId}|${ctx.weekday}|${names}`;
          if (!warnings.has(key)) {
            warnings.set(
              key,
              `Studio "${ctx.roomName(roomId)}" condiviso con ${names} il ${ctx.weekday} ` +
                `${fmtTime(s)}-${fmtTime(e)} (posti sufficienti: ${capacity})`,
            );
          }
        }
      }
    }
  }

  // ==================== OCCUPAZIONE GIORNALIERA ====================

  private toCandidate(a: TemplateAssignment): RoomAssignmentCandidate {
    return {
      operatorId: a.operatorId,
      patternStartDate: new Date(a.patternStartDate),
      validFrom: new Date(a.validFrom),
      validUntil: a.validUntil ? new Date(a.validUntil) : null,
      roomId: a.roomId ?? null,
      chairId: a.chairId ?? null,
      patternGroup: a.patternGroup,
      roomOverrides: (a.roomOverrides ?? []).map((o) => ({
        dayInPattern: o.dayInPattern,
        startTime: o.startTime ?? null,
        endTime: o.endTime ?? null,
        roomId: o.roomId,
        chairId: o.chairId ?? null,
      })),
    };
  }

  /**
   * Fasce di occupazione studi del candidato in una data: bande del template
   * per il giorno del pattern, con override per giorno/fascia applicati
   * (il più specifico vince, poi l'override giornaliero, poi il default).
   * Le fasce senza studio (nessun default né override) non occupano nulla.
   */
  computeDayIntervals(candidate: RoomAssignmentCandidate, date: Date): OccupancyInterval[] {
    const pg = candidate.patternGroup;
    if (!pg?.patterns?.length) return [];

    const patternDay = getPatternDay(
      date,
      new Date(candidate.patternStartDate),
      pg.patternDuration,
    );
    const bands = pg.patterns
      .filter((p) => p.dayInPattern === patternDay)
      .map((p) => ({ start: this.toMinutes(p.startTime), end: this.toMinutes(p.endTime) }))
      .filter((b) => b.end > b.start);
    if (bands.length === 0) return [];

    return this.mapBandsToRooms(candidate, patternDay, bands);
  }

  /**
   * Mappa fasce orarie (minuti) sugli studi effettivi del giorno di pattern:
   * override a fascia > override giornaliero > default dell'assegnazione.
   */
  private mapBandsToRooms(
    candidate: RoomAssignmentCandidate,
    patternDay: number,
    bands: { start: number; end: number }[],
  ): OccupancyInterval[] {
    const dayOverrides = candidate.roomOverrides.filter(
      (o) => o.dayInPattern === patternDay,
    );
    const dayLevel = dayOverrides.find((o) => !o.startTime || !o.endTime) ?? null;
    const timed = dayOverrides
      .filter((o) => o.startTime && o.endTime)
      .map((o) => ({
        start: this.toMinutes(o.startTime!),
        end: this.toMinutes(o.endTime!),
        roomId: o.roomId,
        chairId: o.chairId ?? null,
      }));

    const base = dayLevel
      ? { roomId: dayLevel.roomId as string | null, chairId: dayLevel.chairId ?? null }
      : { roomId: candidate.roomId ?? null, chairId: candidate.chairId ?? null };

    const result: OccupancyInterval[] = [];
    for (const band of bands) {
      const bandStart = band.start;
      const bandEnd = band.end;
      if (bandEnd <= bandStart) continue;

      const points = new Set<number>([bandStart, bandEnd]);
      for (const t of timed) {
        if (t.start < bandEnd && t.end > bandStart) {
          points.add(Math.max(bandStart, t.start));
          points.add(Math.min(bandEnd, t.end));
        }
      }
      const sorted = Array.from(points).sort((a, b) => a - b);
      for (let i = 0; i < sorted.length - 1; i++) {
        const s = sorted[i];
        const e = sorted[i + 1];
        const override = timed.find((t) => t.start <= s && t.end >= e);
        const target = override ?? base;
        if (target.roomId) {
          result.push({ start: s, end: e, roomId: target.roomId, chairId: target.chairId });
        }
      }
    }
    return result;
  }

  /** Sottrazione di intervalli [start,end) in minuti. */
  private subtractIntervals(
    minuend: { start: number; end: number }[],
    subtrahend: { start: number; end: number }[],
  ): { start: number; end: number }[] {
    let result = minuend.map((iv) => ({ start: iv.start, end: iv.end }));
    for (const sub of subtrahend) {
      const next: { start: number; end: number }[] = [];
      for (const iv of result) {
        if (sub.end <= iv.start || sub.start >= iv.end) {
          next.push(iv);
          continue;
        }
        if (sub.start > iv.start) next.push({ start: iv.start, end: Math.min(sub.start, iv.end) });
        if (sub.end < iv.end) next.push({ start: Math.max(sub.end, iv.start), end: iv.end });
      }
      result = next;
    }
    return result.filter((iv) => iv.end > iv.start);
  }

  private toMinutes(time: string): number {
    const [h, m] = String(time).split(':');
    return parseInt(h, 10) * 60 + parseInt(m || '0', 10);
  }

  // ==================== DISPONIBILITÀ STUDI PER ASSEGNAZIONE ====================

  /**
   * Wrapper dal GraphQL input: carica il pattern group e calcola la
   * disponibilità di ogni studio rispetto al template candidato.
   */
  async availabilityForInput(
    input: {
      operatorId: string;
      patternGroupId: string;
      patternStartDate: string;
      validFrom: string;
      validUntil?: string | null;
    },
    excludeAssignmentId?: string,
  ) {
    const patternGroup = await this.dataSource
      .getRepository(PatternGroup)
      .findOne({ where: { id: input.patternGroupId }, relations: ['patterns'] });
    if (!patternGroup) {
      return { rooms: [] };
    }

    const candidate: RoomAssignmentCandidate = {
      operatorId: input.operatorId,
      patternStartDate: new Date(input.patternStartDate),
      validFrom: new Date(input.validFrom),
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      roomId: null,
      chairId: null,
      patternGroup,
      roomOverrides: [],
    };
    return {
      rooms: await this.computeAssignmentRoomAvailability(candidate, excludeAssignmentId),
    };
  }

  /**
   * Per ogni studio attivo: dove e quanto è già occupato rispetto alle fasce
   * del template candidato, proiettato sul ciclo del candidato. Le eccezioni
   * operatore NON contano (decisione esplicita: le assegnazioni sono
   * strutturali, le eccezioni transitorie non liberano studi ai fini della
   * scelta in tendina).
   */
  async computeAssignmentRoomAvailability(
    candidate: RoomAssignmentCandidate,
    excludeAssignmentId?: string,
  ): Promise<
    {
      roomId: string;
      roomName: string;
      capacity: number;
      fullyFree: boolean;
      sharing: boolean;
      full: boolean;
      unavailableReason?: string;
      busy: {
        dayInPattern: number;
        startTime: string;
        endTime: string;
        freeSeats: number;
        occupantNames: string[];
        busyChairIds: string[];
      }[];
      chairs: {
        chairId: string;
        name: string;
        fullyFree: boolean;
        firstConflict?: string;
      }[];
    }[]
  > {
    const rooms = await this.roomRepo.find({
      where: { isActive: true },
      relations: ['chairs'],
    });
    if (rooms.length === 0) return [];

    const pg = candidate.patternGroup;
    const duration = pg?.patternDuration || 7;

    const fromStr = toDateString(candidate.validFrom);
    const untilStr = candidate.validUntil ? toDateString(candidate.validUntil) : null;

    const qb = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patternGroup', 'pg')
      .leftJoinAndSelect('pg.patterns', 'p')
      .leftJoinAndSelect('a.roomOverrides', 'ov')
      .leftJoinAndSelect('a.operator', 'op')
      .where('a.isCurrent = true')
      .andWhere('a.operatorId != :operatorId', { operatorId: candidate.operatorId })
      .andWhere('(a.validUntil IS NULL OR CAST(a.validUntil AS date) >= :fromStr)', { fromStr })
      .andWhere('(a."roomId" IS NOT NULL OR ov.id IS NOT NULL)');
    if (untilStr) {
      qb.andWhere('CAST(a.validFrom AS date) <= :untilStr', { untilStr });
    }
    if (excludeAssignmentId) {
      qb.andWhere('a.id != :excludeAssignmentId', { excludeAssignmentId });
    }
    const others = await qb.getMany();

    // Aggregazione per (studio, giorno del ciclo candidato, segmento orario):
    // conservativa sulle date reali (max occupanti, unione nomi/poltrone).
    interface BusyAgg {
      roomId: string;
      dayInPattern: number;
      start: number;
      end: number;
      maxConcurrent: number;
      occupantNames: Set<string>;
      busyChairIds: Set<string>;
    }
    const busyByKey = new Map<string, BusyAgg>();

    let horizonDays = MAX_HORIZON_DAYS;
    if (untilStr) {
      const diff =
        Math.floor(
          (new Date(untilStr).getTime() - new Date(fromStr).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1;
      horizonDays = Math.min(Math.max(diff, 1), MAX_HORIZON_DAYS);
    }

    const cursor = new Date(fromStr);
    for (let i = 0; i < horizonDays; i++) {
      const dateStr = toDateString(cursor);
      const candidateDay = getPatternDay(
        cursor,
        new Date(candidate.patternStartDate),
        duration,
      );
      const candBands = (pg?.patterns ?? []).filter(
        (p) => p.dayInPattern === candidateDay,
      );

      if (candBands.length > 0) {
        const active = others.filter(
          (o) =>
            dateStr >= toDateString(o.validFrom) &&
            (!o.validUntil || dateStr <= toDateString(o.validUntil)),
        );

        if (active.length > 0) {
          const occ = active.flatMap((o) =>
            this.computeDayIntervals(this.toCandidate(o), cursor).map((iv) => ({
              ...iv,
              operatorName: o.operator
                ? `${o.operator.name} ${o.operator.surname ?? ''}`.trim()
                : 'altro operatore',
            })),
          );

          for (const band of candBands) {
            const bandStart = this.toMinutes(band.startTime);
            const bandEnd = this.toMinutes(band.endTime);
            if (bandEnd <= bandStart) continue;

            for (const room of rooms) {
              const overl = occ.filter(
                (iv) =>
                  iv.roomId === room.id && iv.start < bandEnd && iv.end > bandStart,
              );
              if (overl.length === 0) continue;

              // Sweep sui punti di rottura dentro la fascia candidata
              const points = new Set<number>();
              for (const iv of overl) {
                points.add(Math.max(bandStart, iv.start));
                points.add(Math.min(bandEnd, iv.end));
              }
              const sorted = Array.from(points).sort((a, b) => a - b);
              for (let s = 0; s < sorted.length - 1; s++) {
                const segStart = sorted[s];
                const segEnd = sorted[s + 1];
                const activeIv = overl.filter(
                  (iv) => iv.start <= segStart && iv.end >= segEnd,
                );
                if (activeIv.length === 0) continue;

                const key = `${room.id}|${candidateDay}|${segStart}|${segEnd}`;
                let agg = busyByKey.get(key);
                if (!agg) {
                  agg = {
                    roomId: room.id,
                    dayInPattern: candidateDay,
                    start: segStart,
                    end: segEnd,
                    maxConcurrent: 0,
                    occupantNames: new Set(),
                    busyChairIds: new Set(),
                  };
                  busyByKey.set(key, agg);
                }
                agg.maxConcurrent = Math.max(agg.maxConcurrent, activeIv.length);
                activeIv.forEach((iv) => {
                  agg!.occupantNames.add(iv.operatorName);
                  if (iv.chairId) agg!.busyChairIds.add(iv.chairId);
                });
              }
            }
          }
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    // Costruzione risultato per studio
    const fmtTime = (min: number) =>
      `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    const dayLabel = (day: number) =>
      duration === 7
        ? DAY_NAMES[day % 7]
        : `${DAY_NAMES[day % 7]} (sett. ${Math.floor(day / 7) + 1})`;

    return rooms.map((room) => {
      const activeChairs = (room.chairs || []).filter((c) => c.isActive);
      const capacity = activeChairs.length > 0 ? activeChairs.length : room.capacity || 1;

      const busy = Array.from(busyByKey.values())
        .filter((b) => b.roomId === room.id)
        .sort((a, b) => a.dayInPattern - b.dayInPattern || a.start - b.start)
        .map((b) => ({
          dayInPattern: b.dayInPattern,
          startTime: fmtTime(b.start),
          endTime: fmtTime(b.end),
          freeSeats: Math.max(capacity - b.maxConcurrent, 0),
          occupantNames: Array.from(b.occupantNames),
          busyChairIds: Array.from(b.busyChairIds),
        }));

      const fullEntry = busy.find((b) => b.freeSeats <= 0);
      const full = !!fullEntry;
      const fullyFree = busy.length === 0;
      const sharing = !fullyFree && !full;

      let unavailableReason: string | undefined;
      if (fullEntry) {
        unavailableReason =
          `pieno il ${dayLabel(fullEntry.dayInPattern)} ` +
          `${fullEntry.startTime}-${fullEntry.endTime} — ${fullEntry.occupantNames.join(', ')}`;
      } else if (sharing) {
        const first = busy[0];
        unavailableReason =
          `condiviso il ${dayLabel(first.dayInPattern)} ` +
          `${first.startTime}-${first.endTime} con ${first.occupantNames.join(', ')}`;
      }

      const chairs = activeChairs.map((chair) => {
        const conflict = busy.find((b) => b.busyChairIds.includes(chair.id));
        return {
          chairId: chair.id,
          name: chair.name,
          fullyFree: !conflict,
          firstConflict: conflict
            ? `occupata il ${dayLabel(conflict.dayInPattern)} ${conflict.startTime}-${conflict.endTime}`
            : undefined,
        };
      });

      return {
        roomId: room.id,
        roomName: room.name,
        capacity,
        fullyFree,
        sharing,
        full,
        unavailableReason,
        busy,
        chairs,
      };
    });
  }

  // ==================== OCCUPAZIONE PER LA VISTA STUDI ====================

  /**
   * Occupazione degli studi in un intervallo di date, calcolata dalle
   * assegnazioni template (default + override) CON le eccezioni operatore
   * applicate (decisione con il cliente): ferie/malattie/permessi liberano lo
   * studio nel giorno/fascia dell'eccezione, MODIFIED segue l'orario
   * modificato, EXTRA occupa anche la fascia straordinaria. Le fasce liberate
   * vengono restituite come `absences` per il tooltip "libero: X in ferie".
   * Le eccezioni NON entrano invece nei filtri di assegnazione.
   */
  async computeOccupancy(
    startDate: string,
    endDate: string,
  ): Promise<
    {
      roomId: string;
      date: string;
      bands: {
        startTime: string;
        endTime: string;
        operatorId: string;
        operatorName: string;
        operatorColor?: string;
        chairId?: string;
        chairName?: string;
      }[];
      absences: {
        startTime: string;
        endTime: string;
        operatorId: string;
        operatorName: string;
        reason: string;
      }[];
    }[]
  > {
    const MAX_RANGE_DAYS = 62;

    const assignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patternGroup', 'pg')
      .leftJoinAndSelect('pg.patterns', 'p')
      .leftJoinAndSelect('a.roomOverrides', 'ov')
      .leftJoinAndSelect('a.operator', 'op')
      .where('a.isCurrent = true')
      .andWhere('(a.validUntil IS NULL OR CAST(a.validUntil AS date) >= :startDate)', { startDate })
      .andWhere('CAST(a.validFrom AS date) <= :endDate', { endDate })
      .andWhere('(a."roomId" IS NOT NULL OR ov.id IS NOT NULL)')
      .getMany();

    if (assignments.length === 0) return [];

    const rooms = await this.roomRepo.find({ relations: ['chairs'] });
    const chairNameById = new Map<string, string>();
    rooms.forEach((r) => (r.chairs || []).forEach((c) => chairNameById.set(c.id, c.name)));

    // Eccezioni degli operatori coinvolti (quelle di gruppo vengono già
    // propagate come eccezioni individuali alla creazione).
    const operatorIds = Array.from(new Set(assignments.map((a) => a.operatorId)));
    const exceptions = await this.dataSource
      .getRepository(AvailabilityException)
      .createQueryBuilder('ex')
      .where('ex.operatorId IN (:...operatorIds)', { operatorIds })
      .andWhere('ex.exceptionDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();
    const exceptionsByOpDate = new Map<string, AvailabilityException[]>();
    for (const ex of exceptions) {
      const key = `${ex.operatorId}|${toDateString(ex.exceptionDate)}`;
      if (!exceptionsByOpDate.has(key)) exceptionsByOpDate.set(key, []);
      exceptionsByOpDate.get(key)!.push(ex);
    }

    const EXCEPTION_LABELS: Record<string, string> = {
      SICK: 'malattia',
      VACATION: 'ferie',
      PERSONAL_LEAVE: 'permesso',
      HOLIDAY: 'festività',
      UNAVAILABLE: 'assenza',
      MODIFIED: 'orario modificato',
    };
    const reasonLabel = (dayExs: AvailabilityException[]): string => {
      const labels = Array.from(
        new Set(
          dayExs
            .map((ex) => EXCEPTION_LABELS[String(ex.exceptionType).toUpperCase()])
            .filter(Boolean),
        ),
      );
      return labels.length > 0 ? labels.join(', ') : 'assenza';
    };

    const fmtTime = (min: number) =>
      `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

    const byRoomDate = new Map<
      string,
      { roomId: string; date: string; bands: any[]; absences: any[] }
    >();
    const entryFor = (roomId: string, dateStr: string) => {
      const key = `${roomId}|${dateStr}`;
      if (!byRoomDate.has(key)) {
        byRoomDate.set(key, { roomId, date: dateStr, bands: [], absences: [] });
      }
      return byRoomDate.get(key)!;
    };

    const cursor = new Date(startDate);
    const end = new Date(endDate);
    let guard = 0;
    while (cursor <= end && guard < MAX_RANGE_DAYS) {
      const dateStr = toDateString(cursor);

      for (const a of assignments) {
        if (dateStr < toDateString(a.validFrom)) continue;
        if (a.validUntil && dateStr > toDateString(a.validUntil)) continue;

        const candidate = this.toCandidate(a);
        const pg = candidate.patternGroup;
        if (!pg?.patterns?.length) continue;

        const patternDay = getPatternDay(
          cursor,
          new Date(candidate.patternStartDate),
          pg.patternDuration,
        );
        const templateBands = pg.patterns
          .filter((p) => p.dayInPattern === patternDay)
          .map((p) => ({
            start: this.toMinutes(p.startTime),
            end: this.toMinutes(p.endTime),
            source: 'pattern' as const,
          }))
          .filter((b) => b.end > b.start);

        const dayExs = exceptionsByOpDate.get(`${a.operatorId}|${dateStr}`) ?? [];

        const operatorName = a.operator
          ? `${a.operator.name} ${a.operator.surname ?? ''}`.trim()
          : 'Operatore';

        // Fasce effettive dopo le eccezioni (assenze sottraggono, MODIFIED
        // sostituisce, EXTRA aggiunge). Senza eccezioni = fasce del template.
        const effectiveBands =
          dayExs.length > 0
            ? applyDayExceptions(
                templateBands as DayBand[],
                classifyDayExceptions(dayExs),
              )
            : templateBands;

        if (templateBands.length === 0 && effectiveBands.length === 0) continue;

        const effective = this.mapBandsToRooms(candidate, patternDay, effectiveBands);
        for (const iv of effective) {
          entryFor(iv.roomId, dateStr).bands.push({
            startTime: fmtTime(iv.start),
            endTime: fmtTime(iv.end),
            operatorId: a.operatorId,
            operatorName,
            operatorColor: a.operator?.color ?? undefined,
            chairId: iv.chairId ?? undefined,
            chairName: iv.chairId ? chairNameById.get(iv.chairId) : undefined,
          });
        }

        // Fasce liberate dall'eccezione = occupazione strutturale meno
        // effettiva, per studio (tooltip "libero: X in ferie").
        if (dayExs.length > 0) {
          const structural = this.mapBandsToRooms(candidate, patternDay, templateBands);
          const roomIds = new Set(structural.map((iv) => iv.roomId));
          const reason = reasonLabel(dayExs);

          for (const roomId of roomIds) {
            const structIv = structural.filter((iv) => iv.roomId === roomId);
            const effIv = effective.filter((iv) => iv.roomId === roomId);
            const freed = this.subtractIntervals(structIv, effIv);
            for (const iv of freed) {
              entryFor(roomId, dateStr).absences.push({
                startTime: fmtTime(iv.start),
                endTime: fmtTime(iv.end),
                operatorId: a.operatorId,
                operatorName,
                reason,
              });
            }
          }
        }
      }

      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }

    const result = Array.from(byRoomDate.values());
    result.forEach((r) => {
      r.bands.sort((a, b) => a.startTime.localeCompare(b.startTime));
      r.absences.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return result;
  }

  // ==================== RISOLUZIONE PER APPUNTAMENTI ====================

  /**
   * Studio/poltrona effettivi di un operatore per (data, ora di inizio),
   * risolti dall'assegnazione template valida in quella data con gli override
   * applicati. Usato per lo snapshot roomId/chairId sugli appuntamenti.
   */
  async resolveRoomForSlot(
    operatorId: string,
    dateStr: string,
    startTime: string,
  ): Promise<{ roomId: string | null; chairId: string | null }> {
    const empty = { roomId: null, chairId: null };
    if (!operatorId || !dateStr || !startTime) return empty;

    const assignment = await this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patternGroup', 'pg')
      .leftJoinAndSelect('a.roomOverrides', 'ov')
      .where('a.operatorId = :operatorId', { operatorId })
      .andWhere('a.isCurrent = true')
      .andWhere('CAST(a.validFrom AS date) <= :dateStr', { dateStr })
      .andWhere('(a.validUntil IS NULL OR CAST(a.validUntil AS date) >= :dateStr)', { dateStr })
      .orderBy('a.validFrom', 'DESC')
      .getOne();

    if (!assignment) return empty;
    if (!assignment.roomId && (assignment.roomOverrides ?? []).length === 0) return empty;

    const patternDay = getPatternDay(
      new Date(dateStr),
      new Date(assignment.patternStartDate),
      assignment.patternGroup?.patternDuration ?? 7,
    );
    const startMin = this.toMinutes(startTime);
    const dayOverrides = (assignment.roomOverrides ?? []).filter(
      (o) => o.dayInPattern === patternDay,
    );
    const timed = dayOverrides
      .filter((o) => o.startTime && o.endTime)
      .find(
        (o) =>
          this.toMinutes(o.startTime!) <= startMin &&
          this.toMinutes(o.endTime!) > startMin,
      );
    const dayLevel = dayOverrides.find((o) => !o.startTime || !o.endTime);

    const pick = timed ?? dayLevel ?? { roomId: assignment.roomId, chairId: assignment.chairId };
    return { roomId: pick.roomId ?? null, chairId: pick.chairId ?? null };
  }
}
