import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import {
  TherapeuticPath,
  PathTreatment,
  PathDocument,
  Anamnesis,
} from '../models/therapeutic-path.model';
import { MOCK_THERAPEUTIC_PATHS } from '../mock-data/therapeutic-paths.mock';

/**
 * Servizio per gestire i Percorsi Terapeutici
 * Attualmente usa mock data, sara sostituito con chiamate GraphQL quando il backend sara pronto
 */
@Injectable({
  providedIn: 'root',
})
export class TherapeuticPathService {
  private mockPaths: TherapeuticPath[] = MOCK_THERAPEUTIC_PATHS;

  // Delay simulato per rendere l'esperienza piu realistica
  private readonly MOCK_DELAY = 300;

  /**
   * Ottiene tutti i percorsi terapeutici di un paziente
   */
  getPathsByPatient(patientId: string): Observable<TherapeuticPath[]> {
    const paths = this.mockPaths.filter((p) => p.patientId === patientId);
    // Ordina per data inizio decrescente (piu recenti prima)
    const sorted = paths.sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    return of(sorted).pipe(delay(this.MOCK_DELAY));
  }

  /**
   * Ottiene un singolo percorso con tutti i dettagli
   */
  getPath(pathId: string): Observable<TherapeuticPath | null> {
    const path = this.mockPaths.find((p) => p.id === pathId) || null;
    return of(path).pipe(delay(this.MOCK_DELAY));
  }

  /**
   * Ottiene i trattamenti di un percorso, ordinati per data decrescente
   */
  getTreatmentsByPath(pathId: string): Observable<PathTreatment[]> {
    const path = this.mockPaths.find((p) => p.id === pathId);
    const treatments = path?.treatments || [];
    // Ordina per data decrescente (piu recenti prima)
    const sorted = [...treatments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return of(sorted).pipe(delay(this.MOCK_DELAY));
  }

  /**
   * Ottiene i documenti di un percorso
   */
  getDocumentsByPath(pathId: string): Observable<PathDocument[]> {
    const path = this.mockPaths.find((p) => p.id === pathId);
    return of(path?.documents || []).pipe(delay(this.MOCK_DELAY));
  }

  /**
   * Ottiene l'anamnesi di un percorso
   */
  getAnamnesisByPath(pathId: string): Observable<Anamnesis | null> {
    const path = this.mockPaths.find((p) => p.id === pathId);
    return of(path?.anamnesis || null).pipe(delay(this.MOCK_DELAY));
  }

  /**
   * Conta i percorsi attivi per paziente (per badge/statistiche)
   */
  getActivePathsCount(patientId: string): Observable<number> {
    const count = this.mockPaths.filter(
      (p) => p.patientId === patientId && p.status === 'active'
    ).length;
    return of(count);
  }

  /**
   * Ottiene tutti i percorsi (per ricerche globali)
   */
  getAllPaths(): Observable<TherapeuticPath[]> {
    return of(this.mockPaths).pipe(delay(this.MOCK_DELAY));
  }

  /**
   * Ottiene percorsi per operatore
   */
  getPathsByOperator(operatorId: string): Observable<TherapeuticPath[]> {
    const paths = this.mockPaths.filter((p) => p.primaryOperatorId === operatorId);
    return of(paths).pipe(delay(this.MOCK_DELAY));
  }

  /**
   * Ottiene statistiche per paziente
   */
  getPatientPathStats(patientId: string): Observable<{
    total: number;
    active: number;
    completed: number;
    suspended: number;
  }> {
    const paths = this.mockPaths.filter((p) => p.patientId === patientId);
    const stats = {
      total: paths.length,
      active: paths.filter((p) => p.status === 'active').length,
      completed: paths.filter((p) => p.status === 'completed').length,
      suspended: paths.filter((p) => p.status === 'suspended').length,
    };
    return of(stats).pipe(delay(this.MOCK_DELAY));
  }

  /**
   * Cerca percorsi per nome/diagnosi
   */
  searchPaths(query: string): Observable<TherapeuticPath[]> {
    const lowerQuery = query.toLowerCase();
    const results = this.mockPaths.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.diagnosis?.toLowerCase().includes(lowerQuery) ||
        p.description?.toLowerCase().includes(lowerQuery)
    );
    return of(results).pipe(delay(this.MOCK_DELAY));
  }
}
