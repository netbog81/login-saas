import { gql } from '@apollo/client/core';

export const CREATE_SERVICE = gql`
  mutation CreateService(
    $name: String!
    $serviceCode: String!
    $description: String
    $defaultDuration: Int!
    $defaultPrice: Float
    $bufferTimeBefore: Int
    $bufferTimeAfter: Int
    $color: String
    $isActive: Boolean
    $macroCategory: OperatorMacroCategory
    $subcategoryId: ID
    $discountFE: Float
  ) {
    createService(
      name: $name
      serviceCode: $serviceCode
      description: $description
      defaultDuration: $defaultDuration
      defaultPrice: $defaultPrice
      bufferTimeBefore: $bufferTimeBefore
      bufferTimeAfter: $bufferTimeAfter
      color: $color
      isActive: $isActive
      macroCategory: $macroCategory
      subcategoryId: $subcategoryId
      discountFE: $discountFE
    ) {
      id
      name
      serviceCode
      description
      defaultDuration
      defaultPrice
      bufferTimeBefore
      bufferTimeAfter
      color
      isActive
      macroCategory
      discountFE
      subcategoryId
      subcategory {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_SERVICE = gql`
  mutation UpdateService(
    $id: ID!
    $name: String
    $serviceCode: String
    $description: String
    $defaultDuration: Int
    $defaultPrice: Float
    $bufferTimeBefore: Int
    $bufferTimeAfter: Int
    $color: String
    $isActive: Boolean
    $macroCategory: OperatorMacroCategory
    $subcategoryId: ID
    $discountFE: Float
  ) {
    updateService(
      id: $id
      name: $name
      serviceCode: $serviceCode
      description: $description
      defaultDuration: $defaultDuration
      defaultPrice: $defaultPrice
      bufferTimeBefore: $bufferTimeBefore
      bufferTimeAfter: $bufferTimeAfter
      color: $color
      isActive: $isActive
      macroCategory: $macroCategory
      subcategoryId: $subcategoryId
      discountFE: $discountFE
    ) {
      id
      name
      serviceCode
      description
      defaultDuration
      defaultPrice
      bufferTimeBefore
      bufferTimeAfter
      color
      isActive
      macroCategory
      discountFE
      subcategoryId
      subcategory {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_SERVICE = gql`
  mutation DeleteService($id: ID!) {
    deleteService(id: $id)
  }
`;

export const ASSIGN_SERVICE_TO_OPERATOR = gql`
  mutation AssignServiceToOperator(
    $operatorId: ID!
    $serviceId: ID!
    $customDuration: Int
    $customBufferTime: Int
  ) {
    assignServiceToOperator(
      operatorId: $operatorId
      serviceId: $serviceId
      customDuration: $customDuration
      customBufferTime: $customBufferTime
    ) {
      operatorId
      serviceId
      customDuration
      customBufferTime
    }
  }
`;

export const UPDATE_OPERATOR_SERVICE = gql`
  mutation UpdateOperatorService(
    $operatorId: ID!
    $serviceId: ID!
    $customDuration: Int
    $customBufferTime: Int
  ) {
    updateOperatorService(
      operatorId: $operatorId
      serviceId: $serviceId
      customDuration: $customDuration
      customBufferTime: $customBufferTime
    ) {
      operatorId
      serviceId
      customDuration
      customBufferTime
    }
  }
`;

export const REMOVE_SERVICE_FROM_OPERATOR = gql`
  mutation RemoveServiceFromOperator(
    $operatorId: ID!
    $serviceId: ID!
  ) {
    removeServiceFromOperator(
      operatorId: $operatorId
      serviceId: $serviceId
    )
  }
`;