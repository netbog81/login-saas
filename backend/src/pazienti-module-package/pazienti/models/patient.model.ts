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

@ObjectType({ description: 'Patient record with complete medical and privacy information' })
export class PatientModel {
  @Field(() => ID, { description: 'Unique patient identifier' })
  id: number;

  // ==================== DATI ANAGRAFICI ====================

  @Field({ description: 'First name' })
  name: string;

  @Field({ description: 'Last name' })
  surname: string;

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

  @Field(() => Genere, { description: 'Gender' })
  genere: Genere;

  @Field(() => StatoCivile, { nullable: true, description: 'Marital status' })
  statoCivile?: StatoCivile;

  @Field(() => TipoPaziente, { description: 'Patient type (adult, minor, with guardian, etc.)' })
  tipoPaziente: TipoPaziente;

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
    description: 'Patient record completion status (BOZZA, PARZIALE, COMPLETA, DA_VERIFICARE)',
  })
  statoAnagrafica: StatoAnagrafica;

  @Field(() => StatoPrivacy, {
    description: 'Privacy documents status (NON_ACQUISITA, CARTACEA, DIGITALE, MISTA)',
  })
  statoPrivacy: StatoPrivacy;

  @Field({
    nullable: true,
    description: 'Patient registration source (TELEFONO, WALK_IN, ONLINE, MEDICO)',
  })
  origine?: string;

  // ==================== PRIVACY & GDPR ====================

  @Field({ description: 'General GDPR consent given', defaultValue: false })
  consensoGdpr: boolean;

  @Field({ nullable: true, description: 'Date of GDPR consent' })
  dataConsensoGdpr?: Date;

  @Field({ description: 'Marketing consent given', defaultValue: false })
  consensoMarketing: boolean;

  @Field({ nullable: true, description: 'Date of marketing consent' })
  dataConsensoMarketing?: Date;

  @Field({ description: 'Third-party data sharing consent', defaultValue: false })
  consensoComunicazioneTerzi: boolean;

  @Field({ nullable: true, description: 'Date of third-party consent' })
  dataConsensoTerzi?: Date;

  @Field({ nullable: true, description: 'Privacy document IDs (encrypted references)' })
  documentiPrivacy?: string;

  @Field({ nullable: true, description: 'Last privacy update date' })
  dataUltimaModificaPrivacy?: Date;

  @Field({ description: 'GDPR data deletion requested', defaultValue: false })
  richiestaCancellazione: boolean;

  @Field({ nullable: true, description: 'Date of deletion request' })
  dataRichiestaCancellazione?: Date;

  @Field({ nullable: true, description: 'Date of data anonymization' })
  dataAnonimizzazione?: Date;

  @Field({ nullable: true, description: 'Data retention deadline' })
  conservazioneFino?: Date;

  // ==================== TRACKING FIELDS (from agendatest) ====================

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'Appointment cancellations counter by year. Format: { "2025": 3, "2024": 1 }',
  })
  cancellationsByYear: Record<string, number>;

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'No-show counter by year. Format: { "2025": 2, "2024": 0 }',
  })
  noShowsByYear: Record<string, number>;

  // ==================== RELAZIONI ====================
  // Note: Relations are lazy-loaded, use field resolvers in the resolver

  // ==================== TIMESTAMP ====================

  @Field({ description: 'Record creation timestamp' })
  createdAt: Date;

  @Field({ description: 'Last update timestamp' })
  updatedAt: Date;

  // ==================== COMPUTED FIELDS (via field resolvers) ====================

  @Field({ description: 'Full name (computed)' })
  fullName?: string;

  @Field(() => Int, { nullable: true, description: 'Age calculated from date of birth' })
  age?: number;

  @Field({ description: 'Has at least one contact method (phone/email)' })
  hasContattoTelefonico?: boolean;

  @Field({ description: 'Has minimum required data for appointment creation' })
  isAnagraficaMinima?: boolean;

  @Field({ description: 'Can create appointments (based on status)' })
  canCreateAppuntamento?: boolean;

  @Field({ description: 'Privacy documents complete' })
  isPrivacyCompleta?: boolean;

  @Field({ description: 'All required GDPR consents given' })
  hasAllConsensi?: boolean;
}
