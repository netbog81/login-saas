import { ObjectType, Field, ID } from '@nestjs/graphql';

/** Fascia occupata in uno studio da un operatore (da assegnazione template). */
@ObjectType()
export class RoomOccupancyBand {
  @Field()
  startTime: string; // HH:MM

  @Field()
  endTime: string; // HH:MM

  @Field(() => ID)
  operatorId: string;

  @Field()
  operatorName: string;

  /** Colore configurato sull'operatore (per coerenza con gli appuntamenti). */
  @Field({ nullable: true })
  operatorColor?: string;

  @Field(() => ID, { nullable: true })
  chairId?: string;

  @Field({ nullable: true })
  chairName?: string;
}

/**
 * Fascia che sarebbe occupata da template ma è liberata da un'eccezione
 * dell'operatore (ferie, malattia, permesso, orario modificato...).
 */
@ObjectType()
export class RoomAbsenceBand {
  @Field()
  startTime: string; // HH:MM

  @Field()
  endTime: string;

  @Field(() => ID)
  operatorId: string;

  @Field()
  operatorName: string;

  /** Motivo leggibile: "ferie", "malattia", "permesso"... */
  @Field()
  reason: string;
}

/** Occupazione di uno studio in una data (per la vista calendario Studi). */
@ObjectType()
export class RoomDayOccupancy {
  @Field(() => ID)
  roomId: string;

  @Field()
  date: string; // YYYY-MM-DD

  @Field(() => [RoomOccupancyBand])
  bands: RoomOccupancyBand[];

  /** Fasce liberate da eccezioni: lo studio è libero ma "per assenza". */
  @Field(() => [RoomAbsenceBand])
  absences: RoomAbsenceBand[];
}
