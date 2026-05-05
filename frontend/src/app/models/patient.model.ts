// ============================================================================
// Frontend Patient Model — post-integrazione registry
//
// Il backend espone `Patient { id, subject, anamnesis, attendance, ... }`.
// Il frontend continua a leggere i campi PII direttamente sul Patient
// (es. patient.nome, patient.cognome) per minimizzare il refactor; il mapper
// `mapApiPatientToFlat` proietta `subject.firstName → nome` ecc.
// ============================================================================

export interface RegistryAddress {
  id: string;
  addressType: string;
  street?: string;
  city?: string;
  zipCode?: string;
  province?: string;
  countryCode: string;
  isPrimary: boolean;
}

export interface RegistryContact {
  id: string;
  contactType: string;
  value: string;
  label?: string;
  isPrimary: boolean;
  verified: boolean;
}

export interface RegistryPrivacyConsent {
  given: boolean;
  givenAt?: string | Date;
  revokedAt?: string | Date;
  documentRef?: string;
}

export interface RegistrySubject {
  id: string;
  subjectType: string;
  isActive: boolean;
  firstName?: string;
  lastName?: string;
  taxCode?: string;
  birthDate?: string;
  birthPlace?: string;
  birthCountry?: string;
  gender?: string;
  legalCapacity?: string;
  vatNumber?: string;
  notes?: string;
  addresses: RegistryAddress[];
  contacts: RegistryContact[];
  privacyGeneralConsent?: RegistryPrivacyConsent;
  displayName?: string;
  primaryEmail?: string;
  primaryPhone?: string;
}

export interface PatientAnamnesis {
  id: string;
  subjectId: string;
  operatorId?: string;
  gruppoSanguigno?: string;
  medicoBase?: string;
  patologieCroniche?: string;
  allergie?: string;
  terapiaFarmacologica?: string[];
  patologiePregresse?: string;
  interventiChirurgici?: string;
  traumi?: string;
  storiaFamiliare?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceStats {
  noShowsByYear: Record<string, number>;
  cancellationsByYear: Record<string, number>;
  totalNoShows: number;
  totalCancellations: number;
}

/**
 * Patient — façade frontend.
 *
 * Sotto-oggetti `subject` / `anamnesis` / `attendance` sono il contratto
 * GraphQL "ufficiale". I campi piatti (nome, cognome, telefono, ecc.) sono
 * derivati dal mapper per retro-compatibilità con i componenti Angular esistenti.
 */
export interface Patient {
  id: string;

  // ==================== SOTTO-OGGETTI (dal backend GraphQL) ====================
  subject?: RegistrySubject;
  anamnesis?: PatientAnamnesis;
  attendance?: AttendanceStats;

  // Stato cache locale
  displayName?: string;
  isActive?: boolean;
  lastSyncedAt?: string;

  // ==================== CAMPI PIATTI DERIVATI (dal mapper) ====================
  // Anagrafica (da subject)
  nome?: string;
  cognome?: string;
  codiceFiscale?: string;
  dataNascita?: Date | string;
  comuneNascita?: string;
  nazioneNascita?: string;
  genere?: 'MASCHIO' | 'FEMMINA' | 'ALTRO' | 'NON_SPECIFICATO' | 'M' | 'F' | 'X' | string;

  // Contatti (da subject.contacts)
  telefono?: string;
  cellulare?: string;
  email?: string;
  pec?: string;
  fax?: string;

  // Indirizzo (da subject.addresses primary RESIDENCE)
  indirizzo?: string;
  citta?: string;
  cap?: string;
  provincia?: string;
  nazioneResidenza?: string;
  codiceSdi?: string;

  // Capacità legale (da subject.legalCapacity)
  tipoPaziente?:
    | 'ADULT_AUTONOMOUS'
    | 'MINOR_WITH_GUARDIAN'
    | 'INCAPACITATED_WITH_GUARDIAN'
    | 'ELDERLY_WITH_GUARDIAN'
    | 'ADULTO_AUTONOMO'
    | 'MINORENNE'
    | 'DISABILE_CON_TUTORE'
    | 'ANZIANO_CON_TUTORE'
    | string;

