import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Slot disponibile per la riprenotazione di un appuntamento.
 * A differenza degli slot della ricerca standard, questi sono gia'
 * filtrati anche per disponibilita' strumenti del servizio.
 */
@ObjectType()
export class RebookingSlot {
  @Field(() => ID)
  operatorId: string;

  @Field({ description: 'Data dello slot (YYYY-MM-DD)' })
  date: string;

  @Field({ description: 'Ora inizio (HH:mm)' })
  startTime: string;

  @Field({ description: 'Ora fine (HH:mm)' })
  endTime: string;
}
