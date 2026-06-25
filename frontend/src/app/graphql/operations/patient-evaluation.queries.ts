import { gql } from 'apollo-angular';

// ==================== FRAGMENTS ====================

export const EVALUATION_OBJECTIVE_FRAGMENT = gql`
  fragment EvaluationObjectiveFields on EvaluationObjective {
    id
    evaluationId
    tipo
    descrizione
    raggiunto
    dataRaggiungimento
    progressLevel
    orderIndex
    createdAt
    updatedAt
  }
`;

export const EVALUATION_TEST_FRAGMENT = gql`
  fragment EvaluationTestFields on EvaluationTest {
    id
    evaluationId
    sezione
    nome
    risultato
    superato
    dataEsecuzione
    orderIndex
    createdAt
    updatedAt
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
`;

export const EVALUATION_EXAM_FRAGMENT = gql`
  fragment EvaluationExamFields on EvaluationExam {
    id
    evaluationId
    nomeEsame
    data
    note
    orderIndex
    createdAt
    updatedAt
  }
`;

export const PATIENT_EVALUATION_FRAGMENT = gql`
  fragment PatientEvaluationFields on PatientEvaluation {
    id
    therapeuticPathId
    operatorId

    # Sezione 1: Informazioni Generali
    professione
    sportPraticati
    bmi

    # Sezione 2: Body Map
    bodyMapMarkers {
      id
      x
      y
      note
    }

    # Anamnesi Patologica Remota: spostata su PatientAnamnesis, non più qui.

    # Anamnesi Patologica Prossima
    motivoConsulto
    esordioSintomi
    statoAttualeSintomi
    fattoriAllevianti
    fattoriAggravanti
    andamentoDolore

    # Sezione 5: Esame Obiettivo
    osservazione
    palpazione
    movimentoPassivo
    movimentoAttivo
    forzaMuscolare
    equilibrio
    esameNeurologico
    limitazioniAttivita
    fattoriPrognosticiPositivi
    fattoriPrognosticiNegativi
    strategieCoping
    diagnosiFisioterapica

    # Sezione 7: Pianificazione Trattamento
    interventiProposti
    frequenzaSedute

    # Sezione 8: Monitoraggio
    outcome
    criticita

    # Audit
    createdAt
    updatedAt

    # Operator relation
    operator {
      id
      name
      surname
    }
  }
`;

export const PATIENT_EVALUATION_WITH_RELATIONS_FRAGMENT = gql`
  fragment PatientEvaluationWithRelationsFields on PatientEvaluation {
    ...PatientEvaluationFields
    objectives {
      ...EvaluationObjectiveFields
    }
    tests {
      ...EvaluationTestFields
    }
    exams {
      ...EvaluationExamFields
    }
  }
  ${PATIENT_EVALUATION_FRAGMENT}
  ${EVALUATION_OBJECTIVE_FRAGMENT}
  ${EVALUATION_TEST_FRAGMENT}
  ${EVALUATION_EXAM_FRAGMENT}
`;

// ==================== EVALUATION QUERIES ====================

export const GET_PATIENT_EVALUATION = gql`
  query GetPatientEvaluation($id: ID!) {
    patientEvaluation(id: $id) {
      ...PatientEvaluationWithRelationsFields
    }
  }
  ${PATIENT_EVALUATION_WITH_RELATIONS_FRAGMENT}
`;

export const GET_EVALUATION_BY_PATH = gql`
  query GetEvaluationByPath($pathId: ID!) {
    evaluationByPath(pathId: $pathId) {
      ...PatientEvaluationWithRelationsFields
    }
  }
  ${PATIENT_EVALUATION_WITH_RELATIONS_FRAGMENT}
`;

// ==================== OBJECTIVES QUERIES ====================

export const GET_OBJECTIVES_BY_EVALUATION = gql`
  query GetObjectivesByEvaluation($evaluationId: ID!) {
    objectivesByEvaluation(evaluationId: $evaluationId) {
      ...EvaluationObjectiveFields
    }
  }
  ${EVALUATION_OBJECTIVE_FRAGMENT}
`;

export const GET_OBJECTIVES_PROGRESS = gql`
  query GetObjectivesProgress($evaluationId: ID!) {
    objectivesProgress(evaluationId: $evaluationId) {
      total
      achieved
      percentage
    }
  }
`;

// ==================== TESTS QUERIES ====================

export const GET_TESTS_BY_EVALUATION = gql`
  query GetTestsByEvaluation($evaluationId: ID!) {
    testsByEvaluation(evaluationId: $evaluationId) {
      ...EvaluationTestFields
    }
  }
  ${EVALUATION_TEST_FRAGMENT}
`;

export const GET_TESTS_PROGRESS = gql`
  query GetTestsProgress($evaluationId: ID!) {
    testsProgress(evaluationId: $evaluationId) {
      total
      passed
      failed
      pending
      percentage
    }
  }
`;

// ==================== EXAMS QUERIES ====================

export const GET_EXAMS_BY_EVALUATION = gql`
  query GetExamsByEvaluation($evaluationId: ID!) {
    examsByEvaluation(evaluationId: $evaluationId) {
      ...EvaluationExamFields
    }
  }
  ${EVALUATION_EXAM_FRAGMENT}
`;
