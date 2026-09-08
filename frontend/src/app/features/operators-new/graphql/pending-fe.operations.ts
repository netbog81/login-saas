import { gql } from 'apollo-angular';

/**
 * Sconto FE non incassati del paziente (allarme cartella paziente).
 *
 * Una sola query per badge e riquadro: il conteggio è `count`, l'elenco è
 * `items`. `canCollect`/`cannotCollectReason` arrivano già calcolati dal
 * backend (ruolo + canCollectPayment + impostazione tenant), la UI non
 * ricalcola nulla.
 */
export const PATIENT_PENDING_FE_COLLECTIONS = gql`
  query PatientPendingFeCollections($patientId: ID!) {
    patientPendingFeCollections(patientId: $patientId) {
      count
      totalAmount
      allowAnyOperatorCollect
      callerIsSecretary
      items {
        treatmentId
        startedAt
        status
        operatorId
        operatorName
        operatorAppUserId
        isGym
        amount
        servicesDescription
        therapeuticPathName
        canCollect
        cannotCollectReason
      }
    }
  }
`;
