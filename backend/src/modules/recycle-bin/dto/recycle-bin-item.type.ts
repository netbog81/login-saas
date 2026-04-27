import { ObjectType, Field, ID, registerEnumType, GraphQLISODateTime, Int } from '@nestjs/graphql';

/**
 * Tipi di entità presenti nel cestino. Allineato alle tabelle che hanno
 * `deletedAt` e che possono essere ripristinate come "primarie" (i loro
 * figli risultano automaticamente coinvolti dal restore in cascata).
 */
export enum RecycleBinEntityType {
  THERAPEUTIC_PATH = 'therapeutic_path',
  TREATMENT = 'treatment',
  PATIENT_EVALUATION = 'patient_evaluation',
}

registerEnumType(RecycleBinEntityType, {
  name: 'RecycleBinEntityType',
  description: 'Tipo di entità nel cestino',
});

/**
 * Riga del cestino, normalizzata per la lista UI.
 *
 * I campi `*Snapshot` sono valori al momento della cancellazione
 * (titolo del record, nome del proprietario): se l'entità referenziata
 * cambia o sparisce dopo l'eliminazione, la lista cestino resta leggibile.
 */
@ObjectType('RecycleBinItem')
export class RecycleBinItem {
  @Field(() => ID, { description: 'Id dell\'entità soft-deletata' })
  id: string;

  @Field(() => RecycleBinEntityType)
  entityType: RecycleBinEntityType;

  @Field({ description: 'Titolo leggibile del record (nome percorso, info trattamento, ecc.)' })
  title: string;

  @Field({ nullable: true, description: 'Sottotitolo opzionale (es. nome paziente, data trattamento)' })
  subtitle?: string;

  @Field(() => GraphQLISODateTime)
  deletedAt: Date;

  @Field(() => ID, { nullable: true, description: 'AppUser che ha eseguito la cancellazione' })
  deletedByUserId?: string;

  @Field({ nullable: true, description: 'Nome leggibile dell\'AppUser che ha cancellato' })
  deletedByName?: string;

  @Field(() => ID, {
    nullable: true,
    description: 'AppUser proprietario originale (per filtri in UI). Vuoto se l\'operatore non è linkato a un AppUser.',
  })
  ownerUserId?: string;

  @Field({ nullable: true, description: 'Nome dell\'operatore proprietario originale' })
  ownerName?: string;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Quando l\'elemento sarà eliminato definitivamente dal cron (null = retention indefinita)',
  })
  scheduledPurgeAt?: Date;

  @Field(() => Int, {
    nullable: true,
    description: 'Conteggio figli collegati (es. n trattamenti per un percorso). Solo informativo.',
  })
  childrenCount?: number;
}
