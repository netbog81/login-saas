/**
 * Modelli dell'allarme "sconto FE da incassare" della cartella paziente.
 * Layer 4 (models) — nessuna logica, solo forma dei dati GraphQL.
 */

/** Stati del trattamento così come arrivano dal backend (enum GraphQL). */
export type PendingFeTreatmentStatus =
  | 'WAITING'
  | 'IN_PROGRESS'
  | 'OPERATOR_COMPLETED'
  | 'CLOSED';

/** Etichette italiane degli stati, per la colonna "Stato" del riquadro. */
export const PENDING_FE_STATUS_LABELS: Record<string, string> = {
  WAITING: 'In attesa',
  IN_PROGRESS: 'In corso',
  OPERATOR_COMPLETED: 'Completato',
  CLOSED: 'Chiuso',
};

/**
 * Un trattamento con sconto FE il cui incasso non è mai stato registrato.
 * Vale sia per la fisioterapia sia per la palestra (`isGym`).
 */
export interface PendingFeCollectionItem {
  treatmentId: string;
  /** ISO datetime di inizio seduta. */
  startedAt: string;
  status: PendingFeTreatmentStatus | string;
  operatorId: string;
  operatorName: string;
  operatorAppUserId?: string | null;
  isGym: boolean;
  amount: number;
  servicesDescription?: string | null;
  therapeuticPathName?: string | null;
  /** Deciso dal backend: ruolo + canCollectPayment + impostazione tenant. */
  canCollect: boolean;
  cannotCollectReason?: string | null;
}

/** Riepilogo per paziente: `count = 0` ⇒ badge spento. */
export interface PendingFeCollections {
  count: number;
  totalAmount: number;
  allowAnyOperatorCollect: boolean;
  callerIsSecretary: boolean;
  items: PendingFeCollectionItem[];
}

export const EMPTY_PENDING_FE_COLLECTIONS: PendingFeCollections = {
  count: 0,
  totalAmount: 0,
  allowAnyOperatorCollect: false,
  callerIsSecretary: false,
  items: [],
};
