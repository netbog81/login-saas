import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

/**
 * Intersezione tra una fascia del template candidato e l'occupazione già
 * esistente di uno studio, proiettata sul ciclo del candidato (dayInPattern).
 * Conservativa sulle date reali: se in QUALSIASI occorrenza reale della
 * fascia lo studio è occupato, l'intervallo compare qui.
 */
@ObjectType()
export class RoomBandBusyInfo {
  @Field(() => Int)
  dayInPattern: number;

  @Field()
  startTime: string; // HH:MM

  @Field()
  endTime: string;

  /** Posti ancora liberi nel momento peggiore (capacità - occupanti max). */
  @Field(() => Int)
  freeSeats: number;

  @Field(() => [String])
  occupantNames: string[];

  /** Poltrone occupate in questo intervallo (in almeno una data reale). */
  @Field(() => [ID])
  busyChairIds: string[];
}

@ObjectType()
export class ChairAvailabilityInfo {
  @Field(() => ID)
  chairId: string;

  @Field()
  name: string;

  /** Libera su tutte le fasce del template candidato. */
  @Field()
  fullyFree: boolean;

  /** Primo conflitto in forma leggibile, se non libera. */
  @Field({ nullable: true })
  firstConflict?: string;
}

@ObjectType()
export class RoomAvailabilityInfo {
  @Field(() => ID)
  roomId: string;

  @Field()
  roomName: string;

  /** Capacità effettiva: poltrone attive, o capacity dello studio se zero. */
  @Field(() => Int)
  capacity: number;

  /** Nessuna sovrapposizione su nessuna fascia del template. */
  @Field()
  fullyFree: boolean;

  /** Sovrapposizioni presenti ma con posti sufficienti ovunque. */
  @Field()
  sharing: boolean;

  /** Almeno una fascia del template dove non restano posti. */
  @Field()
  full: boolean;

  /** Motivo leggibile per la tendina ("pieno il lunedì 09:00-12:00 — Rossi"). */
  @Field({ nullable: true })
  unavailableReason?: string;

  @Field(() => [RoomBandBusyInfo])
  busy: RoomBandBusyInfo[];

  @Field(() => [ChairAvailabilityInfo])
  chairs: ChairAvailabilityInfo[];
}

@ObjectType()
export class RoomAssignmentAvailability {
  @Field(() => [RoomAvailabilityInfo])
  rooms: RoomAvailabilityInfo[];
}
