import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Treatment } from '../../availability/entities/treatment.entity';
import { TherapeuticPath } from '../../availability/entities/therapeutic-path.entity';
import { PatientEvaluation } from '../../availability/entities/patient-evaluation.entity';
import { TreatmentService } from '../../availability/services/treatment.service';
import { TherapeuticPathService } from '../../availability/services/therapeutic-path.service';
import {
  RecycleBinEntityType,
  RecycleBinItem,
} from '../dto/recycle-bin-item.type';
import { RecycleBinFilterInput } from '../dto/recycle-bin-filter.input';
import { RecycleBinSettings } from '../../availability/entities/recycle-bin-settings.entity';

import { TenantContextService } from '@curandis/tenant-datasource';
interface RawDeletedRow {
  id: string;
  entityType: RecycleBinEntityType;
  title: string;
  subtitle: string | null;
  deletedAt: Date;
  deletedByUserId: string | null;
  deletedByName: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  childrenCount: number | null;
}

/**
 * Service del cestino: lista, ripristino, eliminazione definitiva e
 * applicazione retention.
 *
 * Le operazioni di restore/purge sono delegate ai service di dominio
 * (TreatmentService, TherapeuticPathService) che conoscono il cascade
 * corretto. Questo service unifica la lista trasversale e il cron.
 */
@Injectable()
export class RecycleBinService {
  private readonly logger = new Logger(RecycleBinService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly treatmentService: TreatmentService,
    private readonly pathService: TherapeuticPathService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get treatmentRepo() { return this.dataSource.getRepository(Treatment); }

  private get pathRepo() { return this.dataSource.getRepository(TherapeuticPath); }

  private get evaluationRepo() { return this.dataSource.getRepository(PatientEvaluation); }

  private get settingsRepo() { return this.dataSource.getRepository(RecycleBinSettings); }

  // ==================== SETTINGS ====================

  async getSettings(): Promise<RecycleBinSettings> {
    const existing = await this.settingsRepo.find({ take: 1 });
    if (existing.length > 0) return existing[0];
    // Auto-seed di sicurezza nel caso il record sia stato cancellato manualmente.
    return this.settingsRepo.save(this.settingsRepo.create({ retentionDays: 30 }));
  }

  async updateSettings(
    retentionDays: number | null,
    updatedByUserId?: string,
  ): Promise<RecycleBinSettings> {
    if (retentionDays !== null && retentionDays < 30) {
      throw new ForbiddenException(
        'La retention minima è 30 giorni. Per retention indefinita usa null.',
      );
    }
    const settings = await this.getSettings();
    settings.retentionDays = retentionDays ?? undefined;
    settings.updatedByUserId = updatedByUserId;
    return this.settingsRepo.save(settings);
  }

  // ==================== LIST ====================

  /**
   * Lista unificata degli elementi nel cestino.
   *
   * Il filtro per `ownerUserId` è applicato server-side: il resolver
   * forza il filtro al proprio appUser per gli utenti non-admin.
   */
  async list(filter: RecycleBinFilterInput): Promise<RecycleBinItem[]> {
    const types =
      filter.entityTypes && filter.entityTypes.length > 0
        ? filter.entityTypes
        : [
            RecycleBinEntityType.THERAPEUTIC_PATH,
            RecycleBinEntityType.TREATMENT,
            RecycleBinEntityType.PATIENT_EVALUATION,
          ];

    const settings = await this.getSettings();
    const retentionDays = settings.retentionDays ?? null;

    const rows: RawDeletedRow[] = [];

    if (types.includes(RecycleBinEntityType.THERAPEUTIC_PATH)) {
      rows.push(...(await this.queryDeletedPaths(filter)));
    }
    if (types.includes(RecycleBinEntityType.TREATMENT)) {
      rows.push(...(await this.queryDeletedTreatments(filter)));
    }
    if (types.includes(RecycleBinEntityType.PATIENT_EVALUATION)) {
      rows.push(...(await this.queryDeletedEvaluations(filter)));
    }

    return rows
      .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
      .map(r => this.toItem(r, retentionDays));
  }

  private toItem(row: RawDeletedRow, retentionDays: number | null): RecycleBinItem {
    const item: RecycleBinItem = {
      id: row.id,
      entityType: row.entityType,
      title: row.title,
      subtitle: row.subtitle ?? undefined,
      deletedAt: row.deletedAt,
      deletedByUserId: row.deletedByUserId ?? undefined,
      deletedByName: row.deletedByName ?? undefined,
      ownerUserId: row.ownerUserId ?? undefined,
      ownerName: row.ownerName ?? undefined,
      childrenCount: row.childrenCount ?? undefined,
    };
    if (retentionDays !== null) {
      const purge = new Date(row.deletedAt.getTime());
      purge.setDate(purge.getDate() + retentionDays);
      item.scheduledPurgeAt = purge;
    }
    return item;
  }

  private buildOwnerSearchClauses(
    filter: RecycleBinFilterInput,
    ownerUserCol: string,
    titleCols: string[],
  ): { sql: string; params: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];
    if (filter.ownerUserId) {
      params.push(filter.ownerUserId);
      clauses.push(`${ownerUserCol} = $${params.length}`);
    }
    if (filter.search && filter.search.trim().length > 0) {
      params.push(`%${filter.search.trim().toLowerCase()}%`);
      const search = `(${titleCols
        .map(c => `LOWER(COALESCE(${c}, '')) LIKE $${params.length}`)
        .join(' OR ')})`;
      clauses.push(search);
    }
    return {
      sql: clauses.length > 0 ? ' AND ' + clauses.join(' AND ') : '',
      params,
    };
  }

