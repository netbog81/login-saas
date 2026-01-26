import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  AnamnesisComplete,
  BodyMapMarker,
  DiagnosticExam,
  Obiettivo,
  TestSpecifico,
} from '../features/operators-new/models/anamnesis.model';

// Queries
import {
  GET_PATIENT_ANAMNESIS,
  GET_ANAMNESIS_BY_PATH,
  GET_OBJECTIVES_BY_ANAMNESIS,
  GET_OBJECTIVES_PROGRESS,
  GET_TESTS_BY_ANAMNESIS,
  GET_TESTS_PROGRESS,
  GET_EXAMS_BY_ANAMNESIS,
} from '../graphql/operations/patient-anamnesis.queries';

// Mutations
import {
  CREATE_ANAMNESIS,
  UPDATE_ANAMNESIS,
  DELETE_ANAMNESIS,
  MARK_OBJECTIVE_ACHIEVED,
  UPDATE_TEST_RESULT,
} from '../graphql/operations/patient-anamnesis.mutations';

// ==================== BACKEND TYPES (from GraphQL) ====================
// NOTA: GraphQL enum values sono UPPERCASE sia in input che in output

type ObjectiveType = 'BREVE_TERMINE' | 'MEDIO_TERMINE' | 'LUNGO_TERMINE';
type TestSection = 'ESAME_OBIETTIVO' | 'MONITORAGGIO';

interface BackendBodyMapMarker {
  id: string;
  x: number;
  y: number;
  note?: string;
}

interface BackendAnamnesisObjective {
  id: string;
  anamnesisId: string;
  tipo: ObjectiveType;
  descrizione: string;
  raggiunto: boolean;
  dataRaggiungimento?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

interface BackendTestEvaluationHistory {
  id: string;
  evaluationLevel: number;
  note?: string;
  treatmentsSinceLast: number;
  createdAt: string;
  operator?: {
    id: string;
    name: string;
    surname: string;
  };
}

interface BackendAnamnesisTest {
  id: string;
  anamnesisId: string;
  sezione: TestSection;
  nome: string;
  risultato?: string;
  superato?: boolean;
  dataEsecuzione?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  evaluationHistory?: BackendTestEvaluationHistory[];
}

interface BackendAnamnesisExam {
  id: string;
  anamnesisId: string;
  nomeEsame: string;
  data?: string;
  note?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

interface BackendPatientAnamnesis {
  id: string;
  therapeuticPathId: string;
  operatorId: string;

  // Sezione 1
  professione?: string;
  sportPraticati?: string[];
  bmi?: number;

  // Sezione 2
  bodyMapMarkers?: BackendBodyMapMarker[];

  // Sezione 3
  patologiePregresse?: string;
  interventiChirurgici?: string;
  traumi?: string;
  terapiaFarmacologica?: string[];

  // Sezione 4
  motivoConsulto?: string;
  esordioSintomi?: string;
  statoAttualeSintomi?: string;
  fattoriAllevianti?: string[];
  fattoriAggravanti?: string[];
  andamentoDolore?: string;

  // Sezione 5
  osservazione?: string;
  palpazione?: string;
  movimentoPassivo?: string;
  movimentoAttivo?: string;
  forzaMuscolare?: string;
  equilibrio?: string;
  esameNeurologico?: string;
  limitazioniAttivita?: string;
  fattoriPrognosticiPositivi?: string;
  fattoriPrognosticiNegativi?: string;
  strategieCoping?: string;
  diagnosiFisioterapica?: string;

  // Sezione 7
  interventiProposti?: string[];
  frequenzaSedute?: string;

  // Sezione 8
  outcome?: string;
  criticita?: string[];

  // Audit
  createdAt: string;
  updatedAt: string;

  // Relations
  operator?: {
    id: string;
    name: string;
    surname: string;
  };
  objectives?: BackendAnamnesisObjective[];
  tests?: BackendAnamnesisTest[];
  exams?: BackendAnamnesisExam[];
}

// ==================== INPUT TYPES ====================

export interface CreateAnamnesisInput {
  therapeuticPathId: string;
  operatorId: string;

  // Sezione 1
  professione?: string;
  sportPraticati?: string[];
  bmi?: number;

