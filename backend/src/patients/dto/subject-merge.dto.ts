import { IsUUID } from 'class-validator';

/**
 * Contratto S2S della "merge / reassign patient" consumata dal registry per
 * consolidare anagrafiche duplicate. Riassegna tutti i dati clinici dal subject
 * "loser" al subject "winner".
 *
 * ATTENZIONE: shape vincolante verso il registry — non rinominare i campi senza
 * coordinarsi col registry.
 */

/** Body del POST /internal/subjects/merge-preview e /merge-execute. */
export class SubjectMergeInput {
  /** Subject vincitore: eredita tutti i dati clinici del loser. */
  @IsUUID()
  winnerSubjectId!: string;

  /** Subject perdente: i suoi dati clinici vengono riassegnati al winner. */
  @IsUUID()
  loserSubjectId!: string;
}

/**
 * Conflitto 1:1: un dato unico-per-subject presente su ENTRAMBI i subject.
 * Risoluzione automatica: vince il winner, la riga del loser viene scartata.
 */
export interface MergeConflict {
  referenceType: string;
  kind: 'one_to_one';
  winnerHasData: boolean;
  loserHasData: boolean;
  autoResolution: 'winner_wins';
}

/** Anteprima (dry-run) di cosa farebbe la merge, senza modificare nulla. */
export interface MergePreview {
  winnerSubjectId: string;
  loserSubjectId: string;
  /** Righe che verrebbero riassegnate loser→winner (solo count>0). */
  moves: Array<{ referenceType: string; count: number }>;
  /** Dati 1:1 presenti su ENTRAMBI (winner vince, loser scartato). */
  conflicts: MergeConflict[];
}

/** Esito della merge eseguita. */
export interface MergeResult {
  winnerSubjectId: string;
  loserSubjectId: string;
  /** Righe effettivamente riassegnate. */
  moved: Array<{ referenceType: string; count: number }>;
  /**
   * Righe 1:1 del loser scartate perché il winner ne aveva già una. `detail`
   * cattura una descrizione leggibile così nulla viene perso silenziosamente.
   */
  discarded: Array<{ referenceType: string; detail: string }>;
}
