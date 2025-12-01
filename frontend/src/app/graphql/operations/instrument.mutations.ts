import { gql } from '@apollo/client/core';

// Instrument Mutations
export const CREATE_INSTRUMENT = gql`
  mutation CreateInstrument(
    $categoryId: ID!
    $name: String!
    $brand: String
    $model: String
    $verificationExpiry: DateTime
    $technicalData: JSON
    $color: String
  ) {
    createInstrument(
      categoryId: $categoryId
      name: $name
      brand: $brand
      model: $model
      verificationExpiry: $verificationExpiry
      technicalData: $technicalData
      color: $color
    ) {
      id
      name
      categoryId
      category {
        id
        name
        macroCategory
      }
      brand
      model
      status
      isActive
      color
      verificationExpiry
      technicalData
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_INSTRUMENT = gql`
  mutation UpdateInstrument(
    $id: ID!
    $name: String
    $categoryId: ID
    $brand: String
    $model: String
    $verificationExpiry: DateTime
    $status: InstrumentStatus
    $technicalData: JSON
    $color: String
    $isActive: Boolean
  ) {
    updateInstrument(
      id: $id
      name: $name
      categoryId: $categoryId
      brand: $brand
      model: $model
      verificationExpiry: $verificationExpiry
      status: $status
      technicalData: $technicalData
      color: $color
      isActive: $isActive
    ) {
      id
      name
      categoryId
      category {
        id
        name
        macroCategory
      }
      brand
      model
      status
      isActive
      color
      verificationExpiry
      technicalData
      createdAt
      updatedAt
    }
  }
`;

export const SET_INSTRUMENT_STATUS = gql`
  mutation SetInstrumentStatus($id: ID!, $status: InstrumentStatus!) {
    setInstrumentStatus(id: $id, status: $status) {
      id
      name
      status
      isActive
    }
  }
`;

export const DELETE_INSTRUMENT = gql`
  mutation DeleteInstrument($id: ID!) {
    deleteInstrument(id: $id)
  }
`;

// Instrument Category Mutations
export const CREATE_INSTRUMENT_CATEGORY = gql`
  mutation CreateInstrumentCategory(
    $name: String!
    $description: String
    $macroCategory: OperatorMacroCategory
  ) {
    createInstrumentCategory(
      name: $name
      description: $description
      macroCategory: $macroCategory
    ) {
      id
      name
      description
      macroCategory
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_INSTRUMENT_CATEGORY = gql`
  mutation UpdateInstrumentCategory(
    $id: ID!
    $name: String
    $description: String
    $macroCategory: OperatorMacroCategory
    $isActive: Boolean
  ) {
    updateInstrumentCategory(
      id: $id
      name: $name
      description: $description
      macroCategory: $macroCategory
      isActive: $isActive
    ) {
      id
      name
      description
      macroCategory
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_INSTRUMENT_CATEGORY = gql`
  mutation DeleteInstrumentCategory($id: ID!) {
    deleteInstrumentCategory(id: $id)
  }
`;
