// GraphQL ObjectType for Patient (Paziente)
// This represents the Patient entity in the GraphQL schema

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import {
  Genere,
  StatoCivile,
  TipoPaziente,
  StatoAnagrafica,
  StatoPrivacy,
} from '../enums/pazienti-enums';

@ObjectType({ description: 'Anagrafica paziente completa' })
export class PatientModel {
  @Field(() => ID, { description: 'ID univoco paziente' })
  id: string;

  // ==================== DATI ANAGRAFICI ====================

  @Field({ description: 'Nome' })
  nome: string;

  @Field({ description: 'Cognome' })
  cognome: string;

  @Field({ nullable: true, description: 'Codice Fiscale' })
  codiceFiscale?: string;

  @Field({ nullable: true, description: 'Data di nascita' })
  dataNascita?: Date;

  @Field({ nullable: true, description: 'Comune di nascita' })
  comuneNascita?: string;

  @Field({ nullable: true, description: 'Nazione di nascita (default: Italia)' })
  nazioneNascita?: string;

  @Field({ nullable: true, description: 'Luogo nascita estero' })
  luogoNascitaEstero?: string;

  @Field(() => Genere, { description: 'Genere' })
  genere: Genere;

  @Field(() => StatoCivile, { nullable: true, description: 'Stato civile' })
  statoCivile?: StatoCivile;

  @Field(() => TipoPaziente, { description: 'Tipo paziente (adulto, minore, con tutore, etc.)' })
  tipoPaziente: TipoPaziente;

  // ==================== CONTATTI ====================

  @Field({ nullable: true, description: 'Telefono fisso' })
  telefono?: string;

  @Field({ nullable: true, description: 'Cellulare' })
  cellulare?: string;

  @Field({ nullable: true, description: 'Email' })
  email?: string;

  @Field({ nullable: true, description: 'PEC' })
  pec?: string;

  @Field({ nullable: true, description: 'Fax' })
  fax?: string;

  // ==================== RESIDENZA ====================

  @Field({ nullable: true, description: 'Indirizzo' })
  indirizzo?: string;

  @Field({ nullable: true, description: 'Citta' })
  citta?: string;

  @Field({ nullable: true, description: 'Provincia' })
  provincia?: string;

  @Field({ nullable: true, description: 'CAP' })
  cap?: string;

  @Field({ nullable: true, description: 'Nazione residenza' })
  nazioneResidenza?: string;

  // ==================== DATI SANITARI ====================

  @Field({ nullable: true, description: 'Medico di base' })
  medicoBase?: string;

  @Field({ nullable: true, description: 'Gruppo sanguigno' })
  gruppoSanguigno?: string;

  @Field({ nullable: true, description: 'Note' })
  notes?: string;

  @Field({ nullable: true, description: 'Allergie' })
  allergie?: string;

  @Field({ nullable: true, description: 'Farmaci in uso' })
  farmaciInUso?: string;

  @Field({ nullable: true, description: 'Patologie croniche' })
  patologieCroniche?: string;

  // ==================== DATI FISCALI ====================

  @Field({ nullable: true, description: 'Codice SDI' })
  codiceSdi?: string;

  // ==================== WORKFLOW STATES ====================

  @Field(() => StatoAnagrafica, {
    description: 'Stato anagrafica (BOZZA, PARZIALE, COMPLETA, DA_VERIFICARE)',
  })
  statoAnagrafica: StatoAnagrafica;

  @Field(() => StatoPrivacy, {
    description: 'Stato privacy (NON_ACQUISITA, CARTACEA, DIGITALE, MISTA)',
  })
  statoPrivacy: StatoPrivacy;

  // ==================== PRIVACY & GDPR ====================

  @Field({ description: 'Consenso privacy dato', defaultValue: false })
  consensoPrivacy: boolean;

  @Field({ nullable: true, description: 'Data consenso privacy' })
  dataConsensoPrivacy?: Date;

  @Field({ description: 'Consenso marketing', defaultValue: false })
  consensoMarketing: boolean;

  @Field({ description: 'Consenso ricerca medica', defaultValue: false })
  consensoRicercaMedica: boolean;

  @Field({ nullable: true, description: 'Data ultima modifica privacy' })
  dataUltimaModificaPrivacy?: Date;

  @Field({ description: 'Richiesta cancellazione GDPR', defaultValue: false })
  richiestaCancellazione: boolean;

  @Field({ nullable: true, description: 'Data richiesta cancellazione' })
  dataRichiestaCancellazione?: Date;

  @Field({ nullable: true, description: 'Data anonimizzazione' })
  dataAnonimizzazione?: Date;

  @Field({ nullable: true, description: 'Conservazione dati fino a' })
  conservazioneFino?: Date;

  // ==================== TRACKING FIELDS ====================

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'Contatore disdette per anno. Formato: { "2025": 3, "2024": 1 }',
  })
  cancellationsByYear: Record<string, number>;

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'Contatore no-show per anno. Formato: { "2025": 2, "2024": 0 }',
  })
  noShowsByYear: Record<string, number>;

  // ==================== CONVENZIONI ====================

  @Field(() => Int, { nullable: true, description: 'ID convenzione associata' })
  convenzioneId?: number;

  // ==================== AMMINISTRATIVO ====================

  @Field({ nullable: true, description: 'Codice paziente interno' })
  codicePaziente?: string;

  @Field({ description: 'Paziente attivo', defaultValue: true })
  attivo: boolean;

  @Field({ nullable: true, description: 'Note amministrative' })
  noteAmministrative?: string;

  // ==================== TIMESTAMP ====================

  @Field({ description: 'Data creazione' })
  createdAt: Date;

  @Field({ description: 'Data ultima modifica' })
  updatedAt: Date;

  // ==================== COMPUTED FIELDS (via field resolvers) ====================

  @Field({ description: 'Nome completo (computed)' })
  nomeCompleto?: string;

  @Field(() => Int, { nullable: true, description: 'Eta calcolata dalla data di nascita' })
  eta?: number;

  @Field({ description: 'Ha contatto telefonico (telefono o cellulare)' })
  hasContattoTelefonico?: boolean;

  @Field({ description: 'Ha dati minimi per appuntamento' })
  isAnagraficaMinima?: boolean;

  @Field({ description: 'Puo creare appuntamenti' })
  canCreateAppuntamento?: boolean;

  @Field({ description: 'Privacy completa' })
  isPrivacyCompleta?: boolean;

  @Field({ description: 'Tutti i consensi dati' })
  hasAllConsensi?: boolean;
}
