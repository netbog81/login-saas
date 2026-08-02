import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { AvailabilityAppointment } from '../entities/availability-appointment.entity';

/**
 * Conflitto rilevato su una singola occorrenza di una serie ricorrente
 * (occorrenza fuori disponibilità operatore o sovrapposta ad altro
 * appuntamento), durante validazione di modifica/creazione serie.
 */
@ObjectType()
export class RecurringOccurrenceConflict {
  @Field(() => ID, { nullable: true })
  appointmentId?: string; // null in fase di creazione (occorrenza non ancora persistita)

  @Field()
  date: string; // YYYY-MM-DD

  @Field()
  startTime: string; // HH:mm

  @Field()
  endTime: string; // HH:mm

  // 'unavailable' = fuori disponibilità operatore; 'overlap' = sovrapposto ad
  // altro appuntamento esistente.
  @Field()
  type: string;

  @Field()
  reason: string;

  // Se overlap: estremi dell'appuntamento in conflitto (per il riepilogo UI).
  @Field({ nullable: true })
  conflictingStartTime?: string;

  @Field({ nullable: true })
  conflictingEndTime?: string;
}

/**
 * Risultato di un'operazione su serie ricorrente con validazione preventiva.
 * Se `conflicts` non è vuoto, l'operazione è stata BLOCCATA e nulla è stato
 * modificato/creato (avvisa-e-blocca).
 */
@ObjectType()
export class RecurringSeriesOperationResult {
  @Field()
  applied: boolean;

  @Field(() => Int)
  affectedCount: number;

  @Field(() => [RecurringOccurrenceConflict])
  conflicts: RecurringOccurrenceConflict[];
}

/**
 * Risultato della creazione di un appuntamento palestra con report: per le
 * serie ricorrenti le occorrenze in conflitto (slot chiuso, capienza piena,
 * nessun istruttore) vengono SALTATE ma elencate in `conflicts`, così il
 * frontend può avvisare l'utente. Se NESSUNA occorrenza è creabile la
 * mutation fallisce con errore RECURRING_SERIES_CONFLICT (avvisa-e-blocca).
 */
@ObjectType()
export class GymAppointmentCreationResult {
  @Field(() => AvailabilityAppointment)
  appointment: AvailabilityAppointment;

  @Field(() => Int)
  createdCount: number;

  @Field(() => Int)
  skippedCount: number;

  @Field(() => [RecurringOccurrenceConflict])
  conflicts: RecurringOccurrenceConflict[];
}
