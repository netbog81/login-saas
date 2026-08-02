import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Between, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { TenantContextService } from '@curandis/tenant-datasource';

import { Treatment } from '../../availability/entities/treatment.entity';
import { TreatmentService as TreatmentServiceEntity } from '../../availability/entities/treatment-service.entity';
import { TreatmentStatus } from '../../availability/entities/treatment-enums';
import { Operator } from '../../availability/entities/operator.entity';
import { toDateString } from '../../availability/utils/date-string.util';
import { RegistrySubjectLoader } from '../../registry/registry-subject.loader';
import { OperatorFeSettlement } from '../entities/operator-fe-settlement.entity';
import {
  OperatorFeSettlementLine,
  OperatorFeLineState,
} from '../entities/operator-fe-settlement-line.entity';
import { OperatorFeAccountSettings } from '../entities/operator-fe-account-settings.entity';
import {
  OperatorFeAnalysis,
  OperatorFeAnalysisRow,
} from '../dto/operator-fe-analysis.output';
import {
  GenerateOperatorFeSettlementsInput,
  PatchOperatorFeSettlementInput,
  UpdateOperatorFeAccountSettingsInput,
} from '../dto/operator-fe-accounts.input';

export interface OperatorFeAnalysisFilters {
  from: string;
  to: string;
  operatorAppUserIds?: string[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
/** Parse tollerante dei decimal TypeORM (arrivano come stringhe da pg). */
const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

/**
 * CONTI FE — motore di analisi e conteggi compensi operatore sui trattamenti
 * con SCONTO FE. Speculare a OperatorAccountsService dell'accounting, ma:
 *
 *  - perimetro = trattamenti `scontoFE = true` (quelli normali sono
 *    conteggiati nei Conti operatori dell'accounting: nessun doppio conteggio);
 *  - scomposizione FE del servizio: il prezzo praticato delle righe non
 *    custom è già `discountFE` ("Totale Sconto FE"), l'extra è
 *    `studioExtraFE` ("Extra studio FE", fallback `studioExtra`);
 *  - stati riga: PAID (trattamento incassato) / UNPAID (chiuso, da
 *    incassare) / OPEN (non ancora chiuso) al posto di
 *    INVOICED/PROFORMA/PENDING;
 *  - formula identica: compenso = royaltyPercentage% × max(0, prezzo − extra).
 *
 * La data di esecuzione è `startedAt` del trattamento, come l'executionDate
 * che il clinico pubblica verso accounting (TreatmentEventMapper).
 */
@Injectable()
export class OperatorFeAccountsService {
  private readonly logger = new Logger(OperatorFeAccountsService.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  // ==================== ANALISI ====================

  async analyze(
    filters: OperatorFeAnalysisFilters,
    subjectLoader?: RegistrySubjectLoader,
  ): Promise<OperatorFeAnalysis[]> {
    const { from, to } = filters;
    if (!from || !to || from > to) {
      throw new BadRequestException('Periodo non valido (from > to)');
    }

    const treatments = await this.dataSource.getRepository(Treatment).find({
      where: {
        scontoFE: true,
        startedAt: Between(
          new Date(`${from}T00:00:00`),
          new Date(`${to}T23:59:59.999`),
        ),
      },
      relations: ['treatmentServices', 'treatmentServices.service'],
      order: { startedAt: 'ASC' },
    });

    // Scheda operatore (percentuale + nome); include gli archiviati: le
    // loro prestazioni storiche restano conteggiabili.
    const operators = await this.dataSource
      .getRepository(Operator)
      .find({ withDeleted: true });
    const operatorById = new Map<string, Operator>();
    for (const op of operators) {
      operatorById.set(op.id, op);
    }

    const patientNames = await this.resolvePatientNames(
      treatments,
      subjectLoader,
    );

    const wantedIds = filters.operatorAppUserIds?.length
      ? new Set(filters.operatorAppUserIds)
      : null;

    const byOperator = new Map<string, OperatorFeAnalysis>();

    for (const t of treatments) {
      const state: OperatorFeLineState = t.isPaid
        ? 'PAID'
        : t.status === TreatmentStatus.CLOSED
          ? 'UNPAID'
          : 'OPEN';

      for (const ts of t.treatmentServices ?? []) {
        // 2026-07-15 — Esecutore della riga: override esplicito "Eseguito
        // da" (executorOperatorId, FK operators) altrimenti l'OPERATORE del
        // trattamento. La colonna legacy executedByOperatorId NON viene più
        // letta: era valorizzata con l'utente LOGGATO, quindi le righe
        // aggiunte dalla segreteria su trattamenti scontoFE risultavano
        // compensi della segreteria invece che dell'operatore.
        const executorOp =
          (ts.executorOperatorId
            ? operatorById.get(ts.executorOperatorId)
            : undefined) ??
          (t.operatorId ? operatorById.get(t.operatorId) : undefined);
        if (!executorOp) continue; // trattamento senza operatore: non attribuibile
        // Chiave di aggregazione: appUserId se collegato, altrimenti l'id
        // operatore — così gli operatori SENZA account Keycloak non
        // spariscono dai conteggi (stessa uuid-shape, nessun conflitto).
        const operatorId = executorOp.appUserId ?? executorOp.id;
        if (wantedIds && !wantedIds.has(operatorId)) continue;

        let analysis = byOperator.get(operatorId);
        if (!analysis) {
          analysis = {
            operatorAppUserId: operatorId,
            operatorName:
              [executorOp.name, executorOp.surname].filter(Boolean).join(' ') ||
              `Operatore ${operatorId.slice(0, 8)}`,
            hasOperator: true,
            royaltyPercentage: num(executorOp.royaltyPercentage),
            counts: { total: 0, paid: 0, unpaid: 0, open: 0 },
            totals: {
              gross: 0,
              base: 0,
              compensation: 0,
              studioShare: 0,
              studioExtra: 0,
            },
            rows: [],
          };
          byOperator.set(operatorId, analysis);
        }

        const row = this.buildRow(
          t,
          ts,
          state,
          analysis.royaltyPercentage,
          patientNames,
        );
        analysis.rows.push(row);

        analysis.counts.total += 1;
        if (state === 'PAID') analysis.counts.paid += 1;
        else if (state === 'UNPAID') analysis.counts.unpaid += 1;
        else analysis.counts.open += 1;

        analysis.totals.gross = round2(analysis.totals.gross + row.unitPrice);
        analysis.totals.base = round2(analysis.totals.base + row.baseAmount);
        analysis.totals.compensation = round2(
          analysis.totals.compensation + row.compensationAmount,
        );
        analysis.totals.studioShare = round2(
          analysis.totals.studioShare + row.studioShareAmount,
        );
        analysis.totals.studioExtra = round2(
          analysis.totals.studioExtra + row.studioExtraAmount,
        );
      }
    }

    return [...byOperator.values()].sort((a, b) =>
      a.operatorName.localeCompare(b.operatorName),
    );
  }

  private buildRow(
    t: Treatment,
    ts: TreatmentServiceEntity,
    state: OperatorFeLineState,
    percentage: number,
    patientNames: Map<string, string>,
  ): OperatorFeAnalysisRow {
    const unitPrice = num(ts.price);
    const svc = ts.service;

    // Extra studio FE del servizio; fallback alla variante normale se la
    // scomposizione FE non è mai stata compilata (stessa scelta accounting).
    const extraRaw = svc ? (svc.studioExtraFE ?? svc.studioExtra) : null;
    const missingBreakdown = extraRaw == null;
    const studioExtraUnit = num(extraRaw);

    const baseAmount = round2(Math.max(0, unitPrice - studioExtraUnit));
    const compensationAmount = round2((baseAmount * percentage) / 100);
    const gross = round2(unitPrice);
    const studioShareAmount = round2(gross - compensationAmount);
    // Clamp: l'extra esposto non supera il prezzo praticato.
    const studioExtraAmount = round2(Math.min(studioExtraUnit, unitPrice));

    return {
      treatmentId: t.id,
      treatmentServiceId: ts.id,
      executionDate: toDateString(t.startedAt),
      description:
        ts.invoiceLineDescription?.trim() || svc?.name || 'Prestazione',
      serviceName: svc?.name ?? null,
      patientName: t.patientId
        ? (patientNames.get(t.patientId) ?? null)
        : null,
      unitPrice: gross,
      studioExtraAmount,
      baseAmount,
      percentage,
      compensationAmount,
      studioShareAmount,
      state,
      isCustomPrice: !!ts.isCustomPrice,
      missingBreakdown,
    };
  }

  /**
   * Nomi pazienti dal registry via DataLoader di request. Best-effort: se il
   * registry non risponde l'analisi esce comunque, coi nomi vuoti.
   */
  private async resolvePatientNames(
    treatments: Treatment[],
    subjectLoader?: RegistrySubjectLoader,
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (!subjectLoader) return names;
    const ids = [
      ...new Set(
        treatments.map((t) => t.patientId).filter((id): id is string => !!id),
      ),
    ];
    if (!ids.length) return names;
    const subjects = await Promise.all(
      ids.map((id) => subjectLoader.load(id).catch(() => null)),
    );
    ids.forEach((id, i) => {
      const s = subjects[i];
      const name =
        s?.displayName || [s?.firstName, s?.lastName].filter(Boolean).join(' ');
      if (name) names.set(id, name);
    });
    return names;
  }

  // ==================== CONTEGGI (SNAPSHOT) ====================

  async generateSettlements(
    input: GenerateOperatorFeSettlementsInput,
    createdByUserId?: string,
    createdByEmail?: string,
    subjectLoader?: RegistrySubjectLoader,
  ): Promise<OperatorFeSettlement[]> {
    if (!input.operatorAppUserIds?.length) {
      throw new BadRequestException('Nessun operatore selezionato');
    }
    const analysis = await this.analyze(
      {
        from: input.from,
        to: input.to,
        operatorAppUserIds: input.operatorAppUserIds,
      },
      subjectLoader,
    );

    const batchId = randomUUID();
    const created: OperatorFeSettlement[] = [];

    await this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(OperatorFeSettlement);
      const lineRepo = manager.getRepository(OperatorFeSettlementLine);

      for (const op of analysis) {
        // Le incassate entrano sempre; le altre secondo i toggle.
        const rows = op.rows.filter(
          (r) =>
            r.state === 'PAID' ||
            (r.state === 'UNPAID' && input.includeUnpaid) ||
            (r.state === 'OPEN' && input.includeOpen),
        );
        if (!rows.length) continue;

        const sum = (fn: (r: OperatorFeAnalysisRow) => number) =>
          round2(rows.reduce((acc, r) => acc + fn(r), 0));

        const settlement = await settlementRepo.save(
          settlementRepo.create({
            batchId,
            operatorAppUserId: op.operatorAppUserId,
            operatorName: op.operatorName,
            periodFrom: input.from,
            periodTo: input.to,
            includeUnpaid: input.includeUnpaid,
            includeOpen: input.includeOpen,
            countTotal: rows.length,
            countPaid: rows.filter((r) => r.state === 'PAID').length,
            countUnpaid: rows.filter((r) => r.state === 'UNPAID').length,
            countOpen: rows.filter((r) => r.state === 'OPEN').length,
            grossAmount: sum((r) => r.unitPrice),
            baseAmount: sum((r) => r.baseAmount),
            compensationAmount: sum((r) => r.compensationAmount),
            studioShareAmount: sum((r) => r.studioShareAmount),
            studioExtraAmount: sum((r) => r.studioExtraAmount),
            createdByUserId: createdByUserId ?? null,
            createdByEmail: createdByEmail ?? null,
          }),
        );

        settlement.lines = await lineRepo.save(
          rows.map((r) =>
            lineRepo.create({
              settlementId: settlement.id,
              treatmentId: r.treatmentId,
              treatmentServiceId: r.treatmentServiceId,
              executionDate: r.executionDate,
              description: r.description,
              serviceName: r.serviceName ?? null,
              patientName: r.patientName ?? null,
              unitPrice: r.unitPrice,
              studioExtraAmount: r.studioExtraAmount,
              baseAmount: r.baseAmount,
              percentage: r.percentage,
              compensationAmount: r.compensationAmount,
              studioShareAmount: r.studioShareAmount,
              state: r.state as OperatorFeLineState,
              isCustomPrice: r.isCustomPrice,
            }),
          ),
        );
        created.push(settlement);
      }
    });

    this.logger.log(
      `Generati ${created.length} conteggi FE (batch ${batchId}, periodo ${input.from} → ${input.to})`,
    );
    return created;
  }

  async findSettlements(
    operatorAppUserId?: string,
  ): Promise<OperatorFeSettlement[]> {
    return this.dataSource.getRepository(OperatorFeSettlement).find({
      where: operatorAppUserId ? { operatorAppUserId } : {},
      relations: ['lines'],
      order: { createdAt: 'DESC', operatorName: 'ASC' },
    });
  }

  async findSettlementById(id: string): Promise<OperatorFeSettlement> {
    const settlement = await this.dataSource
      .getRepository(OperatorFeSettlement)
      .findOne({ where: { id }, relations: ['lines'] });
    if (!settlement) throw new NotFoundException(`Conteggio ${id} non trovato`);
    settlement.lines?.sort((a, b) =>
      a.executionDate.localeCompare(b.executionDate),
    );
    return settlement;
  }

  async patchSettlement(
    id: string,
    input: PatchOperatorFeSettlementInput,
  ): Promise<OperatorFeSettlement> {
    const repo = this.dataSource.getRepository(OperatorFeSettlement);
    const settlement = await repo.findOne({ where: { id } });
    if (!settlement) throw new NotFoundException(`Conteggio ${id} non trovato`);

    if (input.communicated !== undefined && input.communicated !== null) {
      settlement.communicatedAt = input.communicated
        ? (settlement.communicatedAt ?? new Date())
        : null;
    }
    if (input.verified !== undefined && input.verified !== null) {
      settlement.verifiedAt = input.verified
        ? (settlement.verifiedAt ?? new Date())
        : null;
    }
    if (input.paid !== undefined && input.paid !== null) {
      settlement.paidAt = input.paid ? (settlement.paidAt ?? new Date()) : null;
      // Pagato senza data e senza data nel patch → oggi (resta editabile).
      if (input.paid && !settlement.paymentDate && input.paymentDate === undefined) {
        settlement.paymentDate = toDateString(new Date());
      }
    }
    if (input.paymentDate !== undefined) {
      settlement.paymentDate = input.paymentDate;
    }
    if (input.notes !== undefined) {
      settlement.notes = input.notes;
    }

    const saved = await repo.save(settlement);
    // Normalizza le date per il client (vedi date-string.util.ts).
    saved.periodFrom = toDateString(saved.periodFrom);
    saved.periodTo = toDateString(saved.periodTo);
    if (saved.paymentDate) saved.paymentDate = toDateString(saved.paymentDate);
    return saved;
  }

  async bulkDeleteSettlements(
    ids: string[],
  ): Promise<{ deleted: number; skippedPaid: number }> {
    if (!ids.length) return { deleted: 0, skippedPaid: 0 };
    const repo = this.dataSource.getRepository(OperatorFeSettlement);
    const settlements = await repo.find({ where: { id: In(ids) } });
    const deletable = settlements.filter((s) => !s.paidAt);
    const skippedPaid = settlements.length - deletable.length;
    if (deletable.length) await repo.remove(deletable);
    return { deleted: deletable.length, skippedPaid };
  }

  // ==================== IMPOSTAZIONI ====================

  async getSettings(): Promise<OperatorFeAccountSettings> {
    const repo = this.dataSource.getRepository(OperatorFeAccountSettings);
    const existing = await repo.find({ take: 1 });
    if (existing.length) return existing[0];
    // Default non persistito (si materializza al primo salvataggio).
    return repo.create({ periodMode: 'CALENDAR_MONTH', cutoffDay: 25 });
  }

  async updateSettings(
    input: UpdateOperatorFeAccountSettingsInput,
  ): Promise<OperatorFeAccountSettings> {
    const repo = this.dataSource.getRepository(OperatorFeAccountSettings);
    const existing = await repo.find({ take: 1 });
    const settings =
      existing[0] ?? repo.create({ periodMode: 'CALENDAR_MONTH', cutoffDay: 25 });
    if (input.periodMode) settings.periodMode = input.periodMode;
    if (input.cutoffDay != null) {
      if (input.cutoffDay < 1 || input.cutoffDay > 28) {
        throw new BadRequestException('cutoffDay deve essere tra 1 e 28');
      }
      settings.cutoffDay = input.cutoffDay;
    }
    return repo.save(settings);
  }
}
