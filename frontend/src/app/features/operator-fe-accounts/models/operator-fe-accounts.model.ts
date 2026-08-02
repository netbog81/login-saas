/**
 * Modelli dei CONTI FE — mirror del backend (modules/operator-fe-accounts).
 * Compensi operatore sui trattamenti con SCONTO FE, calcolati sui campi FE
 * dei servizi (Tariffa servizio FE / Extra studio FE / Totale Sconto FE).
 */

/** Operatore selezionabile nei filtri (dalla query `operators`). */
export interface FeOperator {
  id: string;
  name: string;
  surname?: string | null;
  /** AppUser.id: chiave dei conteggi (= executedByOperatorId delle righe). */
  appUserId?: string | null;
  /** Enum GraphQL: DOCTOR | PHYSIOTHERAPIST | GYM_INSTRUCTOR | OTHER */
  macroCategory: string;
  royaltyPercentage: number;
  isActive: boolean;
}

/** Etichette filtro per macro categoria operatore (chiavi = enum GraphQL). */
export const OPERATOR_CATEGORY_LABELS: Record<string, string> = {
  DOCTOR: 'Medici',
  PHYSIOTHERAPIST: 'Fisioterapisti',
  GYM_INSTRUCTOR: 'Istruttori palestra',
  OTHER: 'Altro',
};

export function feOperatorDisplayName(op: FeOperator): string {
  return [op.name, op.surname].filter(Boolean).join(' ');
}

/** PAID = incassata · UNPAID = chiusa da incassare · OPEN = in corso. */
export type FeLineState = 'PAID' | 'UNPAID' | 'OPEN';

export const FE_STATE_LABELS: Record<FeLineState, string> = {
  PAID: 'Incassata',
  UNPAID: 'Da incassare',
  OPEN: 'In corso',
};

export interface FeAnalysisRow {
  treatmentId: string;
  treatmentServiceId: string;
  executionDate: string;
  description: string;
  serviceName: string | null;
  patientName: string | null;
  unitPrice: number;
  studioExtraAmount: number;
  baseAmount: number;
  percentage: number;
  compensationAmount: number;
  studioShareAmount: number;
  state: FeLineState;
  isCustomPrice: boolean;
  missingBreakdown: boolean;
}

export interface OperatorFeAnalysis {
  operatorAppUserId: string;
  operatorName: string;
  hasOperator: boolean;
  royaltyPercentage: number;
  counts: { total: number; paid: number; unpaid: number; open: number };
  totals: {
    gross: number;
    base: number;
    compensation: number;
    studioShare: number;
    studioExtra: number;
  };
  rows: FeAnalysisRow[];
}

export interface OperatorFeSettlementLine {
  id: string;
  treatmentId: string;
  treatmentServiceId: string;
  executionDate: string;
  description: string;
  serviceName: string | null;
  patientName: string | null;
  unitPrice: number;
  studioExtraAmount: number;
  baseAmount: number;
  percentage: number;
  compensationAmount: number;
  studioShareAmount: number;
  state: FeLineState;
  isCustomPrice: boolean;
}

export interface OperatorFeSettlement {
  id: string;
  batchId: string | null;
  operatorAppUserId: string;
  operatorName: string;
  periodFrom: string;
  periodTo: string;
  includeUnpaid: boolean;
  includeOpen: boolean;
  countTotal: number;
  countPaid: number;
  countUnpaid: number;
  countOpen: number;
  grossAmount: number;
  baseAmount: number;
  compensationAmount: number;
  studioShareAmount: number;
  studioExtraAmount: number;
  communicatedAt: string | null;
  verifiedAt: string | null;
  paidAt: string | null;
  paymentDate: string | null;
  notes: string | null;
  createdAt: string;
  lines?: OperatorFeSettlementLine[] | null;
}

/** Lotto di generazione (vista ad albero): conteggi creati insieme. */
export interface FeSettlementBatch {
  /** batchId, o l'id del conteggio per lo storico senza batch. */
  key: string;
  createdAt: string;
  periodFrom: string;
  periodTo: string;
  includeUnpaid: boolean;
  includeOpen: boolean;
  settlements: OperatorFeSettlement[];
  totalCompensation: number;
}

export function groupFeSettlementsIntoBatches(
  list: OperatorFeSettlement[],
): FeSettlementBatch[] {
  const byKey = new Map<string, OperatorFeSettlement[]>();
  for (const s of list) {
    const key = s.batchId ?? s.id;
    const group = byKey.get(key) ?? [];
    group.push(s);
    byKey.set(key, group);
  }
  return [...byKey.entries()]
    .map(([key, settlements]) => {
      settlements.sort((a, b) => a.operatorName.localeCompare(b.operatorName));
      const first = settlements[0];
      return {
        key,
        createdAt: first.createdAt,
        periodFrom: first.periodFrom,
        periodTo: first.periodTo,
        includeUnpaid: first.includeUnpaid,
        includeOpen: first.includeOpen,
        settlements,
        totalCompensation: settlements.reduce(
          (sum, s) => sum + (s.compensationAmount || 0),
          0,
        ),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface OperatorFeAccountSettings {
  periodMode: 'CALENDAR_MONTH' | 'CUTOFF';
  cutoffDay: number;
}

export interface GenerateFeSettlementsInput {
  from: string;
  to: string;
  operatorAppUserIds: string[];
  includeUnpaid: boolean;
  includeOpen: boolean;
}

export interface PatchFeSettlementInput {
  communicated?: boolean;
  verified?: boolean;
  paid?: boolean;
  paymentDate?: string | null;
  notes?: string | null;
}

/** Periodo standard selezionabile (calcolato dalle impostazioni). */
export interface StandardPeriod {
  label: string;
  from: string;
  to: string;
}

const toIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const MONTH_LABELS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

/**
 * Ultimi `count` periodi standard (dal più recente), secondo le impostazioni:
 * CALENDAR_MONTH → 1°→ultimo del mese; CUTOFF N → (N+1) mese prec → N mese.
 * Stessa logica dei Conti operatori dell'accounting.
 */
export function buildStandardPeriods(
  settings: OperatorFeAccountSettings,
  count = 12,
  today = new Date(),
): StandardPeriod[] {
  const periods: StandardPeriod[] = [];
  for (let i = 0; i < count; i++) {
    if (settings.periodMode === 'CUTOFF') {
      // Periodo "di" un mese M: dal (cutoff+1) di M-1 al cutoff di M.
      // Il periodo corrente è quello il cui `to` non è ancora passato.
      const ref = new Date(today.getFullYear(), today.getMonth(), 1);
      ref.setMonth(ref.getMonth() - i + (today.getDate() > settings.cutoffDay ? 1 : 0));
      const to = new Date(ref.getFullYear(), ref.getMonth(), settings.cutoffDay);
      const from = new Date(ref.getFullYear(), ref.getMonth() - 1, settings.cutoffDay + 1);
      periods.push({
        label: `${toIso(from).slice(8, 10)}/${toIso(from).slice(5, 7)} → ${toIso(to).slice(8, 10)}/${toIso(to).slice(5, 7)}/${to.getFullYear()}`,
        from: toIso(from),
        to: toIso(to),
      });
    } else {
      const ref = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      periods.push({
        label: `${MONTH_LABELS[ref.getMonth()]} ${ref.getFullYear()}`,
        from: toIso(from),
        to: toIso(to),
      });
    }
  }
  return periods;
}
