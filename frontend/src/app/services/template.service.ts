import { Injectable, Injector } from '@angular/core';
import { Observable, map, mergeMap } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  GET_AVAILABILITY_TEMPLATES,
  GET_ALL_TEMPLATES,
  GET_ALL_TEMPLATE_PATTERNS,
  GET_ALL_PATTERN_GROUPS,
  GET_TEMPLATE_ASSIGNMENTS,
  GET_TEMPLATE_ASSIGNMENT,
  GET_TEMPLATE_ASSIGNMENTS_BY_OPERATOR,
  GET_CURRENT_TEMPLATE_ASSIGNMENTS,
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
  CREATE_PATTERN_GROUP,
  UPDATE_PATTERN_GROUP,
  DELETE_PATTERN_GROUP,
  SET_PATTERN_GROUP_ACTIVE,
  UPDATE_TEMPLATE_ASSIGNMENT,
  DEACTIVATE_TEMPLATE_ASSIGNMENT,
  DELETE_TEMPLATE_ASSIGNMENT,
  DEACTIVATE_ALL_TEMPLATE_ASSIGNMENTS_FOR_OPERATOR,
  SET_ASSIGNMENT_ROOM_OVERRIDES,
  CHECK_ASSIGNMENT_ROOM_CONFLICTS,
  ASSIGNMENT_ROOM_AVAILABILITY,
  UPDATE_PATTERN_GROUP_WITH_CONFLICTS,
} from '../graphql/operations/template.mutations';
import {
  AvailabilityTemplate,
  CreateAvailabilityTemplateInput,
  CreateTemplatePatternInput,
} from '../graphql/generated/types';
import {
  BackendTemplatePattern,
  TemplateAssignment,
  PatternGroup,
  TemplatePattern,
  TimeSlot,
  DaySchedule,
  WeekSchedule,
  AssignTemplateToOperatorInput,
  AssignmentRoomOverrideInput,
  RoomConflictCheckResult,
  RoomAvailabilityInfo,
} from '../graphql/types';

