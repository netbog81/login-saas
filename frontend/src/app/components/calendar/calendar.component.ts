import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { User } from '../../models/user.model';
import { Patient } from '../../models/patient.model';
import { Appointment, RepeatConfig } from '../../models/appointment.model';
import { Availability } from '../../models/availability.model';

interface DragState {
  isDragging: boolean;
  startSlot: string | null;
  endSlot: string | null;
  currentUser: number | null;
  dragType: 'create' | 'move' | 'resize' | null;
  appointmentId: number | null;
  originalStartTime?: string;
  originalEndTime?: string;
}

interface TempAppointment {
  userId: number;
  appointment: Appointment;
  dateStr: string;
}

interface MoveConfirmation {
  appointment: Appointment;
  userId: number;
  oldDate: string;
  newDate: string;
  oldStartTime: string;
  newStartTime: string;
  oldEndTime: string;
  newEndTime: string;
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  // Espone Math al template
  Math = Math;

  users: User[] = [];
  selectedUsers: number[] = [];
  currentDate: Date = new Date();
  timeSlotList: string[] = [];
  appointments: { [userId: number]: { [date: string]: Appointment[] } } = {};
  availabilities: { [userId: number]: { [date: string]: Availability[] } } = {};

  // Vista settimanale
  viewMode: 'daily' | 'weekly' = 'daily';
  weekDays: Date[] = [];
  hoveredAppointment: { userId: number; appointmentId: number; date: string } | null = null;
  hoverTimeout: any = null;

  // Durata slot variabile
  slotDuration: 5 | 15 | 30 = 5; // minuti

  dragState: DragState = {
    isDragging: false,
    startSlot: null,
    endSlot: null,
    currentUser: null,
    dragType: null,
    appointmentId: null
  };

  // Data corrente per drag nella vista settimanale
  weeklyDragDate: Date | null = null;

  availabilityMode = false;
  zoomLevel = 1;
  tempAppointment: TempAppointment | null = null;
  moveConfirmation: MoveConfirmation | null = null;

  // Modal state
  showEditModal = false;
  editingAppointment: {
    userId: number;
    appointmentId: number;
    dateStr: string;
  } | null = null;

  editingDetails: {
    title: string;
    clientName: string;
    clientSurname: string;
    clientPhone: string;
    date: string;
    startTime: string;
    endTime: string;
    notes: string;
    repeat: RepeatConfig;
  } = this.getDefaultEditingDetails();

  patientSearch = '';
  showPatientSearch = false;
  showRepeatOptions = false;
  patients: Patient[] = [];
  filteredPatients: Patient[] = [];

  showDeleteConfirm: {
    userId: number;
    appointmentId: number;
    dateStr: string;
    appointmentTitle: string;
  } | null = null;

