import { InputType, Field, Int, ID } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, IsInt, IsArray, ValidateNested, IsBoolean, Matches, IsEmail, MaxLength, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentInstrumentInput } from './create-availability-appointment.input';
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

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  patientId?: number;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'serviceId deve essere un UUID valido' })
  serviceId?: string;

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
}