@Injectable({
  providedIn: 'root',
})
export class TemplateService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Ottiene tutti i template per un operatore
   */
  getTemplatesByOperator(
    operatorId: string,
    onlyCurrent: boolean = true
  ): Observable<AvailabilityTemplate[]> {
    return this.query<{ availabilityTemplates: AvailabilityTemplate[] }>(
      GET_AVAILABILITY_TEMPLATES,
      { operatorId, onlyCurrent }
    ).pipe(map((result) => result.availabilityTemplates || []));
  }

  /**
   * Ottiene tutti i pattern groups
   * Converte PatternGroup.patterns in AvailabilityTemplate per compatibilità UI
   */
  getAllTemplates(): Observable<Partial<AvailabilityTemplate>[]> {
    return this.query<{ patternGroups: any[] }>(
      GET_ALL_PATTERN_GROUPS
    ).pipe(
      map((result) => {
        const patternGroups = result.patternGroups || [];
        const allPatterns: Partial<AvailabilityTemplate>[] = [];

        // Flatten all patterns from all groups
        patternGroups.forEach((group) => {
          group.patterns?.forEach((p: BackendTemplatePattern) => {
            allPatterns.push({
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
              patternGroupId: group.id, // Include pattern group ID for updates
            } as any);
          });
        });

        return allPatterns;
      })
    );
  }

  /**
   * Verifica se un nome template esiste già.
   * Confronta i nomi dei pattern group (non delle singole fasce): così
   * intercetta anche i gruppi senza fasce orarie, che altrimenti
   * risulterebbero "inesistenti" pur occupando il nome.
   */
  checkTemplateName(name: string): Observable<boolean> {
    return this.getAllPatternGroups().pipe(
      map((groups) =>
        groups.some((g) => g.name?.toLowerCase() === name.toLowerCase())
      )
    );
  }

  /**
   * Converte le fasce di un PatternGroup in Partial<AvailabilityTemplate>[]
   * per compatibilità con la UI esistente (stessa mappatura di getAllTemplates,
   * ma per un singolo gruppo).
   */
  convertGroupToTemplates(group: PatternGroup): Partial<AvailabilityTemplate>[] {
    return (group.patterns || []).map((p) => ({
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
      patternGroupId: group.id,
    } as any));
  }

  /**
   * Converte un PatternGroup nella struttura UI (TemplatePattern).
   * Per i gruppi SENZA fasce orarie (orfani) sintetizza le settimane vuote,
   * così il builder può aprirli in modifica e permettere di aggiungere fasce.
   */
  convertGroupToUiPattern(group: PatternGroup): TemplatePattern {
    const templates = this.convertGroupToTemplates(group);

    if (templates.length > 0) {
      return this.convertBackendToPattern(templates)!;
    }

    // Clamp a 1-4: il builder supporta pattern fino a 4 settimane e alcuni
    // gruppi orfani legacy hanno durate anomale (es. 60 giorni).
    const patternWeeks = Math.min(
      4,
      Math.max(1, Math.ceil((group.patternDuration || 7) / 7))
    );
    const weeks: WeekSchedule[] = [];
    for (let weekNumber = 1; weekNumber <= patternWeeks; weekNumber++) {
      weeks.push({ weekNumber, days: [] });
    }

    return {
      id: undefined,
      name: group.name || '',
      operatorId: undefined,
      patternWeeks,
      weeks,
      validFrom: this.getTodayString(),
      validUntil: undefined,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
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
      this.mutate<{ createAvailabilityTemplate: AvailabilityTemplate }>(
        CREATE_AVAILABILITY_TEMPLATE,
        { input }
      ).pipe(map((result) => result.createAvailabilityTemplate))
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
   * Crea un template pattern generico (senza operatore) usando PatternGroup
   * Returns AvailabilityTemplate[] for UI
   */
  private createPatternTemplate(
    pattern: TemplatePattern
  ): Observable<Partial<AvailabilityTemplate>[]> {
    // Convert UI pattern to PatternGroup input
    const input = this.convertPatternToPatternGroupInput(pattern);

    return this.mutate<{ createPatternGroup: any }>(
      CREATE_PATTERN_GROUP,
      { input },
      [{ query: GET_ALL_PATTERN_GROUPS }]
    ).pipe(
      map((result) => {
        const patternGroup = result.createPatternGroup;
        // Convert PatternGroup.patterns to AvailabilityTemplate[] for UI compatibility
        return patternGroup.patterns.map((bp: BackendTemplatePattern) =>
          this.convertBackendPatternToTemplate(bp, pattern)
        );
      })
    );
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
      patternStartDate: this.getTodayString(), // Not applicable for patterns
      startTime: backendPattern.startTime,
      endTime: backendPattern.endTime,
      version: 1,
      isCurrent: false, // Not applicable for patterns
      validFrom: uiPattern.validFrom || this.getTodayString(),
      validUntil: uiPattern.validUntil || undefined,
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
    return this.mutate<{ updateAvailabilityTemplate: AvailabilityTemplate }>(
      UPDATE_AVAILABILITY_TEMPLATE,
      { id, input }
    ).pipe(map((result) => result.updateAvailabilityTemplate));
  }

  /**
   * Elimina un pattern group dato l'ID di un pattern o di un template
   * Prima trova il pattern group associato, poi lo elimina
   */
  deleteTemplate(patternId: string): Observable<boolean> {
    // First, get all pattern groups to find which one contains this pattern
    return this.query<{ patternGroups: any[] }>(
      GET_ALL_PATTERN_GROUPS
    ).pipe(
      map((result) => {
        const patternGroups = result.patternGroups || [];
        // Find the pattern group that contains this pattern
        const patternGroup = patternGroups.find((group) =>
          group.patterns?.some((p: any) => p.id === patternId)
        );
        return patternGroup?.id;
      }),
      // Delete the pattern group
      mergeMap((patternGroupId) => {
        if (!patternGroupId) {
          throw new Error('Pattern group not found');
        }
        return this.mutate<{ deletePatternGroup: boolean }>(
          DELETE_PATTERN_GROUP,
          { id: patternGroupId },
          [{ query: GET_ALL_PATTERN_GROUPS }]
        );
      }),
      map((result) => result.deletePatternGroup)
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
    return this.mutate<{ rebuildAvailabilityCache: boolean }>(
      REBUILD_AVAILABILITY_CACHE,
      { operatorId, startDate, endDate }
    ).pipe(map((result) => result.rebuildAvailabilityCache));
  }

  /**
   * Converte la struttura UI (TemplatePattern) in input per PatternGroup
   */
  private convertPatternToPatternGroupInput(pattern: TemplatePattern): any {
    const patternDuration = pattern.patternWeeks * 7;
    const patterns: any[] = [];

    // Per ogni settimana nel pattern
    pattern.weeks.forEach((week) => {
      // Per ogni giorno nella settimana
      week.days.forEach((day) => {
        // Per ogni fascia oraria nel giorno
        day.slots.forEach((slot) => {
          // Calcola dayInPattern considerando la settimana e il giorno
          const dayInPattern = (week.weekNumber - 1) * 7 + day.dayOfWeek;

          patterns.push({
            name: pattern.name,
            description: `Pattern ${pattern.patternWeeks} settiman${
              pattern.patternWeeks > 1 ? 'e' : 'a'
            }`,
            dayInPattern,
            startTime: slot.startTime,
            endTime: slot.endTime,
          });
        });
      });
    });

    return {
      name: pattern.name,
      description: `Pattern ${pattern.patternWeeks} settiman${
        pattern.patternWeeks > 1 ? 'e' : 'a'
      }`,
      patternDuration,
      patterns,
    };
  }

  /**
   * @deprecated Use convertPatternToPatternGroupInput instead
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

  // ==================== Template Assignment Methods ====================

  /**
   * Get all template assignments with optional filters
   */
  getTemplateAssignments(
    operatorId?: string,
    onlyCurrent: boolean = true
  ): Observable<TemplateAssignment[]> {
    // result?. — se GraphQL azzera data per un errore parziale (es. relazione
    // null) non vogliamo un TypeError che maschera l'errore vero.
    return this.query<{ templateAssignments: any[] }>(
      GET_TEMPLATE_ASSIGNMENTS,
      { operatorId, onlyCurrent }
    ).pipe(map((result) => result?.templateAssignments || []));
  }

  /**
   * Get a specific template assignment by ID
   */
  getTemplateAssignment(id: string): Observable<TemplateAssignment> {
    return this.query<{ templateAssignment: any }>(
      GET_TEMPLATE_ASSIGNMENT,
      { id }
    ).pipe(map((result) => result.templateAssignment));
  }

  /**
   * Get template assignments for a specific operator
   */
  getTemplateAssignmentsByOperator(
    operatorId: string,
    onlyCurrent: boolean = true
  ): Observable<TemplateAssignment[]> {
    return this.query<{ templateAssignmentsByOperator: any[] }>(
      GET_TEMPLATE_ASSIGNMENTS_BY_OPERATOR,
      { operatorId, onlyCurrent }
    ).pipe(map((result) => result.templateAssignmentsByOperator || []));
  }

  /**
   * Get current template assignments for an operator at a specific date
   */
  getCurrentTemplateAssignments(
    operatorId: string,
    date?: string
  ): Observable<TemplateAssignment[]> {
    return this.query<{ currentTemplateAssignments: any[] }>(
      GET_CURRENT_TEMPLATE_ASSIGNMENTS,
      { operatorId, date }
    ).pipe(map((result) => result.currentTemplateAssignments || []));
  }

  /**
   * Assign a pattern group to an operator
   */
  assignTemplateToOperator(
    input: AssignTemplateToOperatorInput
  ): Observable<TemplateAssignment> {
    return this.mutate<{ assignTemplateToOperator: any }>(
      ASSIGN_TEMPLATE_TO_OPERATOR,
      { input },
      [
        { query: GET_TEMPLATE_ASSIGNMENTS },
        { query: GET_TEMPLATE_ASSIGNMENTS_BY_OPERATOR, variables: { operatorId: input.operatorId } },
      ]
    ).pipe(map((result) => result.assignTemplateToOperator));
  }

  /**
   * Update a template assignment
   */
  updateTemplateAssignment(
    id: string,
    updates: {
      validFrom?: string;
      validUntil?: string; // '' = rimuove la scadenza
      patternStartDate?: string;
      isCurrent?: boolean;
      roomId?: string; // '' = rimuove lo studio
      chairId?: string; // '' = rimuove la poltrona
    }
  ): Observable<TemplateAssignment> {
    return this.mutate<{ updateTemplateAssignment: any }>(
      UPDATE_TEMPLATE_ASSIGNMENT,
      { id, ...updates },
      [
        { query: GET_TEMPLATE_ASSIGNMENTS },
        { query: GET_TEMPLATE_ASSIGNMENT, variables: { id } },
      ]
    ).pipe(map((result) => result.updateTemplateAssignment));
  }

  /**
   * Sostituisce integralmente gli override studio/poltrona di un'assegnazione
   */
  setAssignmentRoomOverrides(
    assignmentId: string,
    overrides: AssignmentRoomOverrideInput[]
  ): Observable<TemplateAssignment> {
    return this.mutate<{ setAssignmentRoomOverrides: any }>(
      SET_ASSIGNMENT_ROOM_OVERRIDES,
      { assignmentId, overrides },
      [
        { query: GET_TEMPLATE_ASSIGNMENTS },
        { query: GET_TEMPLATE_ASSIGNMENT, variables: { id: assignmentId } },
      ]
    ).pipe(map((result) => result.setAssignmentRoomOverrides));
  }

  /**
   * Disponibilità di studi e poltrone rispetto al template candidato
   * (proiezione conservativa sulle date reali di validità). Alimenta le
   * tendine filtrate e l'editor grafico.
   */
  getAssignmentRoomAvailability(
    input: AssignTemplateToOperatorInput,
    excludeAssignmentId?: string
  ): Observable<RoomAvailabilityInfo[]> {
    return this.query<{ assignmentRoomAvailability: { rooms: RoomAvailabilityInfo[] } }>(
      ASSIGNMENT_ROOM_AVAILABILITY,
      { input, excludeAssignmentId }
    ).pipe(map((result) => result?.assignmentRoomAvailability?.rooms || []));
  }

  /**
   * Pre-check dei conflitti di occupazione studi/poltrone: blocking impedirà
   * il salvataggio, warnings è informativo (condivisione entro capacità).
   */
  checkAssignmentRoomConflicts(
    input: AssignTemplateToOperatorInput,
    excludeAssignmentId?: string
  ): Observable<RoomConflictCheckResult> {
    return this.query<{ checkAssignmentRoomConflicts: RoomConflictCheckResult }>(
      CHECK_ASSIGNMENT_ROOM_CONFLICTS,
      { input, excludeAssignmentId }
    ).pipe(map((result) => result.checkAssignmentRoomConflicts));
  }

  /**
   * Deactivate a template assignment (set isCurrent to false)
   */
  deactivateTemplateAssignment(id: string): Observable<TemplateAssignment> {
    return this.mutate<{ deactivateTemplateAssignment: any }>(
      DEACTIVATE_TEMPLATE_ASSIGNMENT,
      { id },
      [
        { query: GET_TEMPLATE_ASSIGNMENTS },
        { query: GET_TEMPLATE_ASSIGNMENT, variables: { id } },
      ]
    ).pipe(map((result) => result.deactivateTemplateAssignment));
  }

  /**
   * Delete a template assignment
   */
  deleteTemplateAssignment(id: string): Observable<boolean> {
    return this.mutate<{ deleteTemplateAssignment: boolean }>(
      DELETE_TEMPLATE_ASSIGNMENT,
      { id },
      [{ query: GET_TEMPLATE_ASSIGNMENTS }]
    ).pipe(map((result) => result.deleteTemplateAssignment));
  }

  /**
   * Deactivate all template assignments for a specific operator
   */
  deactivateAllTemplateAssignmentsForOperator(
    operatorId: string
  ): Observable<boolean> {
    return this.mutate<{ deactivateAllTemplateAssignmentsForOperator: boolean }>(
      DEACTIVATE_ALL_TEMPLATE_ASSIGNMENTS_FOR_OPERATOR,
      { operatorId },
      [
        { query: GET_TEMPLATE_ASSIGNMENTS },
        { query: GET_TEMPLATE_ASSIGNMENTS_BY_OPERATOR, variables: { operatorId } },
      ]
    ).pipe(
      map((result) => result.deactivateAllTemplateAssignmentsForOperator)
    );
  }

  /**
   * Get all pattern groups (templates that can be assigned)
   */
  getAllPatternGroups(): Observable<PatternGroup[]> {
    return this.query<{ patternGroups: any[] }>(
      GET_ALL_PATTERN_GROUPS
    ).pipe(map((result) => result.patternGroups || []));
  }

  /**
   * Update a pattern group (template)
   * Updates the metadata and replaces all patterns
   */
  updatePatternGroup(
    patternGroupId: string,
    pattern: TemplatePattern
  ): Observable<PatternGroup> {
    // Convert UI pattern to backend input format
    const input = this.convertPatternToPatternGroupInput(pattern);

    return this.mutate<{ updatePatternGroup: PatternGroup }>(
      UPDATE_PATTERN_GROUP,
      { id: patternGroupId, input },
      [{ query: GET_ALL_PATTERN_GROUPS }]
    ).pipe(map((result) => result.updatePatternGroup));
  }

  /**
   * Come updatePatternGroup ma restituisce anche i conteggi: appuntamenti in
   * conflitto e override studio/poltrona rimossi perché orfani (guardia
   * modifica template).
   */
  updatePatternGroupWithInfo(
    patternGroupId: string,
    pattern: TemplatePattern
  ): Observable<{
    patternGroup: PatternGroup;
    hasConflicts: boolean;
    conflictsCount: number;
    removedRoomOverridesCount: number;
  }> {
    const input = this.convertPatternToPatternGroupInput(pattern);

    return this.mutate<{ updatePatternGroupWithConflicts: any }>(
      UPDATE_PATTERN_GROUP_WITH_CONFLICTS,
      { id: patternGroupId, input },
      [{ query: GET_ALL_PATTERN_GROUPS }, { query: GET_TEMPLATE_ASSIGNMENTS }]
    ).pipe(map((result) => result.updatePatternGroupWithConflicts));
  }

  /**
   * Elimina un pattern group per ID (anche senza fasce orarie).
   * A differenza di deleteTemplate(patternId) non richiede di risalire al
   * gruppo da una fascia — indispensabile per i gruppi orfani con 0 fasce.
   */
  deletePatternGroup(patternGroupId: string): Observable<boolean> {
    return this.mutate<{ deletePatternGroup: boolean }>(
      DELETE_PATTERN_GROUP,
      { id: patternGroupId },
      [{ query: GET_ALL_PATTERN_GROUPS }]
    ).pipe(map((result) => result.deletePatternGroup));
  }

  /**
   * Attiva/disattiva un pattern group (soft-delete reversibile).
   */
  setPatternGroupActive(
    patternGroupId: string,
    isActive: boolean
  ): Observable<PatternGroup> {
    return this.mutate<{ setPatternGroupActive: PatternGroup }>(
      SET_PATTERN_GROUP_ACTIVE,
      { id: patternGroupId, isActive },
      [{ query: GET_ALL_PATTERN_GROUPS }]
    ).pipe(map((result) => result.setPatternGroupActive));
  }
}
