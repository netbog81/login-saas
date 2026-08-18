import { Resolver, Query, Mutation, Args, ID, Int, Context } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { WhatsappChatGuard } from '../guards/whatsapp-chat.guard';
import { WhatsappConversation } from '../entities/whatsapp-conversation.entity';
import { WhatsappChatService } from '../services/whatsapp-chat.service';
import {
  WhatsappChatMessagePage,
  WhatsappConversationFilterInput,
  OpenWhatsappConversationInput,
  SendWhatsappChatMessageInput,
  LinkWhatsappConversationPatientInput,
} from '../dto/whatsapp-chat.dto';
import { WhatsappChatMessage } from '../entities/whatsapp-chat-message.entity';
import { WhatsappConversationStatus } from '../../enums/whatsapp-enums';

// La chat contiene testo libero scritto da e verso i pazienti: l'accesso è
// riservato alla segreteria su TUTTE le operazioni, lettura compresa.
@UseGuards(WhatsappChatGuard)
@Resolver(() => WhatsappConversation)
export class WhatsappChatResolver {
  constructor(private readonly chatService: WhatsappChatService) {}

  // ==================== QUERY ====================

  @Query(() => [WhatsappConversation], { name: 'whatsappConversations' })
  async conversations(
    @Args('filters', { nullable: true }) filters?: WhatsappConversationFilterInput,
  ): Promise<WhatsappConversation[]> {
    return this.chatService.listConversations(filters);
  }

  @Query(() => WhatsappConversation, { name: 'whatsappConversation' })
  async conversation(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WhatsappConversation> {
    return this.chatService.getConversation(id);
  }

  @Query(() => WhatsappChatMessagePage, { name: 'whatsappChatMessages' })
  async messages(
    @Args('conversationId', { type: () => ID }) conversationId: string,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 50 }) limit: number,
  ): Promise<WhatsappChatMessagePage> {
    const { items, total } = await this.chatService.listMessages(conversationId, page, limit);
    return { items, total, page, limit };
  }

  /** Badge globale: messaggi in arrivo non ancora letti dalla segreteria. */
  @Query(() => Int, { name: 'whatsappChatUnreadCount' })
  async unreadCount(): Promise<number> {
    return this.chatService.countUnread();
  }

  /**
   * Testo di riepilogo dei prossimi appuntamenti del paziente, gia' renderizzato
   * coi template del tenant. Non invia niente: la UI lo mette nella casella di
   * scrittura perché l'operatore lo rilegga.
   */
  @Query(() => String, { name: 'whatsappChatAppointmentsRecap' })
  async appointmentsRecap(
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ): Promise<string> {
    return this.chatService.buildAppointmentsRecap(conversationId);
  }

  // ==================== MUTATION ====================

  @Mutation(() => WhatsappConversation, { name: 'openWhatsappConversation' })
  async openConversation(
    @Args('input') input: OpenWhatsappConversationInput,
  ): Promise<WhatsappConversation> {
    return this.chatService.openConversation({
      phone: input.phone,
      patientId: input.patientId,
      patientName: input.patientName,
    });
  }

  @Mutation(() => WhatsappChatMessage, { name: 'sendWhatsappChatMessage' })
  async sendMessage(
    @Args('input') input: SendWhatsappChatMessageInput,
    @Context() ctx: any,
  ): Promise<WhatsappChatMessage> {
    const user = this.requireUser(ctx);
    return this.chatService.sendMessage({
      conversationId: input.conversationId,
      text: input.text,
      userId: user.userId,
      userName: user.userName,
    });
  }

  @Mutation(() => WhatsappChatMessage, { name: 'retryWhatsappChatMessage' })
  async retryMessage(
    @Args('messageId', { type: () => ID }) messageId: string,
    @Context() ctx: any,
  ): Promise<WhatsappChatMessage> {
    const user = this.requireUser(ctx);
    return this.chatService.retryMessage(messageId, user.userId);
  }

  @Mutation(() => WhatsappConversation, { name: 'markWhatsappConversationRead' })
  async markRead(
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ): Promise<WhatsappConversation> {
    return this.chatService.markAsRead(conversationId);
  }

  @Mutation(() => WhatsappConversation, { name: 'setWhatsappConversationStatus' })
  async setStatus(
    @Args('conversationId', { type: () => ID }) conversationId: string,
    @Args('status', { type: () => WhatsappConversationStatus })
    status: WhatsappConversationStatus,
  ): Promise<WhatsappConversation> {
    return this.chatService.setStatus(conversationId, status);
  }

  @Mutation(() => WhatsappConversation, { name: 'linkWhatsappConversationPatient' })
  async linkPatient(
    @Args('input') input: LinkWhatsappConversationPatientInput,
  ): Promise<WhatsappConversation> {
    return this.chatService.linkPatient(
      input.conversationId,
      input.patientId ?? null,
      input.patientName,
    );
  }

  /**
   * Utente corrente dal contesto tenant. Sull'invio serve davvero: il messaggio
   * resta firmato da chi l'ha scritto, e in una segreteria con piu' persone
   * sulla stessa chat e' l'unico modo per capire chi ha risposto.
   */
  private requireUser(ctx: any): { userId: string; userName?: string } {
    const tenantContext = ctx.req?.tenantContext;
    if (!tenantContext?.userId) {
      throw new UnauthorizedException('Utente non autenticato');
    }
    return {
      // `userId` è il `sub` Keycloak, non l'id di AppUser: qui basta e avanza,
      // serve solo a attribuire il messaggio a chi l'ha scritto.
      userId: tenantContext.userId,
      userName: tenantContext.name || tenantContext.email,
    };
  }
}
