/**
 * Modelli della sezione Statistiche → No Show (gestione assenze
 * ingiustificate). Specchio dei tipi GraphQL del backend
 * (`modules/no-show/models/no-show.models.ts`).
 */

/** Tipologie di evento. Derivate dallo stato dell'appuntamento. */
export type NoShowEventType =
  | 'NO_SHOW'
  | 'CANCELLED_LATE'
  | 'CANCELLED_EARLY'
  | 'CANCELLED_UNKNOWN'
  | 'LATE_ARRIVAL';

/** Ambito: studio (medici/fisio) o palestra (istruttori). */
export type NoShowContext = 'ALL' | 'STUDIO' | 'GYM';

export type NoShowDecision = 'PENDING' | 'TO_CHARGE' | 'WAIVED' | 'JUSTIFIED';

export type ArrivalSource =
  | 'MANUAL_SECRETARY'
  | 'MANUAL_OPERATOR'
  | 'NO_SHOW_REVERT'
  | 'WAITING_ROOM';

export interface NoShowCounts {
  noShow: number;
  cancelledLate: number;
  cancelledEarly: number;
  cancelledUnknown: number;
  lateArrival: number;
  /** No-show + disdette tardive + disdette di preavviso ignoto. */
  unjustified: number;
  total: number;
}

export interface NoShowReview {
  id: string;
  appointmentId: string;
  patientId?: string | null;
  decision: NoShowDecision;
  notes?: string | null;
  chargedAmount?: number | null;
  decidedBy?: string | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
}

export interface NoShowEvent {
  appointmentId: string;
  patientId?: string | null;
  patientName: string;
  eventType: NoShowEventType;
  bookingStatus: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  gymRoomName?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  operatorId?: string | null;
  operatorName?: string | null;
  operatorMacroCategory?: string | null;
  isSubstitution: boolean;
  originalOperatorName?: string | null;
  cancelledAt?: string | null;
  cancellationHoursNotice?: number | null;
  cancellationReason?: string | null;
  arrivedAt?: string | null;
  lateMinutes?: number | null;
  arrivalSource?: ArrivalSource | null;
  wasNoShowReverted: boolean;
  serviceNames: string[];
  review?: NoShowReview | null;
}

export interface NoShowPatientGroup {
  patientId?: string | null;
  patientName: string;
  counts: NoShowCounts;
  /** Ultimi N giorni, indipendente dal filtro. */
  recent: NoShowCounts;
  /** Ultimi 12 mesi scorrevoli, indipendente dal filtro. */
  rollingYear: NoShowCounts;
  firstEventDate?: string | null;
  lastEventDate?: string | null;
  pendingReviews: number;
  events: NoShowEvent[];
}

export interface NoShowPatientPage {
  groups: NoShowPatientGroup[];
  totalPatients: number;
}

export interface NoShowEventPage {
  events: NoShowEvent[];
  total: number;
}

export interface NoShowSummary {
  counts: NoShowCounts;
  patientsInvolved: number;
  pendingReviews: number;
  toCharge: number;
  waived: number;
  justified: number;
  lateCancellationHours: number;
  lateArrivalToleranceMinutes: number;
  recentWindowDays: number;
}

export interface NoShowFilter {
  from?: string | null;
  to?: string | null;
  types?: NoShowEventType[];
  context?: NoShowContext;
  operatorIds?: string[];
  siteIds?: string[];
  patientId?: string | null;
  search?: string | null;
  decisions?: NoShowDecision[];
  excludeJustified?: boolean;
  includeWithoutPatient?: boolean;
  minEvents?: number;
}

// ==================== LABEL / COLORI ====================

const EVENT_TYPE_LABELS: Record<NoShowEventType, string> = {
  NO_SHOW: 'Non presentato',
  CANCELLED_LATE: 'Disdetta tardiva',
  CANCELLED_EARLY: 'Disdetta con preavviso',
  CANCELLED_UNKNOWN: 'Disdetta (preavviso ignoto)',
  LATE_ARRIVAL: 'Arrivato in ritardo',
};

const EVENT_TYPE_ICONS: Record<NoShowEventType, string> = {
  NO_SHOW: 'person_off',
  CANCELLED_LATE: 'event_busy',
  CANCELLED_EARLY: 'event_available',
  CANCELLED_UNKNOWN: 'help_outline',
  LATE_ARRIVAL: 'schedule',
};

export function eventTypeLabel(type: NoShowEventType): string {
  return EVENT_TYPE_LABELS[type] ?? type;
}

export function eventTypeIcon(type: NoShowEventType): string {
  return EVENT_TYPE_ICONS[type] ?? 'help_outline';
}

const DECISION_LABELS: Record<NoShowDecision, string> = {
  PENDING: 'Da valutare',
  TO_CHARGE: 'Da addebitare',
  WAIVED: 'Esonerato',
  JUSTIFIED: 'Giustificato',
};

export function decisionLabel(decision: NoShowDecision): string {
  return DECISION_LABELS[decision] ?? decision;
}

const ARRIVAL_SOURCE_LABELS: Record<ArrivalSource, string> = {
  MANUAL_SECRETARY: 'Registrato dalla segreteria',
  MANUAL_OPERATOR: 'Registrato dall\'operatore',
  NO_SHOW_REVERT: 'Dedotto: dato per assente, poi presentatosi',
  WAITING_ROOM: 'Check-in sala d\'attesa',
};

export function arrivalSourceLabel(source?: ArrivalSource | null): string {
  return source ? ARRIVAL_SOURCE_LABELS[source] ?? source : '';
}

/**
 * Livello di attenzione di un paziente, sulla base delle finestre
 * SCORREVOLI e non dell'anno solare: due assenze a cavallo di Capodanno
 * sono due assenze in sei giorni, non "una e una".
 */
export type NoShowSeverity = 'ok' | 'watch' | 'alert';

export function patientSeverity(group: NoShowPatientGroup): NoShowSeverity {
  const recent = group.recent.unjustified;
  const year = group.rollingYear.unjustified;
  if (recent >= 2 || year >= 4) return 'alert';
  if (recent >= 1 && year >= 2) return 'watch';
  if (year >= 2) return 'watch';
  return 'ok';
}

export function severityLabel(severity: NoShowSeverity): string {
  switch (severity) {
    case 'alert':
      return 'Ricorrente';
    case 'watch':
      return 'Da tenere d\'occhio';
    default:
      return 'Episodico';
  }
}

/** Elenco delle tipologie per i filtri, nell'ordine in cui vanno mostrate. */
export const ALL_EVENT_TYPES: NoShowEventType[] = [
  'NO_SHOW',
  'CANCELLED_LATE',
  'CANCELLED_UNKNOWN',
  'CANCELLED_EARLY',
  'LATE_ARRIVAL',
];

/** Default: le assenze che pesano. Le disdette con preavviso sono opt-in. */
export const DEFAULT_EVENT_TYPES: NoShowEventType[] = [
  'NO_SHOW',
  'CANCELLED_LATE',
  'CANCELLED_UNKNOWN',
];