  // Sezione 2
  bodyMapMarkers?: BodyMapMarkerInput[];

  // Sezione 3
  patologiePregresse?: string;
  interventiChirurgici?: string;
  traumi?: string;
  terapiaFarmacologica?: string[];

  // Sezione 4
  motivoConsulto?: string;
  esordioSintomi?: string;
  statoAttualeSintomi?: string;
  fattoriAllevianti?: string[];
  fattoriAggravanti?: string[];
  andamentoDolore?: string;

  // Sezione 5
  osservazione?: string;
  palpazione?: string;
  movimentoPassivo?: string;
  movimentoAttivo?: string;
  forzaMuscolare?: string;
  equilibrio?: string;
  esameNeurologico?: string;
  limitazioniAttivita?: string;
  fattoriPrognosticiPositivi?: string;
  fattoriPrognosticiNegativi?: string;
  strategieCoping?: string;
  diagnosiFisioterapica?: string;

  // Sezione 6
  exams?: AnamnesisExamInput[];

  // Sezione 7
  interventiProposti?: string[];
  frequenzaSedute?: string;
  objectives?: AnamnesisObjectiveInput[];

  // Sezione 8
  outcome?: string;
  criticita?: string[];
  tests?: AnamnesisTestInput[];
}

export interface UpdateAnamnesisInput extends Partial<Omit<CreateAnamnesisInput, 'therapeuticPathId' | 'operatorId'>> {}

export interface BodyMapMarkerInput {
  id?: string;  // Optional: omit for new markers, backend will generate UUID
  x: number;
  y: number;
  note?: string;
}

export interface AnamnesisObjectiveInput {
  id?: string;
  tipo: ObjectiveType;
  descrizione: string;
  raggiunto?: boolean;
  dataRaggiungimento?: string;
  orderIndex?: number;
}

export interface AnamnesisTestInput {
  id?: string;
  sezione: TestSection;
  nome: string;
  risultato?: string;
  superato?: boolean;
  dataEsecuzione?: string;
  orderIndex?: number;
}

export interface AnamnesisExamInput {
  id?: string;
  nomeEsame: string;
  data?: string;
  note?: string;
  orderIndex?: number;
}

export interface MarkObjectiveAchievedInput {
  raggiunto: boolean;
}

export interface UpdateTestResultInput {
  risultato?: string;
  superato?: boolean;
  dataEsecuzione?: string;
}

// ==================== PROGRESS TYPES ====================

export interface ObjectivesProgress {
  total: number;
  achieved: number;
  percentage: number;
}

export interface TestsProgress {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  percentage: number;
}

// ==================== SERVICE ====================

@Injectable({
  providedIn: 'root',
})
export class PatientAnamnesisService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  // ==================== HELPER FUNCTIONS ====================

