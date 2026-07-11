import { gql } from 'apollo-angular';

/**
 * Operations GraphQL della gestione Voucher FE (card paziente + Statistiche).
 *
 * NOTA: i nomi delle operation/fragment hanno suffisso `Manage` per non
 * collidere con quelli già definiti in `features/trattamenti/graphql/` (usati
 * dal flusso pagamento sconto FE). Vedi codegen.yml.
 */

export const VOUCHER_FE_MANAGE_FIELDS = gql`
  fragment VoucherFeManageFields on VoucherFe {
    id
    code
    patientId
    initialAmount
    residualAmount
    status
    expiryDate
    notes
    createdAt
    updatedAt
  }
`;

/** Tutti i voucher FE di un paziente (storico completo, ogni stato). */
export const VOUCHERS_FE_BY_PATIENT_MANAGE = gql`
  query VouchersFeByPatientManage($patientId: ID!) {
    vouchersFeByPatient(patientId: $patientId) {
      ...VoucherFeManageFields
    }
  }
  ${VOUCHER_FE_MANAGE_FIELDS}
`;

/** Tutti i voucher FE del tenant (Statistiche) con nome paziente. */
export const ALL_VOUCHERS_FE_MANAGE = gql`
  query AllVouchersFeManage($from: String, $to: String) {
    allVouchersFe(from: $from, to: $to) {
      ...VoucherFeManageFields
      patient {
        id
        subject {
          displayName
          firstName
          lastName
        }
      }
    }
  }
  ${VOUCHER_FE_MANAGE_FIELDS}
`;

export const ISSUE_VOUCHER_FE_MANAGE = gql`
  mutation IssueVoucherFeManage(
    $patientId: ID!
    $initialAmount: Float!
    $expiryDate: String
    $notes: String
  ) {
    issueVoucherFe(
      patientId: $patientId
      initialAmount: $initialAmount
      expiryDate: $expiryDate
      notes: $notes
    ) {
      ...VoucherFeManageFields
    }
  }
  ${VOUCHER_FE_MANAGE_FIELDS}
`;

export const UPDATE_VOUCHER_FE_AMOUNT_MANAGE = gql`
  mutation UpdateVoucherFeAmountManage($voucherFeId: ID!, $amount: Float!) {
    updateVoucherFeAmount(voucherFeId: $voucherFeId, amount: $amount) {
      ...VoucherFeManageFields
    }
  }
  ${VOUCHER_FE_MANAGE_FIELDS}
`;

export const SUSPEND_VOUCHER_FE_MANAGE = gql`
  mutation SuspendVoucherFeManage($voucherFeId: ID!) {
    suspendVoucherFe(voucherFeId: $voucherFeId) {
      ...VoucherFeManageFields
    }
  }
  ${VOUCHER_FE_MANAGE_FIELDS}
`;

export const REACTIVATE_VOUCHER_FE_MANAGE = gql`
  mutation ReactivateVoucherFeManage($voucherFeId: ID!) {
    reactivateVoucherFe(voucherFeId: $voucherFeId) {
      ...VoucherFeManageFields
    }
  }
  ${VOUCHER_FE_MANAGE_FIELDS}
`;

export const CANCEL_VOUCHER_FE_MANAGE = gql`
  mutation CancelVoucherFeManage($voucherFeId: ID!) {
    cancelVoucherFe(voucherFeId: $voucherFeId) {
      ...VoucherFeManageFields
    }
  }
  ${VOUCHER_FE_MANAGE_FIELDS}
`;
