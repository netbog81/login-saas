// GraphQL InputType for searching patients

import { InputType, Field, Int } from '@nestjs/graphql';
import {
  Genere,
  TipoPaziente,
  StatoAnagrafica,
  StatoPrivacy,
} from '../enums/pazienti-enums';

@InputType({ description: 'Input per ricerca/filtro pazienti' })
export class SearchPatientInput {
  // ==================== RICERCA TESTUALE ====================

  @Field({ nullable: true, description: 'Ricerca per nome (match parziale)' })
  nome?: string;

  @Field({ nullable: true, description: 'Ricerca per cognome (match parziale)' })
  cognome?: string;

  @Field({ nullable: true, description: 'Ricerca per nome completo (match parziale)' })
  nomeCompleto?: string;

  @Field({ nullable: true, description: 'Ricerca per codice fiscale (match esatto)' })
  codiceFiscale?: string;

  @Field({ nullable: true, description: 'Ricerca per telefono (match parziale)' })
  telefono?: string;

  @Field({ nullable: true, description: 'Ricerca per email (match parziale)' })
  email?: string;

  // ==================== FILTRI ====================

  @Field(() => Genere, { nullable: true, description: 'Filtra per genere' })
  genere?: Genere;

  @Field(() => TipoPaziente, { nullable: true, description: 'Filtra per tipo paziente' })
  tipoPaziente?: TipoPaziente;

  @Field(() => StatoAnagrafica, { nullable: true, description: 'Filtra per stato anagrafica' })
  statoAnagrafica?: StatoAnagrafica;

  @Field(() => StatoPrivacy, { nullable: true, description: 'Filtra per stato privacy' })
  statoPrivacy?: StatoPrivacy;

  // ==================== FILTRI DATE ====================

  @Field({ nullable: true, description: 'Filtra per data nascita minima' })
  dataNascitaMin?: Date;

  @Field({ nullable: true, description: 'Filtra per data nascita massima' })
  dataNascitaMax?: Date;

  @Field({ nullable: true, description: 'Filtra per età minima' })
  minAge?: number;

  @Field({ nullable: true, description: 'Filtra per età massima' })
  maxAge?: number;

  // ==================== FILTRI PRIVACY ====================

  @Field({ nullable: true, description: 'Filtra per consenso privacy' })
  consensoPrivacy?: boolean;

  @Field({ nullable: true, description: 'Filtra per consenso marketing' })
  consensoMarketing?: boolean;

  @Field({ nullable: true, description: 'Filtra pazienti con richiesta cancellazione' })
  richiestaCancellazione?: boolean;

  // ==================== PAGINAZIONE ====================

  @Field(() => Int, {
    nullable: true,
    description: 'Numero elementi per pagina (default: 20, max: 100)',
    defaultValue: 20,
  })
  limit?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Offset pagina (default: 0)',
    defaultValue: 0,
  })
  offset?: number;

  // ==================== ORDINAMENTO ====================

  @Field({
    nullable: true,
    description: 'Campo ordinamento (cognome, nome, dataNascita, createdAt)',
    defaultValue: 'cognome',
  })
  sortBy?: string;

  @Field({
    nullable: true,
    description: 'Direzione ordinamento (ASC o DESC)',
    defaultValue: 'ASC',
  })
  sortOrder?: 'ASC' | 'DESC';
}

@InputType({ description: 'Metadati risultato paginato' })
export class PaginationInfo {
  @Field(() => Int, { description: 'Numero totale elementi' })
  total: number;

  @Field(() => Int, { description: 'Pagina corrente (calcolata da offset/limit)' })
  page: number;

  @Field(() => Int, { description: 'Elementi per pagina' })
  limit: number;

  @Field(() => Int, { description: 'Numero totale pagine' })
  totalPages: number;

  @Field({ description: 'Ha pagina successiva' })
  hasNextPage: boolean;

  @Field({ description: 'Ha pagina precedente' })
  hasPreviousPage: boolean;
}