  /**
   * Converte l'anamnesi backend nel formato frontend completo
   */
  private mapBackendToFrontend(
    backend: BackendPatientAnamnesis,
    patientInfo?: { nome: string; cognome: string; eta: number | null; sesso: string | null }
  ): AnamnesisComplete {
    // Separare test per sezione (GraphQL restituisce UPPERCASE)
    const testsEsameObiettivo = (backend.tests ?? []).filter(t => t.sezione === 'ESAME_OBIETTIVO');
    const testsMonitoraggio = (backend.tests ?? []).filter(t => t.sezione === 'MONITORAGGIO');

    // Separare obiettivi per tipo (GraphQL restituisce UPPERCASE)
    const obiettiviBreve = (backend.objectives ?? []).filter(o => o.tipo === 'BREVE_TERMINE');
    const obiettiviMedio = (backend.objectives ?? []).filter(o => o.tipo === 'MEDIO_TERMINE');
    const obiettiviLungo = (backend.objectives ?? []).filter(o => o.tipo === 'LUNGO_TERMINE');

    return {
      id: backend.id,
      pathId: backend.therapeuticPathId,

      // Sezione 1: Informazioni Generali
      generalInfo: {
        nome: patientInfo?.nome ?? '',
        cognome: patientInfo?.cognome ?? '',
        eta: patientInfo?.eta ?? null,
        sesso: patientInfo?.sesso ?? null,
        professione: backend.professione ?? null,
        sportPraticati: backend.sportPraticati ?? [],
        bmi: backend.bmi ?? null,
      },

      // Sezione 2: Body Map
      bodyMap: {
        markers: (backend.bodyMapMarkers ?? []) as BodyMapMarker[],
      },

      // Sezione 3: Anamnesi Patologica Remota
      remoteHistory: {
        patologiePregresse: backend.patologiePregresse ?? null,
        interventiChirurgici: backend.interventiChirurgici ?? null,
        traumi: backend.traumi ?? null,
        terapiaFarmacologica: backend.terapiaFarmacologica ?? [],
      },

      // Sezione 4: Anamnesi Patologica Prossima
      recentHistory: {
        motivoConsulto: backend.motivoConsulto ?? null,
        esordioSintomi: backend.esordioSintomi ?? null,
        statoAttualeSintomi: backend.statoAttualeSintomi ?? null,
        fattoriAllevianti: backend.fattoriAllevianti ?? [],
        fattoriAggravanti: backend.fattoriAggravanti ?? [],
        andamentoDolore: backend.andamentoDolore ?? null,
      },

      // Sezione 5: Esame Obiettivo
      objectiveExam: {
        osservazione: backend.osservazione ?? null,
        palpazione: backend.palpazione ?? null,
        movimentoPassivo: backend.movimentoPassivo ?? null,
        movimentoAttivo: backend.movimentoAttivo ?? null,
        forzaMuscolare: backend.forzaMuscolare ?? null,
        equilibrio: backend.equilibrio ?? null,
        testSpecifici: testsEsameObiettivo.map(t => this.mapBackendTest(t)),
        esameNeurologico: backend.esameNeurologico ?? null,
        limitazioniAttivita: backend.limitazioniAttivita ?? null,
        fattoriPrognosticiPositivi: backend.fattoriPrognosticiPositivi ?? null,
        fattoriPrognosticiNegativi: backend.fattoriPrognosticiNegativi ?? null,
        strategieCoping: backend.strategieCoping ?? null,
        diagnosiFisioterapica: backend.diagnosiFisioterapica ?? null,
      },

      // Sezione 6: Esami Diagnostici
      diagnosticExams: (backend.exams ?? []).map(e => this.mapBackendExam(e)),

      // Sezione 7: Pianificazione Trattamento
      treatmentPlan: {
        obiettiviBreveTermine: obiettiviBreve.map(o => this.mapBackendObjective(o)),
        obiettiviMedioTermine: obiettiviMedio.map(o => this.mapBackendObjective(o)),
        obiettiviLungoTermine: obiettiviLungo.map(o => this.mapBackendObjective(o)),
        interventiProposti: backend.interventiProposti ?? [],
        frequenzaSedute: backend.frequenzaSedute ?? null,
      },

      // Sezione 8: Monitoraggio
      monitoring: {
        testSpecifici: testsMonitoraggio.map(t => this.mapBackendTest(t)),
        outcome: backend.outcome ?? null,
        criticita: backend.criticita ?? [],
      },

      // Metadata
      createdAt: backend.createdAt,
      updatedAt: backend.updatedAt,
      createdBy: backend.operatorId,
      operatorName: backend.operator
        ? `${backend.operator.name} ${backend.operator.surname}`.trim()
        : undefined,
    };
  }

  private mapBackendObjective(obj: BackendAnamnesisObjective): Obiettivo {
    return {
      id: obj.id,
      descrizione: obj.descrizione,
      raggiunto: obj.raggiunto,
      dataRaggiungimento: obj.dataRaggiungimento ?? null,
    };
  }

  private mapBackendTest(test: BackendAnamnesisTest): TestSpecifico {
    return {
      id: test.id,
      nome: test.nome,
      risultato: test.risultato ?? null,
      data: test.dataEsecuzione ?? null,
      superato: test.superato ?? null,
      evaluationHistory: (test.evaluationHistory ?? []).map(entry => ({
        id: entry.id,
        evaluationLevel: entry.evaluationLevel,
        note: entry.note,
        treatmentsSinceLast: entry.treatmentsSinceLast,
        operatorName: entry.operator
          ? `${entry.operator.name} ${entry.operator.surname}`.trim()
          : 'Operatore',
        createdAt: new Date(entry.createdAt),
      })),
    };
  }

