import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, IsInt, IsEnum, MaxLength } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { TherapeuticPathStatus, DocumentType, DocumentCategory } from '../entities/therapeutic-path-enums';

/**
 * Input per creare un percorso terapeutico
 */
@InputType()
export class CreateTherapeuticPathInput {
  @Field(() => Int)
  @IsInt()
  patientId: number;

  @Field(() => ID)
  @IsUUID('4', { message: 'ID operatore non valido' })
  primaryOperatorId: string;

  @Field()
  @IsString()
  @MaxLength(255, { message: 'Il nome non può superare 255 caratteri' })
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'La diagnosi non può superare 5000 caratteri' })
  diagnosis?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Il codice ICD non può superare 20 caratteri' })
  icdCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalDoctorName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalPrescriptionRef?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

/**
 * Input per aggiornare un percorso terapeutico
 */
@InputType()
export class UpdateTherapeuticPathInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosis?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  icdCode?: string;

  @Field(() => TherapeuticPathStatus, { nullable: true })
  @IsOptional()
  @IsEnum(TherapeuticPathStatus)
  status?: TherapeuticPathStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalDoctorName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalPrescriptionRef?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

/**
 * Input per creare una valutazione (ex anamnesi)
 */
@InputType()
export class CreateEvaluationInput {
  @Field(() => ID)
  @IsUUID('4')
  therapeuticPathId: string;

  @Field(() => ID)
  @IsUUID('4')
  operatorId: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  templateId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  chiefComplaint?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  historyOfPresentIllness?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  aggravatingFactors?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  relievingFactors?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  patientGoals?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  therapistGoals?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  functionalAssessment?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  conclusions?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  fieldValues?: Record<string, unknown>;
}

/**
 * Input per aggiornare una valutazione
 */
@InputType()
export class UpdateEvaluationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  chiefComplaint?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  historyOfPresentIllness?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  aggravatingFactors?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  relievingFactors?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  patientGoals?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  therapistGoals?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  functionalAssessment?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  conclusions?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  fieldValues?: Record<string, unknown>;
}

/**
 * Input per creare un documento
 */
@InputType()
export class CreateDocumentInput {
  @Field(() => ID)
  @IsUUID('4')
  therapeuticPathId: string;

  @Field(() => DocumentType)
  @IsEnum(DocumentType)
  type: DocumentType;

  @Field(() => DocumentCategory)
  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @Field()
  @IsString()
  @MaxLength(255)
  fileName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalFileName?: string;

  @Field()
  @IsString()
  @MaxLength(100)
  mimeType: string;

  @Field(() => Int)
  @IsInt()
  fileSize: number;

  @Field()
  @IsString()
  storagePath: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  thumbnailPath?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalDoctorName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  uploadedBy?: string;
}
