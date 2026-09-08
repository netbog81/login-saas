import { InputType, Field, ID } from '@nestjs/graphql';
import { IsOptional, IsUUID, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RepeatConfigInput } from './create-availability-appointment.input';

/**
 * Una occorrenza risolta dall'utente nel riquadro conflitti: dove va messa
 * davvero.
 *
 * È il cuore del passaggio da "il backend genera e decide" a "il backend
 * propone, l'utente risolve, il backend esegue quello che gli è stato detto".
 * Chi ha confermato un'occorrenza fuori disponibilità la rimanda identica;
 * chi l'ha spostata cambia data, orario o perfino operatore; chi l'ha saltata
 * semplicemente non la include nell'elenco.
 */
@InputType()
export class RecurringOccurrenceInput {
  /** Solo per le serie esistenti: l'occorrenza da aggiornare. */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID occorrenza non valido' })
  appointmentId?: string;

  @Field()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La data deve essere nel formato YYYY-MM-DD' })
  date: string;

  @Field()
  @Matches(/^\d{2}:\d{2}$/, { message: "L'orario di inizio deve essere nel formato HH:mm" })
  startTime: string;

  @Field()
  @Matches(/^\d{2}:\d{2}$/, { message: "L'orario di fine deve essere nel formato HH:mm" })
  endTime: string;

  /** Valorizzato solo se lo spostamento ha cambiato anche operatore. */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID operatore non valido' })
  operatorId?: string;

  /**
   * Valorizzato solo se lo spostamento ha cambiato anche la sala (serie
   * palestra). È l'asse alternativo della palestra: dove nella vista
   * operatori si sposta l'appuntamento su un altro operatore, qui lo si
   * sposta in un'altra sala — l'istruttore viene di conseguenza dal template
   * della sala di destinazione.
   */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID sala palestra non valido' })
  gymRoomId?: string;
}

/**
 * Richiesta di anteprima: stesse informazioni della creazione, ma senza
 * scrivere nulla. Ritorna il piano delle occorrenze con i conflitti.
 */
@InputType()
export class RecurringSeriesPreviewInput {
  /**
   * Operatore della serie. Facoltativo per le serie palestra, dove il vincolo
   * è la sala: l'istruttore lo assegna il template della palestra fascia per
   * fascia, quindi non è un dato che il chiamante possa scegliere.
   */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID operatore non valido' })
  operatorId?: string;

  /**
   * Sala palestra: se valorizzata, l'anteprima valuta le occorrenze con i
   * predicati della palestra (chiusura fascia, istruttore assegnato dal
   * template, capienza) invece che con quelli dell'operatore.
   */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID sala palestra non valido' })
  gymRoomId?: string;

  /** Paziente della serie: serve a segnalare le date in cui è già prenotato. */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID paziente non valido' })
  patientId?: string;

  @Field()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La data deve essere nel formato YYYY-MM-DD' })
  startDate: string;

  @Field()
  @Matches(/^\d{2}:\d{2}$/, { message: "L'orario di inizio deve essere nel formato HH:mm" })
  startTime: string;

  @Field()
  @Matches(/^\d{2}:\d{2}$/, { message: "L'orario di fine deve essere nel formato HH:mm" })
  endTime: string;

  @Field(() => RepeatConfigInput)
  @ValidateNested()
  @Type(() => RepeatConfigInput)
  repeatConfig: RepeatConfigInput;

  /**
   * Appuntamento già esistente che diventa la prima occorrenza ("rendi
   * ricorrente"): va escluso dai controlli, altrimenti risulterebbe
   * sovrapposto a sé stesso.
   */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID appuntamento non valido' })
  excludeAppointmentId?: string;
}
