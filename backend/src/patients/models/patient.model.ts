import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

import { RegistrySubjectModel } from '../../modules/registry/models/registry-subject.model';
import { PatientAnamnesis } from '../../modules/availability/entities/patient-anamnesis.entity';
import { AttendanceStatsModel } from './attendance-stats.model';
import { PatientRelationshipModel } from './patient-relationship.model';

/**
 * Patient — façade clinica del subject del registry.
 *
 * - `id` è l'UUID del subject del registry (= PK di clinical_subject_index)
 * - `subject` è il payload completo dell'anagrafica (registry, via DataLoader)
 * - `anamnesis` sono i dati sanitari art.9 GDPR (locale, in patient_anamnesis)
 * - `attendance` sono i contatori no-show / cancellazioni (locale, aggregati da log)
 * - `relationships` sono le relazioni dal registry + flag operativi locali
 *
 * I campi sono risolti da PatientResolver (vedi resolvers/patient.resolver.ts):
 * né `subject`, né `anamnesis`, né `attendance`, né `relationships` sono
 * persistiti su questa "shell"; il PatientModel di base ha solo l'id.
 */
@ObjectType('Patient', { description: 'Façade clinica di un subject del registry' })
export class PatientModel {
  @Field(() => ID, { description: 'subjectId del paziente nel registry' })
  id: string;

  @Field(() => RegistrySubjectModel, {
    nullable: true,
    description: 'Anagrafica completa dal registry (PII). Null per orphan reference.',
  })
  subject?: RegistrySubjectModel;

  @Field(() => PatientAnamnesis, {
    nullable: true,
    description: 'Dati sanitari (art.9 GDPR) locali',
  })
  anamnesis?: PatientAnamnesis;

  @Field(() => AttendanceStatsModel, {
    description: 'Statistiche presenza (no-show, cancellazioni)',
  })
  attendance: AttendanceStatsModel;

  @Field(() => [PatientRelationshipModel], {
    description: 'Relazioni del subject (registry) + estensione locale',
  })
  relationships: PatientRelationshipModel[];

  // ==================== STATO LOCALE INDEX ====================

  @Field({ nullable: true, description: 'Display name dalla cache locale' })
  displayName?: string;

  @Field({ nullable: true, description: 'Subject attivo (cache locale)' })
  isActive?: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastSyncedAt?: Date;
}
