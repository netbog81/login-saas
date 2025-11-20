import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  GET_AVAILABILITY_TEMPLATES,
  GET_ALL_TEMPLATES,
  GET_ALL_TEMPLATE_PATTERNS,
} from '../graphql/operations/template.queries';
import {
  CREATE_AVAILABILITY_TEMPLATE,
  UPDATE_AVAILABILITY_TEMPLATE,
  DELETE_AVAILABILITY_TEMPLATE,
  REBUILD_AVAILABILITY_CACHE,
  CREATE_TEMPLATE_PATTERN,
  UPDATE_TEMPLATE_PATTERN,
  DELETE_TEMPLATE_PATTERN,
  ASSIGN_TEMPLATE_TO_OPERATOR,
} from '../graphql/operations/template.mutations';
import {
  AvailabilityTemplate,
  CreateAvailabilityTemplateInput,
  CreateTemplatePatternInput,
  TemplatePattern as BackendTemplatePattern,
  TemplateAssignment as BackendTemplateAssignment,
  AssignTemplateToOperatorInput,
} from '../graphql/generated/types';
import {
  TemplatePattern,
  TimeSlot,
  DaySchedule,
  WeekSchedule,
} from '../graphql/ui-types';

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  constructor(private apollo: Apollo) {}

  /**
   * Ottiene tutti i template per un operatore
   */
  getTemplatesByOperator(
    operatorId: string,
    onlyCurrent: boolean = true
  ): Observable<AvailabilityTemplate[]> {
    return this.apollo
      .query<{ availabilityTemplates: AvailabilityTemplate[] }>({
        query: GET_AVAILABILITY_TEMPLATES,
        variables: { operatorId, onlyCurrent },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.availabilityTemplates || []));
  }

  /**
   * Ottiene tutti i template pattern generici (non assegnati a operatori)
   * Converte BackendTemplatePattern in AvailabilityTemplate per compatibilità UI
   */
  getAllTemplates(): Observable<Partial<AvailabilityTemplate>[]> {
    return this.apollo
      .query<{ allTemplatePatterns: BackendTemplatePattern[] }>({
        query: GET_ALL_TEMPLATE_PATTERNS,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          const patterns = result.data?.allTemplatePatterns || [];
          // Convert BackendTemplatePattern to AvailabilityTemplate for UI
          return patterns.map(p => ({
            id: p.id,
            operatorId: '', // No operator for generic patterns
            name: p.name,
            description: p.description,
            dayInPattern: p.dayInPattern,
            patternDuration: p.patternDuration,
            patternStartDate: new Date(),
            startTime: p.startTime,
            endTime: p.endTime,
            version: 1,
            isCurrent: true,
            validFrom: new Date(),
            validUntil: undefined,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          }));
        })
      );
  }

  /**
   * Verifica se un nome template esiste già
   */
  checkTemplateName(name: string): Observable<boolean> {
    return this.getAllTemplates().pipe(
      map((templates) =>
        templates.some(
          (t) => t.name?.toLowerCase() === name.toLowerCase() && t.isCurrent
        )
      )
    );
  }

  /**
   * Crea un template dalla struttura UI
   * Se operatorId non è presente, crea un pattern generico
   * Se operatorId è presente, crea un'assegnazione
   */
  createTemplateFromPattern(
    pattern: TemplatePattern
  ): Observable<Partial<AvailabilityTemplate>[]> {
    // If no operatorId, create a generic pattern template
    if (!pattern.operatorId) {
      return this.createPatternTemplate(pattern);
    }

    // Otherwise, create operator-assigned templates (legacy behavior)
    const inputs = this.convertPatternToBackendInputs(pattern);
    const mutations$ = inputs.map((input) =>
      this.apollo
        .mutate<{ createAvailabilityTemplate: AvailabilityTemplate }>({
          mutation: CREATE_AVAILABILITY_TEMPLATE,
          variables: { input },
        })
        .pipe(map((result) => result.data!.createAvailabilityTemplate))
    );

    // Esegui tutte le mutazioni e ritorna i risultati
    return new Observable((observer) => {
      const results: AvailabilityTemplate[] = [];
      let completed = 0;

      mutations$.forEach((mutation$, index) => {
        mutation$.subscribe({
          next: (template) => {
            results[index] = template;
            completed++;
            if (completed === mutations$.length) {
              observer.next(results);
              observer.complete();
            }
          },
          error: (err) => observer.error(err),
        });
      });
    });
  }

  /**
   * Crea un template pattern generico (senza operatore)
   * Returns BackendTemplatePattern[] from backend, converts to AvailabilityTemplate[] for UI
   */
  private createPatternTemplate(
    pattern: TemplatePattern
  ): Observable<Partial<AvailabilityTemplate>[]> {
    const inputs = this.convertPatternToPatternInputs(pattern);
    const mutations$ = inputs.map((input) =>
      this.apollo
        .mutate<{ createTemplatePattern: BackendTemplatePattern[] }>({
          mutation: CREATE_TEMPLATE_PATTERN,
          variables: { input },
        })
        .pipe(map((result) => result.data!.createTemplatePattern))
    );

    // Esegui tutte le mutazioni e ritorna i risultati convertiti
    return new Observable((observer) => {
      const results: Partial<AvailabilityTemplate>[] = [];
      let completed = 0;

      mutations$.forEach((mutation$, index) => {
        mutation$.subscribe({
          next: (backendPatterns) => {
            // Convert BackendTemplatePattern to AvailabilityTemplate for UI compatibility
            const uiTemplates = backendPatterns.map(bp => this.convertBackendPatternToTemplate(bp, pattern));
            results.push(...uiTemplates);
            completed++;
            if (completed === mutations$.length) {
              observer.next(results);
              observer.complete();
            }
          },
          error: (err) => observer.error(err),
        });
      });
    });
  }

  /**
   * Converts BackendTemplatePattern to AvailabilityTemplate for UI compatibility
   */
  private convertBackendPatternToTemplate(
    backendPattern: BackendTemplatePattern,
    uiPattern: TemplatePattern
  ): Partial<AvailabilityTemplate> {
    return {
      id: backendPattern.id,
      operatorId: '', // No operator for generic patterns
      name: backendPattern.name,
      description: backendPattern.description,
      dayInPattern: backendPattern.dayInPattern,
      patternDuration: backendPattern.patternDuration,
      patternStartDate: new Date(), // Not applicable for patterns
      startTime: backendPattern.startTime,
      endTime: backendPattern.endTime,
      version: 1,
      isCurrent: false, // Not applicable for patterns
      validFrom: new Date(uiPattern.validFrom || this.getTodayString()),
      validUntil: uiPattern.validUntil ? new Date(uiPattern.validUntil) : undefined,
      createdAt: backendPattern.createdAt,
      updatedAt: backendPattern.updatedAt,
    };
  }

  /**
   * Aggiorna un template esistente
   */
  updateTemplate(
    id: string,
    input: CreateAvailabilityTemplateInput
  ): Observable<AvailabilityTemplate> {
    return this.apollo
      .mutate<{ updateAvailabilityTemplate: AvailabilityTemplate }>({
        mutation: UPDATE_AVAILABILITY_TEMPLATE,
        variables: { id, input },
      })
      .pipe(map((result) => result.data!.updateAvailabilityTemplate));
  }

  /**
   * Elimina un template (pattern generico o template assegnato)
   * Prova prima a eliminare come pattern, poi come template assegnato
   */
  deleteTemplate(id: string): Observable<boolean> {
    // Try deleting as template pattern first (generic patterns)
    return this.apollo
      .mutate<{ deleteTemplatePattern: boolean }>({
        mutation: DELETE_TEMPLATE_PATTERN,
        variables: { id },
      })
      .pipe(
        map((result) => result.data!.deleteTemplatePattern),
        // If it fails, it might be an assigned template, try the other delete
        // catchError(() =>
        //   this.apollo
        //     .mutate<{ deleteAvailabilityTemplate: boolean }>({
        //       mutation: DELETE_AVAILABILITY_TEMPLATE,
        //       variables: { id },
        //     })
        //     .pipe(map((result) => result.data!.deleteAvailabilityTemplate))
        // )
      );
  }

  /**
   * Ricostruisce la cache di disponibilità per un operatore
   */
  rebuildCache(
    operatorId: string,
    startDate: string,
    endDate: string
  ): Observable<boolean> {
    return this.apollo
      .mutate<{ rebuildAvailabilityCache: boolean }>({
        mutation: REBUILD_AVAILABILITY_CACHE,
        variables: { operatorId, startDate, endDate },
      })
      .pipe(map((result) => result.data!.rebuildAvailabilityCache));
  }

  /**
   * Converte la struttura UI (TemplatePattern) in input per il pattern generico
   */
  private convertPatternToPatternInputs(pattern: TemplatePattern): CreateTemplatePatternInput[] {
    const inputs: CreateTemplatePatternInput[] = [];
    const patternDuration = pattern.patternWeeks * 7;

    // Per ogni settimana nel pattern
    pattern.weeks.forEach((week) => {
      // Per ogni giorno nella settimana
      week.days.forEach((day) => {
        // Per ogni fascia oraria nel giorno
        day.slots.forEach((slot) => {
          // Calcola dayInPattern considerando la settimana e il giorno
          const dayInPattern = (week.weekNumber - 1) * 7 + day.dayOfWeek;

          inputs.push({
            name: pattern.name,
            description: `Pattern ${pattern.patternWeeks} settiman${
              pattern.patternWeeks > 1 ? 'e' : 'a'
            }`,
            dayInPattern,
            patternDuration,
            startTime: slot.startTime,
            endTime: slot.endTime,
          });
        });
      });
    });

    return inputs;
  }

  /**
   * Converte la struttura UI (TemplatePattern) in input per il backend
   */
  private convertPatternToBackendInputs(
    pattern: TemplatePattern
  ): CreateAvailabilityTemplateInput[] {
    const inputs: CreateAvailabilityTemplateInput[] = [];
    const patternDuration = pattern.patternWeeks * 7;
    const patternStartDate = pattern.validFrom || this.getTodayString();

    // Per ogni settimana nel pattern
    pattern.weeks.forEach((week) => {
      // Per ogni giorno nella settimana
      week.days.forEach((day) => {
        // Per ogni fascia oraria nel giorno
        day.slots.forEach((slot) => {
          // Calcola dayInPattern considerando la settimana e il giorno
          const dayInPattern = (week.weekNumber - 1) * 7 + day.dayOfWeek;

          inputs.push({
            operatorId: pattern.operatorId!,
            name: pattern.name,
            description: `Pattern ${pattern.patternWeeks} settiman${
              pattern.patternWeeks > 1 ? 'e' : 'a'
            }`,
            dayInPattern,
            patternDuration,
            patternStartDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            validFrom: pattern.validFrom || this.getTodayString(),
            validUntil: pattern.validUntil,
          });
        });
      });
    });

    return inputs;
  }

  /**
   * Converte i template backend in una struttura UI (TemplatePattern)
   */
  convertBackendToPattern(
    templates: Partial<AvailabilityTemplate>[]
  ): TemplatePattern | null {
    if (templates.length === 0) return null;

    // Prendi il primo template per informazioni generali
    const firstTemplate = templates[0];

    // Determina il numero di settimane dal patternDuration
    const patternWeeks = Math.ceil((firstTemplate.patternDuration || 7) / 7);

    // Raggruppa i template per settimana e giorno
    const weeks: WeekSchedule[] = [];

    for (let weekNum = 1; weekNum <= patternWeeks; weekNum++) {
      const days: DaySchedule[] = [];

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const dayInPattern = (weekNum - 1) * 7 + dayOfWeek;

        // Trova tutti i template per questo giorno
        const dayTemplates = templates.filter(
          (t) => t.dayInPattern === dayInPattern
        );

        if (dayTemplates.length > 0) {
          const slots: TimeSlot[] = dayTemplates.map((t) => ({
            startTime: t.startTime || '',
            endTime: t.endTime || '',
          }));

          days.push({ dayOfWeek, slots });
        }
      }

      if (days.length > 0) {
        weeks.push({ weekNumber: weekNum, days });
      }
    }

    return {
      id: firstTemplate.id,
      name: firstTemplate.name || '',
      operatorId: firstTemplate.operatorId,
      patternWeeks,
      weeks,
      validFrom: firstTemplate.validFrom?.toString() || '',
      validUntil: firstTemplate.validUntil?.toString(),
      createdAt: firstTemplate.createdAt,
      updatedAt: firstTemplate.updatedAt,
    };
  }

  /**
   * Ottiene la data di oggi in formato YYYY-MM-DD
   */
  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  /**
   * Raggruppa i template per nome (per gestire pattern multi-slot)
   */
  groupTemplatesByName(
    templates: Partial<AvailabilityTemplate>[]
  ): Map<string, Partial<AvailabilityTemplate>[]> {
    const grouped = new Map<string, Partial<AvailabilityTemplate>[]>();

    templates.forEach((template) => {
      const name = template.name || 'Senza Nome';
      if (!grouped.has(name)) {
        grouped.set(name, []);
      }
      grouped.get(name)!.push(template);
    });

    return grouped;
  }
}