  private async queryDeletedPaths(
    filter: RecycleBinFilterInput,
  ): Promise<RawDeletedRow[]> {
    const extra = this.buildOwnerSearchClauses(
      filter,
      'op."app_user_id"',
      ['p."name"', 'pat."nome"', 'pat."cognome"'],
    );

    const sql = `
      SELECT
        p.id                             AS "id",
        'therapeutic_path'::text         AS "entityType",
        p."name"                         AS "title",
        TRIM(CONCAT_WS(' ', pat."nome", pat."cognome")) AS "subtitle",
        p."deletedAt"                    AS "deletedAt",
        p."deletedByUserId"              AS "deletedByUserId",
        TRIM(CONCAT_WS(' ', dau."name", dau."surname")) AS "deletedByName",
        op."app_user_id"                 AS "ownerUserId",
        TRIM(CONCAT_WS(' ', op."name", op."surname"))   AS "ownerName",
        (SELECT COUNT(1) FROM "treatments" t
         WHERE t."therapeuticPathId" = p.id AND t."deletedAt" IS NOT NULL) AS "childrenCount"
      FROM "therapeutic_paths" p
      LEFT JOIN "operators" op ON op.id = p."primaryOperatorId"
      LEFT JOIN "patients" pat ON pat.id = p."patientId"
      LEFT JOIN "app_users" dau ON dau.id = p."deletedByUserId"
      WHERE p."deletedAt" IS NOT NULL${extra.sql}
    `;
    return this.dataSource.query(sql, extra.params);
  }

