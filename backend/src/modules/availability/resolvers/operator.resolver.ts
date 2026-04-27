import { Resolver, Query, Mutation, Args, ID, Context, ObjectType, Field, Int } from '@nestjs/graphql';
import { Logger, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operator } from '../entities/operator.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import {
  OperatorService,
  OperatorDependencyCount,
} from '../services/operator.service';
import { CreateOperatorInput } from '../dto/create-operator.input';
import { UpdateOperatorInput } from '../dto/update-operator.input';
import { AppUser } from '../../users/entities/app-user.entity';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../../users/guards/authorization.guard';
import {
  CurrentUser,
  CurrentUserContext,
} from '../../users/decorators/current-user.decorator';
import { AppUserService } from '../../users/services/app-user.service';

/**
 * Conteggio dipendenze esposto via GraphQL per il dialog di conferma
 * archiviazione (l'admin sa quanti record storici sono coinvolti).
 */
@ObjectType('OperatorDependencyCount')
class OperatorDependencyCountType {
  @Field(() => Int) total: number;
  @Field(() => Int) treatments: number;
  @Field(() => Int) therapeuticPaths: number;
  @Field(() => Int) evaluations: number;
  @Field(() => Int) anamnesis: number;
  @Field(() => Int) appointments: number;
  @Field(() => Int) gymSchedules: number;
  @Field(() => Int) templateAssignments: number;
  @Field(() => Int) waitingList: number;
}

/**
 * Esito della deleteOperator: il client può sapere se l'operatore è
 * stato archiviato (ha storico) o cancellato definitivamente (no deps).
 */
@ObjectType('DeleteOperatorResult')
class DeleteOperatorResultType {
  @Field() archived: boolean;
  @Field() hardDeleted: boolean;
  @Field(() => OperatorDependencyCountType) dependencies: OperatorDependencyCount;
}

@Resolver(() => Operator)
export class OperatorResolver {
  private readonly logger = new Logger(OperatorResolver.name);

  constructor(
    private readonly operatorService: OperatorService,
    private readonly appUserService: AppUserService,
    @InjectRepository(AppUser)
    private readonly appUserRepo: Repository<AppUser>,
  ) {}

  /**
   * Risolve l'AppUserId del chiamante dal sub Keycloak. Usato per
   * popolare deletedByUserId in audit di archiviazione/restore.
   */
  private async resolveAppUserId(
    user: CurrentUserContext | undefined,
  ): Promise<string | undefined> {
    if (!user?.userId) return undefined;
    const appUser = await this.appUserService.findByKeycloakId(user.userId);
    return appUser?.id;
  }

  // Queries
  @Query(() => [Operator], { name: 'operators' })
  async getOperators(
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
    @Args('categoryId', { type: () => ID, nullable: true })
    categoryId?: string,
    @Args('onlyActive', { type: () => Boolean, nullable: true, defaultValue: false })
    onlyActive?: boolean,
  ): Promise<Operator[]> {
    return this.operatorService.findAll({
      macroCategory,
      categoryId,
      onlyActive,
    });
  }

  @Query(() => Operator, { name: 'operator', nullable: true })
  async getOperator(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Operator | null> {
    try {
      return await this.operatorService.findOne(id);
    } catch (error) {
      return null;
    }
  }

  @Query(() => [Operator], { name: 'checkDuplicateOperator' })
  async checkDuplicateOperator(
    @Args('name') name: string,
    @Args('surname', { nullable: true }) surname?: string,
  ): Promise<Operator[]> {
    return this.operatorService.findSimilarOperators(name, surname);
  }

  @Query(() => Operator, { name: 'myOperator', nullable: true })
  async getMyOperator(
    @Context() context: any,
  ): Promise<Operator | null> {
    const keycloakId = context.req?.tenantContext?.userId;
    if (!keycloakId) {
      this.logger.warn('[myOperator] No keycloakId in tenant context');
      return null;
    }

    const appUser = await this.appUserRepo.findOne({
      where: { keycloakId },
    });
    if (!appUser) {
      this.logger.warn(`[myOperator] No AppUser found for keycloakId ${keycloakId}`);
      return null;
    }

    return this.operatorService.findByAppUserId(appUser.id);
  }

  // Mutations
  @Mutation(() => Operator, { name: 'createOperator' })
  async createOperator(
    @Args('input') input: CreateOperatorInput,
  ): Promise<Operator> {
    return this.operatorService.create(input);
  }

  @Mutation(() => Operator, { name: 'updateOperator' })
  async updateOperator(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateOperatorInput,
  ): Promise<Operator> {
    return this.operatorService.update(id, input);
  }

  /**
   * Elimina un operatore. Se ha dipendenze storiche viene archiviato
   * (soft-delete + isActive=false + AppUser disattivato + templates
   * scollegati), altrimenti hard-delete classico.
   * Ritorna l'esito strutturato: il client mostra un messaggio diverso
   * a seconda di archived/hardDeleted, e il count delle dipendenze per
   * dare contesto all'admin.
   */
  @Mutation(() => DeleteOperatorResultType, { name: 'deleteOperator' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_manage')
  async deleteOperator(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<DeleteOperatorResultType> {
    const deletedByUserId = await this.resolveAppUserId(user);
    return this.operatorService.delete(id, deletedByUserId);
  }

  /** Ripristina un operatore archiviato. Admin-only. */
  @Mutation(() => Operator, { name: 'restoreOperator' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_manage')
  async restoreOperator(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Operator> {
    return this.operatorService.restore(id);
  }

  /** Lista degli operatori archiviati per la pagina admin "Archiviati". */
  @Query(() => [Operator], { name: 'archivedOperators' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_manage')
  async getArchivedOperators(): Promise<Operator[]> {
    return this.operatorService.findArchived();
  }

  /**
   * Conteggio dipendenze di un operatore. Utilizzato dal dialog di
   * conferma archiviazione per mostrare all'admin quanti record storici
   * sono coinvolti.
   */
  @Query(() => OperatorDependencyCountType, { name: 'operatorDependencies' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_manage')
  async getOperatorDependencies(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<OperatorDependencyCount> {
    return this.operatorService.countDependencies(id);
  }
}
