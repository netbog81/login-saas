import { Component, Input, Output, EventEmitter, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Appointment } from '../../../models/appointment.model';
import {
  ConflictBannerComponent,
  ConflictBannerAction,
} from '../../../features/conflicts/components/conflict-banner/conflict-banner.component';
import { ConflictInfo } from '../../../features/conflicts/models/conflict.model';
import { User } from '../../../models/user.model';

export interface SummaryAction {
  /**
   * `chat` apre la conversazione WhatsApp interna col paziente; `share` resta
   * la condivisione del riepilogo verso client esterni (mail o wa.me).
   *
   * `conflict-*` sono le tre uscite del riquadro conflitto: accetta subito,
   * apri il pannello di spostamento, apri il dialog completo. Il riepilogo
   * non chiama nessuna mutation — le esegue il container.
   */
  type: 'edit' | 'delete' | 'share' | 'chat' | 'close'
    | 'conflict-accept' | 'conflict-move' | 'conflict-manage'
    // Le due uscite di un appuntamento segnato "non presentato":
    // `mark-attended` toglie l'assenza (il paziente era arrivato dopo tutto),
    // `book-slot` apre la creazione di un nuovo appuntamento nella stessa
    // fascia, che il no-show ha di fatto liberato.
    | 'mark-attended' | 'book-slot';
  appointment: Appointment;
  shareMethod?: 'email' | 'whatsapp';
}

