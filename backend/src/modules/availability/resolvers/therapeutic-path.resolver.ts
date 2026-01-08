import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { PatientEvaluation } from '../entities/patient-evaluation.entity';
import { PathDocument, DocumentCategory } from '../entities/path-document.entity';
import { TherapeuticPathService } from '../services/therapeutic-path.service';
import {
  CreateTherapeuticPathInput,
  UpdateTherapeuticPathInput,
  CreateEvaluationInput,
  UpdateEvaluationInput,
  CreateDocumentInput,
} from '../dto/therapeutic-path.input';

@Resolver(() => TherapeuticPath)
export class TherapeuticPathResolver {
  constructor(private readonly pathService: TherapeuticPathService) {}

  // ==================== PATH QUERIES ====================

  /**
   * Query: Ottiene un percorso terapeutico per ID
   */
  @Query(() => TherapeuticPath, { name: 'therapeuticPath', nullable: true })
  async getTherapeuticPath(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TherapeuticPath | null> {
    return this.pathService.findById(id);
  }

  /**
   * Query: Ottiene tutti i percorsi di un paziente
   */
  @Query(() => [TherapeuticPath], { name: 'therapeuticPathsByPatient' })
  async getTherapeuticPathsByPatient(
    @Args('patientId', { type: () => Int }) patientId: number,
  ): Promise<TherapeuticPath[]> {
    return this.pathService.findByPatient(patientId);
  }

  /**
   * Query: Ottiene i percorsi attivi di un paziente
   */
  @Query(() => [TherapeuticPath], { name: 'activeTherapeuticPathsByPatient' })
  async getActiveTherapeuticPathsByPatient(
    @Args('patientId', { type: () => Int }) patientId: number,
  ): Promise<TherapeuticPath[]> {
    return this.pathService.findActiveByPatient(patientId);
  }

  /**
   * Query: Ottiene i percorsi gestiti da un operatore
   */
  @Query(() => [TherapeuticPath], { name: 'therapeuticPathsByOperator' })
  async getTherapeuticPathsByOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<TherapeuticPath[]> {
    return this.pathService.findByOperator(operatorId);
  }

  // ==================== PATH MUTATIONS ====================

  /**
   * Mutation: Crea un nuovo percorso terapeutico
   */
  @Mutation(() => TherapeuticPath, { name: 'createTherapeuticPath' })
  async createTherapeuticPath(
    @Args('input') input: CreateTherapeuticPathInput,
  ): Promise<TherapeuticPath> {
    return this.pathService.createPath(input);
  }

  /**
   * Mutation: Aggiorna un percorso terapeutico
   */
  @Mutation(() => TherapeuticPath, { name: 'updateTherapeuticPath' })
  async updateTherapeuticPath(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateTherapeuticPathInput,
  ): Promise<TherapeuticPath> {
    return this.pathService.updatePath(id, input);
  }

  /**
   * Mutation: Elimina un percorso terapeutico
   */
  @Mutation(() => Boolean, { name: 'deleteTherapeuticPath' })
  async deleteTherapeuticPath(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.pathService.deletePath(id);
  }

  // ==================== EVALUATION QUERIES ====================

  /**
   * Query: Ottiene una valutazione per ID
   */
  @Query(() => PatientEvaluation, { name: 'patientEvaluation', nullable: true })
  async getPatientEvaluation(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PatientEvaluation | null> {
    return this.pathService.findEvaluationById(id);
  }

  /**
   * Query: Ottiene le valutazioni di un percorso
   */
  @Query(() => [PatientEvaluation], { name: 'evaluationsByPath' })
  async getEvaluationsByPath(
    @Args('pathId', { type: () => ID }) pathId: string,
  ): Promise<PatientEvaluation[]> {
    return this.pathService.findEvaluationsByPath(pathId);
  }

  // ==================== EVALUATION MUTATIONS ====================

  /**
   * Mutation: Crea una nuova valutazione
   */
  @Mutation(() => PatientEvaluation, { name: 'createPatientEvaluation' })
  async createPatientEvaluation(
    @Args('input') input: CreateEvaluationInput,
  ): Promise<PatientEvaluation> {
    return this.pathService.createEvaluation(input);
  }

  /**
   * Mutation: Aggiorna una valutazione
   */
  @Mutation(() => PatientEvaluation, { name: 'updatePatientEvaluation' })
  async updatePatientEvaluation(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateEvaluationInput,
  ): Promise<PatientEvaluation> {
    return this.pathService.updateEvaluation(id, input);
  }

  /**
   * Mutation: Elimina una valutazione
   */
  @Mutation(() => Boolean, { name: 'deletePatientEvaluation' })
  async deletePatientEvaluation(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.pathService.deleteEvaluation(id);
  }

  // ==================== DOCUMENT QUERIES ====================

  /**
   * Query: Ottiene un documento per ID
   */
  @Query(() => PathDocument, { name: 'pathDocument', nullable: true })
  async getPathDocument(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PathDocument | null> {
    return this.pathService.findDocumentById(id);
  }

  /**
   * Query: Ottiene i documenti di un percorso
   */
  @Query(() => [PathDocument], { name: 'documentsByPath' })
  async getDocumentsByPath(
    @Args('pathId', { type: () => ID }) pathId: string,
  ): Promise<PathDocument[]> {
    return this.pathService.findDocumentsByPath(pathId);
  }

  /**
   * Query: Ottiene i documenti di un percorso filtrati per categoria
   */
  @Query(() => [PathDocument], { name: 'documentsByPathAndCategory' })
  async getDocumentsByPathAndCategory(
    @Args('pathId', { type: () => ID }) pathId: string,
    @Args('category', { type: () => DocumentCategory }) category: DocumentCategory,
  ): Promise<PathDocument[]> {
    return this.pathService.findDocumentsByCategory(pathId, category);
  }

  // ==================== DOCUMENT MUTATIONS ====================

  /**
   * Mutation: Crea un nuovo documento
   */
  @Mutation(() => PathDocument, { name: 'createPathDocument' })
  async createPathDocument(
    @Args('input') input: CreateDocumentInput,
  ): Promise<PathDocument> {
    return this.pathService.createDocument(input);
  }

  /**
   * Mutation: Elimina un documento
   */
  @Mutation(() => Boolean, { name: 'deletePathDocument' })
  async deletePathDocument(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.pathService.deleteDocument(id);
  }
}
