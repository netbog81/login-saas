import { gql } from '@apollo/client/core';

export const GET_SERVICES = gql`
  query GetServices {
    services {
      id
      name
      description
      defaultDuration
      defaultPrice
      bufferTimeBefore
      bufferTimeAfter
      color
      isActive
      macroCategory
      discountFE
      serviceFee
      studioExtra
      serviceFeeFE
      studioExtraFE
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

export const GET_SERVICE = gql`
  query GetService($id: ID!) {
    service(id: $id) {
      id
      name
      description
      defaultDuration
      defaultPrice
      bufferTimeBefore
      bufferTimeAfter
      color
      isActive
      macroCategory
      discountFE
      serviceFee
      studioExtra
      serviceFeeFE
      studioExtraFE
      subcategoryId
      subcategory {
        id
        name
      }
      createdAt
      updatedAt
      operators {
        operatorId
        serviceId
        customDuration
        customBufferTime
        operator {
          id
          name
          surname
        }
      }
    }
  }
`;

export const GET_OPERATOR_SERVICES = gql`
  query GetOperatorServices($operatorId: ID!) {
    operatorServices(operatorId: $operatorId) {
      operatorId
      serviceId
      customDuration
      customBufferTime
      service {
        id
        name
        description
        defaultDuration
        defaultPrice
        bufferTimeBefore
        bufferTimeAfter
        color
        isActive
      }
    }
  }
`;

export const GET_SERVICE_OPERATORS = gql`
  query GetServiceOperators($serviceId: ID!) {
    serviceOperators(serviceId: $serviceId) {
      operatorId
      serviceId
      customDuration
      customBufferTime
      operator {
        id
        name
        surname
        email
        macroCategory
      }
    }
  }
`;