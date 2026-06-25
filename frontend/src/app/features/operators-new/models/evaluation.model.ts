/**
 * Evaluation Complete Model
 * Interfacce per la scheda valutazione completa a 8 sezioni
 *
 * Collegata al Percorso Terapeutico (TherapeuticPath)
 * NOTA: Rinominato da "anamnesis" a "evaluation" per chiarezza semantica
 */

// ============================================================
// INTERFACCE PRINCIPALI
// ============================================================

/**
 * Valutazione completa con tutte le 8 sezioni
 */
export interface EvaluationComplete {
  id: string;
  pathId: string;

  // Dati del percorso terapeutico, editabili inline dal modulo unificato
  // (gli altri campi del percorso vivono nei "dettagli percorso").
  pathInfo: PathInfo;

  // Sez 1: Informazioni Generali
  generalInfo: GeneralInfo;

  // Sez 2: Immagine Corporea
  bodyMap: BodyMap;

  // Sez 3: Anamnesi Patologica Remota
  remoteHistory: RemoteHistory;

  // Sez 4: Anamnesi Patologica Prossima
  recentHistory: RecentHistory;

  // Sez 5: Esame Obiettivo
  objectiveExam: ObjectiveExam;

  // Sez 6: Esami Diagnostici
  diagnosticExams: DiagnosticExam[];

  // Sez 7: Pianificazione Trattamento
  treatmentPlan: TreatmentPlan;

  // Sez 8: Monitoraggio e Rivalutazione
  monitoring: Monitoring;

  // Metadata
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: string;
  operatorName?: string;  // "Nome Cognome" dell'operatore che ha compilato
}

// ============================================================
// DATI PERCORSO TERAPEUTICO (inline nel modulo unificato)
// ============================================================

export interface PathInfo {
  nome: string;                 // obbligatorio (= TherapeuticPath.name)
  diagnosi: string | null;      // = TherapeuticPath.diagnosis
  note: string | null;          // = TherapeuticPath.notes
}

// ============================================================
// SEZIONE 1: INFORMAZIONI GENERALI
// ============================================================

export interface GeneralInfo {
  nome: string;           // auto from patient
  cognome: string;        // auto from patient
  eta: number | null;     // auto from patient.dataNascita
  sesso: string | null;   // auto from patient.genere
  professione: string | null;
  sportPraticati: string[];
  bmi: number | null;
}

// ============================================================
// SEZIONE 2: IMMAGINE CORPOREA (BODY MAP)
// ============================================================

export interface BodyMap {
  markers: BodyMapMarker[];
}

export interface BodyMapMarker {
  id: string;
  x: number;  // 0-1 normalized coordinate
  y: number;  // 0-1 normalized coordinate
  note?: string;
}

// ============================================================
// SEZIONE 3: ANAMNESI PATOLOGICA REMOTA
// ============================================================

/**
 * Anamnesi Patologica Remota. NB: questi dati sono salvati/letti dalla
 * tabella PatientAnamnesis (legata al paziente), NON dalla valutazione.
 * Il campo `note` esiste solo su PatientAnamnesis ed è mostrato nel modulo
 * unificato; gli altri campi anagrafico-sanitari (allergie, storia familiare,
 * gruppo sanguigno, ecc.) restano nei "dettagli anamnesi".
 */
export interface RemoteHistory {
  patologiePregresse: string | null;
  interventiChirurgici: string | null;
  traumi: string | null;
  terapiaFarmacologica: string[];
  note: string | null;
}

// ============================================================
// SEZIONE 4: ANAMNESI PATOLOGICA PROSSIMA
// ============================================================

export interface RecentHistory {
  motivoConsulto: string | null;
  esordioSintomi: string | null;
  statoAttualeSintomi: string | null;
  fattoriAllevianti: string[];
  fattoriAggravanti: string[];
  andamentoDolore: string | null;
}

// ============================================================
// SEZIONE 5: ESAME OBIETTIVO
// ============================================================

export interface ObjectiveExam {
  osservazione: string | null;
  palpazione: string | null;
  movimentoPassivo: string | null;
  movimentoAttivo: string | null;
  forzaMuscolare: string | null;
  equilibrio: string | null;
  testSpecifici: TestSpecifico[];
  esameNeurologico: string | null;
  limitazioniAttivita: string | null;
  fattoriPrognosticiPositivi: string | null;
  fattoriPrognosticiNegativi: string | null;
  strategieCoping: string | null;
  diagnosiFisioterapica: string | null;
}

// ============================================================
// SEZIONE 6: ESAMI DIAGNOSTICI
// ============================================================

export interface DiagnosticExam {
  id: string;
  nomeEsame: string;
  data: Date | string | null;
  note: string | null;
}

// ============================================================
// SEZIONE 7: PIANIFICAZIONE TRATTAMENTO
// ============================================================

export interface TreatmentPlan {
  obiettiviBreveTermine: Obiettivo[];
  obiettiviMedioTermine: Obiettivo[];
  obiettiviLungoTermine: Obiettivo[];
  interventiProposti: string[];
  frequenzaSedute: string | null;
}

// ============================================================
// SEZIONE 8: MONITORAGGIO E RIVALUTAZIONE
// ============================================================

export interface Monitoring {
  testSpecifici: TestSpecifico[];
  outcome: string | null;
  criticita: string[];
}

