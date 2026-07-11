import { IsArray, ArrayMaxSize, IsUUID } from 'class-validator';

/**
 * Contratto del "data summary" letto S2S dal registry per decidere se un
 * subject (paziente) può essere hard-deleted senza lasciare dati clinici orfani.
 *
 * ATTENZIONE: shape vincolante — il registry mappa i risultati per `subjectId`
 * e somma i `count`. Non cambiare i nomi dei campi senza coordinarsi col registry.
 */

/** Una singola voce di conteggio per uno specifico tipo di riferimento. */
export interface DataSummaryEntry {
  /** Sempre "clinical" per questo modulo. */
  sourceModule: string;
  /** Tipo di dato che referenzia il subject (es. "treatment", "appointment"). */
  referenceType: string;
  /** Numero di righe che referenziano il subject per questo tipo. Sempre > 0 in `byType`. */
  count: number;
}

/** Riepilogo aggregato dei dati clinici che referenziano un subject. */
export interface SubjectDataSummary {
  /** Il subject UUID del registry per cui è stato calcolato il riepilogo. */
  subjectId: string;
  /** Somma di tutti i count. */
  total: number;
  /** true se total > 0. */
  hasData: boolean;
  /** Una voce per ogni referenceType con count > 0 (le voci a 0 sono omesse). */
  byType: DataSummaryEntry[];
}

/**
 * Body del POST /internal/subjects/data-summary.
 * Cap a 500 id per evitare query IN (...) sproporzionate.
 */
export class SubjectDataSummaryBulkInput {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  subjectIds!: string[];
}
