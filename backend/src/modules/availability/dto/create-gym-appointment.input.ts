import { InputType, Field, ID } from '@nestjs/graphql';
import { IsUUID, IsString, IsOptional, IsDateString, Matches, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import GraphQLJSON from 'graphql-type-json';
import { ServiceInputItem } from './create-availability-appointment.input';
import { RecurringOccurrenceInput } from './recurring-occurrence.input';

@InputType()
export class CreateGymAppointmentInput {
  @Field(() => ID)
  @IsUUID()
  gymRoomId: string;

  @Field()
  @IsDateString()
  appointmentDate: string;  // YYYY-MM-DD

  @Field()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime deve essere nel formato HH:mm'
  })
  startTime: string;  // HH:mm

  @Field()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime deve essere nel formato HH:mm'
  })
  endTime: string;  // HH:mm

  @Field()
  @IsString()
  clientName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  clientEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  clientPhone?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID paziente non valido' })
  patientId?: string;

  /**
   * @deprecated Usa services invece. Mantenuto per retrocompatibilità.
   */
  @Field(() => ID, { nullable: true, deprecationReason: 'Usa services invece' })
  @IsOptional()
  @IsUUID('4', { message: 'serviceId deve essere un UUID valido' })
  serviceId?: string;

  /**
   * Lista dei servizi da associare all'appuntamento.
   * Se fornito, sostituisce serviceId.
   */
  @Field(() => [ServiceInputItem], { nullable: true, description: 'Servizi da associare all\'appuntamento' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceInputItem)
  services?: ServiceInputItem[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  // Per ricorrenza (opzionale)
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  repeatConfig?: any;

  /**
   * Piano risolto nel riquadro conflitti: le occorrenze da creare davvero,
   * con spostamenti (anche di sala) già decisi. Quando presente sostituisce
   * la generazione dalle regole.
   *
   * Parità con la creazione standard: senza questo campo, le decisioni prese
   * occorrenza per occorrenza venivano mostrate all'utente e poi ignorate,
   * perché il backend rigenerava comunque le date dalla regola.
   */
  @Field(() => [RecurringOccurrenceInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringOccurrenceInput)
  occurrences?: RecurringOccurrenceInput[];
}
