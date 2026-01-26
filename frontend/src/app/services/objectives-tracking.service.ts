/**
 * Objectives Tracking Service
 * Gestisce le operazioni GraphQL per il tracking del progresso obiettivi e valutazioni test
 */

import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  ObjectiveWithProgress,
  TestWithEvaluations,
  ObjectiveProgressEntry,
  TestEvaluationEntry,
  ObjectiveType
} from '../features/operators-new/models/objectives-tracking.model';

// ==================== GraphQL Queries ====================

const GET_OBJECTIVES_WITH_HISTORY = gql`
  query GetObjectivesWithHistory($anamnesisId: ID!) {
    objectivesWithHistory(anamnesisId: $anamnesisId) {
      id
      tipo
      descrizione
      raggiunto
      dataRaggiungimento
      progressLevel
      orderIndex
      progressHistory {
        id
        previousLevel
        newLevel
        treatmentsSinceLast
        note
        createdAt
        operator {
          id
          name
          surname
        }
      }
    }
  }
`;

const GET_TESTS_WITH_HISTORY = gql`
  query GetTestsWithHistory($anamnesisId: ID!) {
    testsWithHistory(anamnesisId: $anamnesisId) {
      id
      nome
      risultato
      superato
      dataEsecuzione
      sezione
      orderIndex
      evaluationHistory {
        id
        evaluationLevel
        note
        treatmentsSinceLast
        createdAt
        operator {
          id
          name
          surname
        }
      }
    }
  }
`;

const GET_OBJECTIVE_PROGRESS_HISTORY = gql`
  query GetObjectiveProgressHistory($objectiveId: ID!) {
    objectiveProgressHistory(objectiveId: $objectiveId) {
      id
      previousLevel
      newLevel
      treatmentsSinceLast
      note
      createdAt
      operator {
        id
        name
        surname
      }
    }
  }
`;

const GET_TEST_EVALUATION_HISTORY = gql`
  query GetTestEvaluationHistory($testId: ID!) {
    testEvaluationHistory(testId: $testId) {
      id
      evaluationLevel
      note
      treatmentsSinceLast
      createdAt
      operator {
        id
        name
        surname
      }
    }
  }
`;

// ==================== GraphQL Mutations ====================

const UPDATE_OBJECTIVE_PROGRESS = gql`
  mutation UpdateObjectiveProgress(
    $objectiveId: ID!
    $pathId: ID!
    $operatorId: ID!
    $input: UpdateObjectiveProgressInput!
  ) {
    updateObjectiveProgress(
      objectiveId: $objectiveId
      pathId: $pathId
      operatorId: $operatorId
      input: $input
    ) {
      id
      progressLevel
      raggiunto
      dataRaggiungimento
    }
  }
`;

const ADD_TEST_EVALUATION = gql`
  mutation AddTestEvaluation(
    $testId: ID!
    $pathId: ID!
    $operatorId: ID!
    $input: AddTestEvaluationInput!
  ) {
    addTestEvaluation(
      testId: $testId
      pathId: $pathId
      operatorId: $operatorId
      input: $input
    ) {
      id
      risultato
      superato
      dataEsecuzione
    }
  }
`;

const EDIT_TEST_EVALUATION = gql`
  mutation EditTestEvaluation(
    $testId: ID!
    $newLevel: Int!
    $operatorId: ID!
  ) {
    editTestEvaluation(
      testId: $testId
      newLevel: $newLevel
      operatorId: $operatorId
    ) {
      id
      risultato
      superato
    }
  }
`;

const RESET_TEST_EVALUATION = gql`
  mutation ResetTestEvaluation($testId: ID!) {
    resetTestEvaluation(testId: $testId) {
      id
      risultato
      superato
      dataEsecuzione
    }
  }
`;

const DELETE_TEST = gql`
  mutation DeleteAnamnesisTest($testId: ID!, $anamnesisId: ID!) {
    deleteAnamnesisTest(testId: $testId, anamnesisId: $anamnesisId)
  }
`;

const EDIT_TEST_EVALUATION_ENTRY = gql`
  mutation EditTestEvaluationEntry(
    $evaluationHistoryId: ID!
    $evaluationLevel: Int!
    $note: String
  ) {
    editTestEvaluationEntry(
      evaluationHistoryId: $evaluationHistoryId
      evaluationLevel: $evaluationLevel
      note: $note
    ) {
      id
      evaluationLevel
      note
      createdAt
      operator {
        id
        name
        surname
      }
    }
  }
`;

const DELETE_TEST_EVALUATION_ENTRY = gql`
  mutation DeleteTestEvaluationEntry($evaluationHistoryId: ID!) {
    deleteTestEvaluationEntry(evaluationHistoryId: $evaluationHistoryId)
  }
`;