  private mapBackendExam(exam: BackendAnamnesisExam): DiagnosticExam {
    return {
      id: exam.id,
      nomeEsame: exam.nomeEsame,
      data: exam.data ?? null,
      note: exam.note ?? null,
    };
  }

  /**
   * Verifica se una stringa è un UUID v4 valido
   * Gli ID generati dal frontend (es. 1769418383768-xa1v05a) non sono UUID
   * e devono essere omessi per permettere al backend di generare un nuovo UUID
   */
  private isValidUUID(id: string): boolean {
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Regex.test(id);
  }

  /**
   * Converte anamnesi frontend in input per creazione/update
   * NOTA: Gli enum devono essere in UPPERCASE per GraphQL
   */
  mapFrontendToInput(anamnesis: AnamnesisComplete): CreateAnamnesisInput {
    // Unisci test da sezione 5 e sezione 8
    // IMPORTANTE: sezione deve essere UPPERCASE per GraphQL
    // NOTA: ID viene incluso solo se è un UUID valido (item esistente dal backend)
    const allTests: AnamnesisTestInput[] = [
      ...anamnesis.objectiveExam.testSpecifici.map((t, i) => ({
        ...(this.isValidUUID(t.id) ? { id: t.id } : {}),
        sezione: 'ESAME_OBIETTIVO' as TestSection,
        nome: t.nome,
        risultato: t.risultato ?? undefined,
        superato: t.superato ?? undefined,
        dataEsecuzione: t.data ? (typeof t.data === 'string' ? t.data : t.data.toISOString()) : undefined,
        orderIndex: i,
      })),
      ...anamnesis.monitoring.testSpecifici.map((t, i) => ({
        ...(this.isValidUUID(t.id) ? { id: t.id } : {}),
        sezione: 'MONITORAGGIO' as TestSection,
        nome: t.nome,
        risultato: t.risultato ?? undefined,
        superato: t.superato ?? undefined,
        dataEsecuzione: t.data ? (typeof t.data === 'string' ? t.data : t.data.toISOString()) : undefined,
        orderIndex: i,
      })),
    ];

    // Unisci obiettivi da sezione 7
    // IMPORTANTE: tipo deve essere UPPERCASE per GraphQL
    // NOTA: ID viene incluso solo se è un UUID valido (item esistente dal backend)
    const allObjectives: AnamnesisObjectiveInput[] = [
      ...anamnesis.treatmentPlan.obiettiviBreveTermine.map((o, i) => ({
        ...(this.isValidUUID(o.id) ? { id: o.id } : {}),
        tipo: 'BREVE_TERMINE' as ObjectiveType,
        descrizione: o.descrizione,
        raggiunto: o.raggiunto,
        dataRaggiungimento: o.dataRaggiungimento
          ? (typeof o.dataRaggiungimento === 'string' ? o.dataRaggiungimento : o.dataRaggiungimento.toISOString())
          : undefined,
        orderIndex: i,
      })),
      ...anamnesis.treatmentPlan.obiettiviMedioTermine.map((o, i) => ({
        ...(this.isValidUUID(o.id) ? { id: o.id } : {}),
        tipo: 'MEDIO_TERMINE' as ObjectiveType,
        descrizione: o.descrizione,
        raggiunto: o.raggiunto,
        dataRaggiungimento: o.dataRaggiungimento
          ? (typeof o.dataRaggiungimento === 'string' ? o.dataRaggiungimento : o.dataRaggiungimento.toISOString())
          : undefined,
        orderIndex: i,
      })),
      ...anamnesis.treatmentPlan.obiettiviLungoTermine.map((o, i) => ({
        ...(this.isValidUUID(o.id) ? { id: o.id } : {}),
        tipo: 'LUNGO_TERMINE' as ObjectiveType,
        descrizione: o.descrizione,
        raggiunto: o.raggiunto,
        dataRaggiungimento: o.dataRaggiungimento
          ? (typeof o.dataRaggiungimento === 'string' ? o.dataRaggiungimento : o.dataRaggiungimento.toISOString())
          : undefined,
        orderIndex: i,
      })),
    ];

    return {
      therapeuticPathId: anamnesis.pathId,
      operatorId: anamnesis.createdBy,

      // Sezione 1
      professione: anamnesis.generalInfo.professione ?? undefined,
      sportPraticati: anamnesis.generalInfo.sportPraticati,
      bmi: anamnesis.generalInfo.bmi ?? undefined,

      // Sezione 2 - Rimuovi __typename aggiunto da Apollo
      // NOTA: ID viene incluso solo se è un UUID valido (item esistente dal backend)
      bodyMapMarkers: anamnesis.bodyMap.markers.map(m => ({
        ...(this.isValidUUID(m.id) ? { id: m.id } : {}),
        x: m.x,
        y: m.y,
        note: m.note ?? undefined,
      })),

      // Sezione 3
      patologiePregresse: anamnesis.remoteHistory.patologiePregresse ?? undefined,
      interventiChirurgici: anamnesis.remoteHistory.interventiChirurgici ?? undefined,
      traumi: anamnesis.remoteHistory.traumi ?? undefined,
      terapiaFarmacologica: anamnesis.remoteHistory.terapiaFarmacologica,

      // Sezione 4
      motivoConsulto: anamnesis.recentHistory.motivoConsulto ?? undefined,
      esordioSintomi: anamnesis.recentHistory.esordioSintomi ?? undefined,
      statoAttualeSintomi: anamnesis.recentHistory.statoAttualeSintomi ?? undefined,
      fattoriAllevianti: anamnesis.recentHistory.fattoriAllevianti,
      fattoriAggravanti: anamnesis.recentHistory.fattoriAggravanti,
      andamentoDolore: anamnesis.recentHistory.andamentoDolore ?? undefined,

      // Sezione 5
      osservazione: anamnesis.objectiveExam.osservazione ?? undefined,
      palpazione: anamnesis.objectiveExam.palpazione ?? undefined,
      movimentoPassivo: anamnesis.objectiveExam.movimentoPassivo ?? undefined,
      movimentoAttivo: anamnesis.objectiveExam.movimentoAttivo ?? undefined,
      forzaMuscolare: anamnesis.objectiveExam.forzaMuscolare ?? undefined,
      equilibrio: anamnesis.objectiveExam.equilibrio ?? undefined,
      esameNeurologico: anamnesis.objectiveExam.esameNeurologico ?? undefined,
      limitazioniAttivita: anamnesis.objectiveExam.limitazioniAttivita ?? undefined,
      fattoriPrognosticiPositivi: anamnesis.objectiveExam.fattoriPrognosticiPositivi ?? undefined,
      fattoriPrognosticiNegativi: anamnesis.objectiveExam.fattoriPrognosticiNegativi ?? undefined,
      strategieCoping: anamnesis.objectiveExam.strategieCoping ?? undefined,
      diagnosiFisioterapica: anamnesis.objectiveExam.diagnosiFisioterapica ?? undefined,

      // Sezione 6
      // NOTA: ID viene incluso solo se è un UUID valido (item esistente dal backend)
      exams: anamnesis.diagnosticExams.map((e, i) => ({
        ...(this.isValidUUID(e.id) ? { id: e.id } : {}),
        nomeEsame: e.nomeEsame,
        data: e.data ? (typeof e.data === 'string' ? e.data : e.data.toISOString()) : undefined,
        note: e.note ?? undefined,
        orderIndex: i,
      })),

      // Sezione 7
      interventiProposti: anamnesis.treatmentPlan.interventiProposti,
      frequenzaSedute: anamnesis.treatmentPlan.frequenzaSedute ?? undefined,
      objectives: allObjectives,

      // Sezione 8
      outcome: anamnesis.monitoring.outcome ?? undefined,
      criticita: anamnesis.monitoring.criticita,
      tests: allTests,
    };
  }

