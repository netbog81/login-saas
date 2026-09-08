import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';
import {
  NotificationCategory, NotificationChannel,
} from '../entities/notification-channel-setting.entity';

/**
 * Aggiornamento delle impostazioni di UN canale.
 *
 * Un canale per volta e non l'intero blocco: chi accende l'email non deve
 * poter riscrivere per sbaglio la configurazione di WhatsApp, che è quella
 * da cui oggi passa tutto.
 */
@InputType()
export class NotificationChannelSettingInput {
  @Field(() => NotificationChannel)
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field(() => [NotificationCategory], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationCategory, { each: true })
  categories?: NotificationCategory[];

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  smsDriver?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emailFromName?: string;
}