// ==================== Types ====================

interface ObjectiveBackend {
  id: string;
  tipo: string;
  descrizione: string;
  raggiunto: boolean;
  dataRaggiungimento?: string;
  progressLevel: number;
  orderIndex: number;
  progressHistory?: ProgressHistoryBackend[];
}

interface ProgressHistoryBackend {
  id: string;
  previousLevel: number;
  newLevel: number;
  treatmentsSinceLast: number;
  note?: string;
  createdAt: string;
  operator?: {
    id: string;
    name: string;
    surname: string;
  };
}

interface TestBackend {
  id: string;
  nome: string;
  risultato?: string;
  superato?: boolean;
  dataEsecuzione?: string;
  sezione: string;
  orderIndex: number;
  evaluationHistory?: EvaluationHistoryBackend[];
}

interface EvaluationHistoryBackend {
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

@Injectable({
  providedIn: 'root'
})
export class ObjectivesTrackingService {

  constructor(private apollo: Apollo) {}

  // ==================== Queries ====================

  /**
   * Ottiene gli obiettivi con il loro storico progressi
   */
  getObjectivesWithHistory(anamnesisId: string): Observable<ObjectiveWithProgress[]> {
    return this.apollo.query<{ objectivesWithHistory: ObjectiveBackend[] }>({
      query: GET_OBJECTIVES_WITH_HISTORY,
      variables: { anamnesisId },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => this.mapObjectives(result.data?.objectivesWithHistory || []))
    );
  }

  /**
   * Ottiene i test con il loro storico valutazioni
   */
  getTestsWithHistory(anamnesisId: string): Observable<TestWithEvaluations[]> {
    return this.apollo.query<{ testsWithHistory: TestBackend[] }>({
      query: GET_TESTS_WITH_HISTORY,
      variables: { anamnesisId },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => this.mapTests(result.data?.testsWithHistory || []))
    );
  }

  /**
   * Ottiene lo storico progressi di un obiettivo specifico
   */
  getObjectiveProgressHistory(objectiveId: string): Observable<ObjectiveProgressEntry[]> {
    return this.apollo.query<{ objectiveProgressHistory: ProgressHistoryBackend[] }>({
      query: GET_OBJECTIVE_PROGRESS_HISTORY,
      variables: { objectiveId },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => this.mapProgressHistory(result.data?.objectiveProgressHistory || []))
    );
  }

  /**
   * Ottiene lo storico valutazioni di un test specifico
   */
  getTestEvaluationHistory(testId: string): Observable<TestEvaluationEntry[]> {
    return this.apollo.query<{ testEvaluationHistory: EvaluationHistoryBackend[] }>({
      query: GET_TEST_EVALUATION_HISTORY,
      variables: { testId },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => this.mapEvaluationHistory(result.data?.testEvaluationHistory || []))
    );
  }

  // ==================== Mutations ====================

  /**
   * Aggiorna il progresso di un obiettivo (scala 0-5) con storico
   */
  updateObjectiveProgress(
    objectiveId: string,
    pathId: string,
    operatorId: string,
    newLevel: number,
    note?: string
  ): Observable<{ id: string; progressLevel: number; raggiunto: boolean }> {
    return this.apollo.mutate<{ updateObjectiveProgress: any }>({
      mutation: UPDATE_OBJECTIVE_PROGRESS,
      variables: {
        objectiveId,
        pathId,
        operatorId,
        input: { newLevel, note }
      }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned from updateObjectiveProgress');
        return result.data.updateObjectiveProgress;
      })
    );
  }

