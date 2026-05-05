import { Field, InputType } from '@nestjs/graphql';

import { CreateRegistryIndividualInput } from './create-registry-individual.input';
import { UpdatePatientAnamnesisInput } from '../../modules/availability/dto/patient-anamnesis.input';

/**
 * Input per creare un paziente: anagrafica → registry, dati clinici → locale.
 *
 * - `registry` viene mappato a CreateIndividualDto e inviato a POST /individuals.
 * - `anamnesis` opzionale: se presente, dopo la create del subject viene
 *   invocato un upsert su patient_anamnesis col subject_id appena creato.
 */
@InputType({ description: 'Input per creare un nuovo paziente' })
export class CreatePatientInput {
  @Field(() => CreateRegistryIndividualInput, {
    description: 'Anagrafica (PII), inviata al registry',
  })
  registry: CreateRegistryIndividualInput;

  @Field(() => UpdatePatientAnamnesisInput, {
    nullable: true,
    description: 'Dati sanitari iniziali (opzionali)',
  })
  anamnesis?: UpdatePatientAnamnesisInput;
}