// ============================================================
// INTERFACCE CONDIVISE
// ============================================================

/**
 * Test specifico usato in Esame Obiettivo e Monitoraggio
 * Il campo 'superato' è usato per tracking nella valutazione trattamento
 */
/**
 * Entry storico valutazione test (inline per evitare circular deps)
 */
export interface TestEvaluationHistoryEntry {
  id: string;
  evaluationLevel: number;
  note?: string;
  treatmentsSinceLast: number;
  operatorName: string;
  createdAt: Date | string;
}

export interface TestSpecifico {
  id: string;
  nome: string;
  risultato: string | null;
  data: Date | string | null;
  superato?: boolean | null;
  evaluationHistory?: TestEvaluationHistoryEntry[];
}

/**
 * Obiettivo terapeutico (breve, medio, lungo termine)
 * Usato per tracking raggiungimento nella valutazione trattamento
 */
export interface Obiettivo {
  id: string;
  descrizione: string;
  raggiunto: boolean;
  dataRaggiungimento: Date | string | null;
  progressLevel?: number;
}

// ============================================================
// INTERFACCE PER INPUT (CREATE/UPDATE)
// ============================================================

/**
 * Input per creazione nuova valutazione
 * Usato nei form e nelle mutations GraphQL
 */
export interface EvaluationCreateInput {
  pathId: string;
  generalInfo: Omit<GeneralInfo, 'nome' | 'cognome' | 'eta' | 'sesso'> & {
    professione: string | null;
    sportPraticati: string[];
    bmi: number | null;
  };
  bodyMap: BodyMap;
  remoteHistory: RemoteHistory;
  recentHistory: RecentHistory;
  objectiveExam: Omit<ObjectiveExam, 'testSpecifici'> & {
    testSpecifici: Omit<TestSpecifico, 'id'>[];
  };
  diagnosticExams: Omit<DiagnosticExam, 'id'>[];
  treatmentPlan: Omit<TreatmentPlan, 'obiettiviBreveTermine' | 'obiettiviMedioTermine' | 'obiettiviLungoTermine'> & {
    obiettiviBreveTermine: Omit<Obiettivo, 'id'>[];
    obiettiviMedioTermine: Omit<Obiettivo, 'id'>[];
    obiettiviLungoTermine: Omit<Obiettivo, 'id'>[];
  };
  monitoring: Omit<Monitoring, 'testSpecifici'> & {
    testSpecifici: Omit<TestSpecifico, 'id'>[];
  };
}

/**
 * Input per aggiornamento valutazione esistente
 */
export interface EvaluationUpdateInput extends Partial<EvaluationCreateInput> {
  id: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Crea una valutazione vuota con valori di default
 */
export function createEmptyEvaluation(pathId: string): Omit<EvaluationComplete, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> {
  return {
    pathId,
    pathInfo: {
      nome: '',
      diagnosi: null,
      note: null
    },
    generalInfo: {
      nome: '',
      cognome: '',
      eta: null,
      sesso: null,
      professione: null,
      sportPraticati: [],
      bmi: null
    },
    bodyMap: {
      markers: []
    },
    remoteHistory: {
      patologiePregresse: null,
      interventiChirurgici: null,
      traumi: null,
      terapiaFarmacologica: [],
      note: null
    },
    recentHistory: {
      motivoConsulto: null,
      esordioSintomi: null,
      statoAttualeSintomi: null,
      fattoriAllevianti: [],
      fattoriAggravanti: [],
      andamentoDolore: null
    },
    objectiveExam: {
      osservazione: null,
      palpazione: null,
      movimentoPassivo: null,
      movimentoAttivo: null,
      forzaMuscolare: null,
      equilibrio: null,
      testSpecifici: [],
      esameNeurologico: null,
      limitazioniAttivita: null,
      fattoriPrognosticiPositivi: null,
      fattoriPrognosticiNegativi: null,
      strategieCoping: null,
      diagnosiFisioterapica: null
    },
    diagnosticExams: [],
    treatmentPlan: {
      obiettiviBreveTermine: [],
      obiettiviMedioTermine: [],
      obiettiviLungoTermine: [],
      interventiProposti: [],
      frequenzaSedute: null
    },
    monitoring: {
      testSpecifici: [],
      outcome: null,
      criticita: []
    }
  };
}

/**
 * Genera un ID univoco per elementi interni (markers, test, obiettivi)
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Verifica se una sezione è stata compilata
 */
export function isSectionFilled(section: unknown): boolean {
  if (!section) return false;

  if (Array.isArray(section)) {
    return section.length > 0;
  }

  if (typeof section === 'object') {
    return Object.values(section as Record<string, unknown>).some(value => {
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    });
  }

  return Boolean(section);
}

// ============================================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================================
// Manteniamo gli alias per facilitare la migrazione graduale

/** @deprecated Use EvaluationComplete instead */
export type AnamnesisComplete = EvaluationComplete;

/** @deprecated Use EvaluationCreateInput instead */
export type AnamnesisCreateInput = EvaluationCreateInput;

/** @deprecated Use EvaluationUpdateInput instead */
export type AnamnesisUpdateInput = EvaluationUpdateInput;

/** @deprecated Use createEmptyEvaluation instead */
export const createEmptyAnamnesis = createEmptyEvaluation;
