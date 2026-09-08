import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';
import { PermissionDenial } from '../entities/permission-denial.entity';

/** Quanto si tengono i rifiuti prima di essere potati. */
const RETENTION_DAYS = 90;

/** Ogni quanto, al massimo, questo processo ripulisce lo storico di un tenant. */
const PRUNE_EVERY_MS = 60 * 60 * 1000;

export interface RecordDenialInput {
  appUserId?: string;
  keycloakId?: string;
  email?: string;
  /** I permessi che mancavano: una riga ciascuno. */
  permissions: string[];
  operation?: string;
  reason: 'missing_permission' | 'user_not_found';
}

/** Una combinazione utente + permesso, con quante volte ha sbattuto. */
export interface DenialSummaryRow {
  appUserId?: string;
  keycloakId?: string;
  email?: string;
  permission: string;
  reason: string;
  count: number;
  lastOccurredAt: Date;
  operations: { operation: string; count: number }[];
}

/**
 * Storico degli accessi negati.
 *
 * Scrivere qui non deve MAI far fallire la richiesta che stiamo già
 * rifiutando: all'utente interessa il 403, non il fatto che il registro sia
 * andato storto. Per questo ogni errore viene loggato e ingoiato.
 */
@Injectable()
export class PermissionDenialService {
  private readonly logger = new Logger(PermissionDenialService.name);

  /** Ultima potatura per tenant, per non rifarla a ogni rifiuto. */
  private readonly lastPruneAt = new Map<string, number>();

  constructor(private readonly tenantContext: TenantContextService) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get repo() {
    return this.dataSource.getRepository(PermissionDenial);
  }

  /**
   * Registra un rifiuto. Non solleva mai: chi la chiama sta già rifiutando.
   */
  async record(input: RecordDenialInput): Promise<void> {
    try {
      const rows = input.permissions.map((permission) => this.repo.create({
        appUserId: input.appUserId,
        keycloakId: input.keycloakId,
        email: input.email,
        permission,
        operation: input.operation?.slice(0, 200),
        reason: input.reason,
      }));
      if (rows.length === 0) return;
      await this.repo.save(rows);
      await this.pruneIfDue();
    } catch (err) {
      this.logger.warn(`Impossibile registrare il rifiuto: ${(err as Error).message}`);
    }
  }

  /** Elenco grezzo, dal più recente. */
  async recent(days: number, limit: number): Promise<PermissionDenial[]> {
    return this.repo
      .createQueryBuilder('d')
      .where(`d.occurred_at > now() - (:days || ' days')::interval`, { days })
      .orderBy('d.occurred_at', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Un utente, un permesso, quante volte e dove.
   *
   * Il dettaglio per operazione arriva da una seconda query invece che da un
   * `string_agg`: sono due GROUP BY su una tabella piccola, e leggere il
   * risultato non richiede di smontare una stringa.
   */
  async summary(days: number): Promise<DenialSummaryRow[]> {
    const groups = await this.repo.query(`
      SELECT app_user_id, keycloak_id, email, permission, reason,
             COUNT(*)::int AS count,
             MAX(occurred_at) AS last_occurred_at
      FROM permission_denials
      WHERE occurred_at > now() - ($1 || ' days')::interval
      GROUP BY app_user_id, keycloak_id, email, permission, reason
      ORDER BY MAX(occurred_at) DESC
    `, [days]);

    const byOperation = await this.repo.query(`
      SELECT keycloak_id, permission, COALESCE(operation, '—') AS operation,
             COUNT(*)::int AS count
      FROM permission_denials
      WHERE occurred_at > now() - ($1 || ' days')::interval
      GROUP BY keycloak_id, permission, operation
      ORDER BY COUNT(*) DESC
    `, [days]);

    return groups.map((g: any) => ({
      appUserId: g.app_user_id ?? undefined,
      keycloakId: g.keycloak_id ?? undefined,
      email: g.email ?? undefined,
      permission: g.permission,
      reason: g.reason,
      count: g.count,
      lastOccurredAt: g.last_occurred_at,
      operations: byOperation
        .filter((o: any) => o.keycloak_id === g.keycloak_id && o.permission === g.permission)
        .map((o: any) => ({ operation: o.operation, count: o.count })),
    }));
  }

  /**
   * Potatura opportunistica: non c'è un cron, e nel clinico i cron
   * multi-tenant hanno il vizio di girare senza contesto tenant. Qui invece
   * siamo dentro una richiesta, quindi il DataSource giusto ce l'abbiamo già.
   */
  private async pruneIfDue(): Promise<void> {
    const alias = this.tenantContext.getTenantAlias() ?? 'unknown';
    const last = this.lastPruneAt.get(alias) ?? 0;
    const now = Date.now();
    if (now - last < PRUNE_EVERY_MS) return;
    this.lastPruneAt.set(alias, now);

    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .where(`occurred_at < now() - (:days || ' days')::interval`, { days: RETENTION_DAYS })
      .execute();

    if (result.affected) {
      this.logger.log(`Potati ${result.affected} rifiuti oltre i ${RETENTION_DAYS} giorni (tenant=${alias})`);
    }
  }
}