  // ==================== ANAMNESIS QUERIES ====================

  /**
   * Ottiene un'anamnesi per ID
   */
  getAnamnesis(
    id: string,
    patientInfo?: { nome: string; cognome: string; eta: number | null; sesso: string | null }
  ): Observable<AnamnesisComplete | null> {
    return this.query<{ patientAnamnesis: BackendPatientAnamnesis | null }>(
      GET_PATIENT_ANAMNESIS,
      { id }
    ).pipe(
      map((result) =>
        result.patientAnamnesis
          ? this.mapBackendToFrontend(result.patientAnamnesis, patientInfo)
          : null
      )
    );
  }

  /**
   * Ottiene l'anamnesi di un percorso terapeutico
   */
  getAnamnesisByPath(
    pathId: string,
    patientInfo?: { nome: string; cognome: string; eta: number | null; sesso: string | null }
  ): Observable<AnamnesisComplete | null> {
    return this.query<{ anamnesisByPath: BackendPatientAnamnesis | null }>(
      GET_ANAMNESIS_BY_PATH,
      { pathId }
    ).pipe(
      map((result) =>
        result.anamnesisByPath
          ? this.mapBackendToFrontend(result.anamnesisByPath, patientInfo)
          : null
      )
    );
  }

  // ==================== PROGRESS QUERIES ====================

