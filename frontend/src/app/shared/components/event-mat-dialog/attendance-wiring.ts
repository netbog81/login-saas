import { MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { BookingStatus } from '../../../models/appointment.model';
import {
  AttendanceActionRequest,
  EventMatDialogComponent,
  EventMatDialogResult,
} from './event-mat-dialog.component';

/**
 * Collega le azioni di presenza del dialog appuntamento al backend, LASCIANDO
 * IL DIALOG APERTO.
 *
 * Il giro completo (mutation → stato aggiornato nel dialog → ricarica del
 * calendario dietro) e' identico per i tre calendari che aprono questo dialog,
 * e prima era copiato — male — in ognuno: il calendario v3 lo gestiva solo
 * dall'apertura da griglia, mentre dalla finestra "Appuntamenti" i pulsanti di
 * stato non facevano assolutamente nulla, in silenzio.
 *
 * @param onChanged invocato dopo ogni azione andata a buon fine, per
 *                  ricaricare la vista sottostante.
 */
export function wireAttendanceActions(
  dialogRef: MatDialogRef<EventMatDialogComponent, EventMatDialogResult>,
  appointmentService: AvailabilityAppointmentService,
  onChanged: () => void,
): Subscription {
  const instance = dialogRef.componentInstance;
  return instance.attendanceAction.subscribe((req: AttendanceActionRequest) => {
    appointmentService.runAttendanceAction(req.action, req.appointmentId).subscribe({
      next: (updated) => {
        instance.applyBookingStatus(
          toModelStatus(updated?.bookingStatus) ?? fallbackStatus(req),
        );
        onChanged();
      },
      error: (err: any) => {
        instance.failStatusAction(
          err?.graphQLErrors?.[0]?.message ||
            err?.message ||
            'Operazione non riuscita. Riprova.',
        );
      },
    });
  });
}

const MODEL_STATUSES: BookingStatus[] = [
  'scheduled', 'confirmed', 'cancelled',
  'cancelled_early', 'cancelled_late', 'no_show', 'attended',
];

/**
 * L'enum generato dal codegen espone i valori in MAIUSCOLO (`NO_SHOW`), il
 * model di dominio li usa minuscoli (`no_show`). Conversione esplicita: un
 * cast secco avrebbe passato "NO_SHOW" alla UI, che non lo riconosce e
 * mostrerebbe di nuovo "Prenotato".
 */
function toModelStatus(raw: unknown): BookingStatus | null {
  const value = String(raw ?? '').toLowerCase() as BookingStatus;
  return MODEL_STATUSES.includes(value) ? value : null;
}

/**
 * Stato atteso quando il backend non rimanda l'appuntamento aggiornato.
 * Serve solo a non lasciare il badge fermo su un valore vecchio; la verita'
 * arriva comunque col reload della vista.
 */
function fallbackStatus(req: AttendanceActionRequest): BookingStatus {
  switch (req.action) {
    case 'mark-attended':
      return 'attended';
    case 'mark-no-show':
      return 'no_show';
    case 'revert-attended':
      return 'confirmed';
    case 'cancel-with-notice':
      return 'cancelled_early';
  }
}
