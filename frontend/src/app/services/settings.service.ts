import { Injectable, Injector } from '@angular/core';
import { gql } from 'apollo-angular';
import { Observable, map, catchError, of } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

export interface GeneralSetting {
  id: string;
  key: string;
  value: any;
  description?: string;
  valueType: string;
  category?: string;
  updatedAt: Date;
}

/**
 * Cosa fa il click su un appuntamento nella vista operatori del calendario.
 * - 'edit-first'    → click = modifica, doppio click = riepilogo (default)
 * - 'summary-first' → click = riepilogo, doppio click = modifica
 */
export type AppointmentClickAction = 'edit-first' | 'summary-first';

export interface CalendarSettings {
  startHour: number;
  endHour: number;
  showWorkingHoursOnly: boolean;
  showWeekend: boolean;
  slotDuration: number;
  defaultView: 'daily' | 'weekly';
  showUnavailableCellsBackground: boolean;
  blockAppointmentsOutsideAvailability: boolean;
  operatorsSelectedOnLoad: boolean;
  showGymInstructorsInOperators: boolean;
  defaultOperatorCategory: string;
  appointmentClickAction: AppointmentClickAction;
}

const GET_ALL_SETTINGS = gql`
  query GetAllSettings {
    generalSettings {
      id
      key
      value
      description
      valueType
      category
      updatedAt
    }
  }
`;

const GET_SETTINGS_BY_CATEGORY = gql`
  query GetSettingsByCategory($category: String!) {
    generalSettingsByCategory(category: $category) {
      id
      key
      value
      description
      valueType
      category
      updatedAt
    }
  }
`;

const GET_SETTING = gql`
  query GetSetting($key: String!) {
    generalSetting(key: $key) {
      id
      key
      value
      description
      valueType
      category
      updatedAt
    }
  }
`;

const UPDATE_SETTING = gql`
  mutation UpdateGeneralSetting($key: String!, $value: JSON!) {
    updateGeneralSetting(key: $key, value: $value) {
      id
      key
      value
      description
      valueType
      category
      updatedAt
    }
  }
`;

const UPSERT_SETTING = gql`
  mutation UpsertGeneralSetting(
    $key: String!
    $value: JSON!
    $description: String
    $valueType: String
    $category: String
  ) {
    upsertGeneralSetting(
      key: $key
      value: $value
      description: $description
      valueType: $valueType
      category: $category
    ) {
      id
      key
      value
      description
      valueType
      category
      updatedAt
    }
  }
`;

const DELETE_SETTING = gql`
  mutation DeleteGeneralSetting($key: String!) {
    deleteGeneralSetting(key: $key)
  }
`;

const INITIALIZE_DEFAULTS = gql`
  mutation InitializeDefaultSettings {
    initializeDefaultSettings
  }
`;

const GET_CALENDAR_SETTINGS = gql`
  query GetCalendarSettings {
    calendarSettings {
      startHour
      endHour
      showWorkingHoursOnly
      showWeekend
      slotDuration
      defaultView
      showUnavailableCellsBackground
      blockAppointmentsOutsideAvailability
      operatorsSelectedOnLoad
      showGymInstructorsInOperators
      defaultOperatorCategory
      appointmentClickAction
    }
  }
`;

@Injectable({
  providedIn: 'root',
})
export class SettingsService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Get all settings
   */
  getAllSettings(): Observable<GeneralSetting[]> {
    return this.query<{ generalSettings: GeneralSetting[] }>(GET_ALL_SETTINGS)
      .pipe(map((result) => result.generalSettings ?? []));
  }

  /**
   * Get settings by category
   */
  getSettingsByCategory(category: string): Observable<GeneralSetting[]> {
    return this.query<{ generalSettingsByCategory: GeneralSetting[] }>(
      GET_SETTINGS_BY_CATEGORY,
      { category }
    ).pipe(map((result) => result.generalSettingsByCategory ?? []));
  }

  /**
   * Get a single setting by key
   */
  getSetting(key: string): Observable<GeneralSetting | null> {
    return this.query<{ generalSetting: GeneralSetting | null }>(
      GET_SETTING,
      { key }
    ).pipe(map((result) => result.generalSetting ?? null));
  }

  /**
   * Update a setting value
   */
  updateSetting(key: string, value: any): Observable<GeneralSetting> {
    return this.mutate<{ updateGeneralSetting: GeneralSetting }>(
      UPDATE_SETTING,
      { key, value }
    ).pipe(map((result) => result.updateGeneralSetting));
  }

  /**
   * Create or update a setting
   */
  upsertSetting(
    key: string,
    value: any,
    options?: {
      description?: string;
      valueType?: string;
      category?: string;
    }
  ): Observable<GeneralSetting> {
    return this.mutate<{ upsertGeneralSetting: GeneralSetting }>(
      UPSERT_SETTING,
      {
        key,
        value,
        description: options?.description,
        valueType: options?.valueType,
        category: options?.category,
      }
    ).pipe(map((result) => result.upsertGeneralSetting));
  }

  /**
   * Delete a setting
   */
  deleteSetting(key: string): Observable<boolean> {
    return this.mutate<{ deleteGeneralSetting: boolean }>(
      DELETE_SETTING,
      { key }
    ).pipe(map((result) => result.deleteGeneralSetting));
  }

  /**
   * Initialize default settings
   */
  initializeDefaults(): Observable<boolean> {
    return this.mutate<{ initializeDefaultSettings: boolean }>(INITIALIZE_DEFAULTS)
      .pipe(map((result) => result.initializeDefaultSettings));
  }

  /**
   * Get calendar settings with fallback to defaults
   */
  getCalendarSettings(): Observable<CalendarSettings> {
    const defaultSettings: CalendarSettings = {
      startHour: 7,
      endHour: 21,
      showWorkingHoursOnly: true,
      showWeekend: true,
      slotDuration: 15,
      defaultView: 'daily',
      showUnavailableCellsBackground: true,
      blockAppointmentsOutsideAvailability: false,
      operatorsSelectedOnLoad: false,
      showGymInstructorsInOperators: true,
      defaultOperatorCategory: 'all',
      appointmentClickAction: 'edit-first',
    };

    return this.query<{ calendarSettings: CalendarSettings }>(GET_CALENDAR_SETTINGS)
      .pipe(
        map((result) => result.calendarSettings ?? defaultSettings),
        catchError((error) => {
          console.warn('Error loading calendar settings, using defaults:', error);
          return of(defaultSettings);
        })
      );
  }
}
