/**
 * Calendar V2 Grid Service
 * Layer 3: Business Logic
 *
 * Pre-calcola TUTTI i dati della griglia (celle, posizioni eventi)
 * in una singola passata. Il risultato e' un oggetto immutabile
 * che il componente grid renderizza senza mai chiamare funzioni dal template.
 */

import { Injectable } from '@angular/core';
import { Appointment } from '../../../models/appointment.model';
import {
  CalendarV2Config,
  CalendarOperator,
  OperatorGridData,
  OperatorColumnData,
  CellState,
  PositionedEvent,
  TimeSlot,
  OperatorAvailability,
} from '../models/calendar-v2.model';

@Injectable({ providedIn: 'root' })
export class CalendarV2GridService {

  /**
   * Calcola l'intera griglia operatori in una passata.
   * Chiamato una volta quando cambiano i dati.
   * Ritorna un oggetto immutabile pronto per il rendering.
   */
  computeOperatorGrid(
    config: CalendarV2Config,
    dates: string[],
    operators: CalendarOperator[],
    appointments: Map<string, Map<string, Appointment[]>>,
    availabilities: Map<string, Map<string, { startTime: string; endTime: string }[]>>,
  ): OperatorGridData {
    const timeSlots = this.computeTimeSlots(config);
    const baseSlotHeight = 60; // px base
    const slotHeightPx = baseSlotHeight * config.zoom;

    const columns: OperatorColumnData[] = [];

    for (const date of dates) {
      for (const op of operators) {
        // Celle pre-calcolate
        const opAvails = availabilities.get(op.operatorId)?.get(date) || [];
        const cells = this.computeCells(timeSlots, config.slotDuration, opAvails, op.hasTemplate);

        // Eventi posizionati
        const dayAppointments = appointments.get(op.operatorId)?.get(date) || [];
        const events = this.computeEventPositions(dayAppointments, timeSlots, slotHeightPx, config.slotDuration, op.color, op.operatorId, date);

        columns.push({
          operatorId: op.operatorId,
          operatorName: op.name,
          operatorColor: op.color,
          date,
          cells,
          events,
        });
      }
    }

    return { columns, timeSlots, slotHeightPx, dates };
  }

  // ==================== TIME SLOTS ====================

  private computeTimeSlots(config: CalendarV2Config): TimeSlot[] {
    const startHour = config.showWorkingHoursOnly ? config.workingHoursStart : config.startHour;
    const endHour = config.showWorkingHoursOnly ? config.workingHoursEnd : config.endHour;
    const slots: TimeSlot[] = [];
    let index = 0;

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += config.slotDuration) {
        if (h * 60 + m >= endHour * 60) break;
        slots.push({
          time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          index: index++,
        });
      }
    }
    return slots;
  }

  // ==================== CELLS ====================

  private computeCells(
    timeSlots: TimeSlot[],
    slotDuration: number,
    availabilities: { startTime: string; endTime: string }[],
    hasTemplate: boolean,
  ): CellState[] {
    return timeSlots.map(slot => {
      const slotStart = this.timeToMinutes(slot.time);
      const slotEnd = slotStart + slotDuration;

      let available = false;
      let unavailableTopPct = 0;
      let unavailableBottomPct = 0;

      if (!hasTemplate) {
        // Senza template, tutto disponibile
        available = true;
      } else if (availabilities.length === 0) {
        // Template ma nessuna disponibilita' per questo giorno
        available = false;
      } else {
        // Calcola copertura disponibilita'
        let coveredStart = slotEnd;
        let coveredEnd = slotStart;

        for (const avail of availabilities) {
          const availStart = this.timeToMinutes(avail.startTime);
          const availEnd = this.timeToMinutes(avail.endTime);

          if (availStart < slotEnd && availEnd > slotStart) {
            coveredStart = Math.min(coveredStart, Math.max(availStart, slotStart));
            coveredEnd = Math.max(coveredEnd, Math.min(availEnd, slotEnd));
          }
        }

        if (coveredStart < slotEnd && coveredEnd > slotStart) {
          available = true;
          const topUnavail = Math.max(0, coveredStart - slotStart);
          const bottomUnavail = Math.max(0, slotEnd - coveredEnd);
          unavailableTopPct = (topUnavail / slotDuration) * 100;
          unavailableBottomPct = (bottomUnavail / slotDuration) * 100;
        }
      }

      // CSS class pre-calcolata
      let cssClass = available ? 'cell-available' : 'cell-unavailable';
      if (!hasTemplate) cssClass = 'cell-no-template';

      return { available, occupied: false, unavailableTopPct, unavailableBottomPct, cssClass };
    });
  }

  // ==================== EVENT POSITIONS ====================

  private computeEventPositions(
    appointments: Appointment[],
    timeSlots: TimeSlot[],
    slotHeightPx: number,
    slotDuration: number,
    defaultColor: string,
    operatorId: string,
    date: string,
  ): PositionedEvent[] {
    if (appointments.length === 0 || timeSlots.length === 0) return [];

    const gridStartMinutes = this.timeToMinutes(timeSlots[0].time);
    const pxPerMinute = slotHeightPx / slotDuration;

    // Ordina per startTime
    const sorted = [...appointments].sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Calcola overlap groups per larghezza
    const groups = this.computeOverlapGroups(sorted);

    const events: PositionedEvent[] = [];

    for (const group of groups) {
      const groupSize = group.length;
      group.forEach((apt, idx) => {
        const startMin = this.timeToMinutes(apt.startTime);
        const endMin = this.timeToMinutes(apt.endTime);
        const topPx = (startMin - gridStartMinutes) * pxPerMinute;
        const heightPx = Math.max((endMin - startMin) * pxPerMinute, slotHeightPx * 0.5);

        const widthPct = 100 / groupSize;
        const leftPct = widthPct * idx;

        // Titolo: nome paziente + servizio
        const serviceName = apt.appointmentServices?.[0]?.service?.name || apt.service?.name || '';
        const title = apt.title || 'Appuntamento';
        const timeLabel = `${apt.startTime} - ${apt.endTime}`;

        events.push({
          appointment: apt,
          operatorId,
          date,
          topPx,
          heightPx,
          leftPct,
          widthPct,
          color: defaultColor,
          title,
          timeLabel,
          isRecurring: apt.isRecurring || false,
          originalStartTime: apt.startTime,
          originalEndTime: apt.endTime,
        });
      });
    }

    return events;
  }

  /**
   * Raggruppa appuntamenti sovrapposti per calcolo larghezza.
   */
  private computeOverlapGroups(appointments: Appointment[]): Appointment[][] {
    const groups: Appointment[][] = [];
    let currentGroup: Appointment[] = [];
    let currentGroupEnd = 0;

    for (const apt of appointments) {
      const start = this.timeToMinutes(apt.startTime);
      const end = this.timeToMinutes(apt.endTime);

      if (currentGroup.length === 0 || start < currentGroupEnd) {
        // Si sovrappone: aggiungi al gruppo
        currentGroup.push(apt);
        currentGroupEnd = Math.max(currentGroupEnd, end);
      } else {
        // Non si sovrappone: chiudi gruppo e inizia nuovo
        groups.push(currentGroup);
        currentGroup = [apt];
        currentGroupEnd = end;
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    return groups;
  }

  // ==================== UTILITIES ====================

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
