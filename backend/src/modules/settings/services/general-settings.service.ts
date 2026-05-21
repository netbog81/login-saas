import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeneralSettings } from '../entities/general-settings.entity';

/**
 * Chiavi di impostazione predefinite
 */
export const SETTINGS_KEYS = {
  // Sala d'attesa
  WAITING_ROOM_ENABLED: 'waitingRoom.enabled',
  WAITING_ROOM_METHOD: 'waitingRoom.method', // 'manual' | 'qrcode'

  // WhatsApp / Notifiche
  WHATSAPP_ENABLED: 'whatsapp.enabled',
  WHATSAPP_REMINDER_HOURS: 'whatsapp.reminderHours',

  // Appuntamenti
  APPOINTMENT_DEFAULT_DURATION: 'appointment.defaultDuration',
  APPOINTMENT_BUFFER_BEFORE: 'appointment.bufferBefore',
  APPOINTMENT_BUFFER_AFTER: 'appointment.bufferAfter',
  APPOINTMENT_SLOT_DURATION_DEFAULT: 'appointment.defaultSlotDuration',
  APPOINTMENT_SLOT_DURATION_PRIORITY: 'appointment.slotDurationPriority',

  // Calendario
  CALENDAR_START_HOUR: 'calendar.startHour',
  CALENDAR_END_HOUR: 'calendar.endHour',
  CALENDAR_SHOW_WORKING_HOURS_ONLY: 'calendar.showWorkingHoursOnly',
  CALENDAR_SHOW_WEEKEND: 'calendar.showWeekend',
  CALENDAR_SLOT_DURATION: 'calendar.slotDuration',
  CALENDAR_DEFAULT_VIEW: 'calendar.defaultView',
  CALENDAR_SHOW_UNAVAILABLE_BACKGROUND: 'calendar.showUnavailableCellsBackground',
  CALENDAR_BLOCK_OUTSIDE_AVAILABILITY: 'calendar.blockAppointmentsOutsideAvailability',

  // Auto Attendance (cambio automatico stato appuntamento)
  AUTO_ATTENDANCE_ENABLED: 'autoAttendance.enabled',
  AUTO_ATTENDANCE_OFFSET_MINUTES: 'autoAttendance.offsetMinutes',
} as const;

@Injectable()
export class GeneralSettingsService {
  constructor(
    @InjectRepository(GeneralSettings)
    private settingsRepo: Repository<GeneralSettings>,
  ) {}

  /**
   * Ottieni tutte le impostazioni
   */
  async findAll(): Promise<GeneralSettings[]> {
    return this.settingsRepo.find({
      order: { category: 'ASC', key: 'ASC' }
    });
  }

  /**
   * Ottieni impostazioni per categoria
   */
  async findByCategory(category: string): Promise<GeneralSettings[]> {
    return this.settingsRepo.find({
      where: { category },
      order: { key: 'ASC' }
    });
  }

  /**
   * Ottieni singola impostazione per chiave
   */
  async findByKey(key: string): Promise<GeneralSettings | null> {
    return this.settingsRepo.findOne({ where: { key } });
  }

  /**
   * Ottieni valore di un'impostazione (ritorna default se non esiste)
   */
  async getValue<T = any>(key: string, defaultValue?: T): Promise<T> {
    const setting = await this.findByKey(key);
    if (!setting) {
      return defaultValue as T;
    }
    return setting.value as T;
  }

  /**
   * Crea o aggiorna un'impostazione
   */
  async upsert(
    key: string,
    value: any,
    options?: {
      description?: string;
      valueType?: string;
      category?: string;
    }
  ): Promise<GeneralSettings> {
    let setting = await this.findByKey(key);

    if (setting) {
      // Update
      setting.value = value;
      if (options?.description) setting.description = options.description;
      if (options?.valueType) setting.valueType = options.valueType;
      if (options?.category) setting.category = options.category;
    } else {
      // Create
      setting = this.settingsRepo.create({
        key,
        value,
        description: options?.description,
        valueType: options?.valueType || this.inferValueType(value),
        category: options?.category || this.inferCategory(key)
      });
    }

    return this.settingsRepo.save(setting);
  }

  /**
   * Aggiorna solo il valore di un'impostazione esistente
   */
  async updateValue(key: string, value: any): Promise<GeneralSettings> {
    const setting = await this.findByKey(key);
    if (!setting) {
      throw new NotFoundException(`Impostazione '${key}' non trovata`);
    }

    setting.value = value;
    return this.settingsRepo.save(setting);
  }

