// Frontend Patient Model - Subset essenziale dei campi backend

export interface Patient {
  // Identificazione
  id: string;
  nome: string;
  cognome: string;
  codiceFiscale?: string;

  // Contatti
  telefono?: string;
  cellulare?: string;
  email?: string;

  // Anagrafica base
  dataNascita?: Date | string;
  // GraphQL enum key names (what gets sent/received via GraphQL)
  genere?: 'MASCHIO' | 'FEMMINA' | 'ALTRO' | 'NON_SPECIFICATO';
  tipoPaziente?: 'ADULTO_AUTONOMO' | 'MINORENNE' | 'DISABILE_CON_TUTORE' | 'ANZIANO_CON_TUTORE';
  indirizzo?: string;
  citta?: string;
  cap?: string;

  // Privacy
  consensoPrivacy?: boolean;
  consensoMarketing?: boolean;

  // Stati - GraphQL enum key names
  statoAnagrafica?: 'BOZZA' | 'PARZIALE' | 'COMPLETA' | 'DA_VERIFICARE';
  statoPrivacy?: 'NON_ACQUISITA' | 'CARTACEA' | 'DIGITALE' | 'MISTA';

  // Tracking
  createdAt?: Date | string;
  updatedAt?: Date | string;

  // Computed (restituiti dal backend)
  nomeCompleto?: string;
  eta?: number;
  hasContattoTelefonico?: boolean;
  canCreateAppuntamento?: boolean;

  // Futuro
  convenzioneId?: number;

  // Note
  notes?: string;
}

// Helper functions per uso nei componenti
export function getPatientDisplayName(p: Patient): string {
  return p.nomeCompleto || `${p.nome} ${p.cognome}`;
}

export function getPatientPhone(p: Patient): string {
  return p.cellulare || p.telefono || '';
}

export function getPatientInitials(p: Patient): string {
  const nome = p.nome?.charAt(0)?.toUpperCase() || '';
  const cognome = p.cognome?.charAt(0)?.toUpperCase() || '';
  return `${nome}${cognome}`;
}

// Tipo per creazione nuovo paziente (campi minimi)
export interface CreatePatientInput {
  nome: string;
  cognome: string;
  telefono?: string;
  cellulare?: string;
  email?: string;
  dataNascita?: Date | string;
  genere?: 'MASCHIO' | 'FEMMINA' | 'ALTRO' | 'NON_SPECIFICATO';
  notes?: string;
}

// Tipo per ricerca pazienti
export interface PatientSearchParams {
  search?: string;
  statoAnagrafica?: string;
  statoPrivacy?: string;
  soloMinorenni?: boolean;
  limit?: number;
  offset?: number;
}
