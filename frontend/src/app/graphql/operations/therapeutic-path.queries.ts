import { gql } from 'apollo-angular';

// ==================== FRAGMENTS ====================

/**
 * PatientEvaluation fragment - Valutazione del percorso terapeutico
 * (ex Anamnesi del percorso)
 *
 * NOTA: Questa è la valutazione legata al percorso terapeutico,
 * NON la nuova anamnesi paziente (che usa SimplePatientAnamnesisService)
 */
export const PATIENT_EVALUATION_FRAGMENT = gql`
  fragment PatientEvaluationFields on PatientEvaluation {
    id
    therapeuticPathId
    operatorId

    # Sezione 1: Informazioni generali
    professione
    sportPraticati
    bmi

    # Sezione 2: Immagine corporea
    bodyMapMarkers

    # Sezione 3: Anamnesi patologica remota (storico, editing in PatientAnamnesis)
    patologiePregresse
    interventiChirurgici
    traumi
    terapiaFarmacologica

    # Sezione 4: Anamnesi patologica prossima
    motivoConsulto
    esordioSintomi
    statoAttualeSintomi
    fattoriAllevianti
    fattoriAggravanti
    andamentoDolore

    # Sezione 5: Esame obiettivo
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

    # Sezione 7: Pianificazione trattamento
    interventiProposti
    frequenzaSedute

    # Sezione 8: Monitoraggio
    outcome
    criticita

    # Audit
    createdAt
    updatedAt

    # Relations
    operator {
      id
      name
      surname
    }
  }
`;

export const PATH_DOCUMENT_FRAGMENT = gql`
  fragment PathDocumentFields on PathDocument {
    id
    therapeuticPathId
    type
    category
    fileName
    originalFileName
    mimeType
    fileSize
    storagePath
    thumbnailPath
    externalDoctorName
    notes
    description
    uploadedBy
    uploadedAt
  }
`;

export const THERAPEUTIC_PATH_FRAGMENT = gql`
  fragment TherapeuticPathFields on TherapeuticPath {
    id
    patientId
    primaryOperatorId
    name
    diagnosis
    icdCode
    status
    externalDoctorName
    externalPrescriptionRef
    notes
    createdAt
    updatedAt
    closedAt
    primaryOperator {
      id
      name
      surname
    }
    patient {
      id
      nome
      cognome
      codiceFiscale
      telefono
      email
    }
  }
`;

/**
 * Fragment con relazioni per TherapeuticPath
 *
 * NOTA: 'evaluations' è stato rimosso - la relazione PatientEvaluation
 * è ora 1:1 con TherapeuticPath e si carica separatamente tramite
 * evaluationByPath(pathId: ID!)
 */
export const THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT = gql`
  fragment TherapeuticPathWithRelationsFields on TherapeuticPath {
    ...TherapeuticPathFields
    documents {
      ...PathDocumentFields
    }
  }
  ${THERAPEUTIC_PATH_FRAGMENT}
  ${PATH_DOCUMENT_FRAGMENT}
`;

// ==================== PATH QUERIES ====================

export const GET_THERAPEUTIC_PATH = gql`
  query GetTherapeuticPath($id: ID!) {
    therapeuticPath(id: $id) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

export const GET_THERAPEUTIC_PATHS_BY_PATIENT = gql`
  query GetTherapeuticPathsByPatient($patientId: Int!) {
    therapeuticPathsByPatient(patientId: $patientId) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

export const GET_ACTIVE_THERAPEUTIC_PATHS_BY_PATIENT = gql`
  query GetActiveTherapeuticPathsByPatient($patientId: Int!) {
    activeTherapeuticPathsByPatient(patientId: $patientId) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

export const GET_THERAPEUTIC_PATHS_BY_OPERATOR = gql`
  query GetTherapeuticPathsByOperator($operatorId: ID!) {
    therapeuticPathsByOperator(operatorId: $operatorId) {
      ...TherapeuticPathWithRelationsFields
    }
  }
  ${THERAPEUTIC_PATH_WITH_RELATIONS_FRAGMENT}
`;

// ==================== EVALUATION QUERIES ====================

export const GET_PATIENT_EVALUATION = gql`
  query GetPatientEvaluation($id: ID!) {
    patientEvaluation(id: $id) {
      ...PatientEvaluationFields
    }
  }
  ${PATIENT_EVALUATION_FRAGMENT}
`;

/**
 * Query per ottenere la valutazione di un percorso terapeutico
 * Relazione 1:1 tra PatientEvaluation e TherapeuticPath
 */
export const GET_EVALUATION_BY_PATH = gql`
  query GetEvaluationByPath($pathId: ID!) {
    evaluationByPath(pathId: $pathId) {
      ...PatientEvaluationFields
    }
  }
  ${PATIENT_EVALUATION_FRAGMENT}
`;

// Legacy alias per compatibilità
export const GET_EVALUATIONS_BY_PATH = GET_EVALUATION_BY_PATH;

// ==================== DOCUMENT QUERIES ====================

export const GET_PATH_DOCUMENT = gql`
  query GetPathDocument($id: ID!) {
    pathDocument(id: $id) {
      ...PathDocumentFields
    }
  }
  ${PATH_DOCUMENT_FRAGMENT}
`;

export const GET_DOCUMENTS_BY_PATH = gql`
  query GetDocumentsByPath($pathId: ID!) {
    documentsByPath(pathId: $pathId) {
      ...PathDocumentFields
    }
  }
  ${PATH_DOCUMENT_FRAGMENT}
`;

export const GET_DOCUMENTS_BY_PATH_AND_CATEGORY = gql`
  query GetDocumentsByPathAndCategory($pathId: ID!, $category: DocumentCategory!) {
    documentsByPathAndCategory(pathId: $pathId, category: $category) {
      ...PathDocumentFields
    }
  }
  ${PATH_DOCUMENT_FRAGMENT}
`;
