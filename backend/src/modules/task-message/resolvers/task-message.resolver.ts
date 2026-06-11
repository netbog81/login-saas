import {
  Resolver,
  Query,
  Mutation,
  Args,
  Context,
  ResolveField,
  Parent,
  Int,
} from '@nestjs/graphql';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { TaskMessage } from '../entities/task-message.entity';
import { TaskMessagePage } from '../dto/task-message-page.type';
import { TaskMessageResult } from '../dto/task-message-result.type';
import { CreateTaskMessageInput } from '../dto/create-task-message.input';
import { UpdateTaskMessageInput } from '../dto/update-task-message.input';
import { TaskMessageService } from '../services/task-message.service';
import { AppUser } from '../../users/entities/app-user.entity';

import { TenantContextService } from '@curandis/tenant-datasource';
@Resolver(() => TaskMessage)
export class TaskMessageResolver {
  private readonly logger = new Logger(TaskMessageResolver.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly taskMessageService: TaskMessageService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get appUserRepo() { return this.dataSource.getRepository(AppUser); }

  // ─── Queries ──────────────────────────────────────────────────

  @Query(() => TaskMessagePage, { name: 'taskMessageInbox' })
  async inbox(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Context() ctx: any,
  ): Promise<TaskMessagePage> {
    const user = await this.resolveCurrentUser(ctx);
    if (!user) return { items: [], total: 0 };
    return this.taskMessageService.getInbox(user.appUserId, page, limit);
  }

  @Query(() => TaskMessagePage, { name: 'taskMessageSent' })
  async sent(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Context() ctx: any,
  ): Promise<TaskMessagePage> {
    const user = await this.resolveCurrentUser(ctx);
    if (!user) return { items: [], total: 0 };
    return this.taskMessageService.getSent(user.appUserId, page, limit);
  }

  @Query(() => TaskMessagePage, { name: 'taskMessageCompleted' })
  async completed(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Context() ctx: any,
  ): Promise<TaskMessagePage> {
    const user = await this.resolveCurrentUser(ctx);
    if (!user) return { items: [], total: 0 };
    return this.taskMessageService.getCompleted(user.appUserId, page, limit);
  }

  @Query(() => TaskMessage, { name: 'taskMessage', nullable: true })
  async getMessage(
    @Args('id') id: string,
  ): Promise<TaskMessage | null> {
    return this.taskMessageService.getById(id);
  }

  @Query(() => Int, { name: 'taskMessageUnreadCount' })
  async unreadCount(@Context() ctx: any): Promise<number> {
    const user = await this.resolveCurrentUser(ctx);
    if (!user) return 0;
    return this.taskMessageService.countUnread(user.appUserId);
  }

  @Query(() => String, { name: 'taskMessageMyAppUserId', nullable: true })
  async myAppUserId(@Context() ctx: any): Promise<string | null> {
    const user = await this.resolveCurrentUser(ctx);
    return user?.appUserId ?? null;
  }

  // ─── Mutations ────────────────────────────────────────────────

  @Mutation(() => TaskMessageResult, { name: 'createTaskMessage' })
  async create(
    @Args('input') input: CreateTaskMessageInput,
    @Context() ctx: any,
  ): Promise<TaskMessageResult> {
    const { appUserId, tenantId } = await this.requireCurrentUser(ctx);
    return this.taskMessageService.create(tenantId, appUserId, input);
  }

  @Mutation(() => Boolean, { name: 'updateTaskMessage' })
  async update(
    @Args('messageId') messageId: string,
    @Args('input') input: UpdateTaskMessageInput,
    @Context() ctx: any,
  ): Promise<boolean> {
    const { appUserId, tenantId } = await this.requireCurrentUser(ctx);
    return this.taskMessageService.update(tenantId, appUserId, messageId, input);
  }

  @Mutation(() => Boolean, { name: 'deleteTaskMessage' })
  async delete(
    @Args('messageId') messageId: string,
    @Context() ctx: any,
  ): Promise<boolean> {
    const { appUserId, tenantId } = await this.requireCurrentUser(ctx);
    return this.taskMessageService.delete(tenantId, appUserId, messageId);
  }

  @Mutation(() => Boolean, { name: 'markTaskMessageAsRead' })
  async markAsRead(
    @Args('messageId') messageId: string,
    @Context() ctx: any,
  ): Promise<boolean> {
    const { appUserId, tenantId } = await this.requireCurrentUser(ctx);
    return this.taskMessageService.markAsRead(tenantId, appUserId, messageId);
  }

  @Mutation(() => Boolean, { name: 'completeTaskMessage' })
  async complete(
    @Args('messageId') messageId: string,
    @Context() ctx: any,
  ): Promise<boolean> {
    const { appUserId, tenantId } = await this.requireCurrentUser(ctx);
    return this.taskMessageService.complete(tenantId, appUserId, messageId);
  }

  // ─── ResolveFields ────────────────────────────────────────────

  @ResolveField(() => AppUser, { nullable: true })
  async senderUser(@Parent() msg: TaskMessage): Promise<AppUser | null> {
    if (msg.senderUser) return msg.senderUser;
    return this.appUserRepo.findOneBy({ id: msg.senderUserId });
  }

  @ResolveField(() => AppUser, { nullable: true })
  async recipientUser(@Parent() msg: TaskMessage): Promise<AppUser | null> {
    if (msg.recipientUser) return msg.recipientUser;
    return this.appUserRepo.findOneBy({ id: msg.recipientUserId });
  }

  // ─── Helpers ──────────────────────────────────────────────────

  /**
   * Resolves current user from JWT context.
   * Maps keycloakId → AppUser.id. Returns null if no AppUser is linked.
   */
  private async resolveCurrentUser(ctx: any): Promise<{ appUserId: string; tenantId: string } | null> {
    const tenantContext = ctx.req?.tenantContext;
    if (!tenantContext?.userId) {
      throw new UnauthorizedException('Utente non autenticato');
    }

    const keycloakId = tenantContext.userId;
    const tenantId = tenantContext.tenantId;

    const appUser = await this.appUserRepo.findOneBy({ keycloakId });
    if (!appUser) {
      this.logger.warn(`Nessun AppUser trovato per keycloakId ${keycloakId}`);
      return null;
    }

    return { appUserId: appUser.id, tenantId };
  }

  /**
   * Like resolveCurrentUser but throws for mutations that require a linked user.
   */
  private async requireCurrentUser(ctx: any): Promise<{ appUserId: string; tenantId: string }> {
    const result = await this.resolveCurrentUser(ctx);
    if (!result) {
      throw new UnauthorizedException('Account non collegato: collega il tuo utente prima di usare i messaggi task');
    }
    return result;
  }
}
