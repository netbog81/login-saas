import { gql } from '@apollo/client/core';

export const GET_INSTRUMENTS = gql`
  query GetInstruments($categoryId: ID, $status: InstrumentStatus) {
    instruments(categoryId: $categoryId, status: $status) {
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

export const GET_INSTRUMENT = gql`
  query GetInstrument($id: ID!) {
    instrument(id: $id) {
      id
      name
      categoryId
      category {
        id
        name
        macroCategory
        description
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

export const GET_INSTRUMENT_CATEGORIES = gql`
  query GetInstrumentCategories($macroCategory: OperatorMacroCategory) {
    instrumentCategories(macroCategory: $macroCategory) {
      id
      name
      description
      macroCategory
      isActive
      instruments {
        id
        name
        status
        isActive
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_INSTRUMENT_CATEGORY = gql`
  query GetInstrumentCategory($id: ID!) {
    instrumentCategory(id: $id) {
      id
      name
      description
      macroCategory
      isActive
      instruments {
        id
        name
        brand
        model
        status
        isActive
        color
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_AVAILABLE_INSTRUMENTS_BY_CATEGORY = gql`
  query GetAvailableInstrumentsByCategory($categoryId: ID!) {
    availableInstrumentsByCategory(categoryId: $categoryId) {
      id
      name
      brand
      model
      status
      color
    }
  }
`;
