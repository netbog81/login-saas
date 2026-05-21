import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Tipi per la disponibilita' operatori usata dal Calendario V3.
 *
 * A differenza di DailyAvailability/AvailabilitySlot (che espongono fasce
 * di template "a capacita'": una fascia intera diventa non disponibile
 * appena bookedCapacity >= totalCapacity), questi tipi espongono i
 * "free block" REALI: gli intervalli di template gia' decurtati degli
 * appuntamenti esistenti.
 *
 * Modello: la fascia di lavoro resta disponibile ovunque tranne dove
 * cadono gli appuntamenti. Per operatori con maxConcurrentAppointments>1
 * un minuto e' occupato solo quando il numero di appuntamenti
 * sovrapposti raggiunge la capacita'.
 */

@ObjectType()
export class TimeBlockV3 {
  @Field({ description: 'Inizio blocco (HH:mm)' })
  startTime: string;

  @Field({ description: 'Fine blocco (HH:mm)' })
  endTime: string;
}

@ObjectType()
export class DayAvailabilityV3 {
  @Field({ description: 'Data (YYYY-MM-DD)' })
  date: string;

  @Field(() => [TimeBlockV3], {
    description: 'Intervalli realmente liberi (template meno appuntamenti)',
  })
  freeBlocks: TimeBlockV3[];
}

@ObjectType()
export class OperatorAvailabilityV3 {
  @Field(() => ID)
  operatorId: string;

  @Field(() => [DayAvailabilityV3])
  days: DayAvailabilityV3[];
}
