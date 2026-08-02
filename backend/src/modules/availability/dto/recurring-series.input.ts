import { registerEnumType, InputType, Field, ID } from '@nestjs/graphql';
import { AppointmentInstrumentInput, ServiceInputItem } from './create-availability-appointment.input';

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

/**
 * Input per la modifica COMPLETA di una serie ricorrente: propaga alle
 * occorrenze nello scope scelto tutti i campi modificabili (orario, operatore,
 * paziente, servizi, strumenti, note, non-retribuito) ed un eventuale
 * spostamento di data. Se `newDate` differisce dalla data attuale
 * dell'occorrenza corrente, l'intera serie viene traslata dello stesso numero
 * di giorni. Warn-and-block sulle sovrapposizioni: se una occorrenza si
 * sovrappone (alla nuova posizione) a un appuntamento esterno alla serie, nulla
 * viene applicato e i conflitti vengono ritornati.
 */
@InputType()
export class UpdateRecurringSeriesInput {
  @Field(() => ID)
  appointmentId: string;

  @Field(() => RecurringSeriesScope)
  scope: RecurringSeriesScope;

  // Per scope DATE_RANGE: estremi inclusi dell'intervallo (YYYY-MM-DD).
  @Field({ nullable: true })
  rangeFrom?: string;

  @Field({ nullable: true })
  rangeTo?: string;

  @Field({ nullable: true })
  includeCurrent?: boolean;

  // Nuova data (YYYY-MM-DD) dell'occorrenza corrente: se diversa dall'attuale,
  // trasla l'intera serie nello scope dello stesso numero di giorni.
  @Field({ nullable: true })
  newDate?: string;

  @Field()
  startTime: string; // HH:mm

  @Field()
  endTime: string; // HH:mm

  @Field(() => ID, { nullable: true })
  operatorId?: string;

  @Field(() => ID, { nullable: true })
  patientId?: string;

  @Field({ nullable: true })
  clientName?: string;

  @Field({ nullable: true })
  clientPhone?: string;

  @Field({ nullable: true })
  clientEmail?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  nonRetribuito?: boolean;

  @Field({ nullable: true })
  instrumentOrderMatters?: boolean;

  @Field(() => [ServiceInputItem], { nullable: true })
  services?: ServiceInputItem[];

  @Field(() => [AppointmentInstrumentInput], { nullable: true })
  instruments?: AppointmentInstrumentInput[];
}
