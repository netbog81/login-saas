/**
 * Cosa i pazienti NON hanno ricevuto.
 *
 * I nomi delle enum arrivano da GraphQL in MAIUSCOLO, non con i valori a
 * database: usare quelli minuscoli produce una tabella che si popola ma senza
 * etichette, e nessun errore da nessuna parte.
 */

export type ContactState = 'USABLE' | 'INVALID' | 'NO_CONTACT' | 'UNKNOWN';

/**
 * Cosa dire quando non si può raggiungere qualcuno.
 *
 * Due problemi diversi che si riparano in due posti diversi: il numero
 * scritto male sta sull'appuntamento, il numero mancante in anagrafica.
 * Un messaggio unico manderebbe metà delle volte a cercare dalla parte
 * sbagliata.
 */
export const CONTACT_WARNINGS: Record<string, {
  text: string; icon: string; level: 'grave' | 'avviso';
}> = {
  INVALID: {
    text: 'il telefono sull\'appuntamento non è un numero valido: il messaggio non può partire',
    icon: 'phone_disabled',
    level: 'grave',
  },
  NO_CONTACT: {
    text: 'in anagrafica non c\'è né cellulare né telefono: aggiungilo per poterlo avvisare',
    icon: 'contact_phone',
    level: 'grave',
  },
  UNKNOWN: {
    text: 'recapito non verificato: l\'anagrafica non ha risposto',
    icon: 'cloud_off',
    level: 'avviso',
  },
};

export type NotificationIssueKind =
  | 'NEVER_NOTIFIED'
  | 'STALE_INFO'
  | 'CANCELLED_NOT_NOTIFIED'
  | 'STUCK';

export interface AppointmentNotificationIssue {
  appointmentId: string;
  appointmentDate: string;
  startTime: string;
  /** Quando è stato fissato, in ora dello studio. Già formattato dal backend. */
  bookedAt: string;
  /** Quando è stato disdetto. Solo sugli appuntamenti annullati. */
  cancelledAt?: string | null;
  kind: NotificationIssueKind;
  announcedFor?: string | null;
  lastMessageStatus?: string | null;
  lastMessageAt?: string | null;
  unreachable: boolean;
}

export interface PatientNotificationIssues {
  patientId?: string | null;
  patientName?: string | null;
  phoneNumber?: string | null;
  /** Se e come si può raggiungere. MAIUSCOLO: è una enum GraphQL. */
  contactState: ContactState;
  appointments: AppointmentNotificationIssue[];
}

export interface NotificationIssueTotals {
  neverNotified: number;
  staleInfo: number;
  cancelledNotNotified: number;
  stuck: number;
  patients: number;
  outsideWindow: number;
  unreachable: number;
  unreachableUnpaid: number;
}

export interface PhoneNumberIssue {
  patientName?: string | null;
  clientPhone: string;
  appointments: number;
  patientId?: string | null;
  /** Il numero come sta in anagrafica, se ce n'è uno valido. */
  registryPhone?: string | null;
  /** Cosa c'è in anagrafica quando non è un numero utilizzabile. */
  registryPhoneDirty?: string | null;
  hasRegistryFallback: boolean;
}

export interface WhatsappDiagnostics {
  generatedAt: string;
  windowDays: number;
  uncoveredCategories: string[];
  totals: NotificationIssueTotals;
  groups: PatientNotificationIssues[];
  phoneIssues: PhoneNumberIssue[];
}

export interface ResendOutcome {
  requested: number;
  dispatched: number;
  skipped: number;
  errors: string[];
}

/**
 * Ogni problema detto come lo direbbe una persona, con accanto la conseguenza.
 *
 * La conseguenza serve a decidere: "mai avvisato" e "disdetta non comunicata"
 * sembrano simili, ma nel primo caso il paziente non sa di avere un
 * appuntamento e nel secondo si presenta a uno che non esiste — e la seconda
 * cosa fa perdere un'ora a qualcuno.
 */
export const ISSUE_LABELS: Record<NotificationIssueKind, {
  name: string; effect: string; action: string; icon: string; severity: 'alta' | 'media';
}> = {
  NEVER_NOTIFIED: {
    name: 'Mai avvisato',
    effect: 'Il paziente non sa di avere questo appuntamento.',
    action: 'Spunta la riga e premi «Rimanda le conferme».',
    icon: 'notifications_off',
    severity: 'alta',
  },
  CANCELLED_NOT_NOTIFIED: {
    name: 'Disdetto, non comunicato',
    effect: 'Si presenterà a un appuntamento che non esiste più.',
    action: 'Spunta la riga: riceverà l\'avviso di disdetta e il promemoria già in coda viene tolto.',
    icon: 'event_busy',
    severity: 'alta',
  },
  STALE_INFO: {
    name: 'Spostato, non comunicato',
    effect: 'È stato spostato, ma il paziente ha in mano l\'orario vecchio.',
    action: 'Spunta la riga: riceverà la conferma con la data aggiornata.',
    icon: 'update_disabled',
    severity: 'alta',
  },
  // "Bloccato" non diceva niente a nessuno — nemmeno a chi ha scritto il
  // sistema. Il fatto è questo: il messaggio è stato preso in carico e
  // consegnato al gateway, e da lì non è mai uscito verso WhatsApp. Per chi
  // legge cambia poco il perché: cambia che il paziente non l'ha ricevuto e
  // che si ripara rimandandolo.
  STUCK: {
    name: 'Preso in carico, mai partito',
    effect: 'Il sistema l\'aveva accettato, ma da WhatsApp non è mai uscito: il paziente non l\'ha ricevuto.',
    action: 'Spunta la riga e premi «Rimanda le conferme».',
    icon: 'sync_problem',
    severity: 'media',
  },
};

/** Le stesse etichette della pagina impostazioni, per il banner. */
export const CATEGORY_NAMES: Record<string, string> = {
  confirmation: 'Conferma prenotazione',
  reminder: 'Promemoria',
  reschedule: 'Spostamento',
  cancellation: 'Disdetta',
};

export const WINDOW_CHOICES = [
  { days: 3, label: 'Ultimi 3 giorni' },
  { days: 7, label: 'Ultima settimana' },
  { days: 30, label: 'Ultimo mese' },
  { days: 365, label: 'Tutto' },
];
