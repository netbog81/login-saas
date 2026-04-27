import { gql } from 'apollo-angular';

/**
 * Profilo del chiamante: usato dal frontend per gestire visibilità
 * (PermissionsService) e ownership delle entità.
 */
export const MY_PROFILE_QUERY = gql`
  query MyProfile {
    myProfile {
      appUserId
      userType
      operatorId
      permissions
    }
  }
`;
