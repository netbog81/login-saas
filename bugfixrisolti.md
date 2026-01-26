# Bugfix Risolti

## Fix patientId stringa→numero (RISOLTO)
- Problema: GraphQL serializza ID come stringa, causando errore "Int cannot represent non-integer value"
- Soluzione: Aggiunto `Number()` in `gym-appointment-mat-dialog.component.ts` linea 513

## Fix orderPosition in ServiceInputItem DTO (RISOLTO)
- Problema: orderPosition non definito nel DTO backend
- Soluzione: Aggiunto campo `orderPosition` in `create-availability-appointment.input.ts`

## Fix Multi-Servizio Mapper (RISOLTO)
- Problema: Il mapper `appointment.mapper.ts` non mappava `appointmentServices`
- Soluzione: Aggiunta funzione `mapAppointmentServices()` nel mapper

## Fix AppointmentCardComponent.getServiceName() (RISOLTO)
- Problema: Cercava campo `serviceName` inesistente invece di `appointmentServices[]`
- Soluzione: Modificato metodo per usare `appointmentServices` array con fallback a `service`

## Fix Multi-Servizio EventDialogComponent (RISOLTO)
- Problema: Dialog operatori non supportava multi-servizio
- Soluzione: Integrato `ServiceMultiSelectComponent`, aggiunto `selectedServices[]`, modificato `onSave()`

## Pulsante "Annulla Appuntamento" (IN STANDBY)
- Il pulsante è stato nascosto dalla UI
- L'implementazione richiede un sistema di notifiche generico (feature futura)
