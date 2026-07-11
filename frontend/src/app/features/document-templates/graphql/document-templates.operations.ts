import { gql } from 'apollo-angular';

export const DOCUMENT_TEMPLATE_FIELDS = gql`
  fragment DocumentTemplateFields on DocumentTemplate {
    id
    name
    type
    content
    pageSettings
    isDefault
    createdAt
    updatedAt
  }
`;

export const GET_DOCUMENT_TEMPLATES = gql`
  query DocumentTemplates($type: DocumentTemplateType) {
    documentTemplates(type: $type) {
      ...DocumentTemplateFields
    }
  }
  ${DOCUMENT_TEMPLATE_FIELDS}
`;

export const GET_DOCUMENT_TEMPLATE = gql`
  query DocumentTemplate($id: ID!) {
    documentTemplate(id: $id) {
      ...DocumentTemplateFields
    }
  }
  ${DOCUMENT_TEMPLATE_FIELDS}
`;

export const GET_DEFAULT_DOCUMENT_TEMPLATE = gql`
  query DefaultDocumentTemplate($type: DocumentTemplateType!) {
    defaultDocumentTemplate(type: $type) {
      ...DocumentTemplateFields
    }
  }
  ${DOCUMENT_TEMPLATE_FIELDS}
`;

export const CREATE_DOCUMENT_TEMPLATE = gql`
  mutation CreateDocumentTemplate($input: CreateDocumentTemplateInput!) {
    createDocumentTemplate(input: $input) {
      ...DocumentTemplateFields
    }
  }
  ${DOCUMENT_TEMPLATE_FIELDS}
`;

export const UPDATE_DOCUMENT_TEMPLATE = gql`
  mutation UpdateDocumentTemplate($id: ID!, $input: UpdateDocumentTemplateInput!) {
    updateDocumentTemplate(id: $id, input: $input) {
      ...DocumentTemplateFields
    }
  }
  ${DOCUMENT_TEMPLATE_FIELDS}
`;

export const DELETE_DOCUMENT_TEMPLATE = gql`
  mutation DeleteDocumentTemplate($id: ID!) {
    deleteDocumentTemplate(id: $id)
  }
`;

/**
 * Dati del trattamento per la generazione dell'attestato di presenza.
 * APPROACH: GraphQL Fragments (architettura approccio 1) — il backend
 * risolve paziente (registry via DataLoader), appuntamento, operatore e
 * sede in una singola query.
 */
export const GET_TREATMENT_FOR_CERTIFICATE = gql`
  query TreatmentForAttendanceCertificate($id: ID!) {
    treatment(id: $id) {
      id
      appointment {
        id
        appointmentDate
        startTime
        endTime
      }
      operator {
        id
        name
        surname
        professionalTitle
        professionalRegistration
        taxCode
        vatNumber
      }
      site {
        id
        name
        address
      }
      patient {
        id
        subject {
          id
          firstName
          lastName
          taxCode
          birthDate
          birthPlace
        }
      }
      treatmentServices {
        id
        service {
          id
          name
        }
      }
    }
  }
`;
