import { AvailabilityAppointment, BookingStatus } from '../entities/availability-appointment.entity';
import { toDateString } from './date-string.util';

/**
 * Cosa l'operatore vede di un appuntamento nel proprio calendario esterno.
 *
 * UNICO POSTO che decide titolo, descrizione e luogo, condiviso fra il feed
 * ICS e il push su Google Calendar. Sono due canali diversi ma la domanda è la
 * stessa — quanto di un paziente esce dal gestionale e finisce in un
 * calendario personale — e due copie della risposta finirebbero per divergere
 * proprio sulle scelte di riservatezza, che sono quelle su cui non ci si può
 * permettere una svista.
 */

export interface ExternalEventVisibility {
  /** L'operatore ha acconsentito a vedere il nome del paziente. */
  showPatientName: boolean;
  /** L'operatore ha acconsentito a vedere il telefono del paziente. */
  showPatientPhone: boolean;
  /**
   * Recapiti già etichettati ("Cell: … · Tel: …"), presi dal registry.
   * Assente = si ripiega su quello eventualmente salvato sull'appuntamento.
   */
  patientPhone?: string;
  /** Oggi in formato YYYY-MM-DD: il telefono esce solo per il futuro. */
  todayStr: string;
}

export interface ExternalEventContent {
  summary: string;
  description?: string;
  location?: string;
}

export function buildExternalEventContent(
  appointment: AvailabilityAppointment,
  visibility: ExternalEventVisibility,
): ExternalEventContent {
  const services = (appointment.appointmentServices ?? [])
    .map(s => s.service?.name)
    .filter((n): n is string => !!n)
    .join(', ');
  const serviceLabel = services || appointment.service?.name || '';

  let summary: string;
  if (appointment.nonRetribuito) {
    // Le fasce non retribuite non hanno paziente: il titolo è già il motivo
    // per cui esistono (pausa, riunione, rappresentante).
    summary = appointment.clientName?.trim() || 'Impegno';
  } else if (visibility.showPatientName) {
    summary = [appointment.clientName?.trim(), serviceLabel].filter(Boolean).join(' — ')
      || 'Appuntamento';
  } else {
    summary = serviceLabel || 'Appuntamento';
  }

  const location = [appointment.site?.name, appointment.room?.name]
    .filter(Boolean)
    .join(' · ');

  const parts: string[] = [];
  if (serviceLabel && visibility.showPatientName) {
    parts.push(`Servizio: ${serviceLabel}`);
  }

  // Telefono solo sugli appuntamenti futuri: su uno di due mesi fa non serve a
  // niente e sarebbe un recapito in più esposto senza motivo.
  const appointmentDay = toDateString(appointment.appointmentDate as unknown as Date | string);
  if (visibility.showPatientPhone
      && !appointment.nonRetribuito
      && appointmentDay >= visibility.todayStr) {
    // Dal registry i recapiti arrivano già etichettati; quello salvato
    // sull'appuntamento è un numero secco e va etichettato qui.
    const phone = visibility.patientPhone
      ?? (appointment.clientPhone?.trim() ? `Tel: ${appointment.clientPhone.trim()}` : undefined);
    if (phone) parts.push(phone);
  }

  if (appointment.notes) parts.push(appointment.notes);
  if (appointment.bookingStatus === BookingStatus.NO_SHOW) {
    parts.push('Paziente non presentato.');
  }

  return {
    summary,
    description: parts.join('\n') || undefined,
    location: location || undefined,
  };
}

/** Gli stati che NON devono comparire nel calendario dell'operatore. */
export function isAppointmentVisibleExternally(appointment: AvailabilityAppointment): boolean {
  return ![
    BookingStatus.CANCELLED,
    BookingStatus.CANCELLED_EARLY,
    BookingStatus.CANCELLED_LATE,
  ].includes(appointment.bookingStatus);
}
