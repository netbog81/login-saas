/**
 * Modelli per il tracking obiettivi e test (Tab Obiettivi)
 * Layer: Models
 */

import { Obiettivo, TestSpecifico } from './anamnesis.model';

/**
 * Tipo di obiettivo (breve, medio, lungo termine)
 */
export enum ObjectiveType {
  BREVE_TERMINE = 'breve_termine',
  MEDIO_TERMINE = 'medio_termine',
  LUNGO_TERMINE = 'lungo_termine'
}

/**
 * Entry nello storico progressi di un obiettivo
 */
export interface ObjectiveProgressEntry {
  id: string;
  previousLevel: number;
  newLevel: number;
  treatmentsSinceLast: number;
  note?: string;
  operatorName: string;
  createdAt: Date;
}

/**
 * Entry nello storico valutazioni di un test
 */
export interface TestEvaluationEntry {
  id: string;
  evaluationLevel: number;
  note?: string;
  treatmentsSinceLast: number;
  operatorName: string;
  createdAt: Date;
}

/**
 * Obiettivo con progressLevel e storico
 */
export interface ObjectiveWithProgress extends Obiettivo {
  tipo: ObjectiveType;
  progressLevel: number;  // 0-5
  progressHistory: ObjectiveProgressEntry[];
}

/**
 * Test con valutazioni e storico
 */
export interface TestWithEvaluations extends TestSpecifico {
  currentLevel: number;  // 0-5 (ultima valutazione o 0)
  evaluationHistory: TestEvaluationEntry[];
  canRepeat: boolean;  // true se ha almeno una valutazione
}

/**
 * Input per aggiornamento progresso obiettivo
 */
export interface UpdateObjectiveProgressInput {
  newLevel: number;
  note?: string;
}

/**
 * Input per aggiunta valutazione test
 */
export interface AddTestEvaluationInput {
  evaluationLevel: number;
  note?: string;
}

/**
 * Evento emesso dal componente obiettivi
 */
export interface ObjectiveProgressChangeEvent {
  objectiveId: string;
  newLevel: number;
  note?: string;
}

/**
 * Evento emesso dal componente test
 */
export interface TestEvaluationAddedEvent {
  testId: string;
  level: number;
  note?: string;
}

/**
 * Evento modifica valutazione test esistente
 */
export interface TestEvaluationEditedEvent {
  testId: string;
  level: number;
  note?: string;
}

/**
 * Evento reset test
 */
export interface TestResetEvent {
  testId: string;
}

/**
 * Evento eliminazione test
 */
export interface TestDeleteEvent {
  testId: string;
  anamnesisId: string;
}

/**
 * Helper per determinare il label del tipo obiettivo
 */
export function getObjectiveTypeLabel(tipo: ObjectiveType): string {
  switch (tipo) {
    case ObjectiveType.BREVE_TERMINE:
      return 'Breve Termine';
    case ObjectiveType.MEDIO_TERMINE:
      return 'Medio Termine';
    case ObjectiveType.LUNGO_TERMINE:
      return 'Lungo Termine';
    default:
      return 'Sconosciuto';
  }
}

/**
 * Helper per calcolare il colore del progress bar
 */
export function getProgressColor(level: number): string {
  if (level === 0) return '#e2e8f0'; // gray
  if (level <= 2) return '#fbbf24'; // yellow
  if (level <= 4) return '#60a5fa'; // blue
  return '#22c55e'; // green (5 = completato)
}

/**
 * Helper per il label del livello
 */
export function getProgressLabel(level: number): string {
  switch (level) {
    case 0: return 'Non iniziato';
    case 1: return 'Appena iniziato';
    case 2: return 'In corso';
    case 3: return 'Buon progresso';
    case 4: return 'Quasi completato';
    case 5: return 'Completato';
    default: return `${level}/5`;
  }
}
