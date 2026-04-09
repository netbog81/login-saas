/**
 * Instructor Workspace Models
 * Interfacce per la pagina Istruttori Palestra
 */

import { AvailabilityAppointment, GymRoom } from '../../../graphql/generated/types';
import { TherapeuticPath } from '../../../models/therapeutic-path.model';
import { Treatment } from '../../../models/treatment.model';

// ==================== SLOT GROUPING ====================

/**
 * Gruppo di appuntamenti nello stesso slot orario e palestra
 */
export interface SlotGroup {
  /** Chiave univoca: "${startTime}-${endTime}|${gymRoomId}" */
  key: string;
  startTime: string;
  endTime: string;
  gymRoom: Pick<GymRoom, 'id' | 'name' | 'color' | 'maxCapacity'>;
  appointments: AvailabilityAppointment[];
  date: string; // "YYYY-MM-DD"
}

/**
 * Giorno della settimana con i suoi slot
 */
export interface WeekDay {
  date: Date;
  dateString: string;   // "YYYY-MM-DD"
  dayLabel: string;     // "Lun 24/03"
  isToday: boolean;
  slots: SlotGroup[];
}

// ==================== IN-PROGRESS ====================

/**
 * Dati di una colonna paziente nella vista "In Corso"
 */
export interface PatientTreatmentColumn {
  appointment: AvailabilityAppointment;
  patientId: string;
  patientName: string;
  activePaths: TherapeuticPath[];
  existingTreatment: Treatment | null;
  isAttended: boolean;
  selectedPathId: string | null;
}

// ==================== MULTI-TREATMENT DIALOG ====================

/**
 * Dati passati al MultiTreatmentDialogContainer
 */
export interface MultiTreatmentDialogData {
  appointments: AvailabilityAppointment[];
  operatorId: string;
  date: string;
}

/**
 * Stato di una singola colonna nel dialog multi-trattamento
 */
export interface TreatmentColumnState {
  appointment: AvailabilityAppointment;
  patientId: string;
  patientName: string;
  treatment: Treatment | null;
  activePaths: TherapeuticPath[];
  isAttended: boolean;
  isSaving: boolean;
  isCompleted: boolean;
}

// ==================== EXECUTED (PAST) SLOTS ====================

/**
 * Stato di un singolo paziente in uno slot eseguito (passato).
 * Combina appuntamento + eventuale trattamento associato.
 */
export interface ExecutedPatientEntry {
  appointment: AvailabilityAppointment;
  patientId: string;
  patientName: string;
  treatment: Treatment | null;
  isAttended: boolean;
}

/**
 * Slot eseguito (orario passato) con i pazienti e i loro trattamenti.
 * Estensione di SlotGroup arricchita con dati di trattamento.
 */
export interface ExecutedSlotGroup {
  key: string;
  startTime: string;
  endTime: string;
  gymRoom: SlotGroup['gymRoom'];
  date: string;
  appointments: AvailabilityAppointment[];
  patients: ExecutedPatientEntry[];
}

// ==================== UI STATE ====================

export type ViewMode = 'day' | 'week';

export interface InstructorWorkspaceUIState {
  viewMode: ViewMode;
  loadingAppointments: boolean;
  error: string | null;
}

// ==================== HELPERS ====================

/**
 * Raggruppa appuntamenti per slot orario + palestra
 */
export function groupAppointmentsBySlot(
  appointments: AvailabilityAppointment[],
): SlotGroup[] {
  const map = new Map<string, SlotGroup>();

  for (const apt of appointments) {
    const gymRoomId = apt.gymRoomId || 'no-room';
    const key = `${apt.startTime}-${apt.endTime}|${gymRoomId}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        startTime: apt.startTime,
        endTime: apt.endTime,
        gymRoom: apt.gymRoom
          ? { id: apt.gymRoom.id, name: apt.gymRoom.name, color: apt.gymRoom.color ?? undefined, maxCapacity: apt.gymRoom.maxCapacity }
          : { id: gymRoomId, name: 'Sconosciuta', maxCapacity: 4 },
        appointments: [],
        date: apt.appointmentDate,
      });
    }
    map.get(key)!.appointments.push(apt);
  }

  return Array.from(map.values()).sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.gymRoom.name.localeCompare(b.gymRoom.name),
  );
}

/**
 * Filtra gli slot mantenendo solo quelli passati rispetto al momento di valutazione.
 * Regole:
 * - Se la data selezionata è nel futuro -> nessuno slot.
 * - Se la data selezionata è nel passato -> tutti gli slot.
 * - Se la data selezionata è oggi -> solo gli slot con endTime <= oraCorrente (HH:MM).
 */
export function filterPastSlots(
  slots: SlotGroup[],
  selectedDate: Date,
  now: Date = new Date(),
): SlotGroup[] {
  const selectedStr = formatDateLocal(selectedDate);
  const todayStr = formatDateLocal(now);

  if (selectedStr > todayStr) {
    return [];
  }
  if (selectedStr < todayStr) {
    return [...slots];
  }
  // Stessa giornata: confronta endTime <= oraCorrente
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return slots.filter((s) => s.endTime <= currentTime);
}

/**
 * Format Date -> YYYY-MM-DD usando il fuso locale (evita lo shift UTC di toISOString).
 */
export function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Costruisce array di WeekDay per una settimana a partire dalla data selezionata
 */
export function buildWeekDays(
  selectedDate: Date,
  appointments: AvailabilityAppointment[],
): WeekDay[] {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Trova lunedì della settimana
  const monday = new Date(selectedDate);
  const dayOfWeek = monday.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + diff);

  const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const weekDays: WeekDay[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateString = d.toISOString().split('T')[0];
    const dayAppts = appointments.filter(a => a.appointmentDate === dateString);

    weekDays.push({
      date: d,
      dateString,
      dayLabel: `${dayNames[i]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
      isToday: dateString === todayStr,
      slots: groupAppointmentsBySlot(dayAppts),
    });
  }

  return weekDays;
}
