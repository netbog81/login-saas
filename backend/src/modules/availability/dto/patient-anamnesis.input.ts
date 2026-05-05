import { InputType, Field, ID } from '@nestjs/graphql';

/**
 * Input per creazione nuova anamnesi paziente.
 * subjectId è l'UUID del subject del registry (= ex patientId locale).
 */
@InputType()
export class CreatePatientAnamnesisInput {
  @Field(() => ID, { description: 'subjectId del paziente nel registry' })
  subjectId: string;

  @Field(() => ID, { nullable: true, description: 'ID operatore che compila' })
  operatorId?: string;

  // ==================== ANAMNESI PATOLOGICA REMOTA ====================

  @Field({ nullable: true, description: 'Patologie pregresse' })
  patologiePregresse?: string;

  @Field({ nullable: true, description: 'Interventi chirurgici subiti' })
  interventiChirurgici?: string;

  @Field({ nullable: true, description: 'Traumi significativi' })
  traumi?: string;

  @Field(() => [String], { nullable: true, description: 'Terapia farmacologica in corso' })
  terapiaFarmacologica?: string[];

  @Field({ nullable: true, description: 'Allergie note' })
  allergie?: string;

  @Field({ nullable: true, description: 'Storia familiare / Anamnesi familiare' })
  storiaFamiliare?: string;

  // ==================== DATI SANITARI "ANAGRAFICI" ====================

  @Field({ nullable: true, description: 'Gruppo sanguigno' })
  gruppoSanguigno?: string;

  @Field({ nullable: true, description: 'Medico di base / curante' })
  medicoBase?: string;

  @Field({ nullable: true, description: 'Patologie croniche attuali' })
  patologieCroniche?: string;

  // ==================== NOTE ====================

  @Field({ nullable: true, description: 'Note generali' })
  note?: string;
}

/**
 * Input per aggiornamento anamnesi paziente.
 */
@InputType()
export class UpdatePatientAnamnesisInput {
  @Field(() => ID, { nullable: true, description: 'ID operatore che modifica' })
  operatorId?: string;

  @Field({ nullable: true, description: 'Patologie pregresse' })
  patologiePregresse?: string;

  @Field({ nullable: true, description: 'Interventi chirurgici subiti' })
  interventiChirurgici?: string;

  @Field({ nullable: true, description: 'Traumi significativi' })
  traumi?: string;

  @Field(() => [String], { nullable: true, description: 'Terapia farmacologica in corso' })
  terapiaFarmacologica?: string[];

  @Field({ nullable: true, description: 'Allergie note' })
  allergie?: string;

  @Field({ nullable: true, description: 'Storia familiare / Anamnesi familiare' })
  storiaFamiliare?: string;

  @Field({ nullable: true, description: 'Gruppo sanguigno' })
  gruppoSanguigno?: string;

  @Field({ nullable: true, description: 'Medico di base / curante' })
  medicoBase?: string;

  @Field({ nullable: true, description: 'Patologie croniche attuali' })
  patologieCroniche?: string;

  @Field({ nullable: true, description: 'Note generali' })
  note?: string;
}