  /**
   * Ottiene il progresso degli obiettivi
   */
  getObjectivesProgress(anamnesisId: string): Observable<ObjectivesProgress> {
    return this.query<{ objectivesProgress: ObjectivesProgress }>(
      GET_OBJECTIVES_PROGRESS,
      { anamnesisId }
    ).pipe(map((result) => result.objectivesProgress));
  }

  /**
   * Ottiene il progresso dei test
   */
  getTestsProgress(anamnesisId: string): Observable<TestsProgress> {
    return this.query<{ testsProgress: TestsProgress }>(
      GET_TESTS_PROGRESS,
      { anamnesisId }
    ).pipe(map((result) => result.testsProgress));
  }

  // ==================== ANAMNESIS MUTATIONS ====================

  /**
   * Crea una nuova anamnesi
   */
  createAnamnesis(
    input: CreateAnamnesisInput,
    patientInfo?: { nome: string; cognome: string; eta: number | null; sesso: string | null }
  ): Observable<AnamnesisComplete> {
    return this.mutate<{ createAnamnesis: BackendPatientAnamnesis }>(
      CREATE_ANAMNESIS,
      { input }
    ).pipe(
      map((result) => this.mapBackendToFrontend(result.createAnamnesis, patientInfo))
    );
  }

  /**
   * Aggiorna un'anamnesi esistente
   */
  updateAnamnesis(
    id: string,
    input: UpdateAnamnesisInput,
    patientInfo?: { nome: string; cognome: string; eta: number | null; sesso: string | null }
  ): Observable<AnamnesisComplete> {
    return this.mutate<{ updateAnamnesis: BackendPatientAnamnesis }>(
      UPDATE_ANAMNESIS,
      { id, input }
    ).pipe(
      map((result) => this.mapBackendToFrontend(result.updateAnamnesis, patientInfo))
    );
  }

  /**
   * Elimina un'anamnesi
   */
  deleteAnamnesis(id: string): Observable<boolean> {
    return this.mutate<{ deleteAnamnesis: boolean }>(
      DELETE_ANAMNESIS,
      { id }
    ).pipe(map((result) => result.deleteAnamnesis));
  }

  // ==================== OBJECTIVE MUTATIONS ====================
  // Per la sezione "Valutazione Trattamento"

  /**
   * Segna un obiettivo come raggiunto/non raggiunto
   */
  markObjectiveAchieved(
    objectiveId: string,
    raggiunto: boolean
  ): Observable<Obiettivo> {
    return this.mutate<{ markObjectiveAchieved: BackendAnamnesisObjective }>(
      MARK_OBJECTIVE_ACHIEVED,
      {
        objectiveId,
        input: { raggiunto },
      }
    ).pipe(
      map((result) => this.mapBackendObjective(result.markObjectiveAchieved))
    );
  }

  // ==================== TEST MUTATIONS ====================
  // Per la sezione "Valutazione Trattamento"

  /**
   * Aggiorna il risultato di un test
   */
  updateTestResult(
    testId: string,
    input: UpdateTestResultInput
  ): Observable<TestSpecifico> {
    return this.mutate<{ updateTestResult: BackendAnamnesisTest }>(
      UPDATE_TEST_RESULT,
      { testId, input }
    ).pipe(
      map((result) => this.mapBackendTest(result.updateTestResult))
    );
  }
}
