import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RegistryAddressInput {
  @Field({
    description: 'LEGAL | RESIDENCE | BILLING | SHIPPING | OTHER',
    defaultValue: 'RESIDENCE',
  })
  addressType: string;

  @Field({ nullable: true })
  street?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  zipCode?: string;

  @Field({ nullable: true })
  province?: string;

  @Field({ defaultValue: 'IT', description: 'ISO2 country code' })
  countryCode: string;

  @Field({ defaultValue: true })
  isPrimary: boolean;
}

@InputType()
export class RegistryContactInput {
  @Field({ description: 'EMAIL | PHONE | MOBILE | FAX | PEC' })
  contactType: string;

  @Field()
  value: string;

  @Field({ nullable: true })
  label?: string;

  @Field({ defaultValue: false })
  isPrimary: boolean;
}

/**
 * Input per la creazione di un INDIVIDUAL nel registry (POST /individuals).
 * I valori dell'enum gender / legalCapacity sono passati come stringa per
 * non duplicare gli enum del registry lato GraphQL clinico.
 */
@InputType()
export class CreateRegistryIndividualInput {
  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field({ nullable: true })
  taxCode?: string;

  @Field({ nullable: true, description: 'M | F | X' })
  gender?: string;

  @Field({ nullable: true, description: 'Data nascita ISO (yyyy-mm-dd)' })
  birthDate?: string;

  @Field({ nullable: true })
  birthPlace?: string;

  @Field({ nullable: true, description: 'ISO2 country code della nascita' })
  birthCountry?: string;

  @Field({
    nullable: true,
    description:
      'ADULT_AUTONOMOUS | MINOR_WITH_GUARDIAN | INCAPACITATED_WITH_GUARDIAN | ELDERLY_WITH_GUARDIAN',
  })
  legalCapacity?: string;

  @Field({ nullable: true })
  vatNumber?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => [RegistryAddressInput], { nullable: true })
  addresses?: RegistryAddressInput[];

  @Field(() => [RegistryContactInput], { nullable: true })
  contacts?: RegistryContactInput[];
}

/**
 * Input per aggiornamento parziale dell'anagrafica (PUT /individuals/:id).
 * Tutti i campi sono opzionali; quelli omessi non vengono toccati.
 */
@InputType()
export class UpdateRegistryIndividualInput {
  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  taxCode?: string;

  @Field({ nullable: true, description: 'M | F | X' })
  gender?: string;

  @Field({ nullable: true })
  birthDate?: string;

  @Field({ nullable: true })
  birthPlace?: string;

  @Field({ nullable: true })
  birthCountry?: string;

  @Field({ nullable: true })
  legalCapacity?: string;

  @Field({ nullable: true })
  vatNumber?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field(() => [RegistryAddressInput], { nullable: true })
  addresses?: RegistryAddressInput[];

  @Field(() => [RegistryContactInput], { nullable: true })
  contacts?: RegistryContactInput[];
}
