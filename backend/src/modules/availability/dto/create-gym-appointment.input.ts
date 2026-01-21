import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsUUID, IsString, IsOptional, IsInt, Min, IsDateString, Matches, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import GraphQLJSON from 'graphql-type-json';
import { ServiceInputItem } from './create-availability-appointment.input';

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

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  patientId?: number;

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
}
