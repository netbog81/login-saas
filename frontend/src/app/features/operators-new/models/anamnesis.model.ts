/**
 * Anamnesis Complete Model — COMPATIBILITÀ
 *
 * Questo file un tempo duplicava le interfacce della scheda valutazione.
 * La fonte unica è ora `evaluation.model.ts` (che espone già gli alias
 * `AnamnesisComplete`, `AnamnesisCreateInput`, ecc. per retrocompatibilità).
 * Qui ri-esportiamo tutto per non toccare i numerosi import esistenti che
 * puntano a `models/anamnesis.model`.
 */

export type {
  EvaluationComplete,
  PathInfo,
  GeneralInfo,
  BodyMap,
  BodyMapMarker,
  RemoteHistory,
  RecentHistory,
  ObjectiveExam,
  DiagnosticExam,
  TreatmentPlan,
  Monitoring,
  TestEvaluationHistoryEntry,
  TestSpecifico,
  Obiettivo,
  EvaluationCreateInput,
  EvaluationUpdateInput,
  // Alias storici
  AnamnesisComplete,
  AnamnesisCreateInput,
  AnamnesisUpdateInput,
} from './evaluation.model';

export {
  createEmptyEvaluation,
  createEmptyAnamnesis,
  generateId,
  isSectionFilled,
} from './evaluation.model';
