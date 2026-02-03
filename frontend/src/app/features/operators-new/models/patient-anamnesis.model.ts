/**
 * Patient Anamnesis Model
 * Interfacce per l'anamnesi del paziente (indipendente dal percorso terapeutico)
 *
 * Collegata al Paziente (Patient) con relazione 1:1
 */

/**
 * Anamnesi del paziente completa
 */
export interface PatientAnamnesis {
  id: string;
  patientId: number;

  // Anamnesi Patologica Remota
  patologiePregresse: string | null;
  interventiChirurgici: string | null;
  traumi: string | null;
  terapiaFarmacologica: string[];

  // Nuovi campi
  allergie: string | null;
  storiaFamiliare: string | null;

  // Note
  note: string | null;

  // Metadata
  createdAt: Date | string;
  updatedAt: Date | string;
  operatorId?: string;
  operatorName?: string;
}

/**
 * Input per creazione anamnesi paziente
 */
export interface CreatePatientAnamnesisInput {
  patientId: number;
  operatorId?: string;
  patologiePregresse?: string;
  interventiChirurgici?: string;
  traumi?: string;
  terapiaFarmacologica?: string[];
  allergie?: string;
  storiaFamiliare?: string;
  note?: string;
}

/**
 * Input per aggiornamento anamnesi paziente
 */
export interface UpdatePatientAnamnesisInput {
  operatorId?: string;
  patologiePregresse?: string;
  interventiChirurgici?: string;
  traumi?: string;
  terapiaFarmacologica?: string[];
  allergie?: string;
  storiaFamiliare?: string;
  note?: string;
}

/**
 * Crea un'anamnesi vuota con valori di default
 */
export function createEmptyPatientAnamnesis(patientId: number): Omit<PatientAnamnesis, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    patientId,
    patologiePregresse: null,
    interventiChirurgici: null,
    traumi: null,
    terapiaFarmacologica: [],
    allergie: null,
    storiaFamiliare: null,
    note: null,
  };
}

/**
 * Verifica se l'anamnesi è stata compilata (ha almeno un campo valorizzato)
 */
export function isAnamnesisFilled(anamnesis: PatientAnamnesis | null): boolean {
  if (!anamnesis) return false;

  return !!(
    anamnesis.patologiePregresse ||
    anamnesis.interventiChirurgici ||
    anamnesis.traumi ||
    (anamnesis.terapiaFarmacologica && anamnesis.terapiaFarmacologica.length > 0) ||
    anamnesis.allergie ||
    anamnesis.storiaFamiliare ||
    anamnesis.note
  );
}
