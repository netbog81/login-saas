import { InputType, Field, ID } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, IsArray, ValidateNested, IsBoolean, Matches, IsEmail, MaxLength, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentInstrumentInput, ServiceInputItem } from './create-availability-appointment.input';
import { BookingStatus } from '../entities/availability-appointment.entity';

@InputType()
export class UpdateAvailabilityAppointmentInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Il nome cliente non può superare 255 caratteri' })
  clientName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'Email non valida' })
  @MaxLength(255)
  clientEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Numero di telefono troppo lungo' })
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
   * Se fornito, sostituisce tutti i servizi esistenti.
   */
  @Field(() => [ServiceInputItem], { nullable: true, description: 'Servizi da associare all\'appuntamento' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceInputItem)
  services?: ServiceInputItem[];

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La data deve essere nel formato YYYY-MM-DD' })
  appointmentDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: "L'orario deve essere nel formato HH:mm" })
  startTime?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: "L'orario deve essere nel formato HH:mm" })
  endTime?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note non possono superare 2000 caratteri' })
  notes?: string;

  @Field(() => BookingStatus, { nullable: true })
  @IsOptional()
  @IsEnum(BookingStatus, { message: 'Stato prenotazione non valido' })
  bookingStatus?: BookingStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Il motivo cancellazione non può superare 1000 caratteri' })
  cancellationReason?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note operatore non possono superare 2000 caratteri' })
  operatorNotes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  instrumentOrderMatters?: boolean;

  @Field(() => [AppointmentInstrumentInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppointmentInstrumentInput)
  instruments?: AppointmentInstrumentInput[];

  @Field({ nullable: true, description: 'Appuntamento non retribuito (pausa pranzo, rappresentante, etc.)' })
  @IsOptional()
  @IsBoolean()
  nonRetribuito?: boolean;
}