  modalDocked = false;
  modalPosition = { x: 0, y: 0 };
  isDraggingModal = false;
  dragOffset = { x: 0, y: 0 };

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.generateTimeSlots();
    this.loadUsers();
    this.loadPatients();
    this.calculateWeekDays();
  }

  // === VISTA SETTIMANALE ===

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'daily' ? 'weekly' : 'daily';
    if (this.viewMode === 'weekly') {
      this.calculateWeekDays();
      this.loadWeekData();
    } else {
      this.loadAppointmentsAndAvailabilities();
    }
  }

  calculateWeekDays(): void {
    const current = new Date(this.currentDate);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Lunedì
    const monday = new Date(current.setDate(diff));

    this.weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      this.weekDays.push(date);
    }
  }

  navigateWeek(direction: number): void {
    this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
    this.currentDate = new Date(this.currentDate);
    this.calculateWeekDays();
    this.loadWeekData();
  }

  loadWeekData(): void {
    if (this.weekDays.length === 0) return;

    const startDate = this.formatDateISO(this.weekDays[0]);
    const endDate = this.formatDateISO(this.weekDays[6]);

    // Load appointments per range
    this.apiService.getAppointmentsByDateRange(startDate, endDate).subscribe({
      next: (appointments) => {
        this.appointments = {};
        appointments.forEach(apt => {
          if (!this.appointments[apt.userId]) {
            this.appointments[apt.userId] = {};
          }
          if (!this.appointments[apt.userId][apt.date]) {
            this.appointments[apt.userId][apt.date] = [];
          }
          this.appointments[apt.userId][apt.date].push(apt);
        });
      },
      error: (err) => console.error('Error loading week appointments:', err)
    });

    // Load availabilities per range
    this.apiService.getAvailabilitiesByDateRange(startDate, endDate).subscribe({
      next: (availabilities) => {
        this.availabilities = {};
        availabilities.forEach(avail => {
          if (!this.availabilities[avail.userId]) {
            this.availabilities[avail.userId] = {};
          }
          if (!this.availabilities[avail.userId][avail.date]) {
            this.availabilities[avail.userId][avail.date] = [];
          }
          this.availabilities[avail.userId][avail.date].push(avail);
        });
      },
      error: (err) => console.error('Error loading week availabilities:', err)
    });
  }

  getAppointmentForDateUserSlot(date: Date, userId: number, timeSlot: string): Appointment | null {
    const dateStr = this.formatDateISO(date);
    const userAppointments = this.appointments[userId] || {};
    const dayAppointments = userAppointments[dateStr] || [];

    return dayAppointments.find(apt => {
      return this.timeOverlaps(timeSlot, apt.startTime, apt.endTime);
    }) || null;
  }

  isSlotAvailableForDate(date: Date, userId: number, timeSlot: string): boolean {
    const dateStr = this.formatDateISO(date);
    return this.isSlotAvailable(userId, dateStr, timeSlot);
  }

  // Hover con delay di 1 secondo
  handleAppointmentHover(userId: number, appointmentId: number, date: string, enter: boolean): void {
    if (enter) {
      this.hoverTimeout = setTimeout(() => {
        this.hoveredAppointment = { userId, appointmentId, date };
      }, 1000);
    } else {
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
        this.hoverTimeout = null;
      }
      this.hoveredAppointment = null;
    }
  }

  getWeekRangeText(): string {
    if (this.weekDays.length === 0) return '';
    const start = this.weekDays[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const end = this.weekDays[6].toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${start} - ${end}`;
  }

  getDayName(date: Date): string {
    return date.toLocaleDateString('it-IT', { weekday: 'short' });
  }

  getDayNumber(date: Date): number {
    return date.getDate();
  }

  generateTimeSlots(): void {
    this.timeSlotList = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += this.slotDuration) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        this.timeSlotList.push(timeString);
      }
    }
  }

  changeSlotDuration(duration: 5 | 15 | 30): void {
    this.slotDuration = duration;
    this.generateTimeSlots();
    if (this.viewMode === 'weekly') {
      this.loadWeekData();
    } else {
      this.loadAppointmentsAndAvailabilities();
    }
  }

  loadUsers(): void {
    this.apiService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        // Seleziona tutti gli utenti di default
        this.selectedUsers = users.map(u => u.id);
        this.loadAppointmentsAndAvailabilities();
      },
      error: (err) => console.error('Error loading users:', err)
    });
  }

  loadPatients(): void {
    this.apiService.getPatients().subscribe({
      next: (patients) => {
        this.patients = patients;
        this.filteredPatients = patients;
      },
      error: (err) => console.error('Error loading patients:', err)
    });
  }

  loadAppointmentsAndAvailabilities(): void {
    const dateStr = this.formatDateISO(this.currentDate);

    // Load appointments
    this.apiService.getAppointmentsByDate(dateStr).subscribe({
      next: (appointments) => {
        this.appointments = {};
        appointments.forEach(apt => {
          if (!this.appointments[apt.userId]) {
            this.appointments[apt.userId] = {};
          }
          if (!this.appointments[apt.userId][apt.date]) {
            this.appointments[apt.userId][apt.date] = [];
          }
          this.appointments[apt.userId][apt.date].push(apt);
        });
      },
      error: (err) => console.error('Error loading appointments:', err)
    });

    // Load availabilities
    this.apiService.getAvailabilitiesByDate(dateStr).subscribe({
      next: (availabilities) => {
        this.availabilities = {};
        availabilities.forEach(avail => {
          if (!this.availabilities[avail.userId]) {
            this.availabilities[avail.userId] = {};
          }
          if (!this.availabilities[avail.userId][avail.date]) {
            this.availabilities[avail.userId][avail.date] = [];
          }
          this.availabilities[avail.userId][avail.date].push(avail);
        });
      },
      error: (err) => console.error('Error loading availabilities:', err)
    });
  }

  toggleUser(userId: number): void {
    const index = this.selectedUsers.indexOf(userId);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(userId);
    }
  }

  navigateDay(direction: number): void {
    this.currentDate.setDate(this.currentDate.getDate() + direction);
    this.currentDate = new Date(this.currentDate);
    this.loadAppointmentsAndAvailabilities();
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateISO(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  getAppointmentForSlot(userId: number, timeSlot: string): Appointment | null {
    const dateStr = this.formatDateISO(this.currentDate);
    const userAppointments = this.appointments[userId] || {};
    const dayAppointments = userAppointments[dateStr] || [];

    // Check temp appointment
    if (this.tempAppointment &&
        this.tempAppointment.userId === userId &&
        this.tempAppointment.dateStr === dateStr) {
      const tempApt = this.tempAppointment.appointment;
      if (this.timeOverlaps(timeSlot, tempApt.startTime, tempApt.endTime)) {
        return tempApt;
      }
    }

    return dayAppointments.find(apt => {
      return this.timeOverlaps(timeSlot, apt.startTime, apt.endTime);
    }) || null;
  }

  // Rileva se una cella contiene sia fine che inizio di appuntamenti diversi
  getAppointmentsInSlot(userId: number, timeSlot: string): {ending: Appointment | null, starting: Appointment | null} {
    const dateStr = this.formatDateISO(this.currentDate);
    const userAppointments = this.appointments[userId] || {};
    const dayAppointments = userAppointments[dateStr] || [];

    let ending: Appointment | null = null;
    let starting: Appointment | null = null;

    for (const apt of dayAppointments) {
      if (this.isLastSlot(apt, timeSlot)) {
        ending = apt;
      }
      if (this.isFirstSlot(apt, timeSlot)) {
        starting = apt;
      }
    }

    return { ending, starting };
  }

  // Verifica se uno slot è coperto da un range temporale
  private timeOverlaps(slot: string, startTime: string, endTime: string): boolean {
    const slotMinutes = this.timeToMinutes(slot);
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    const slotEndMinutes = slotMinutes + this.slotDuration;

    // Lo slot è coperto se c'è overlap tra [slotMinutes, slotEndMinutes) e [startMinutes, endMinutes)
    return slotMinutes < endMinutes && slotEndMinutes > startMinutes;
  }

  // Converte "HH:MM" in minuti dal mezzanotte
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Scurisce un colore hex di una percentuale
  private darkenColor(hex: string, percent: number): string {
    // Rimuovi il # se presente
    hex = hex.replace('#', '');

    // Converti in RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Scurisci
    const newR = Math.max(0, Math.floor(r * (100 - percent) / 100));
    const newG = Math.max(0, Math.floor(g * (100 - percent) / 100));
    const newB = Math.max(0, Math.floor(b * (100 - percent) / 100));

    // Converti di nuovo in hex
    return '#' +
      newR.toString(16).padStart(2, '0') +
      newG.toString(16).padStart(2, '0') +
      newB.toString(16).padStart(2, '0');
  }

  isSlotAvailable(userId: number, dateStr: string, timeSlot: string): boolean {
    const availList = this.availabilities[userId]?.[dateStr] || [];

    const slotHour = parseInt(timeSlot.split(':')[0]);
    const slotMinute = parseInt(timeSlot.split(':')[1]);
    const slotTime = slotHour * 60 + slotMinute;

    for (const avail of availList) {
      if (avail.available) {
        const [startHour, startMin] = avail.startTime.split(':').map(Number);
        const [endHour, endMin] = avail.endTime.split(':').map(Number);
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        if (slotTime >= startTime && slotTime < endTime) {
          return true;
        }
      }
    }
    return false;
  }

  // === FEATURE 1: Drag and Drop per spostare appuntamenti ===
  handleMouseDown(userId: number, timeSlot: string, event: MouseEvent): void {
    const dateStr = this.formatDateISO(this.currentDate);
    const existingAppointment = this.getAppointmentForSlot(userId, timeSlot);
    const slotIndex = this.timeSlotList.indexOf(timeSlot);

    if (existingAppointment && !this.tempAppointment) {
      // Determina se è la prima o l'ultima cella
      const startIndex = this.timeSlotList.indexOf(existingAppointment.startTime);
      const endIndex = this.timeSlotList.indexOf(existingAppointment.endTime) - 1;
      const isFirstCell = slotIndex === startIndex;
      const isLastCell = slotIndex === endIndex && endIndex > startIndex;
      const isSingleCell = endIndex === startIndex;

      if (isFirstCell && !isSingleCell) {
        // FEATURE 1: Drag per spostare l'intero appuntamento
        this.dragState = {
          isDragging: true,
          startSlot: timeSlot,
          endSlot: timeSlot,
          currentUser: userId,
          dragType: 'move',
          appointmentId: existingAppointment.id,
          originalStartTime: existingAppointment.startTime,
          originalEndTime: existingAppointment.endTime
        };
        event.preventDefault();
      } else if (isLastCell) {
        // FEATURE 2: Drag per ridimensionare
        this.dragState = {
          isDragging: true,
          startSlot: existingAppointment.startTime,
          endSlot: timeSlot,
          currentUser: userId,
          dragType: 'resize',
          appointmentId: existingAppointment.id,
          originalStartTime: existingAppointment.startTime,
          originalEndTime: existingAppointment.endTime
        };
        event.preventDefault();
      } else if (isSingleCell && isFirstCell) {
        // Per appuntamenti di una cella, permettiamo sia move che resize
        // Iniziamo con 'move' e decidiamo in base al movimento
        this.dragState = {
          isDragging: true,
          startSlot: timeSlot,
          endSlot: timeSlot,
          currentUser: userId,
          dragType: 'move', // Inizia come move, può diventare resize
          appointmentId: existingAppointment.id,
          originalStartTime: existingAppointment.startTime,
          originalEndTime: existingAppointment.endTime
        };
        event.preventDefault();
      }
    } else if (!existingAppointment && this.availabilityMode) {
      // Modalità disponibilità - IMPORTANTE: non mostrare alert qui
      this.dragState = {
        isDragging: true,
        startSlot: timeSlot,
        endSlot: timeSlot,
        currentUser: userId,
        dragType: 'create',
        appointmentId: null
      };
      event.preventDefault();
    } else if (!existingAppointment && !this.availabilityMode) {
      // Creare nuovo appuntamento
      if (!this.isSlotAvailable(userId, dateStr, timeSlot)) {
        alert('Questo slot non è disponibile per appuntamenti');
        return;
      }

      // FEATURE 3: Drag per creare appuntamento con estensione durata
      this.dragState = {
        isDragging: true,
        startSlot: timeSlot,
        endSlot: timeSlot,
        currentUser: userId,
        dragType: 'create',
        appointmentId: null
      };
    }
  }

  handleMouseEnter(userId: number, timeSlot: string): void {
    if (!this.dragState.isDragging || this.dragState.currentUser !== userId) {
      return;
    }

    const dateStr = this.formatDateISO(this.currentDate);
    const currentIndex = this.timeSlotList.indexOf(timeSlot);
    const startIndex = this.timeSlotList.indexOf(this.dragState.startSlot!);
    const originalStartIndex = this.timeSlotList.indexOf(this.dragState.originalStartTime!);

    // Verifica se possiamo estendere fino a questo slot
    if (this.dragState.dragType === 'create') {
      if (this.availabilityMode) {
        // In modalità disponibilità, permetti sempre l'estensione
        this.dragState.endSlot = timeSlot;
      } else {
        // Per creazione appuntamento: verifica disponibilità
        const canExtend = this.canExtendToSlot(userId, dateStr, this.dragState.startSlot!, timeSlot);
        if (canExtend) {
          this.dragState.endSlot = timeSlot;
        }
      }
    } else if (this.dragState.dragType === 'resize') {
      // Per resize: limita alla durata minima e verifica disponibilità
      if (currentIndex >= startIndex) {
        const canExtend = this.canExtendToSlot(userId, dateStr, this.dragState.startSlot!, timeSlot);
        if (canExtend) {
          this.dragState.endSlot = timeSlot;
        }
      }
    } else if (this.dragState.dragType === 'move') {
      // Per move: aggiorna la posizione di inizio, mantenendo la durata originale
      this.dragState.startSlot = timeSlot;
      this.dragState.endSlot = timeSlot;
    } else {
      // Disponibilità mode
      this.dragState.endSlot = timeSlot;
    }
  }

  canExtendToSlot(userId: number, dateStr: string, startSlot: string, endSlot: string): boolean {
    // Calcola il range temporale in minuti
    const startMinutes = this.timeToMinutes(startSlot);
    const endMinutes = this.timeToMinutes(endSlot);
    const minMinutes = Math.min(startMinutes, endMinutes);
    const maxMinutes = Math.max(startMinutes, endMinutes) + this.slotDuration; // +slotDuration perché endSlot è inclusivo

    // Verifica tutti gli slot nel range
    for (const slot of this.timeSlotList) {
      const slotMinutes = this.timeToMinutes(slot);
      const slotEndMinutes = slotMinutes + this.slotDuration;

      // Solo controlla gli slot che si sovrappongono al range
      if (slotMinutes >= maxMinutes || slotEndMinutes <= minMinutes) {
        continue;
      }

      // Verifica disponibilità
      if (!this.isSlotAvailable(userId, dateStr, slot)) {
        return false;
      }

      // Verifica che non ci siano altri appuntamenti
      const existingApt = this.getAppointmentForSlot(userId, slot);
      if (existingApt && (!this.dragState.appointmentId || existingApt.id !== this.dragState.appointmentId)) {
        return false;
      }
    }

    return true;
  }

  handleMouseUp(): void {
    if (!this.dragState.isDragging) return;

    const { startSlot, endSlot, currentUser, dragType, appointmentId } = this.dragState;
    if (!startSlot || !endSlot || !currentUser) {
      this.resetDragState();
      return;
    }

    const startIndex = this.timeSlotList.indexOf(startSlot);
    const endIndex = this.timeSlotList.indexOf(endSlot);
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    const newStartTime = this.timeSlotList[minIndex];
    const newEndTime = this.timeSlotList[Math.min(maxIndex + 1, this.timeSlotList.length - 1)];
    const dateStr = this.formatDateISO(this.currentDate);

    if (dragType === 'move' && appointmentId) {
      // FEATURE 1: Conferma spostamento appuntamento
      const appointment = this.findAppointmentById(appointmentId);
      if (appointment) {
        // Verifica se c'è stato un movimento reale
        if (this.dragState.originalStartTime === newStartTime) {
          // Nessun movimento, ignora
          this.resetDragState();
          return;
        }

        const duration = this.getAppointmentDuration(appointment);
        const newEndIndex = minIndex + duration;
        const calculatedEndTime = this.timeSlotList[Math.min(newEndIndex, this.timeSlotList.length - 1)];

        // Verifica se può essere spostato (controlla fino all'ultima cella inclusa)
        const lastSlotIndex = newEndIndex - 1;
        const canMove = lastSlotIndex < this.timeSlotList.length &&
                       this.canExtendToSlot(currentUser, dateStr, newStartTime, this.timeSlotList[lastSlotIndex]);

        if (canMove) {
          this.moveConfirmation = {
            appointment,
            userId: currentUser,
            oldDate: dateStr,
            newDate: dateStr,
            oldStartTime: this.dragState.originalStartTime!,
            newStartTime,
            oldEndTime: this.dragState.originalEndTime!,
            newEndTime: calculatedEndTime
          };
        } else {
          alert('Non è possibile spostare l\'appuntamento in questa posizione');
        }
      }
    } else if (dragType === 'resize' && appointmentId) {
      // FEATURE 2: Ridimensionamento appuntamento
      const appointment = this.findAppointmentById(appointmentId);
      if (appointment) {
        this.updateAppointmentTime(appointmentId, currentUser, dateStr, appointment.startTime, newEndTime);
      }
    } else if (dragType === 'create' && !this.availabilityMode) {
      // Creazione nuovo appuntamento
      const newAppointment: Appointment = {
        id: Date.now(),
        startTime: newStartTime,
        endTime: newEndTime,
        title: 'Nuovo appuntamento',
        date: dateStr,
        userId: currentUser
      } as Appointment;

      this.tempAppointment = {
        userId: currentUser,
        appointment: newAppointment,
        dateStr
      };

      this.openEditModal(currentUser, newAppointment.id, dateStr, newAppointment);
    } else if (this.availabilityMode) {
      // Modifica disponibilità - Toggle automatico basato sullo stato attuale
      setTimeout(() => {
        // Verifica se l'intervallo è attualmente disponibile
        const isCurrentlyAvailable = this.isSlotAvailable(currentUser, dateStr, newStartTime);

        // Verifica se ci sono appuntamenti nell'intervallo
        const hasAppointments = this.hasAppointmentsInRange(currentUser, dateStr, newStartTime, newEndTime);

        if (hasAppointments && isCurrentlyAvailable) {
          alert(`⚠️ Attenzione: ci sono appuntamenti nell'intervallo ${newStartTime} - ${newEndTime}. Elimina prima gli appuntamenti per rendere l'intervallo non disponibile.`);
          this.resetDragState();
          return;
        }

        // Toggle: se è disponibile, lo rendo indisponibile e viceversa
        const newAvailability = !isCurrentlyAvailable;
        const action = newAvailability ? 'disponibile' : 'non disponibile';
        const confirmMessage = `Rendere l'intervallo ${newStartTime} - ${newEndTime} ${action}?`;

        if (confirm(confirmMessage)) {
          this.createAvailability(currentUser, dateStr, newStartTime, newEndTime, newAvailability);
        }
      }, 100);
    }

    this.resetDragState();
  }

  resetDragState(): void {
    this.dragState = {
      isDragging: false,
      startSlot: null,
      endSlot: null,
      currentUser: null,
      dragType: null,
      appointmentId: null
    };
  }

  getAppointmentDuration(appointment: Appointment): number {
    // Ritorna la durata in numero di slot attuali
    const startMinutes = this.timeToMinutes(appointment.startTime);
    const endMinutes = this.timeToMinutes(appointment.endTime);
    const durationMinutes = endMinutes - startMinutes;
    return Math.ceil(durationMinutes / this.slotDuration);
  }

  findAppointmentById(id: number): Appointment | null {
    for (const userId in this.appointments) {
      for (const date in this.appointments[userId]) {
        const apt = this.appointments[userId][date].find(a => a.id === id);
        if (apt) return apt;
      }
    }
    return null;
  }

  confirmMove(): void {
    if (!this.moveConfirmation) return;

    const { appointment, userId, newStartTime, newEndTime, newDate } = this.moveConfirmation;

    this.updateAppointmentTime(
      appointment.id,
      userId,
      newDate,
      newStartTime,
      newEndTime
    );

    this.moveConfirmation = null;
  }

  cancelMove(): void {
    this.moveConfirmation = null;
  }

  updateAppointmentTime(
    appointmentId: number,
    userId: number,
    dateStr: string,
    newStartTime: string,
    newEndTime: string
  ): void {
    const updateData: Partial<Appointment> = {
      startTime: newStartTime,
      endTime: newEndTime,
      date: dateStr
    };

    this.apiService.updateAppointment(appointmentId, updateData).subscribe({
      next: () => {
        this.loadAppointmentsAndAvailabilities();
      },
      error: (err) => console.error('Error updating appointment:', err)
    });
  }

  hasAppointmentsInRange(userId: number, dateStr: string, startTime: string, endTime: string): boolean {
    const userAppointments = this.appointments[userId] || {};
    const dayAppointments = userAppointments[dateStr] || [];

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    return dayAppointments.some(apt => {
      const aptStartMinutes = this.timeToMinutes(apt.startTime);
      const aptEndMinutes = this.timeToMinutes(apt.endTime);

      // Controlla se c'è sovrapposizione
      return aptStartMinutes < endMinutes && aptEndMinutes > startMinutes;
    });
  }

  checkAppointmentOverlap(
    userId: number,
    date: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId: number
  ): Appointment | null {
    const userAppointments = this.appointments[userId] || {};
    const dayAppointments = userAppointments[date] || [];

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    for (const apt of dayAppointments) {
      // Salta l'appuntamento corrente se stiamo modificando
      if (apt.id === excludeAppointmentId) continue;

      const aptStartMinutes = this.timeToMinutes(apt.startTime);
      const aptEndMinutes = this.timeToMinutes(apt.endTime);

      // Controlla se c'è sovrapposizione
      if (aptStartMinutes < endMinutes && aptEndMinutes > startMinutes) {
        return apt;
      }
    }

    return null;
  }

  createAvailability(
    userId: number,
    date: string,
    startTime: string,
    endTime: string,
    available: boolean
  ): void {
    const availability: Partial<Availability> = {
      userId,
      date,
      startTime,
      endTime,
      available
    };

    this.apiService.createAvailability(availability).subscribe({
      next: () => {
        console.log('✅ Disponibilità salvata:', availability);
        // Ricarica da backend per avere dati aggiornati
        if (this.viewMode === 'weekly') {
          this.loadWeekData();
        } else {
          this.loadAppointmentsAndAvailabilities();
        }
      },
      error: (err) => {
        console.error('❌ Errore nel salvare disponibilità:', err);
        alert('Errore nel salvare la disponibilità. Controlla che il backend sia attivo.');
      }
    });
  }

  // FEATURE 3: Visual feedback durante il drag
  getCellClass(userId: number, timeSlot: string): string {
    const baseHeight = Math.max(16, 20 * this.zoomLevel);
    let className = 'calendar-cell border-b border-gray-100 cursor-pointer transition-colors duration-100 flex items-center px-1 text-xs relative';

    const appointment = this.getAppointmentForSlot(userId, timeSlot);
    const dateStr = this.formatDateISO(this.currentDate);
    const isAvailable = this.isSlotAvailable(userId, dateStr, timeSlot);
    const isTempAppointment = this.tempAppointment &&
      this.tempAppointment.userId === userId &&
      appointment &&
      appointment.id === this.tempAppointment.appointment.id;

    const slotIndex = this.timeSlotList.indexOf(timeSlot);
    const isInDragRange = this.isSlotInDragRange(userId, timeSlot);

    if (appointment && !isTempAppointment) {
      // Il colore dello sfondo è gestito da getCellStyle()
      className += ' border-gray-200';

      // FEATURE 3: Visual feedback per resize
      if (this.dragState.isDragging &&
          this.dragState.dragType === 'resize' &&
          this.dragState.appointmentId === appointment.id) {

        const originalEndMinutes = this.timeToMinutes(this.dragState.originalEndTime!);
        const currentEndMinutes = this.timeToMinutes(this.dragState.endSlot!);
        const slotMinutes = this.timeToMinutes(timeSlot);

        if (currentEndMinutes < originalEndMinutes && slotMinutes >= currentEndMinutes) {
          // Riduzione: tonalità più chiara
          className += ' opacity-50';
        } else if (currentEndMinutes > originalEndMinutes && slotMinutes >= originalEndMinutes && slotMinutes < currentEndMinutes + this.slotDuration) {
          // Allungamento: ring per evidenziare
          className += ' ring-2 ring-blue-400';
        }
      }
    } else if (appointment && isTempAppointment) {
      className += ' bg-yellow-100 border-yellow-200';
    } else if (isInDragRange) {
      if (this.dragState.dragType === 'move') {
        className += ' bg-blue-300 ring-2 ring-blue-500';
      } else if (this.dragState.dragType === 'resize') {
        className += ' bg-green-300';
      } else if (this.availabilityMode) {
        // In modalità disponibilità, mostra anteprima del toggle
        if (isAvailable) {
          className += ' bg-red-200'; // Diventerà indisponibile
        } else {
          className += ' bg-green-200'; // Diventerà disponibile
        }
      } else {
        className += ' bg-red-200';
      }
    } else if (!isAvailable) {
      // Cella non disponibile
      if (this.availabilityMode) {
        className += ' bg-red-50'; // Più evidente in modalità disponibilità
      } else {
        className += ' bg-gray-100';
      }
    } else {
      // Cella disponibile
      if (this.availabilityMode) {
        className += ' bg-green-50 hover:bg-green-100'; // Più evidente in modalità disponibilità
      } else {
        className += ' bg-white hover:bg-gray-50';
      }
    }

    return className;
  }

  isSlotInDragRange(userId: number, timeSlot: string): boolean {
    if (!this.dragState.isDragging || this.dragState.currentUser !== userId) {
      return false;
    }

    if (!this.dragState.startSlot || !this.dragState.endSlot) {
      return false;
    }

    const slotMinutes = this.timeToMinutes(timeSlot);
    const startMinutes = this.timeToMinutes(this.dragState.startSlot);
    const endMinutes = this.timeToMinutes(this.dragState.endSlot);

    const minMinutes = Math.min(startMinutes, endMinutes);
    const maxMinutes = Math.max(startMinutes, endMinutes);

    if (this.dragState.dragType === 'move' && this.dragState.originalStartTime && this.dragState.originalEndTime) {
      // Per il move, mostra il nuovo range basato sulla durata originale
      const originalStartMinutes = this.timeToMinutes(this.dragState.originalStartTime);
      const originalEndMinutes = this.timeToMinutes(this.dragState.originalEndTime);
      const durationMinutes = originalEndMinutes - originalStartMinutes;

      const newEndMinutes = minMinutes + durationMinutes;
      return slotMinutes >= minMinutes && slotMinutes < newEndMinutes;
    }

    return slotMinutes >= minMinutes && slotMinutes <= maxMinutes;
  }

  getCellStyle(userId: number | null, timeSlot: string): any {
    const baseHeight = Math.max(16, 20 * this.zoomLevel);
    const baseStyle: any = {
      height: `${baseHeight}px`,
      minHeight: `${baseHeight}px`
    };

    if (userId !== null) {
      const user = this.getUserById(userId);
      const color = user?.color || '#86efac';

      // Controlla se ci sono due appuntamenti nella stessa cella
      const {ending, starting} = this.getAppointmentsInSlot(userId, timeSlot);

      // Aggiungi bordo sinistro colorato per tutte le celle del medico
      baseStyle.borderLeft = `4px solid ${color}`;

      // Caso speciale: cella con fine di un appuntamento E inizio di un altro
      if (ending && starting && ending.id !== starting.id) {
        // Crea gradiente orizzontale: 30% fine primo, 10% gap, 60% inizio secondo
        const darkerEndColor = this.darkenColor(color, 30);
        baseStyle.background = `linear-gradient(to right,
          ${darkerEndColor} 0%, ${darkerEndColor} 30%,
          transparent 30%, transparent 40%,
          ${color} 40%, ${color} 100%)`;
        baseStyle.opacity = 0.7;
        baseStyle.borderTop = `2px solid ${darkerEndColor}`;
        baseStyle.borderBottom = `2px solid ${color}`;
        return baseStyle;
      }

      // Caso normale: un solo appuntamento
      const appointment = this.getAppointmentForSlot(userId, timeSlot);
      if (appointment) {
        const isFirstSlot = this.isFirstSlot(appointment, timeSlot);
        const isLastSlot = this.isLastSlot(appointment, timeSlot);

        if (isFirstSlot) {
          const fillPercentage = this.getSlotFillPercentage(appointment, timeSlot);
          if (fillPercentage < 100) {
            // Applica gradiente per occupazione parziale
            baseStyle.background = `linear-gradient(to bottom, ${color} 0%, ${color} ${fillPercentage}%, transparent ${fillPercentage}%, transparent 100%)`;
          } else {
            // Occupazione completa
            baseStyle.backgroundColor = color;
            baseStyle.opacity = 0.7;
          }
          // Bordo superiore più spesso per evidenziare l'inizio
          baseStyle.borderTop = `4px solid ${color}`;
        } else {
          // Non è il primo slot, applica colore pieno
          baseStyle.backgroundColor = color;
          baseStyle.opacity = 0.7;
        }

        // Bordo inferiore più spesso per evidenziare la fine
        if (isLastSlot) {
          // Usa una tonalità più scura del colore del medico
          const darkerColor = this.darkenColor(color, 30);
          baseStyle.borderBottom = `3px solid ${darkerColor}`;
        }
      }
    }

    return baseStyle;
  }

  // Calcola la percentuale di riempimento di uno slot
  getSlotFillPercentage(appointment: Appointment, timeSlot: string): number {
    const slotIndex = this.timeSlotList.indexOf(timeSlot);
    const startIndex = this.timeSlotList.indexOf(appointment.startTime);
    const endIndex = this.timeSlotList.indexOf(appointment.endTime);

    // Calcola la durata dell'appuntamento in numero di slot da 5 minuti
    const appointmentSlotsIn5Min = endIndex - startIndex;
    const appointmentMinutes = appointmentSlotsIn5Min * 5;

    // Se l'appuntamento occupa più slot di quello corrente, ritorna 100%
    if (appointmentSlotsIn5Min > 1 && slotIndex < endIndex - 1) {
      return 100;
    }

    // Se l'appuntamento dura meno dello slot corrente, calcola la percentuale
    if (appointmentMinutes < this.slotDuration) {
      return (appointmentMinutes / this.slotDuration) * 100;
    }

    return 100;
  }

  isFirstSlot(appointment: Appointment, timeSlot: string): boolean {
    // È il primo slot se l'appuntamento inizia in questo slot
    const slotMinutes = this.timeToMinutes(timeSlot);
    const startMinutes = this.timeToMinutes(appointment.startTime);
    const slotEndMinutes = slotMinutes + this.slotDuration;

    return startMinutes >= slotMinutes && startMinutes < slotEndMinutes;
  }

  isLastSlot(appointment: Appointment, timeSlot: string): boolean {
    // È l'ultimo slot se l'appuntamento finisce in questo slot o prima del prossimo slot
    const slotMinutes = this.timeToMinutes(timeSlot);
    const endMinutes = this.timeToMinutes(appointment.endTime);
    const slotEndMinutes = slotMinutes + this.slotDuration;

    // Trova lo slot successivo
    const slotIndex = this.timeSlotList.indexOf(timeSlot);
    if (slotIndex === -1 || slotIndex >= this.timeSlotList.length - 1) {
      return endMinutes <= slotEndMinutes;
    }

    const nextSlotMinutes = this.timeToMinutes(this.timeSlotList[slotIndex + 1]);
    return endMinutes > slotMinutes && endMinutes <= nextSlotMinutes;
  }

  openEditModal(userId: number, appointmentId: number, dateStr: string, appointment?: Appointment): void {
    this.editingAppointment = { userId, appointmentId, dateStr };

    if (appointment) {
      this.editingDetails = {
        title: appointment.title || '',
        clientName: appointment.patient?.name || '',
        clientSurname: appointment.patient?.surname || '',
        clientPhone: appointment.patient?.phone || '',
        date: dateStr,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        notes: appointment.notes || '',
        repeat: appointment.repeat || this.getDefaultRepeatConfig()
      };
    }

    this.showEditModal = true;
  }

  saveAppointmentDetails(): void {
    if (!this.editingAppointment) return;

    const { userId, appointmentId, dateStr } = this.editingAppointment;

    const appointmentData: Partial<Appointment> = {
      title: this.editingDetails.title,
      date: this.editingDetails.date,
      startTime: this.editingDetails.startTime,
      endTime: this.editingDetails.endTime,
      userId,
      notes: this.editingDetails.notes,
      repeat: this.editingDetails.repeat
    };

    // Verifica disponibilità dello slot
    if (!this.isSlotAvailable(userId, this.editingDetails.date, this.editingDetails.startTime)) {
      alert('⚠️ Lo slot selezionato non è disponibile per questo operatore.');
      return;
    }

    // Verifica sovrapposizioni con altri appuntamenti
    const overlappingAppointment = this.checkAppointmentOverlap(
      userId,
      this.editingDetails.date,
      this.editingDetails.startTime,
      this.editingDetails.endTime,
      appointmentId
    );

    if (overlappingAppointment) {
      alert(`⚠️ Questo appuntamento si sovrappone con "${overlappingAppointment.title}" (${overlappingAppointment.startTime} - ${overlappingAppointment.endTime})`);
      return;
    }

    // Crea o aggiorna paziente se specificato
    if (this.editingDetails.clientName && this.editingDetails.clientSurname) {
      const patientData: Partial<Patient> = {
        name: this.editingDetails.clientName,
        surname: this.editingDetails.clientSurname,
        phone: this.editingDetails.clientPhone
      };

      // Per semplicità, qui creiamo sempre un nuovo paziente
      // In produzione, dovresti cercare prima se esiste
      this.apiService.createPatient(patientData).subscribe({
        next: (patient) => {
          appointmentData.patientId = patient.id;
          this.saveOrUpdateAppointment(appointmentId, appointmentData);
        },
        error: (err) => {
          console.error('Error creating patient:', err);
          this.saveOrUpdateAppointment(appointmentId, appointmentData);
        }
      });
    } else {
      this.saveOrUpdateAppointment(appointmentId, appointmentData);
    }
  }

  saveOrUpdateAppointment(appointmentId: number, appointmentData: Partial<Appointment>): void {
    if (this.tempAppointment) {
      // Nuovo appuntamento
      this.apiService.createAppointment(appointmentData).subscribe({
        next: () => {
          this.tempAppointment = null;
          this.showEditModal = false;
          this.resetEditingDetails();
          this.loadAppointmentsAndAvailabilities();
        },
        error: (err) => console.error('Error creating appointment:', err)
      });
    } else {
      // Aggiorna esistente
      this.apiService.updateAppointment(appointmentId, appointmentData).subscribe({
        next: () => {
          this.showEditModal = false;
          this.resetEditingDetails();
          this.loadAppointmentsAndAvailabilities();
        },
        error: (err) => console.error('Error updating appointment:', err)
      });
    }
  }

  deleteAppointment(userId: number, appointmentId: number, dateStr: string): void {
    this.apiService.deleteAppointment(appointmentId).subscribe({
      next: () => {
        this.showEditModal = false;
        this.showDeleteConfirm = null;
        this.resetEditingDetails();
        this.loadAppointmentsAndAvailabilities();
      },
      error: (err) => console.error('Error deleting appointment:', err)
    });
  }

  searchPatients(query: string): void {
    this.patientSearch = query;
    if (query) {
      this.apiService.getPatients(query).subscribe({
        next: (patients) => {
          this.filteredPatients = patients;
        },
        error: (err) => console.error('Error searching patients:', err)
      });
    } else {
      this.filteredPatients = this.patients;
    }
  }

  selectPatient(patient: Patient): void {
    this.editingDetails.clientName = patient.name;
    this.editingDetails.clientSurname = patient.surname;
    this.editingDetails.clientPhone = patient.phone;
    this.showPatientSearch = false;
    this.patientSearch = '';
  }

  resetEditingDetails(): void {
    this.editingDetails = this.getDefaultEditingDetails();
    this.editingAppointment = null;
  }

  getDefaultEditingDetails(): any {
    return {
      title: '',
      clientName: '',
      clientSurname: '',
      clientPhone: '',
      date: '',
      startTime: '',
      endTime: '',
      notes: '',
      repeat: this.getDefaultRepeatConfig()
    };
  }

  getDefaultRepeatConfig(): RepeatConfig {
    return {
      enabled: false,
      type: 'daily',
      interval: 1,
      selectedDays: [],
      endType: 'never',
      occurrences: 1,
      untilDate: ''
    };
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.tempAppointment = null;
    this.resetEditingDetails();
  }

  getUserById(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getUserSurname(userId: number): string {
    const user = this.getUserById(userId);
    if (!user || !user.name) return '';
    const parts = user.name.split(' ');
    return parts.length > 0 ? parts[parts.length - 1] : '';
  }

  // Determina se mostrare l'orario per questo indice
  // Mostra ogni slot nella vista corrispondente (ogni 5 per vista 5min, ogni 15 per vista 15min, ogni 30 per vista 30min)
  shouldShowTimeLabel(index: number): boolean {
    return true; // Mostra sempre l'orario per ogni slot
  }

  // === METODI VISTA SETTIMANALE ===

  getWeeklyCellClass(date: Date, userId: number, timeSlot: string): string {
    const appointment = this.getAppointmentForDateUserSlot(date, userId, timeSlot);
    const dateStr = this.formatDateISO(date);
    const isAvailable = this.isSlotAvailable(userId, dateStr, timeSlot);

    // Il colore di sfondo è gestito da getWeeklyCellStyle()
    if (appointment) {
      // Slot occupato da appuntamento
      return 'border-gray-200';
    } else if (!isAvailable) {
      // Slot non disponibile
      return 'bg-gray-300';
    } else {
      // Slot libero
      return '';
    }
  }

  getWeeklyCellStyle(date: Date, userId: number, timeSlot: string): any {
    const baseStyle = this.getCellStyle(userId, timeSlot);
    const appointment = this.getAppointmentForDateUserSlot(date, userId, timeSlot);
    const user = this.getUserById(userId);

    if (appointment && user) {
      // Slot occupato: colora l'intera cella
      return {
        ...baseStyle,
        backgroundColor: user.color,
        opacity: 0.7
      };
    } else if (!appointment && user) {
      // Slot libero: mostra solo bordo sinistro colorato
      return {
        ...baseStyle,
        borderLeft: `4px solid ${user.color}`
      };
    }

    return baseStyle;
  }

  handleWeeklyHover(date: Date, userId: number, timeSlot: string, enter: boolean): void {
    const appointment = this.getAppointmentForDateUserSlot(date, userId, timeSlot);

    if (appointment && enter) {
      const dateStr = this.formatDateISO(date);
      this.handleAppointmentHover(userId, appointment.id, dateStr, true);
    } else if (!enter) {
      this.handleAppointmentHover(0, 0, '', false);
    }
  }

  getHoveredAppointmentDetails(): Appointment | null {
    if (!this.hoveredAppointment) return null;

    const { userId, appointmentId, date } = this.hoveredAppointment;
    const userAppointments = this.appointments[userId];
    if (!userAppointments) return null;

    const dayAppointments = userAppointments[date];
    if (!dayAppointments) return null;

    return dayAppointments.find(apt => apt.id === appointmentId) || null;
  }

  // === WEEKLY VIEW CRUD OPERATIONS ===

  handleWeeklyMouseDown(date: Date, userId: number, timeSlot: string, event: MouseEvent): void {
    this.weeklyDragDate = date;
    const dateStr = this.formatDateISO(date);
    const existingAppointment = this.getAppointmentForDateUserSlot(date, userId, timeSlot);
    const slotIndex = this.timeSlotList.indexOf(timeSlot);

    if (existingAppointment && !this.tempAppointment) {
      const startIndex = this.timeSlotList.indexOf(existingAppointment.startTime);
      const endIndex = this.timeSlotList.indexOf(existingAppointment.endTime) - 1;
      const isFirstCell = slotIndex === startIndex;
      const isLastCell = slotIndex === endIndex && endIndex > startIndex;
      const isSingleCell = endIndex === startIndex;

      if (isFirstCell && !isSingleCell) {
        this.dragState = {
          isDragging: true,
          startSlot: timeSlot,
          endSlot: timeSlot,
          currentUser: userId,
          dragType: 'move',
          appointmentId: existingAppointment.id,
          originalStartTime: existingAppointment.startTime,
          originalEndTime: existingAppointment.endTime
        };
        event.preventDefault();
      } else if (isLastCell) {
        this.dragState = {
          isDragging: true,
          startSlot: existingAppointment.startTime,
          endSlot: timeSlot,
          currentUser: userId,
          dragType: 'resize',
          appointmentId: existingAppointment.id,
          originalStartTime: existingAppointment.startTime,
          originalEndTime: existingAppointment.endTime
        };
        event.preventDefault();
      } else if (isSingleCell && isFirstCell) {
        // Per appuntamenti di una cella, permettiamo sia move che resize
        this.dragState = {
          isDragging: true,
          startSlot: timeSlot,
          endSlot: timeSlot,
          currentUser: userId,
          dragType: 'move', // Inizia come move, può diventare resize
          appointmentId: existingAppointment.id,
          originalStartTime: existingAppointment.startTime,
          originalEndTime: existingAppointment.endTime
        };
        event.preventDefault();
      }
    } else if (!existingAppointment && this.availabilityMode) {
      this.dragState = {
        isDragging: true,
        startSlot: timeSlot,
        endSlot: timeSlot,
        currentUser: userId,
        dragType: 'create',
        appointmentId: null
      };
      event.preventDefault();
    } else if (!existingAppointment && !this.availabilityMode) {
      if (!this.isSlotAvailable(userId, dateStr, timeSlot)) {
        alert('Questo slot non è disponibile per appuntamenti');
        return;
      }

      this.dragState = {
        isDragging: true,
        startSlot: timeSlot,
        endSlot: timeSlot,
        currentUser: userId,
        dragType: 'create',
        appointmentId: null
      };
    }
  }

  handleWeeklyMouseEnter(date: Date, userId: number, timeSlot: string): void {
    if (!this.dragState.isDragging || this.dragState.currentUser !== userId) {
      return;
    }

    // Solo aggiorna se siamo nello stesso giorno
    if (this.weeklyDragDate && this.formatDateISO(date) !== this.formatDateISO(this.weeklyDragDate)) {
      return;
    }

    const dateStr = this.formatDateISO(date);
    const currentIndex = this.timeSlotList.indexOf(timeSlot);
    const startIndex = this.timeSlotList.indexOf(this.dragState.startSlot!);
    const originalStartIndex = this.timeSlotList.indexOf(this.dragState.originalStartTime!);

    if (this.dragState.dragType === 'create') {
      if (this.availabilityMode) {
        // In modalità disponibilità, permetti sempre l'estensione
        this.dragState.endSlot = timeSlot;
      } else {
        const canExtend = this.canExtendToSlot(userId, dateStr, this.dragState.startSlot!, timeSlot);
        if (canExtend) {
          this.dragState.endSlot = timeSlot;
        }
      }
    } else if (this.dragState.dragType === 'resize') {
      if (currentIndex >= startIndex) {
        const canExtend = this.canExtendToSlot(userId, dateStr, this.dragState.startSlot!, timeSlot);
        if (canExtend) {
          this.dragState.endSlot = timeSlot;
        }
      }
    } else if (this.dragState.dragType === 'move') {
      this.dragState.startSlot = timeSlot;
      this.dragState.endSlot = timeSlot;
    }
  }

  handleWeeklyMouseUp(date: Date): void {
    if (!this.dragState.isDragging || !this.weeklyDragDate) {
      this.resetWeeklyDrag();
      return;
    }

    const { startSlot, endSlot, currentUser, dragType, appointmentId } = this.dragState;
    if (!startSlot || !endSlot || !currentUser) {
      this.resetWeeklyDrag();
      return;
    }

    const startIndex = this.timeSlotList.indexOf(startSlot);
    const endIndex = this.timeSlotList.indexOf(endSlot);
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    const newStartTime = this.timeSlotList[minIndex];
    const newEndTime = this.timeSlotList[Math.min(maxIndex + 1, this.timeSlotList.length - 1)];
    const dateStr = this.formatDateISO(this.weeklyDragDate);

    if (dragType === 'move' && appointmentId) {
      const appointment = this.findAppointmentById(appointmentId);
      if (appointment) {
        // Verifica se c'è stato un movimento reale
        if (this.dragState.originalStartTime === newStartTime && appointment.date === dateStr) {
          // Nessun movimento, ignora
          this.resetWeeklyDrag();
          return;
        }

        const duration = this.getAppointmentDuration(appointment);
        const newEndIndex = minIndex + duration;
        const calculatedEndTime = this.timeSlotList[Math.min(newEndIndex, this.timeSlotList.length - 1)];

        // Verifica se può essere spostato (controlla fino all'ultima cella inclusa)
        const lastSlotIndex = newEndIndex - 1;
        const canMove = lastSlotIndex < this.timeSlotList.length &&
                       this.canExtendToSlot(currentUser, dateStr, newStartTime, this.timeSlotList[lastSlotIndex]);

        if (canMove) {
          this.moveConfirmation = {
            appointment,
            userId: currentUser,
            oldDate: appointment.date,
            newDate: dateStr,
            oldStartTime: this.dragState.originalStartTime!,
            newStartTime,
            oldEndTime: this.dragState.originalEndTime!,
            newEndTime: calculatedEndTime
          };
        } else {
          alert('Non è possibile spostare l\'appuntamento in questa posizione');
        }
      }
    } else if (dragType === 'resize' && appointmentId) {
      const appointment = this.findAppointmentById(appointmentId);
      if (appointment) {
        this.updateAppointmentTime(appointmentId, currentUser, dateStr, appointment.startTime, newEndTime);
      }
    } else if (dragType === 'create' && !this.availabilityMode) {
      const newAppointment: Appointment = {
        id: Date.now(),
        startTime: newStartTime,
        endTime: newEndTime,
        title: 'Nuovo appuntamento',
        date: dateStr,
        userId: currentUser
      } as Appointment;

      this.tempAppointment = {
        userId: currentUser,
        appointment: newAppointment,
        dateStr
      };

      this.openEditModal(currentUser, newAppointment.id, dateStr, newAppointment);
    } else if (this.availabilityMode) {
      // Modifica disponibilità - Toggle automatico basato sullo stato attuale
      setTimeout(() => {
        // Verifica se l'intervallo è attualmente disponibile
        const isCurrentlyAvailable = this.isSlotAvailable(currentUser, dateStr, newStartTime);

        // Verifica se ci sono appuntamenti nell'intervallo
        const hasAppointments = this.hasAppointmentsInRange(currentUser, dateStr, newStartTime, newEndTime);

        if (hasAppointments && isCurrentlyAvailable) {
          alert(`⚠️ Attenzione: ci sono appuntamenti nell'intervallo ${newStartTime} - ${newEndTime}. Elimina prima gli appuntamenti per rendere l'intervallo non disponibile.`);
          this.resetWeeklyDrag();
          return;
        }

        // Toggle: se è disponibile, lo rendo indisponibile e viceversa
        const newAvailability = !isCurrentlyAvailable;
        const action = newAvailability ? 'disponibile' : 'non disponibile';
        const confirmMessage = `Rendere l'intervallo ${newStartTime} - ${newEndTime} ${action}?`;

        if (confirm(confirmMessage)) {
          this.createAvailability(currentUser, dateStr, newStartTime, newEndTime, newAvailability);
        }
      }, 100);
    }

    this.resetWeeklyDrag();
  }

  resetWeeklyDrag(): void {
    this.resetDragState();
    this.weeklyDragDate = null;
  }

  handleWeeklyDoubleClick(date: Date, userId: number, timeSlot: string): void {
    const appointment = this.getAppointmentForDateUserSlot(date, userId, timeSlot);
    if (appointment) {
      const dateStr = this.formatDateISO(date);
      this.openEditModal(userId, appointment.id, dateStr, appointment);
    }
  }
}
