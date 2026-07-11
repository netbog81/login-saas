/**
 * Modelli di dominio Voucher FE (feature voucher-fe).
 * Interfacce locali — NON re-export dei tipi generati (riduce coupling).
 */

export type VoucherFeStatus =
  | 'active'
  | 'inactive'
  | 'depleted'
  | 'expired'
  | 'cancelled';

export interface VoucherFe {
  id: string;
  code: string;
  patientId: string;
  initialAmount: number;
  residualAmount: number;
  status: VoucherFeStatus | string;
  expiryDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
  /** Popolato solo dalla query Statistiche (allVouchersFe). */
  patient?: {
    id: string;
    subject?: {
      displayName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
}

/** Importo già utilizzato = iniziale − residuo. */
export function voucherFeUsedAmount(v: VoucherFe): number {
  return Math.round((Number(v.initialAmount) - Number(v.residualAmount)) * 100) / 100;
}

/** Il voucher è intatto (mai consumato)? Determina se si modifica iniziale o residuo. */
export function isVoucherFeUntouched(v: VoucherFe): boolean {
  return voucherFeUsedAmount(v) <= 0.005;
}

export function voucherFeStatusLabel(status: string): string {
  switch (status) {
    case 'active': return 'Attivo';
    case 'inactive': return 'Sospeso';
    case 'depleted': return 'Esaurito';
    case 'expired': return 'Scaduto';
    case 'cancelled': return 'Annullato';
    default: return status;
  }
}

export function voucherFeStatusColor(status: string): string {
  switch (status) {
    case 'active': return '#16a34a';
    case 'inactive': return '#d97706';
    case 'depleted': return '#64748b';
    case 'expired': return '#9333ea';
    case 'cancelled': return '#dc2626';
    default: return '#64748b';
  }
}

export function voucherFePatientName(v: VoucherFe): string {
  const s = v.patient?.subject;
  if (s) {
    const full = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
    return s.displayName || full || v.patientId;
  }
  return v.patientId;
}
