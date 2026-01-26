import { gql } from 'apollo-angular';

// ==================== FRAGMENTS ====================

export const ANAMNESIS_OBJECTIVE_FRAGMENT = gql`
  fragment AnamnesisObjectiveFields on AnamnesisObjective {
    id
    anamnesisId
    tipo
    descrizione
    raggiunto
    dataRaggiungimento
    orderIndex
    createdAt
    updatedAt
  }
`;

export const ANAMNESIS_TEST_FRAGMENT = gql`
  fragment AnamnesisTestFields on AnamnesisTest {
    id
    anamnesisId
    sezione
    nome
    risultato
    superato
    dataEsecuzione
    orderIndex
    createdAt
    updatedAt
  }
`;

export const ANAMNESIS_EXAM_FRAGMENT = gql`
  fragment AnamnesisExamFields on AnamnesisExam {
    id
    anamnesisId
    nomeEsame
    data
    note
    orderIndex
    createdAt
    updatedAt
  }
`;

export const PATIENT_ANAMNESIS_FRAGMENT = gql`
  fragment PatientAnamnesisFields on PatientAnamnesis {
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

    # Sezione 3: Anamnesi Patologica Remota
    patologiePregresse
    interventiChirurgici
    traumi
    terapiaFarmacologica

    # Sezione 4: Anamnesi Patologica Prossima
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

export const PATIENT_ANAMNESIS_WITH_RELATIONS_FRAGMENT = gql`
  fragment PatientAnamnesisWithRelationsFields on PatientAnamnesis {
    ...PatientAnamnesisFields
    objectives {
      ...AnamnesisObjectiveFields
    }
    tests {
      ...AnamnesisTestFields
    }
    exams {
      ...AnamnesisExamFields
    }
  }
  ${PATIENT_ANAMNESIS_FRAGMENT}
  ${ANAMNESIS_OBJECTIVE_FRAGMENT}
  ${ANAMNESIS_TEST_FRAGMENT}
  ${ANAMNESIS_EXAM_FRAGMENT}
`;

// ==================== ANAMNESIS QUERIES ====================

export const GET_PATIENT_ANAMNESIS = gql`
  query GetPatientAnamnesis($id: ID!) {
    patientAnamnesis(id: $id) {
      ...PatientAnamnesisWithRelationsFields
    }
  }
  ${PATIENT_ANAMNESIS_WITH_RELATIONS_FRAGMENT}
`;

export const GET_ANAMNESIS_BY_PATH = gql`
  query GetAnamnesisByPath($pathId: ID!) {
    anamnesisByPath(pathId: $pathId) {
      ...PatientAnamnesisWithRelationsFields
    }
  }
  ${PATIENT_ANAMNESIS_WITH_RELATIONS_FRAGMENT}
`;

// ==================== OBJECTIVES QUERIES ====================

export const GET_OBJECTIVES_BY_ANAMNESIS = gql`
  query GetObjectivesByAnamnesis($anamnesisId: ID!) {
    objectivesByAnamnesis(anamnesisId: $anamnesisId) {
      ...AnamnesisObjectiveFields
    }
  }
  ${ANAMNESIS_OBJECTIVE_FRAGMENT}
`;

export const GET_OBJECTIVES_PROGRESS = gql`
  query GetObjectivesProgress($anamnesisId: ID!) {
    objectivesProgress(anamnesisId: $anamnesisId) {
      total
      achieved
      percentage
    }
  }
`;

// ==================== TESTS QUERIES ====================

export const GET_TESTS_BY_ANAMNESIS = gql`
  query GetTestsByAnamnesis($anamnesisId: ID!) {
    testsByAnamnesis(anamnesisId: $anamnesisId) {
      ...AnamnesisTestFields
    }
  }
  ${ANAMNESIS_TEST_FRAGMENT}
`;

export const GET_TESTS_PROGRESS = gql`
  query GetTestsProgress($anamnesisId: ID!) {
    testsProgress(anamnesisId: $anamnesisId) {
      total
      passed
      failed
      pending
      percentage
    }
  }
`;

// ==================== EXAMS QUERIES ====================

export const GET_EXAMS_BY_ANAMNESIS = gql`
  query GetExamsByAnamnesis($anamnesisId: ID!) {
    examsByAnamnesis(anamnesisId: $anamnesisId) {
      ...AnamnesisExamFields
    }
  }
  ${ANAMNESIS_EXAM_FRAGMENT}
`;
