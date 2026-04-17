/**
 * Calendar V2 Data Service
 * Layer 3: Business Logic
 *
 * Caricamento dati tramite query bulk.
 * Non gestisce stato - delega al StateService.
 * Usa esclusivamente BaseGraphQLService (via i service esistenti).
 */

import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, map } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { OperatorService } from '../../../services/operator.service';
import { DailyAvailability } from '../../../graphql/types';
import { TreatmentService } from '../../../services/treatment.service';
import { GymRoomService, GymRoom, GymSlotInfo, GymAppointment } from '../../../services/gym-room.service';
import { PatientService } from '../../../services/patient.service';
import { AvailabilityAppointment } from '../../../graphql/generated/types';
import { Treatment } from '../../../models/treatment.model';
import { Patient } from '../../../models/patient.model';
import { Appointment } from '../../../models/appointment.model';
import { mapAvailabilityAppointmentToAppointment } from '../../../utils/appointment.mapper';

// ==================== RESULT TYPES ====================

export interface OperatorLoadResult {
  appointments: Map<string, Map<string, Appointment[]>>;  // operatorId → date → appointments
  availabilities: Map<string, Map<string, { startTime: string; endTime: string }[]>>; // operatorId → date → slots
  treatments: Treatment[];
}

export interface GymLoadResult {
  slotsInfo: Map<string, (GymSlotInfo & { gymRoomId: string; date: string })[]>;  // date → slots
  appointments: Map<string, GymAppointment[]>;  // date → appointments (grouped by gymRoomId inside)
}

@Injectable({ providedIn: 'root' })
export class CalendarV2DataService {

  constructor(
    private appointmentService: AvailabilityAppointmentService,
    private operatorService: OperatorService,
    private treatmentService: TreatmentService,
    private gymRoomService: GymRoomService,
    private patientService: PatientService,
  ) {}

  // ==================== OPERATOR DATA (3 query parallele) ====================

  /**
   * Carica tutti i dati operatori per il range di date.
   * 3 query parallele: appuntamenti + disponibilità + trattamenti.
   */
  loadOperatorData(
    operatorIds: string[],
    operatorsWithTemplate: string[],
    startDate: string,
    endDate: string,
    todayDate: string,
  ): Observable<OperatorLoadResult> {
    if (operatorIds.length === 0) {
      return of({
        appointments: new Map(),
        availabilities: new Map(),
        treatments: [],
      });
    }

    return forkJoin({
      rawAppointments: this.appointmentService.getAppointments(startDate, endDate, operatorIds).pipe(
        catchError(() => of([] as AvailabilityAppointment[])),
      ),
      rawAvailabilities: operatorsWithTemplate.length > 0
        ? this.operatorService.getOperatorsAvailability(operatorsWithTemplate, startDate, endDate).pipe(
            catchError(() => of([] as { operatorId: string; availability: DailyAvailability[] }[])),
          )
        : of([] as { operatorId: string; availability: DailyAvailability[] }[]),
      treatments: this.treatmentService.getTreatmentsByOperators(
        operatorIds,
        todayDate,
      ).pipe(catchError(() => of([] as Treatment[]))),
    }).pipe(
      map(({ rawAppointments, rawAvailabilities, treatments }) => {
        // Mappa appuntamenti: operatorId → date → Appointment[]
        const appointments = new Map<string, Map<string, Appointment[]>>();
        for (const raw of rawAppointments) {
          const apt = mapAvailabilityAppointmentToAppointment(raw);
          if (!appointments.has(apt.operatorId)) appointments.set(apt.operatorId, new Map());
          const dateMap = appointments.get(apt.operatorId)!;
          if (!dateMap.has(apt.date)) dateMap.set(apt.date, []);
          dateMap.get(apt.date)!.push(apt);
        }

        // Mappa disponibilità: operatorId → date → slots[]
        const availabilities = new Map<string, Map<string, { startTime: string; endTime: string }[]>>();
        for (const opResult of rawAvailabilities) {
          if (!availabilities.has(opResult.operatorId)) availabilities.set(opResult.operatorId, new Map());
          const opMap = availabilities.get(opResult.operatorId)!;
          for (const daily of opResult.availability) {
            if (daily.hasAvailability && daily.slots) {
              opMap.set(
                daily.date,
                daily.slots.filter((s: any) => s.isAvailable).map((s: any) => ({
                  startTime: s.startTime,
                  endTime: s.endTime,
                })),
              );
            }
          }
        }

        return { appointments, availabilities, treatments };
      }),
    );
  }

  // ==================== GYM DATA (2 query parallele) ====================

  /**
   * Carica tutti i dati palestra per il range di date.
   * 2 query parallele: slot info + appuntamenti.
   */
  loadGymData(
    gymRoomIds: string[],
    startDate: string,
    endDate: string,
  ): Observable<GymLoadResult> {
    if (gymRoomIds.length === 0) {
      return of({ slotsInfo: new Map(), appointments: new Map() });
    }

    return forkJoin({
      allSlots: this.gymRoomService.getAvailableSlotsForRooms(gymRoomIds, startDate, endDate).pipe(
        catchError(() => of([])),
      ),
      allAppointments: this.gymRoomService.getAppointmentsForRooms(gymRoomIds, startDate, endDate).pipe(
        catchError(() => of([] as GymAppointment[])),
      ),
    }).pipe(
      map(({ allSlots, allAppointments }) => {
        // Raggruppa slot per date
        const slotsInfo = new Map<string, any[]>();
        for (const slot of allSlots as any[]) {
          const key = slot.date;
          if (!slotsInfo.has(key)) slotsInfo.set(key, []);
          slotsInfo.get(key)!.push(slot);
        }

        // Raggruppa appuntamenti per date
        const appointments = new Map<string, GymAppointment[]>();
        for (const apt of allAppointments) {
          const key = apt.appointmentDate;
          if (!appointments.has(key)) appointments.set(key, []);
          appointments.get(key)!.push(apt);
        }

        return { slotsInfo, appointments };
      }),
    );
  }

  // ==================== UTILITY ====================

  /**
   * Carica le palestre attive.
   */
  loadGymRooms(): Observable<GymRoom[]> {
    return this.gymRoomService.getAll(true);
  }

  /**
   * Carica i pazienti.
   */
  loadPatients(): Observable<Patient[]> {
    return this.patientService.getPatients();
  }
}