  /**
   * Aggiunge una nuova valutazione a un test (ripetizione) con storico
   */
  addTestEvaluation(
    testId: string,
    pathId: string,
    operatorId: string,
    evaluationLevel: number,
    note?: string
  ): Observable<{ id: string; risultato: string; superato: boolean }> {
    return this.apollo.mutate<{ addTestEvaluation: any }>({
      mutation: ADD_TEST_EVALUATION,
      variables: {
        testId,
        pathId,
        operatorId,
        input: { evaluationLevel, note }
      }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned from addTestEvaluation');
        return result.data.addTestEvaluation;
      })
    );
  }

  /**
   * Modifica l'ultima valutazione di un test (senza creare storico)
   */
  editTestEvaluation(
    testId: string,
    newLevel: number,
    operatorId: string
  ): Observable<{ id: string; risultato: string; superato: boolean }> {
    return this.apollo.mutate<{ editTestEvaluation: any }>({
      mutation: EDIT_TEST_EVALUATION,
      variables: { testId, newLevel, operatorId }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned from editTestEvaluation');
        return result.data.editTestEvaluation;
      })
    );
  }

  /**
   * Reset valutazione test (cancella storico e resetta a non valutato)
   */
  resetTestEvaluation(testId: string): Observable<{ id: string }> {
    return this.apollo.mutate<{ resetTestEvaluation: any }>({
      mutation: RESET_TEST_EVALUATION,
      variables: { testId }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned from resetTestEvaluation');
        return result.data.resetTestEvaluation;
      })
    );
  }

  /**
   * Elimina un test dall'anamnesi
   */
  deleteTest(testId: string, anamnesisId: string): Observable<boolean> {
    return this.apollo.mutate<{ deleteAnamnesisTest: boolean }>({
      mutation: DELETE_TEST,
      variables: { testId, anamnesisId }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned from deleteAnamnesisTest');
        return result.data.deleteAnamnesisTest;
      })
    );
  }

  /**
   * Modifica una singola entry dello storico valutazioni test
   */
  editTestEvaluationEntry(
    evaluationHistoryId: string,
    evaluationLevel: number,
    note?: string
  ): Observable<TestEvaluationEntry> {
    return this.apollo.mutate<{ editTestEvaluationEntry: EvaluationHistoryBackend }>({
      mutation: EDIT_TEST_EVALUATION_ENTRY,
      variables: { evaluationHistoryId, evaluationLevel, note }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned from editTestEvaluationEntry');
        return this.mapEvaluationHistory([result.data.editTestEvaluationEntry])[0];
      })
    );
  }

  /**
   * Elimina una singola entry dello storico valutazioni test
   */
  deleteTestEvaluationEntry(evaluationHistoryId: string): Observable<boolean> {
    return this.apollo.mutate<{ deleteTestEvaluationEntry: boolean }>({
      mutation: DELETE_TEST_EVALUATION_ENTRY,
      variables: { evaluationHistoryId }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned from deleteTestEvaluationEntry');
        return result.data.deleteTestEvaluationEntry;
      })
    );
  }

  // ==================== Mappers ====================

  private mapObjectives(objectives: ObjectiveBackend[]): ObjectiveWithProgress[] {
    return objectives.map(obj => ({
      id: obj.id,
      descrizione: obj.descrizione,
      raggiunto: obj.raggiunto,
      dataRaggiungimento: obj.dataRaggiungimento ? new Date(obj.dataRaggiungimento) : null,
      tipo: this.mapObjectiveType(obj.tipo),
      progressLevel: obj.progressLevel,
      progressHistory: this.mapProgressHistory(obj.progressHistory || [])
    }));
  }

  private mapObjectiveType(tipo: string): ObjectiveType {
    switch (tipo.toLowerCase()) {
      case 'breve_termine':
        return ObjectiveType.BREVE_TERMINE;
      case 'medio_termine':
        return ObjectiveType.MEDIO_TERMINE;
      case 'lungo_termine':
        return ObjectiveType.LUNGO_TERMINE;
      default:
        return ObjectiveType.BREVE_TERMINE;
    }
  }

  private mapProgressHistory(history: ProgressHistoryBackend[]): ObjectiveProgressEntry[] {
    return history.map(h => ({
      id: h.id,
      previousLevel: h.previousLevel,
      newLevel: h.newLevel,
      treatmentsSinceLast: h.treatmentsSinceLast,
      note: h.note,
      operatorName: h.operator
        ? `${h.operator.name} ${h.operator.surname}`.trim()
        : 'Operatore',
      createdAt: new Date(h.createdAt)
    }));
  }

  private mapTests(tests: TestBackend[]): TestWithEvaluations[] {
    return tests.map(test => {
      const evaluationHistory = this.mapEvaluationHistory(test.evaluationHistory || []);
      const currentLevel = this.extractCurrentLevel(test.risultato);

      return {
        id: test.id,
        nome: test.nome,
        risultato: test.risultato ?? null,
        data: test.dataEsecuzione ? new Date(test.dataEsecuzione) : null,
        superato: test.superato ?? null,
        currentLevel,
        evaluationHistory,
        canRepeat: evaluationHistory.length > 0
      };
    });
  }

  private mapEvaluationHistory(history: EvaluationHistoryBackend[]): TestEvaluationEntry[] {
    return history.map(h => ({
      id: h.id,
      evaluationLevel: h.evaluationLevel,
      note: h.note,
      treatmentsSinceLast: h.treatmentsSinceLast,
      operatorName: h.operator
        ? `${h.operator.name} ${h.operator.surname}`.trim()
        : 'Operatore',
      createdAt: new Date(h.createdAt)
    }));
  }

  /**
   * Estrae il livello numerico dal risultato (es. "4/5" -> 4)
   */
  private extractCurrentLevel(risultato?: string): number {
    if (!risultato) return 0;
    const match = risultato.match(/^(\d+)\/5$/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
