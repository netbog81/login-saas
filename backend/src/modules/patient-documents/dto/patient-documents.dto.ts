import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  PatientDocumentCategory,
  PatientDocumentKind,
  PatientDocumentScope,
} from '../entities/patient-document-enums';

/** Filtri per l'elenco documenti di un paziente. */
@InputType()
export class PatientDocumentsFilterInput {
  @Field(() => PatientDocumentScope, { nullable: true })
  scope?: PatientDocumentScope;

  @Field(() => ID, { nullable: true })
  therapeuticPathId?: string;

  @Field(() => ID, { nullable: true })
  treatmentId?: string;

  @Field(() => PatientDocumentCategory, { nullable: true })
  category?: PatientDocumentCategory;

  @Field(() => PatientDocumentKind, { nullable: true })
  contentKind?: PatientDocumentKind;

  @Field({ nullable: true, description: 'Ricerca su nome file/note/descrizione' })
  search?: string;
}

/** Update metadati (il blob è immutabile: si ricarica, non si modifica). */
@InputType()
export class UpdatePatientDocumentInput {
  @Field(() => PatientDocumentCategory, { nullable: true })
  category?: PatientDocumentCategory;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  externalDoctorName?: string;
}

@ObjectType()
export class PatientDocumentCategoryCount {
  @Field(() => PatientDocumentCategory)
  category: PatientDocumentCategory;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class PatientDocumentKindCount {
  @Field(() => PatientDocumentKind)
  kind: PatientDocumentKind;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class PatientDocumentPathCount {
  @Field(() => ID)
  therapeuticPathId: string;

  @Field(() => Int)
  count: number;
}

/** Contatori per i badge dei filtri UI. */
@ObjectType()
export class PatientDocumentStats {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  generalCount: number;

  @Field(() => Int)
  pathCount: number;

  @Field(() => Int)
  treatmentCount: number;

  @Field(() => [PatientDocumentCategoryCount])
  byCategory: PatientDocumentCategoryCount[];

  @Field(() => [PatientDocumentKindCount])
  byKind: PatientDocumentKindCount[];

  @Field(() => [PatientDocumentPathCount])
  byPath: PatientDocumentPathCount[];
}
