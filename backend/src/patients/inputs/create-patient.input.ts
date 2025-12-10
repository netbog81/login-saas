// GraphQL InputType for creating a new Patient

import { InputType, Field, Int } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import {
  Genere,
  StatoCivile,
  TipoPaziente,
  StatoAnagrafica,
  StatoPrivacy,
} from '../enums/pazienti-enums';

@InputType({ description: 'Input per creare un nuovo paziente' })
export class CreatePatientInput {
  // ==================== DATI ANAGRAFICI OBBLIGATORI ====================

  @Field({ description: 'Nome (obbligatorio)' })
  nome: string;

  @Field({ description: 'Cognome (obbligatorio)' })
  cognome: string;

  @Field(() => Genere, { description: 'Genere (obbligatorio)' })
  genere: Genere;

  @Field(() => TipoPaziente, {
    description: 'Tipo paziente (obbligatorio)',
    defaultValue: TipoPaziente.ADULTO_AUTONOMO,
  })
  tipoPaziente: TipoPaziente;

  // ==================== DATI ANAGRAFICI OPZIONALI ====================

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

  @Field(() => StatoCivile, { nullable: true, description: 'Stato civile' })
  statoCivile?: StatoCivile;

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

  @Field({ nullable: true, description: 'Codice SDI per fatturazione elettronica' })
  codiceSdi?: string;

  // ==================== WORKFLOW STATES ====================

  @Field(() => StatoAnagrafica, {
    nullable: true,
    description: 'Stato anagrafica (default: BOZZA)',
    defaultValue: StatoAnagrafica.BOZZA,
  })
  statoAnagrafica?: StatoAnagrafica;

  @Field(() => StatoPrivacy, {
    nullable: true,
    description: 'Stato privacy (default: NON_ACQUISITA)',
    defaultValue: StatoPrivacy.NON_ACQUISITA,
  })
  statoPrivacy?: StatoPrivacy;

  // ==================== PRIVACY & GDPR ====================

  @Field({ nullable: true, description: 'Consenso privacy dato', defaultValue: false })
  consensoPrivacy?: boolean;

  @Field({ nullable: true, description: 'Data consenso privacy' })
  dataConsensoPrivacy?: Date;

  @Field({ nullable: true, description: 'Consenso marketing', defaultValue: false })
  consensoMarketing?: boolean;

  @Field({ nullable: true, description: 'Consenso ricerca medica', defaultValue: false })
  consensoRicercaMedica?: boolean;

  // ==================== TRACKING FIELDS ====================

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'Contatore disdette per anno. Formato: { "2025": 3 }',
  })
  cancellationsByYear?: Record<string, number>;

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'Contatore no-show per anno. Formato: { "2025": 2 }',
  })
  noShowsByYear?: Record<string, number>;

  // ==================== CONVENZIONI ====================

  @Field(() => Int, { nullable: true, description: 'ID convenzione associata' })
  convenzioneId?: number;

  // ==================== AMMINISTRATIVO ====================

  @Field({ nullable: true, description: 'Codice paziente interno' })
  codicePaziente?: string;

  @Field({ nullable: true, description: 'Paziente attivo', defaultValue: true })
  attivo?: boolean;

  @Field({ nullable: true, description: 'Note amministrative' })
  noteAmministrative?: string;
}
