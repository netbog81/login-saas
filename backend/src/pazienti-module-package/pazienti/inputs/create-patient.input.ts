// GraphQL InputType for creating a new Patient

import { InputType, Field } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import {
  Genere,
  StatoCivile,
  TipoPaziente,
  StatoAnagrafica,
  StatoPrivacy,
} from '../enums/pazienti-enums';

@InputType({ description: 'Input for creating a new patient' })
export class CreatePatientInput {
  // ==================== DATI ANAGRAFICI OBBLIGATORI ====================

  @Field({ description: 'First name (required)' })
  name: string;

  @Field({ description: 'Last name (required)' })
  surname: string;

  @Field(() => Genere, { description: 'Gender (required)' })
  genere: Genere;

  @Field(() => TipoPaziente, {
    description: 'Patient type (required)',
    defaultValue: TipoPaziente.ADULTO_AUTONOMO,
  })
  tipoPaziente: TipoPaziente;

  // ==================== DATI ANAGRAFICI OPZIONALI ====================

  @Field({ nullable: true, description: 'Italian tax code (Codice Fiscale)' })
  codiceFiscale?: string;

  @Field({ nullable: true, description: 'Date of birth' })
  dataNascita?: Date;

  @Field({ nullable: true, description: 'City/municipality of birth' })
  comuneNascita?: string;

  @Field({ nullable: true, description: 'Country of birth (default: Italia)' })
  nazioneNascita?: string;

  @Field({ nullable: true, description: 'Foreign place of birth (if applicable)' })
  luogoNascitaEstero?: string;

  @Field(() => StatoCivile, { nullable: true, description: 'Marital status' })
  statoCivile?: StatoCivile;

  // ==================== CONTATTI ====================

  @Field({ nullable: true, description: 'Primary phone number' })
  phone?: string;

  @Field({ nullable: true, description: 'Mobile phone number' })
  cellulare?: string;

  @Field({ nullable: true, description: 'Email address' })
  email?: string;

  @Field({ nullable: true, description: 'PEC (certified email)' })
  pec?: string;

  // ==================== RESIDENZA ====================

  @Field({ nullable: true, description: 'Residential address' })
  indirizzoResidenza?: string;

  @Field({ nullable: true, description: 'City of residence' })
  comuneResidenza?: string;

  @Field({ nullable: true, description: 'Province of residence' })
  provinciaResidenza?: string;

  @Field({ nullable: true, description: 'Postal code' })
  cap?: string;

  // ==================== DATI SANITARI ====================

  @Field({ nullable: true, description: 'Italian SSN card number (Tessera Sanitaria)' })
  tesseraSanitaria?: string;

  @Field({ nullable: true, description: 'Primary doctor name' })
  medicoCurante?: string;

  @Field({ nullable: true, description: 'Medical notes and observations' })
  notes?: string;

  @Field({ nullable: true, description: 'Known allergies' })
  allergie?: string;

  @Field({ nullable: true, description: 'Current medications' })
  farmaci?: string;

  @Field({ nullable: true, description: 'Chronic pathologies' })
  patologieCroniche?: string;

  // ==================== DATI FISCALI ====================

  @Field({ nullable: true, description: 'Billing name (if different from patient)' })
  nomeFatturazione?: string;

  @Field({ nullable: true, description: 'Billing address' })
  indirizzoFatturazione?: string;

  @Field({ nullable: true, description: 'VAT number (Partita IVA)' })
  partitaIva?: string;

  @Field({ nullable: true, description: 'Billing tax code (if different from patient)' })
  codiceFiscaleFatturazione?: string;

  @Field({ nullable: true, description: 'SDI code for electronic invoicing' })
  codiceSdi?: string;

  @Field({ nullable: true, description: 'Insurance company name' })
  assicurazione?: string;

  @Field({ nullable: true, description: 'Insurance policy number' })
  numeroPolizzaAssicurativa?: string;

  // ==================== WORKFLOW STATES ====================

  @Field(() => StatoAnagrafica, {
    nullable: true,
    description: 'Patient record status (default: BOZZA)',
    defaultValue: StatoAnagrafica.BOZZA,
  })
  statoAnagrafica?: StatoAnagrafica;

  @Field(() => StatoPrivacy, {
    nullable: true,
    description: 'Privacy documents status (default: NON_ACQUISITA)',
    defaultValue: StatoPrivacy.NON_ACQUISITA,
  })
  statoPrivacy?: StatoPrivacy;

  @Field({
    nullable: true,
    description: 'Patient registration source (TELEFONO, WALK_IN, ONLINE, MEDICO)',
  })
  origine?: string;

  // ==================== PRIVACY & GDPR ====================

  @Field({ nullable: true, description: 'General GDPR consent given', defaultValue: false })
  consensoGdpr?: boolean;

  @Field({ nullable: true, description: 'Date of GDPR consent' })
  dataConsensoGdpr?: Date;

  @Field({ nullable: true, description: 'Marketing consent given', defaultValue: false })
  consensoMarketing?: boolean;

  @Field({ nullable: true, description: 'Date of marketing consent' })
  dataConsensoMarketing?: Date;

  @Field({
    nullable: true,
    description: 'Third-party data sharing consent',
    defaultValue: false,
  })
  consensoComunicazioneTerzi?: boolean;

  @Field({ nullable: true, description: 'Date of third-party consent' })
  dataConsensoTerzi?: Date;

  @Field({ nullable: true, description: 'Privacy document IDs (encrypted references)' })
  documentiPrivacy?: string;

  // ==================== TRACKING FIELDS ====================

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'Appointment cancellations counter by year. Format: { "2025": 3 }',
  })
  cancellationsByYear?: Record<string, number>;

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'No-show counter by year. Format: { "2025": 2 }',
  })
  noShowsByYear?: Record<string, number>;
}
