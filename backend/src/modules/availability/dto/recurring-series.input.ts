import { registerEnumType, InputType, Field, ID } from '@nestjs/graphql';

export enum RecurringSeriesScope {
  CURRENT_ONLY = 'current_only',
  THIS_AND_FOLLOWING = 'this_and_following',
  ALL = 'all',
  DATE_RANGE = 'date_range',
}

registerEnumType(RecurringSeriesScope, {
  name: 'RecurringSeriesScope',
  description: 'Scope delle operazioni bulk su serie ricorrenti: solo corrente, corrente+successivi, intera serie, intervallo di date',
});

/**
 * Input per la modifica di orario/durata su una serie ricorrente.
 * Modifica SOLO startTime/endTime delle occorrenze nello scope scelto
 * (cambi di data/giorno richiedono di eliminare e ricreare la serie).
 */
@InputType()
export class UpdateRecurringSeriesTimeInput {
  @Field(() => ID)
  appointmentId: string;

  @Field(() => RecurringSeriesScope)
  scope: RecurringSeriesScope;

  @Field()
  startTime: string; // HH:mm

  @Field()
  endTime: string; // HH:mm

  // Per scope DATE_RANGE: estremi inclusi dell'intervallo (YYYY-MM-DD).
  @Field({ nullable: true })
  rangeFrom?: string;

  @Field({ nullable: true })
  rangeTo?: string;

  // Per scope DATE_RANGE: se false, l'occorrenza corrente è esclusa anche se
  // ricade nell'intervallo. Ignorato per gli altri scope.
  @Field({ nullable: true })
  includeCurrent?: boolean;
}
