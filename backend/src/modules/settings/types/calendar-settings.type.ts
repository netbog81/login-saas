import { ObjectType, Field, Int } from '@nestjs/graphql';

/**
 * CalendarSettings - Tipo GraphQL per le impostazioni del calendario
 */
@ObjectType()
export class CalendarSettings {
  @Field(() => Int)
  startHour: number;

  @Field(() => Int)
  endHour: number;

  @Field()
  showWorkingHoursOnly: boolean;

  @Field()
  showWeekend: boolean;

  @Field(() => Int)
  slotDuration: number;

  @Field()
  defaultView: string;

  @Field()
  showUnavailableCellsBackground: boolean;

  @Field()
  blockAppointmentsOutsideAvailability: boolean;

  @Field()
  operatorsSelectedOnLoad: boolean;

  @Field()
  showGymInstructorsInOperators: boolean;

  @Field()
  defaultOperatorCategory: string;

  /**
   * Cosa fa il click su un appuntamento nella vista operatori:
   * - 'edit-first'    → click = modifica, doppio click = riepilogo (default)
   * - 'summary-first' → click = riepilogo, doppio click = modifica
   */
  @Field()
  appointmentClickAction: string;
}
