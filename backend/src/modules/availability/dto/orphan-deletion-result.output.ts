import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Esito della cancellazione di UN trattamento orfano nella pulizia in blocco.
 *
 * La cancellazione in blocco non è atomica per scelta: ogni trattamento ha la
 * sua transazione, così uno bloccato (voucher FE attivo, riga di conguaglio,
 * già fatturato) non impedisce di ripulire tutti gli altri. Questo output dice
 * riga per riga com'è andata, con il motivo già formulato per l'utente.
 */
@ObjectType('OrphanDeletionResult')
export class OrphanDeletionResult {
  @Field(() => ID)
  treatmentId: string;

  @Field()
  deleted: boolean;

  /** Motivo del blocco. Null se il trattamento è stato cestinato. */
  @Field(() => String, { nullable: true })
  reason: string | null;
}
