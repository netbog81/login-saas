import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, IsEnum, MaxLength, IsInt } from 'class-validator';
import { TherapeuticPathStatus } from '../entities/therapeutic-path-enums';

/**
 * Input per creare un percorso terapeutico
 */
@InputType()
export class CreateTherapeuticPathInput {
  @Field(() => ID)
  @IsUUID('4', { message: 'ID paziente non valido' })
  patientId: string;

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

// NOTA: CreateDocumentInput (path_documents) rimosso — l'upload documenti
// ora passa dal modulo patient-documents (REST multipart + patient_documents).