  private async queryDeletedTreatments(
    filter: RecycleBinFilterInput,
  ): Promise<RawDeletedRow[]> {
    const extra = this.buildOwnerSearchClauses(
      filter,
      'op."app_user_id"',
      ['p."name"', 'pat."nome"', 'pat."cognome"'],
    );

    const sql = `
      SELECT
        t.id                             AS "id",
        'treatment'::text                AS "entityType",
        COALESCE(p."name", 'Trattamento') AS "title",
        TRIM(CONCAT_WS(' • ',
          TRIM(CONCAT_WS(' ', pat."nome", pat."cognome")),
          TO_CHAR(t."startedAt", 'DD/MM/YYYY HH24:MI')
        ))                                AS "subtitle",
        t."deletedAt"                    AS "deletedAt",
        t."deletedByUserId"              AS "deletedByUserId",
        TRIM(CONCAT_WS(' ', dau."name", dau."surname")) AS "deletedByName",
        op."app_user_id"                 AS "ownerUserId",
        TRIM(CONCAT_WS(' ', op."name", op."surname"))   AS "ownerName",
        NULL::int                        AS "childrenCount"
      FROM "treatments" t
      LEFT JOIN "operators" op ON op.id = t."operatorId"
      LEFT JOIN "patients" pat ON pat.id = t."patientId"
      LEFT JOIN "therapeutic_paths" p ON p.id = t."therapeuticPathId"
      LEFT JOIN "app_users" dau ON dau.id = t."deletedByUserId"
      WHERE t."deletedAt" IS NOT NULL
        AND t."therapeuticPathId" NOT IN (
          -- Esclude i trattamenti già coperti da un percorso nel cestino,
          -- per non duplicare visualmente la stessa cancellazione.
          SELECT id FROM "therapeutic_paths" WHERE "deletedAt" IS NOT NULL
        )${extra.sql}
    `;
    return this.dataSource.query(sql, extra.params);
  }

  private async queryDeletedEvaluations(
    filter: RecycleBinFilterInput,
  ): Promise<RawDeletedRow[]> {
    const extra = this.buildOwnerSearchClauses(
      filter,
      'op."app_user_id"',
      ['p."name"', 'pat."nome"', 'pat."cognome"'],
    );

    const sql = `
      SELECT
        e.id                             AS "id",
        'patient_evaluation'::text       AS "entityType",
        COALESCE('Valutazione · ' || p."name", 'Valutazione') AS "title",
        TRIM(CONCAT_WS(' ', pat."nome", pat."cognome")) AS "subtitle",
        e."deletedAt"                    AS "deletedAt",
        e."deletedByUserId"              AS "deletedByUserId",
        TRIM(CONCAT_WS(' ', dau."name", dau."surname")) AS "deletedByName",
        op."app_user_id"                 AS "ownerUserId",
        TRIM(CONCAT_WS(' ', op."name", op."surname"))   AS "ownerName",
        NULL::int                        AS "childrenCount"
      FROM "patient_evaluations" e
      LEFT JOIN "therapeutic_paths" p ON p.id = e."therapeuticPathId"
      LEFT JOIN "operators" op ON op.id = e."operatorId"
      LEFT JOIN "patients" pat ON pat.id = p."patientId"
      LEFT JOIN "app_users" dau ON dau.id = e."deletedByUserId"
      WHERE e."deletedAt" IS NOT NULL
        AND e."therapeuticPathId" NOT IN (
          SELECT id FROM "therapeutic_paths" WHERE "deletedAt" IS NOT NULL
        )${extra.sql}
    `;
    return this.dataSource.query(sql, extra.params);
  }

  // ==================== RESTORE / PURGE ====================

  /**
   * Ripristina un elemento dal cestino delegando al service di dominio
   * per gestire correttamente il cascade di restore.
   */
  async restore(
    entityType: RecycleBinEntityType,
    id: string,
  ): Promise<boolean> {
    switch (entityType) {
      case RecycleBinEntityType.THERAPEUTIC_PATH:
        await this.pathService.restorePath(id);
        return true;
      case RecycleBinEntityType.TREATMENT:
        await this.treatmentService.restoreFromRecycleBin(id);
        return true;
      case RecycleBinEntityType.PATIENT_EVALUATION:
        await this.restoreEvaluation(id);
        return true;
    }
  }

  private async restoreEvaluation(id: string): Promise<void> {
    const ev = await this.evaluationRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!ev) {
      throw new NotFoundException(`Valutazione ${id} non trovata`);
    }
    if (!ev.deletedAt) {
      throw new ForbiddenException(`Valutazione ${id} non è nel cestino.`);
    }
    const deletedAt = ev.deletedAt;
    const toleranceMs = 5000;
    const from = new Date(deletedAt.getTime() - toleranceMs);
    const to = new Date(deletedAt.getTime() + toleranceMs);