@Component({
  selector: 'app-appointment-summary',
  standalone: true,
  imports: [CommonModule, ConflictBannerComponent],
  templateUrl: './appointment-summary.component.html',
  styleUrls: ['./appointment-summary.component.scss']
})
export class AppointmentSummaryComponent {
  @Input() appointment!: Appointment;
  @Input() user?: User;
  @Output() action = new EventEmitter<SummaryAction>();
  @Output() clickOutside = new EventEmitter<void>();

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.clickOutside.emit();
    }
  }

  onEdit(): void {
    this.action.emit({
      type: 'edit',
      appointment: this.appointment
    });
  }

  onDelete(): void {
    this.action.emit({
      type: 'delete',
      appointment: this.appointment
    });
  }

  onShareEmail(): void {
    this.action.emit({
      type: 'share',
      appointment: this.appointment,
      shareMethod: 'email'
    });
  }

  /**
   * "Recap WhatsApp": NON è una condivisione del testo come per l'email —
   * fa partire subito al paziente il messaggio di recap dell'appuntamento,
   * lo stesso che riceve alla prenotazione.
   */
  onShareWhatsapp(): void {
    this.action.emit({
      type: 'share',
      appointment: this.appointment,
      shareMethod: 'whatsapp'
    });
  }

  /** Apre la chat WhatsApp interna col paziente (non wa.me). */
  onOpenChat(): void {
    this.action.emit({
      type: 'chat',
      appointment: this.appointment
    });
  }

  onClose(): void {
    this.action.emit({
      type: 'close',
      appointment: this.appointment
    });
  }

  /**
   * Appuntamento con paziente assente. Sblocca il riquadro dedicato: sono le
   * uniche due azioni che su un no-show si vogliono davvero, e non si
   * ricavano da nessun altro pulsante di questo riepilogo.
   */
  get isNoShow(): boolean {
    return (this.appointment?.bookingStatus || '').toLowerCase() === 'no_show';
  }

  /** "Il paziente e' arrivato": toglie l'assenza e la scala dai conteggi. */
  onMarkAttended(): void {
    this.action.emit({ type: 'mark-attended', appointment: this.appointment });
  }

  /** Prenota un altro paziente nella fascia lasciata libera dall'assenza. */
  onBookSlot(): void {
    this.action.emit({ type: 'book-slot', appointment: this.appointment });
  }

  /** Conflitto dell'appuntamento nella forma attesa dal banner. */
  get conflictInfo(): ConflictInfo {
    return {
      hasConflict: !!this.appointment?.hasConflict,
      reason: this.appointment?.conflictReason,
      detectedAt: this.appointment?.conflictDetectedAt,
    };
  }

  onConflictAction(action: ConflictBannerAction): void {
    const map = {
      accept: 'conflict-accept',
      move: 'conflict-move',
      manage: 'conflict-manage',
    } as const;
    this.action.emit({ type: map[action], appointment: this.appointment });
  }

  get formattedTime(): string {
    return `${this.appointment.startTime} - ${this.appointment.endTime}`;
  }

  /**
   * Recapito telefonico del paziente: prima l'anagrafica se caricata, poi il
   * numero denormalizzato sull'appuntamento (sempre presente se la
   * prenotazione l'aveva). Serve all'operatore che deve chiamare il paziente.
   */
  get contactPhone(): string {
    const p = this.appointment.patient;
    return p?.cellulare || p?.telefono || this.appointment.clientPhone || '';
  }

  get contactEmail(): string {
    return this.appointment.patient?.email || '';
  }

  get hasContacts(): boolean {
    return !!(this.contactPhone || this.contactEmail);
  }

  get duration(): string {
    const [startHour, startMin] = this.appointment.startTime.split(':').map(Number);
    const [endHour, endMin] = this.appointment.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const durationMinutes = endMinutes - startMinutes;

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}min`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}min`;
    }
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('it-IT', options);
  }

  get hasServices(): boolean {
    return !!(this.appointment.appointmentServices && this.appointment.appointmentServices.length > 0);
  }

  get servicesNames(): string {
    if (!this.appointment.appointmentServices) return '';
    return this.appointment.appointmentServices
      .map(as => as.service?.name || 'Servizio')
      .join(', ');
  }

  get hasInstruments(): boolean {
    return !!(this.appointment.instruments && this.appointment.instruments.length > 0);
  }

  get instrumentOrderMatters(): boolean {
    return this.appointment.instrumentOrderMatters ?? false;
  }

  get sortedInstruments(): any[] {
    if (!this.appointment.instruments) return [];
    // Ordina per startOffsetMinutes per mostrare in ordine temporale
    return [...this.appointment.instruments].sort((a, b) => a.startOffsetMinutes - b.startOffsetMinutes);
  }

  getInstrumentTimeRange(instrument: { startOffsetMinutes: number; endOffsetMinutes: number }): string {
    const startTime = this.addMinutesToTime(this.appointment.startTime, instrument.startOffsetMinutes);
    const endTime = this.addMinutesToTime(this.appointment.startTime, instrument.endOffsetMinutes);
    return `${startTime} - ${endTime}`;
  }

  /**
   * Restituisce la posizione dello strumento nell'appuntamento
   * Es: "Primi 30 min", "Ultimi 30 min", "Min 15-45"
   */
  getInstrumentPosition(instrument: { startOffsetMinutes: number; endOffsetMinutes: number }): string {
    const duration = this.getDurationMinutes();
    const start = instrument.startOffsetMinutes;
    const end = instrument.endOffsetMinutes;

    if (start === 0 && end === duration) {
      return 'Intero appuntamento';
    } else if (start === 0) {
      return `Primi ${end} min`;
    } else if (end === duration) {
      return `Ultimi ${duration - start} min`;
    } else {
      return `Min ${start}-${end}`;
    }
  }

  /**
   * Restituisce l'etichetta dell'ordine dello strumento
   * Es: "1° strumento", "2° strumento"
   */
  getInstrumentOrderLabel(index: number): string {
    const total = this.appointment.instruments?.length || 0;
    if (total === 1) return '';
    return `${index + 1}° strumento`;
  }

  private getDurationMinutes(): number {
    const [startHour, startMin] = this.appointment.startTime.split(':').map(Number);
    const [endHour, endMin] = this.appointment.endTime.split(':').map(Number);
    return (endHour * 60 + endMin) - (startHour * 60 + startMin);
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }
}