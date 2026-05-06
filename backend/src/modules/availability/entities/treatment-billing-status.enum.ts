import { registerEnumType } from '@nestjs/graphql';

/**
 * Stato del trattamento nel ciclo di fatturazione clinico ↔ accounting.
 *
 * Transizioni (lato clinico):
 *  NOT_READY            → READY_FOR_BILLING  (closeTreatment + setReadyForBilling)
 *  READY_FOR_BILLING    → SENT               (publish treatment.closed)
 *  SENT                 → PENDING            (consume billable.received)
 *  PENDING / REISSUED   → INVOICED           (consume billable.invoiced)
 *  INVOICED             → REFUNDED           (consume billable.refunded)
 *  INVOICED             → PARTIALLY_REFUNDED (consume billable.partially-refunded)
 *  INVOICED             → REISSUED → INVOICED (consume billable.reissued)
 *  PENDING              → CANCELLED          (cancelTreatment)
 *  CANCELLED → INVOICED rollback su billable.cancellation-rejected (race condition).
 */
export enum TreatmentBillingStatus {
  NOT_READY = 'NOT_READY',
  READY_FOR_BILLING = 'READY_FOR_BILLING',
  SENT = 'SENT',
  PENDING = 'PENDING',
  INVOICED = 'INVOICED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
  REISSUED = 'REISSUED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(TreatmentBillingStatus, {
  name: 'TreatmentBillingStatus',
  description: 'Stato del trattamento nel ciclo di fatturazione clinico ↔ accounting',
});