    await this.dataSource.transaction(async manager => {
      await manager.query(
        `UPDATE "evaluation_objectives" SET "deletedAt" = NULL, "deletedByUserId" = NULL
         WHERE "evaluationId" = $1 AND "deletedAt" BETWEEN $2 AND $3`,
        [id, from, to],
      );
      await manager.query(
        `UPDATE "evaluation_tests" SET "deletedAt" = NULL, "deletedByUserId" = NULL
         WHERE "evaluationId" = $1 AND "deletedAt" BETWEEN $2 AND $3`,
        [id, from, to],
      );
      await manager.query(
        `UPDATE "evaluation_exams" SET "deletedAt" = NULL, "deletedByUserId" = NULL
         WHERE "evaluationId" = $1 AND "deletedAt" BETWEEN $2 AND $3`,
        [id, from, to],
      );
      await manager.query(
        `UPDATE "patient_evaluations" SET "deletedAt" = NULL, "deletedByUserId" = NULL WHERE id = $1`,
        [id],
      );
    });
  }

  /**
   * Eliminazione definitiva (hard delete). Riservata ad admin tramite
   * permesso `recycle_bin_purge`. Delega al service di dominio o usa
   * delete diretto per le valutazioni (CASCADE DB ai figli).
   */
  async purge(
    entityType: RecycleBinEntityType,
    id: string,
  ): Promise<boolean> {
    switch (entityType) {
      case RecycleBinEntityType.THERAPEUTIC_PATH:
        return this.pathService.hardDeletePath(id);
      case RecycleBinEntityType.TREATMENT:
        return this.treatmentService.hardDelete(id);
      case RecycleBinEntityType.PATIENT_EVALUATION: {
        const result = await this.evaluationRepo.delete(id);
        return (result.affected ?? 0) > 0;
      }
    }
  }

  // ==================== RETENTION CLEANUP ====================

  /**
   * Esegue la pulizia degli elementi più vecchi di `retentionDays`.
   * Usata sia dal cron giornaliero sia da admin per "svuotare ora".
   *
   * @param force - se true, ignora la retention e svuota tutto il cestino
   *   (uso admin: "svuota cestino"). Default: false.
   * @returns numero totale di record eliminati definitivamente.
   */
  async runRetentionCleanup(force: boolean = false): Promise<number> {
    const settings = await this.getSettings();
    const retentionDays = settings.retentionDays ?? null;

    if (!force && retentionDays === null) {
      this.logger.log(
        'RecycleBin: retention indefinita, nessuna pulizia automatica',
      );
      return 0;
    }

    const cutoff = force
      ? new Date()
      : new Date(Date.now() - (retentionDays as number) * 24 * 60 * 60 * 1000);

    let totalPurged = 0;

    // Ordine: prima i percorsi (cascade DB elimina figli), poi i restanti
    // trattamenti orfani, poi le valutazioni orfane.
    totalPurged += await this.purgeOlderThan(
      'therapeutic_paths',
      cutoff,
    );
    totalPurged += await this.purgeOlderThan('treatments', cutoff);
    totalPurged += await this.purgeOlderThan('patient_evaluations', cutoff);

    this.logger.log(
      `RecycleBin cleanup: ${totalPurged} record eliminati definitivamente ` +
        `(force=${force}, cutoff=${cutoff.toISOString()})`,
    );
    return totalPurged;
  }

  private async purgeOlderThan(
    table: string,
    cutoff: Date,
  ): Promise<number> {
    const result: { count: string }[] = await this.dataSource.query(
      `WITH purged AS (
         DELETE FROM "${table}" WHERE "deletedAt" IS NOT NULL AND "deletedAt" < $1
         RETURNING id
       )
       SELECT COUNT(*)::text AS count FROM purged`,
      [cutoff],
    );
    return parseInt(result[0]?.count ?? '0', 10);
  }
}
