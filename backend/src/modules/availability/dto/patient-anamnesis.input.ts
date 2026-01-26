import { InputType, Field, ID, Int, Float } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  MaxLength,
  ValidateNested,
  IsDateString
} from 'class-validator';
import { Type } from 'class-transformer';
import GraphQLJSON from 'graphql-type-json';
import { ObjectiveType, TestSection } from '../entities/anamnesis-enums';

// ============================================================
// INPUT PER BODY MAP MARKER
// ============================================================

@InputType()
export class BodyMapMarkerInput {
  @Field({ nullable: true, description: 'ID per update, null per create' })
  @IsOptional()
  @IsString()
  id?: string;

  @Field(() => Float)
  @IsNumber()
  x: number;

  @Field(() => Float)
  @IsNumber()
  y: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ============================================================
// INPUT PER OBIETTIVI
// ============================================================

@InputType()
export class AnamnesisObjectiveInput {
  @Field({ nullable: true, description: 'ID per update, null per create' })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @Field(() => ObjectiveType)
  @IsEnum(ObjectiveType)
  tipo: ObjectiveType;

  @Field()
  @IsString()
  @MaxLength(500)
  descrizione: string;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  raggiunto?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dataRaggiungimento?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  orderIndex?: number;
}

// ============================================================
// INPUT PER TEST
// ============================================================

@InputType()
export class AnamnesisTestInput {
  @Field({ nullable: true, description: 'ID per update, null per create' })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @Field(() => TestSection)
  @IsEnum(TestSection)
  sezione: TestSection;

  @Field()
  @IsString()
  @MaxLength(255)
  nome: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  risultato?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  superato?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dataEsecuzione?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  orderIndex?: number;
}

// ============================================================
// INPUT PER ESAMI DIAGNOSTICI
// ============================================================

@InputType()
export class AnamnesisExamInput {
  @Field({ nullable: true, description: 'ID per update, null per create' })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @Field()
  @IsString()
  @MaxLength(255)
  nomeEsame: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  data?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  orderIndex?: number;
}

// ============================================================
// INPUT PER CREARE ANAMNESI
// ============================================================

@InputType()
export class CreateAnamnesisInput {
  @Field(() => ID)
  @IsUUID('4')
  therapeuticPathId: string;

  @Field(() => ID)
  @IsUUID('4')
  operatorId: string;

  // Sezione 1: Informazioni Generali
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  professione?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  sportPraticati?: string[];

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  bmi?: number;

  // Sezione 2: Body Map
  @Field(() => [BodyMapMarkerInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BodyMapMarkerInput)
  bodyMapMarkers?: BodyMapMarkerInput[];

  // Sezione 3: Anamnesi Patologica Remota
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  patologiePregresse?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  interventiChirurgici?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  traumi?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  terapiaFarmacologica?: string[];

  // Sezione 4: Anamnesi Patologica Prossima
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  motivoConsulto?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  esordioSintomi?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  statoAttualeSintomi?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  fattoriAllevianti?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  fattoriAggravanti?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  andamentoDolore?: string;

  // Sezione 5: Esame Obiettivo
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  osservazione?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  palpazione?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  movimentoPassivo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  movimentoAttivo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  forzaMuscolare?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  equilibrio?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  esameNeurologico?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  limitazioniAttivita?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  fattoriPrognosticiPositivi?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  fattoriPrognosticiNegativi?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  strategieCoping?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosiFisioterapica?: string;

  // Sezione 6: Esami Diagnostici
  @Field(() => [AnamnesisExamInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AnamnesisExamInput)
  exams?: AnamnesisExamInput[];

  // Sezione 7: Pianificazione Trattamento
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  interventiProposti?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  frequenzaSedute?: string;

  @Field(() => [AnamnesisObjectiveInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AnamnesisObjectiveInput)
  objectives?: AnamnesisObjectiveInput[];

  // Sezione 8: Monitoraggio
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  outcome?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  criticita?: string[];

  @Field(() => [AnamnesisTestInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AnamnesisTestInput)
  tests?: AnamnesisTestInput[];
}

// ============================================================
// INPUT PER AGGIORNARE ANAMNESI
// ============================================================

@InputType()
export class UpdateAnamnesisInput {
  // Tutti i campi sono opzionali per update parziale

  // Sezione 1: Informazioni Generali
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  professione?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  sportPraticati?: string[];

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  bmi?: number;

  // Sezione 2: Body Map
  @Field(() => [BodyMapMarkerInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BodyMapMarkerInput)
  bodyMapMarkers?: BodyMapMarkerInput[];

  // Sezione 3: Anamnesi Patologica Remota
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  patologiePregresse?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  interventiChirurgici?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  traumi?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  terapiaFarmacologica?: string[];

  // Sezione 4: Anamnesi Patologica Prossima
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  motivoConsulto?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  esordioSintomi?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  statoAttualeSintomi?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  fattoriAllevianti?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  fattoriAggravanti?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  andamentoDolore?: string;

  // Sezione 5: Esame Obiettivo
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  osservazione?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  palpazione?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  movimentoPassivo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  movimentoAttivo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  forzaMuscolare?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  equilibrio?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  esameNeurologico?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  limitazioniAttivita?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  fattoriPrognosticiPositivi?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  fattoriPrognosticiNegativi?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  strategieCoping?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosiFisioterapica?: string;

  // Sezione 6: Esami Diagnostici (replace all)
  @Field(() => [AnamnesisExamInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AnamnesisExamInput)
  exams?: AnamnesisExamInput[];

  // Sezione 7: Pianificazione Trattamento
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  interventiProposti?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  frequenzaSedute?: string;

  @Field(() => [AnamnesisObjectiveInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AnamnesisObjectiveInput)
  objectives?: AnamnesisObjectiveInput[];

  // Sezione 8: Monitoraggio
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  outcome?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  criticita?: string[];

  @Field(() => [AnamnesisTestInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AnamnesisTestInput)
  tests?: AnamnesisTestInput[];
}

// ============================================================
// INPUT PER OPERAZIONI SINGOLE (Valutazione Trattamento)
// ============================================================

@InputType()
export class MarkObjectiveAchievedInput {
  @Field()
  @IsBoolean()
  raggiunto: boolean;
}

@InputType()
export class UpdateTestResultInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  risultato?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  superato?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dataEsecuzione?: string;
}
