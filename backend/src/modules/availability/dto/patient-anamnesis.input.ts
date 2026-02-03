import { InputType, Field, Int, ID } from '@nestjs/graphql';

/**
 * Input per creazione nuova anamnesi paziente
 */
@InputType()
export class CreatePatientAnamnesisInput {
  @Field(() => Int, { description: 'ID del paziente' })
  patientId: number;

  @Field(() => ID, { nullable: true, description: 'ID operatore che compila' })
  operatorId?: string;

  // Anamnesi Patologica Remota
  @Field({ nullable: true, description: 'Patologie pregresse' })
  patologiePregresse?: string;

  @Field({ nullable: true, description: 'Interventi chirurgici subiti' })
  interventiChirurgici?: string;

  @Field({ nullable: true, description: 'Traumi significativi' })
  traumi?: string;

  @Field(() => [String], { nullable: true, description: 'Terapia farmacologica in corso' })
  terapiaFarmacologica?: string[];

  // Nuovi campi
  @Field({ nullable: true, description: 'Allergie note' })
  allergie?: string;

  @Field({ nullable: true, description: 'Storia familiare / Anamnesi familiare' })
  storiaFamiliare?: string;

  // Note
  @Field({ nullable: true, description: 'Note generali' })
  note?: string;
}

/**
 * Input per aggiornamento anamnesi paziente
 */
@InputType()
export class UpdatePatientAnamnesisInput {
  @Field(() => ID, { nullable: true, description: 'ID operatore che modifica' })
  operatorId?: string;

  // Anamnesi Patologica Remota
  @Field({ nullable: true, description: 'Patologie pregresse' })
  patologiePregresse?: string;

  @Field({ nullable: true, description: 'Interventi chirurgici subiti' })
  interventiChirurgici?: string;

  @Field({ nullable: true, description: 'Traumi significativi' })
  traumi?: string;

  @Field(() => [String], { nullable: true, description: 'Terapia farmacologica in corso' })
  terapiaFarmacologica?: string[];

  // Nuovi campi
  @Field({ nullable: true, description: 'Allergie note' })
  allergie?: string;

  @Field({ nullable: true, description: 'Storia familiare / Anamnesi familiare' })
  storiaFamiliare?: string;

  // Note
  @Field({ nullable: true, description: 'Note generali' })
  note?: string;
}
