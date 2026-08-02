import { Field, ID, Int, Float, ObjectType, registerEnumType } from '@nestjs/graphql';

import { AppointmentType } from '../../availability/entities/appointment-type.enum';
import {
  ArrivalSource,
  BookingStatus,
} from '../../availability/entities/availability-appointment.entity';
import { OperatorMacroCategory } from '../../availability/entities/operator-macro-category.enum';
import { NoShowReview } from '../entities/no-show-review.entity';

/**
 * Tipologie di evento della pagina "No Show".
 *
 * Derivate dallo stato dell'appuntamento, non da una tabella di log: gli
 * appuntamenti sono l'unica sorgente che ha già operatore, sede, tipo
 * (studio/palestra) e ore di preavviso, ed è retroattiva sullo storico.
 */
export enum NoShowEventType {
  /** Paziente non presentato */
  NO_SHOW = 'NO_SHOW',
  /** Disdetta sotto la soglia di preavviso (assenza ingiustificata) */
  CANCELLED_LATE = 'CANCELLED_LATE',
  /** Disdetta con preavviso sufficiente: informativa, non è una penalità */
  CANCELLED_EARLY = 'CANCELLED_EARLY',
  /**
   * Disdetta storica/di sistema senza calcolo del preavviso
   * (bookingStatus `cancelled` legacy): il preavviso non è ricostruibile.
   */
  CANCELLED_UNKNOWN = 'CANCELLED_UNKNOWN',
  /** Arrivato in ritardo oltre la tolleranza, o dato per assente e poi presentatosi */
  LATE_ARRIVAL = 'LATE_ARRIVAL',
}

registerEnumType(NoShowEventType, {
  name: 'NoShowEventType',
  description: 'Tipologia di assenza/ritardo nella gestione assenze ingiustificate',
});

/** Ambito: studio (operatori/medici) o palestra (istruttori). */
export enum NoShowContext {
  ALL = 'ALL',
  STUDIO = 'STUDIO',
  GYM = 'GYM',
}

registerEnumType(NoShowContext, {
  name: 'NoShowContext',
  description: 'Ambito degli appuntamenti: studio, palestra o entrambi',
});

@ObjectType('NoShowCounts')
export class NoShowCounts {
  @Field(() => Int) noShow: number;
  @Field(() => Int) cancelledLate: number;
  @Field(() => Int) cancelledEarly: number;
  @Field(() => Int) cancelledUnknown: number;
  @Field(() => Int) lateArrival: number;

  @Field(() => Int, {
    description:
      'Totale "pesante": no-show + disdette tardive + disdette di preavviso ignoto. ' +
      'Esclude le disdette con preavviso e i ritardi.',
  })
  unjustified: number;

  @Field(() => Int, { description: 'Totale di tutti gli eventi, ritardi e disdette early inclusi' })
  total: number;
}

@ObjectType('NoShowEvent')
export class NoShowEvent {
  @Field(() => ID) appointmentId: string;

  @Field(() => ID, { nullable: true }) patientId?: string;
  @Field({ description: 'Display name dalla cache locale, fallback su clientName' })
  patientName: string;

  @Field(() => NoShowEventType) eventType: NoShowEventType;
  @Field(() => BookingStatus) bookingStatus: BookingStatus;

  @Field(() => String, { description: 'Data appuntamento YYYY-MM-DD' })
  appointmentDate: string;
  @Field() startTime: string;
  @Field() endTime: string;

  @Field(() => AppointmentType) appointmentType: AppointmentType;
  @Field({ nullable: true }) gymRoomName?: string;
  @Field(() => ID, { nullable: true }) siteId?: string;
  @Field({ nullable: true }) siteName?: string;

  @Field(() => ID, { nullable: true }) operatorId?: string;
  @Field({ nullable: true }) operatorName?: string;
  @Field(() => OperatorMacroCategory, { nullable: true })
  operatorMacroCategory?: OperatorMacroCategory;

  @Field({ description: 'L\'appuntamento era stato riassegnato a un sostituto' })
  isSubstitution: boolean;
  @Field({ nullable: true, description: 'Operatore originale, se c\'è stata sostituzione' })
  originalOperatorName?: string;

  // ---- disdetta ----
  @Field({ nullable: true }) cancelledAt?: Date;
  @Field(() => Float, { nullable: true }) cancellationHoursNotice?: number;
  @Field({ nullable: true }) cancellationReason?: string;

  // ---- ritardo ----
  @Field({ nullable: true }) arrivedAt?: Date;
  @Field(() => Int, { nullable: true }) lateMinutes?: number;
  @Field(() => ArrivalSource, { nullable: true }) arrivalSource?: ArrivalSource;
  @Field({ description: 'Era stato dato per assente e poi si è presentato' })
  wasNoShowReverted: boolean;

  @Field(() => [String], { description: 'Servizi prenotati sull\'appuntamento' })
  serviceNames: string[];

  @Field(() => NoShowReview, { nullable: true, description: 'Decisione dello staff, se presa' })
  review?: NoShowReview;
}

@ObjectType('NoShowPatientGroup')
export class NoShowPatientGroup {
  @Field(() => ID, { nullable: true }) patientId?: string;
  @Field() patientName: string;

  @Field(() => NoShowCounts, { description: 'Conteggi nel periodo filtrato' })
  counts: NoShowCounts;

  @Field(() => NoShowCounts, {
    description:
      'Conteggi negli ultimi N giorni (impostazione noShow.recentWindowDays), ' +
      'indipendenti dal filtro: servono a distinguere "2 in un mese" da "2 in un anno"',
  })
  recent: NoShowCounts;

  @Field(() => NoShowCounts, {
    description: 'Conteggi negli ultimi 12 mesi scorrevoli, indipendenti dal filtro',
  })
  rollingYear: NoShowCounts;

  @Field(() => String, { nullable: true, description: 'Primo evento nel periodo (YYYY-MM-DD)' })
  firstEventDate?: string;
  @Field(() => String, { nullable: true, description: 'Ultimo evento nel periodo (YYYY-MM-DD)' })
  lastEventDate?: string;

  @Field(() => Int, { description: 'Eventi ancora da valutare dallo staff' })
  pendingReviews: number;

  @Field(() => [NoShowEvent], { description: 'Gli eventi del paziente nel periodo' })
  events: NoShowEvent[];
}

@ObjectType('NoShowPatientPage')
export class NoShowPatientPage {
  @Field(() => [NoShowPatientGroup]) groups: NoShowPatientGroup[];
  @Field(() => Int, { description: 'Pazienti totali che soddisfano il filtro' })
  totalPatients: number;
}

@ObjectType('NoShowEventPage')
export class NoShowEventPage {
  @Field(() => [NoShowEvent]) events: NoShowEvent[];
  @Field(() => Int) total: number;
}

@ObjectType('NoShowSummary')
export class NoShowSummary {
  @Field(() => NoShowCounts) counts: NoShowCounts;

  @Field(() => Int, { description: 'Pazienti distinti coinvolti nel periodo' })
  patientsInvolved: number;

  @Field(() => Int) pendingReviews: number;
  @Field(() => Int) toCharge: number;
  @Field(() => Int) waived: number;
  @Field(() => Int) justified: number;

  // Echo delle soglie in vigore: la UI le mostra senza una query in più.
  @Field(() => Int) lateCancellationHours: number;
  @Field(() => Int) lateArrivalToleranceMinutes: number;
  @Field(() => Int) recentWindowDays: number;
}