  /**
   * Elimina un'impostazione
   */
  async delete(key: string): Promise<boolean> {
    const result = await this.settingsRepo.delete({ key });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Inizializza impostazioni predefinite (da chiamare al bootstrap)
   */
  async initializeDefaults(): Promise<void> {
    const defaults = [
      {
        key: SETTINGS_KEYS.WAITING_ROOM_ENABLED,
        value: false,
        description: 'Abilita conferma arrivo paziente in sala d\'attesa',
        valueType: 'boolean',
        category: 'waitingRoom'
      },
      {
        key: SETTINGS_KEYS.WAITING_ROOM_METHOD,
        value: 'manual',
        description: 'Metodo conferma arrivo: manual o qrcode',
        valueType: 'string',
        category: 'waitingRoom'
      },
      {
        key: SETTINGS_KEYS.WHATSAPP_ENABLED,
        value: false,
        description: 'Abilita notifiche WhatsApp',
        valueType: 'boolean',
        category: 'whatsapp'
      },
      {
        key: SETTINGS_KEYS.WHATSAPP_REMINDER_HOURS,
        value: 24,
        description: 'Ore prima dell\'appuntamento per inviare reminder',
        valueType: 'number',
        category: 'whatsapp'
      },
      {
        key: SETTINGS_KEYS.APPOINTMENT_DEFAULT_DURATION,
        value: 30,
        description: 'Durata predefinita appuntamento in minuti',
        valueType: 'number',
        category: 'appointment'
      },
      {
        key: SETTINGS_KEYS.APPOINTMENT_SLOT_DURATION_DEFAULT,
        value: 45,
        description: 'Durata standard slot per generazione appuntamenti (step in minuti)',
        valueType: 'number',
        category: 'appointment'
      },
      {
        key: SETTINGS_KEYS.APPOINTMENT_SLOT_DURATION_PRIORITY,
        value: 'operator',
        description: 'Priorità durata slot: operator (usa preferenza operatore) o system (usa impostazione di sistema)',
        valueType: 'string',
        category: 'appointment'
      },
      // Calendario
      {
        key: SETTINGS_KEYS.CALENDAR_START_HOUR,
        value: 7,
        description: 'Ora inizio visualizzazione calendario',
        valueType: 'number',
        category: 'calendar'
      },
      {
        key: SETTINGS_KEYS.CALENDAR_END_HOUR,
        value: 21,
        description: 'Ora fine visualizzazione calendario',
        valueType: 'number',
        category: 'calendar'
      },
      {
        key: SETTINGS_KEYS.CALENDAR_SHOW_WORKING_HOURS_ONLY,
        value: true,
        description: 'Mostra solo orari lavorativi nel calendario',
        valueType: 'boolean',
        category: 'calendar'
      },
      {
        key: SETTINGS_KEYS.CALENDAR_SHOW_WEEKEND,
        value: true,
        description: 'Mostra weekend nel calendario settimanale',
        valueType: 'boolean',
        category: 'calendar'
      },
      {
        key: SETTINGS_KEYS.CALENDAR_SLOT_DURATION,
        value: 15,
        description: 'Durata slot griglia calendario in minuti',
        valueType: 'number',
        category: 'calendar'
      },
      {
        key: SETTINGS_KEYS.CALENDAR_DEFAULT_VIEW,
        value: 'daily',
        description: 'Vista predefinita calendario: daily o weekly',
        valueType: 'string',
        category: 'calendar'
      },
      {
        key: SETTINGS_KEYS.CALENDAR_SHOW_UNAVAILABLE_BACKGROUND,
        value: true,
        description: 'Mostra sfondo evidenziato per celle non disponibili',
        valueType: 'boolean',
        category: 'calendar'
      },
      {
        key: SETTINGS_KEYS.CALENDAR_BLOCK_OUTSIDE_AVAILABILITY,
        value: false,
        description: 'Blocca la creazione/spostamento di appuntamenti fuori dalla disponibilità dell\'operatore',
        valueType: 'boolean',
        category: 'calendar'
      },
      // Auto Attendance
      {
        key: SETTINGS_KEYS.AUTO_ATTENDANCE_ENABLED,
        value: false,
        description: 'Abilita cambio automatico stato appuntamento a ATTENDED quando scatta l\'ora di inizio',
        valueType: 'boolean',
        category: 'autoAttendance'
      },
      {
        key: SETTINGS_KEYS.AUTO_ATTENDANCE_OFFSET_MINUTES,
        value: 0,
        description: 'Minuti di offset per cambio automatico stato (negativo = prima dell\'ora, positivo = dopo)',
        valueType: 'number',
        category: 'autoAttendance'
      }
    ];

    for (const def of defaults) {
      const exists = await this.findByKey(def.key);
      if (!exists) {
        await this.settingsRepo.save(this.settingsRepo.create(def));
      }
    }
  }

  // ==================== HELPERS ====================

  /**
   * Helper: verifica se sala d'attesa è abilitata
   */
  async isWaitingRoomEnabled(): Promise<boolean> {
    return this.getValue<boolean>(SETTINGS_KEYS.WAITING_ROOM_ENABLED, false);
  }

  /**
   * Helper: ottieni metodo conferma arrivo
   */
  async getWaitingRoomMethod(): Promise<'manual' | 'qrcode'> {
    return this.getValue<'manual' | 'qrcode'>(SETTINGS_KEYS.WAITING_ROOM_METHOD, 'manual');
  }

  /**
   * Helper: verifica se WhatsApp è abilitato
   */
  async isWhatsAppEnabled(): Promise<boolean> {
    return this.getValue<boolean>(SETTINGS_KEYS.WHATSAPP_ENABLED, false);
  }

  /**
   * Helper: ottieni durata default slot per generazione appuntamenti
   */
  async getDefaultSlotDuration(): Promise<number> {
    return this.getValue<number>(SETTINGS_KEYS.APPOINTMENT_SLOT_DURATION_DEFAULT, 45);
  }

  /**
   * Helper: ottieni priorità durata slot (operator o system)
   */
  async getSlotDurationPriority(): Promise<'operator' | 'system'> {
    return this.getValue<'operator' | 'system'>(SETTINGS_KEYS.APPOINTMENT_SLOT_DURATION_PRIORITY, 'operator');
  }

  // ==================== CALENDAR HELPERS ====================

  /**
   * Helper: ottieni configurazione completa calendario
   */
  async getCalendarSettings(): Promise<{
    startHour: number;
    endHour: number;
    showWorkingHoursOnly: boolean;
    showWeekend: boolean;
    slotDuration: number;
    defaultView: 'daily' | 'weekly';
    showUnavailableCellsBackground: boolean;
    blockAppointmentsOutsideAvailability: boolean;
  }> {
    const [startHour, endHour, showWorkingHoursOnly, showWeekend, slotDuration, defaultView, showUnavailableCellsBackground, blockAppointmentsOutsideAvailability] = await Promise.all([
      this.getValue<number>(SETTINGS_KEYS.CALENDAR_START_HOUR, 7),
      this.getValue<number>(SETTINGS_KEYS.CALENDAR_END_HOUR, 21),
      this.getValue<boolean>(SETTINGS_KEYS.CALENDAR_SHOW_WORKING_HOURS_ONLY, true),
      this.getValue<boolean>(SETTINGS_KEYS.CALENDAR_SHOW_WEEKEND, true),
      this.getValue<number>(SETTINGS_KEYS.CALENDAR_SLOT_DURATION, 45),
      this.getValue<'daily' | 'weekly'>(SETTINGS_KEYS.CALENDAR_DEFAULT_VIEW, 'daily'),
      this.getValue<boolean>(SETTINGS_KEYS.CALENDAR_SHOW_UNAVAILABLE_BACKGROUND, true),
      this.getValue<boolean>(SETTINGS_KEYS.CALENDAR_BLOCK_OUTSIDE_AVAILABILITY, false),
    ]);

    return {
      startHour,
      endHour,
      showWorkingHoursOnly,
      showWeekend,
      slotDuration,
      defaultView,
      showUnavailableCellsBackground,
      blockAppointmentsOutsideAvailability,
    };
  }

  /**
   * Helper: verifica se il blocco appuntamenti fuori disponibilità è attivo.
   */
  async isBlockOutsideAvailabilityEnabled(): Promise<boolean> {
    return this.getValue<boolean>(SETTINGS_KEYS.CALENDAR_BLOCK_OUTSIDE_AVAILABILITY, false);
  }

  // ==================== AUTO ATTENDANCE HELPERS ====================

  /**
   * Helper: verifica se auto attendance è abilitato
   */
  async isAutoAttendanceEnabled(): Promise<boolean> {
    return this.getValue<boolean>(SETTINGS_KEYS.AUTO_ATTENDANCE_ENABLED, false);
  }

  /**
   * Helper: ottieni offset minuti per auto attendance
   * Negativo = prima dell'ora di inizio, Positivo = dopo
   */
  async getAutoAttendanceOffsetMinutes(): Promise<number> {
    return this.getValue<number>(SETTINGS_KEYS.AUTO_ATTENDANCE_OFFSET_MINUTES, 0);
  }

  /**
   * Helper: ottieni configurazione completa auto attendance
   */
  async getAutoAttendanceSettings(): Promise<{
    enabled: boolean;
    offsetMinutes: number;
  }> {
    const [enabled, offsetMinutes] = await Promise.all([
      this.isAutoAttendanceEnabled(),
      this.getAutoAttendanceOffsetMinutes()
    ]);

    return { enabled, offsetMinutes };
  }

  // ==================== PRIVATE HELPERS ====================

  private inferValueType(value: any): string {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'object') return 'json';
    return 'string';
  }

  private inferCategory(key: string): string {
    const parts = key.split('.');
    return parts.length > 1 ? parts[0] : 'general';
  }
}
