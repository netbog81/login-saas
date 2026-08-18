import { ObjectType, Field } from '@nestjs/graphql';

/**
 * Esito del pre-check conflitti studi/poltrone per un'assegnazione template:
 * blocking impedisce il salvataggio, warnings è informativo (condivisione
 * studio entro la capacità).
 */
@ObjectType()
export class RoomConflictCheckResult {
  @Field(() => [String])
  blocking: string[];

  @Field(() => [String])
  warnings: string[];
}
