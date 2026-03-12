export interface DispatchBookingPayload {
  type: 'APPOINTMENT_BOOKING';
  data: {
    appointmentId: string;
    pazienteId: string;
    phone: string;
    date: string;
    name: string;
  };
  correlationId: string;
}

export interface DispatchBookingResponse {
  correlationId: string;
  status: string;
}

export interface DispatchCancelPayload {
  type: 'APPOINTMENT_CANCEL';
  data: {
    appointmentId: string;
    phone: string;
    sendCancelNotification: boolean;
    cancelNotificationMessage?: string;
    name: string;
    date: string;
  };
  correlationId: string;
}
