import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsUUID, IsString, IsOptional, IsInt, Min, IsDateString, Matches, IsBoolean } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

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
