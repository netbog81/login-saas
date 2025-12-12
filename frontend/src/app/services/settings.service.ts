import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map, catchError, of } from 'rxjs';

export interface GeneralSetting {
  id: string;
  key: string;
  value: any;
  description?: string;
  valueType: string;
  category?: string;
  updatedAt: Date;
}

export interface CalendarSettings {
  startHour: number;
  endHour: number;
  showWorkingHoursOnly: boolean;
  showWeekend: boolean;
  slotDuration: number;
  defaultView: 'daily' | 'weekly';
  showUnavailableCellsBackground: boolean;
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
    }
  }
`;

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  constructor(private apollo: Apollo) {}

  /**
   * Get all settings
   */
  getAllSettings(): Observable<GeneralSetting[]> {
    return this.apollo
      .query<{ generalSettings: GeneralSetting[] }>({
        query: GET_ALL_SETTINGS,
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.generalSettings ?? []));
  }

  /**
   * Get settings by category
   */
  getSettingsByCategory(category: string): Observable<GeneralSetting[]> {
    return this.apollo
      .query<{ generalSettingsByCategory: GeneralSetting[] }>({
        query: GET_SETTINGS_BY_CATEGORY,
        variables: { category },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.generalSettingsByCategory ?? []));
  }

  /**
   * Get a single setting by key
   */
  getSetting(key: string): Observable<GeneralSetting | null> {
    return this.apollo
      .query<{ generalSetting: GeneralSetting | null }>({
        query: GET_SETTING,
        variables: { key },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.generalSetting ?? null));
  }

  /**
   * Update a setting value
   */
  updateSetting(key: string, value: any): Observable<GeneralSetting> {
    return this.apollo
      .mutate<{ updateGeneralSetting: GeneralSetting }>({
        mutation: UPDATE_SETTING,
        variables: { key, value },
      })
      .pipe(map((result) => result.data!.updateGeneralSetting));
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
    return this.apollo
      .mutate<{ upsertGeneralSetting: GeneralSetting }>({
        mutation: UPSERT_SETTING,
        variables: {
          key,
          value,
          description: options?.description,
          valueType: options?.valueType,
          category: options?.category,
        },
      })
      .pipe(map((result) => result.data!.upsertGeneralSetting));
  }

  /**
   * Delete a setting
   */
  deleteSetting(key: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteGeneralSetting: boolean }>({
        mutation: DELETE_SETTING,
        variables: { key },
      })
      .pipe(map((result) => result.data!.deleteGeneralSetting));
  }

  /**
   * Initialize default settings
   */
  initializeDefaults(): Observable<boolean> {
    return this.apollo
      .mutate<{ initializeDefaultSettings: boolean }>({
        mutation: INITIALIZE_DEFAULTS,
      })
      .pipe(map((result) => result.data!.initializeDefaultSettings));
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
    };

    return this.apollo
      .query<{ calendarSettings: CalendarSettings }>({
        query: GET_CALENDAR_SETTINGS,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => result.data?.calendarSettings ?? defaultSettings),
        catchError((error) => {
          console.warn('Error loading calendar settings, using defaults:', error);
          return of(defaultSettings);
        })
      );
  }
}