  // Privacy (da subject.privacyGeneralConsent.given)
  consensoPrivacy?: boolean;
  // Mantenuto per back-compat UI: sempre derivato dal consenso registry.
  consensoMarketing?: boolean;
  statoPrivacy?: 'NON_ACQUISITA' | 'CARTACEA' | 'DIGITALE' | 'MISTA';
  statoAnagrafica?: 'BOZZA' | 'PARZIALE' | 'COMPLETA' | 'DA_VERIFICARE';

  // Dati sanitari (da anamnesis)
  gruppoSanguigno?: string;
  medicoBase?: string;
  allergie?: string;
  farmaciInUso?: string;
  patologieCroniche?: string;

  // Computed
  nomeCompleto?: string;
  eta?: number;
  hasContattoTelefonico?: boolean;
  canCreateAppuntamento?: boolean;

  // Tracking (da attendance)
  cancellationsByYear?: Record<string, number>;
  noShowsByYear?: Record<string, number>;

  // Note generiche
  notes?: string;

  // Timestamps
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// ============================================================================
// MAPPER — proietta subject + anamnesis sui campi piatti
// ============================================================================

function getPrimaryAddress(s?: RegistrySubject): RegistryAddress | undefined {
  if (!s?.addresses?.length) return undefined;
  return (
    s.addresses.find((a) => a.isPrimary && a.addressType === 'RESIDENCE') ||
    s.addresses.find((a) => a.isPrimary) ||
    s.addresses.find((a) => a.addressType === 'RESIDENCE') ||
    s.addresses[0]
  );
}

function getContactByType(s: RegistrySubject | undefined, type: string): string | undefined {
  if (!s?.contacts?.length) return undefined;
  const primary = s.contacts.find((c) => c.isPrimary && c.contactType === type);
  if (primary) return primary.value;
  return s.contacts.find((c) => c.contactType === type)?.value;
}

function computeEta(birthDate?: string): number | undefined {
  if (!birthDate) return undefined;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

/**
 * Riceve il payload GraphQL `Patient { id, subject, anamnesis, attendance }` e
 * popola i campi piatti per back-compat. Idempotente: se il payload non ha
 * `subject` (orphan), lascia vuoti i campi PII.
 */
export function mapApiPatientToFlat(p: Patient | null | undefined): Patient | null {
  if (!p) return null;
  const subject = p.subject;
  const anamnesis = p.anamnesis;
  const attendance = p.attendance;
  const addr = getPrimaryAddress(subject);

  const flat: Patient = {
    ...p,
    // Identità
    nome: subject?.firstName,
    cognome: subject?.lastName,
    codiceFiscale: subject?.taxCode,
    dataNascita: subject?.birthDate,
    comuneNascita: subject?.birthPlace,
    nazioneNascita: subject?.birthCountry,
    genere: subject?.gender,

    // Contatti
    telefono: getContactByType(subject, 'PHONE'),
    cellulare: getContactByType(subject, 'MOBILE'),
    email: getContactByType(subject, 'EMAIL'),
    pec: getContactByType(subject, 'PEC'),
    fax: getContactByType(subject, 'FAX'),

    // Indirizzo
    indirizzo: addr?.street,
    citta: addr?.city,
    cap: addr?.zipCode,
    provincia: addr?.province,
    nazioneResidenza: addr?.countryCode,
    codiceSdi: undefined,

    // Capacità legale
    tipoPaziente: subject?.legalCapacity,

    // Privacy
    consensoPrivacy: !!subject?.privacyGeneralConsent?.given,
    consensoMarketing: false,
    statoPrivacy: subject?.privacyGeneralConsent?.given ? 'DIGITALE' : 'NON_ACQUISITA',
    statoAnagrafica: computeStatoAnagrafica(subject),

    // Anamnesi
    gruppoSanguigno: anamnesis?.gruppoSanguigno,
    medicoBase: anamnesis?.medicoBase,
    allergie: anamnesis?.allergie,
    farmaciInUso: anamnesis?.terapiaFarmacologica?.join(', '),
    patologieCroniche: anamnesis?.patologieCroniche,

    // Computed
    nomeCompleto:
      subject?.displayName ??
      [subject?.firstName, subject?.lastName].filter(Boolean).join(' '),
    eta: computeEta(subject?.birthDate),
    hasContattoTelefonico: !!(getContactByType(subject, 'MOBILE') || getContactByType(subject, 'PHONE')),

    // Tracking
    cancellationsByYear: attendance?.cancellationsByYear,
    noShowsByYear: attendance?.noShowsByYear,

    // Display name dalla cache locale, fallback al subject
    displayName: p.displayName ?? subject?.displayName,
    isActive: p.isActive ?? subject?.isActive,
  };
  return flat;
}

function computeStatoAnagrafica(s?: RegistrySubject): Patient['statoAnagrafica'] {
  if (!s) return 'BOZZA';
  const hasName = !!(s.firstName && s.lastName);
  const hasCF = !!s.taxCode;
  const hasContact = (s.contacts || []).length > 0;
  const hasAddress = (s.addresses || []).some((a) => a.street);
  const hasPrivacy = !!s.privacyGeneralConsent?.given;
  if (!hasName) return 'BOZZA';
  if (hasName && hasCF && hasContact && hasAddress && hasPrivacy) return 'COMPLETA';
  if (hasName && hasCF) return 'PARZIALE';
  return 'BOZZA';
}

/**
 * Versione "in-place" di mapApiPatientToFlat: dato un oggetto qualsiasi che
 * include un campo `patient` (es. Treatment, Appointment, TherapeuticPath
 * dal backend), proietta i campi piatti del paziente sul sotto-oggetto in
 * modo che i componenti UI possano leggere `obj.patient.nome`, ecc.
 *
 * Usata dai service GraphQL per non costringere ogni componente a importare
 * il mapper. Pass-through se `patient` è già null/undefined.
 */
export function mapEmbeddedPatient<T extends { patient?: Patient | null }>(item: T): T {
  if (!item) return item;
  if (!item.patient) return item;
  const flat = mapApiPatientToFlat(item.patient);
  return flat ? { ...item, patient: flat } : item;
}

// ============================================================================
// HELPER LEGACY (mantenuti per back-compat)
// ============================================================================

export function getPatientDisplayName(p: Patient): string {
  return p.nomeCompleto || `${p.nome ?? ''} ${p.cognome ?? ''}`.trim() || '—';
}

export function getPatientPhone(p: Patient): string {
  return p.cellulare || p.telefono || '';
}

export function getPatientInitials(p: Patient): string {
  const nome = p.nome?.charAt(0)?.toUpperCase() || '';
  const cognome = p.cognome?.charAt(0)?.toUpperCase() || '';
  return `${nome}${cognome}`;
}

// ============================================================================
// INPUT TYPES (per mutation GraphQL)
// ============================================================================

export interface CreateRegistryAddressInput {
  addressType: string;
  street?: string;
  city?: string;
  zipCode?: string;
  province?: string;
  countryCode: string;
  isPrimary: boolean;
}

export interface CreateRegistryContactInput {
  contactType: string;
  value: string;
  label?: string;
  isPrimary: boolean;
}

export interface CreateRegistryIndividualInput {
  firstName: string;
  lastName: string;
  taxCode?: string;
  gender?: string;
  birthDate?: string;
  birthPlace?: string;
  birthCountry?: string;
  legalCapacity?: string;
  vatNumber?: string;
  notes?: string;
  addresses?: CreateRegistryAddressInput[];
  contacts?: CreateRegistryContactInput[];
}

export interface UpdateRegistryIndividualInput extends Partial<CreateRegistryIndividualInput> {
  isActive?: boolean;
}

export interface UpdatePatientAnamnesisInput {
  operatorId?: string;
  gruppoSanguigno?: string;
  medicoBase?: string;
  patologieCroniche?: string;
  allergie?: string;
  terapiaFarmacologica?: string[];
  patologiePregresse?: string;
  interventiChirurgici?: string;
  traumi?: string;
  storiaFamiliare?: string;
  note?: string;
}

export interface CreatePatientInput {
  registry: CreateRegistryIndividualInput;
  anamnesis?: UpdatePatientAnamnesisInput;
}

/**
 * Costruisce l'array `contacts` per il registry da campi piatti.
 * Trim'pa, salta valori vuoti, primary su MOBILE se c'è (altrimenti su PHONE).
 */
export function buildContactsFromFlat(p: {
  telefono?: string;
  cellulare?: string;
  email?: string;
  pec?: string;
  fax?: string;
}): CreateRegistryContactInput[] {
  const contacts: CreateRegistryContactInput[] = [];
  const cellulare = p.cellulare?.trim();
  const telefono = p.telefono?.trim();
  const email = p.email?.trim();
  const pec = p.pec?.trim();
  const fax = p.fax?.trim();
  if (cellulare) contacts.push({ contactType: 'MOBILE', value: cellulare, isPrimary: true });
  if (telefono) contacts.push({ contactType: 'PHONE', value: telefono, isPrimary: !cellulare });
  if (email) contacts.push({ contactType: 'EMAIL', value: email, isPrimary: true });
  if (pec) contacts.push({ contactType: 'PEC', value: pec, isPrimary: !email });
  if (fax) contacts.push({ contactType: 'FAX', value: fax, isPrimary: false });
  return contacts;
}

/**
 * Costruisce l'array `addresses` per il registry da campi piatti.
 * Ritorna array vuoto se nessun campo dell'indirizzo è valorizzato.
 */
export function buildAddressesFromFlat(p: {
  indirizzo?: string;
  citta?: string;
  cap?: string;
  provincia?: string;
  nazioneResidenza?: string;
}): CreateRegistryAddressInput[] {
  const street = p.indirizzo?.trim();
  const city = p.citta?.trim();
  const zipCode = p.cap?.trim();
  const province = p.provincia?.trim().toUpperCase().substring(0, 2);
  if (!street && !city && !zipCode && !province) return [];
  return [
    {
      addressType: 'RESIDENCE',
      street: street || undefined,
      city: city || undefined,
      zipCode: zipCode || undefined,
      province: province || undefined,
      countryCode: (p.nazioneResidenza?.trim() || 'IT').toUpperCase().substring(0, 2),
      isPrimary: true,
    },
  ];
}

/**
 * Helper: dato un Patient piatto con nome/cognome/telefono/ecc., costruisce
 * il payload `CreatePatientInput` strutturato per la mutation.
 */
export function buildCreatePatientInput(p: {
  nome: string;
  cognome: string;
  codiceFiscale?: string;
  dataNascita?: string;
  genere?: string;
  telefono?: string;
  cellulare?: string;
  email?: string;
  pec?: string;
  fax?: string;
  indirizzo?: string;
  citta?: string;
  cap?: string;
  provincia?: string;
  nazioneResidenza?: string;
  legalCapacity?: string;
  notes?: string;
}): CreatePatientInput {
  const contacts = buildContactsFromFlat(p);
  const addresses = buildAddressesFromFlat(p);

  return {
    registry: {
      firstName: p.nome,
      lastName: p.cognome,
      taxCode: p.codiceFiscale,
      birthDate: p.dataNascita,
      gender: mapGenereToRegistry(p.genere),
      legalCapacity: mapLegalCapacityToRegistry(p.legalCapacity),
      notes: p.notes,
      addresses: addresses.length ? addresses : undefined,
      contacts: contacts.length ? contacts : undefined,
    },
  };
}

function mapGenereToRegistry(g?: string): string | undefined {
  if (!g) return undefined;
  const u = g.toUpperCase();
  if (u === 'M' || u === 'MASCHIO' || u === 'MALE') return 'M';
  if (u === 'F' || u === 'FEMMINA' || u === 'FEMALE') return 'F';
  return 'X';
}

/**
 * Traduce i vecchi valori italiani di tipoPaziente nei valori inglesi
 * accettati dal registry (subjects.legal_capacity).
 * I valori già inglesi sono pass-through.
 */
export function mapLegalCapacityToRegistry(v?: string): string {
  if (!v) return 'ADULT_AUTONOMOUS';
  const u = v.toUpperCase();
  switch (u) {
    case 'ADULTO_AUTONOMO':
    case 'ADULT_AUTONOMOUS':
      return 'ADULT_AUTONOMOUS';
    case 'MINORENNE':
    case 'MINOR_WITH_GUARDIAN':
      return 'MINOR_WITH_GUARDIAN';
    case 'DISABILE_CON_TUTORE':
    case 'INCAPACITATED_WITH_GUARDIAN':
      return 'INCAPACITATED_WITH_GUARDIAN';
    case 'ANZIANO_CON_TUTORE':
    case 'ELDERLY_WITH_GUARDIAN':
      return 'ELDERLY_WITH_GUARDIAN';
    default:
      return 'ADULT_AUTONOMOUS';
  }
}

// Compat: PatientSearchParams del vecchio service
export interface PatientSearchParams {
  query?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  // Legacy alias mantenuti per i componenti esistenti
  search?: string;
  limit?: number;
  offset?: number;
}
