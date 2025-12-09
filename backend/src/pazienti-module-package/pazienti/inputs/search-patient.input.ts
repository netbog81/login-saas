// GraphQL InputType for searching patients

import { InputType, Field, Int } from '@nestjs/graphql';
import {
  Genere,
  TipoPaziente,
  StatoAnagrafica,
  StatoPrivacy,
} from '../enums/pazienti-enums';

@InputType({ description: 'Input for searching/filtering patients' })
export class SearchPatientInput {
  // ==================== TEXT SEARCH ====================

  @Field({ nullable: true, description: 'Search by name (partial match)' })
  name?: string;

  @Field({ nullable: true, description: 'Search by surname (partial match)' })
  surname?: string;

  @Field({ nullable: true, description: 'Search by full name (partial match)' })
  fullName?: string;

  @Field({ nullable: true, description: 'Search by Italian tax code (exact match)' })
  codiceFiscale?: string;

  @Field({ nullable: true, description: 'Search by phone number (partial match)' })
  phone?: string;

  @Field({ nullable: true, description: 'Search by email (partial match)' })
  email?: string;

  // ==================== FILTERS ====================

  @Field(() => Genere, { nullable: true, description: 'Filter by gender' })
  genere?: Genere;

  @Field(() => TipoPaziente, { nullable: true, description: 'Filter by patient type' })
  tipoPaziente?: TipoPaziente;

  @Field(() => StatoAnagrafica, { nullable: true, description: 'Filter by record status' })
  statoAnagrafica?: StatoAnagrafica;

  @Field(() => StatoPrivacy, { nullable: true, description: 'Filter by privacy status' })
  statoPrivacy?: StatoPrivacy;

  // ==================== DATE RANGE FILTERS ====================

  @Field({ nullable: true, description: 'Filter by minimum date of birth' })
  dataNascitaMin?: Date;

  @Field({ nullable: true, description: 'Filter by maximum date of birth' })
  dataNascitaMax?: Date;

  @Field({ nullable: true, description: 'Filter by minimum age' })
  minAge?: number;

  @Field({ nullable: true, description: 'Filter by maximum age' })
  maxAge?: number;

  // ==================== PRIVACY FILTERS ====================

  @Field({ nullable: true, description: 'Filter by GDPR consent given' })
  consensoGdpr?: boolean;

  @Field({ nullable: true, description: 'Filter by marketing consent given' })
  consensoMarketing?: boolean;

  @Field({ nullable: true, description: 'Filter patients with deletion requested' })
  richiestaCancellazione?: boolean;

  // ==================== PAGINATION ====================

  @Field(() => Int, {
    nullable: true,
    description: 'Number of items per page (default: 20, max: 100)',
    defaultValue: 20,
  })
  limit?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Page offset (default: 0)',
    defaultValue: 0,
  })
  offset?: number;

  // ==================== SORTING ====================

  @Field({
    nullable: true,
    description: 'Sort field (surname, name, dataNascita, createdAt)',
    defaultValue: 'surname',
  })
  sortBy?: string;

  @Field({
    nullable: true,
    description: 'Sort direction (ASC or DESC)',
    defaultValue: 'ASC',
  })
  sortOrder?: 'ASC' | 'DESC';
}

@InputType({ description: 'Paginated search result metadata' })
export class PaginationInfo {
  @Field(() => Int, { description: 'Total number of items' })
  total: number;

  @Field(() => Int, { description: 'Current page (calculated from offset/limit)' })
  page: number;

  @Field(() => Int, { description: 'Items per page' })
  limit: number;

  @Field(() => Int, { description: 'Total number of pages' })
  totalPages: number;

  @Field({ description: 'Has next page' })
  hasNextPage: boolean;

  @Field({ description: 'Has previous page' })
  hasPreviousPage: boolean;
}
