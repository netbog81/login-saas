import { Injectable, Injector } from '@angular/core';
import { gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  TaskMessage,
  TaskMessagePage,
  TaskMessageResult,
  CreateTaskMessageInput,
  UpdateTaskMessageInput,
} from '../models/task-message.models';

// ─── GraphQL Documents ──────────────────────────────────────────

const TASK_MESSAGE_FIELDS = gql`
  fragment TaskMessageFields on TaskMessage {
    id
    gatewayMessageId
    tenantId
    senderUserId
    recipientUserId
    senderUser {
      id
      name
      surname
    }
    recipientUser {
      id
      name
      surname
    }
    content
    status
    availableFrom
    readAt
    completedAt
    createdAt
    updatedAt
  }
`;

const GET_INBOX = gql`
  ${TASK_MESSAGE_FIELDS}
  query TaskMessageInbox($page: Int, $limit: Int) {
    taskMessageInbox(page: $page, limit: $limit) {
      items {
        ...TaskMessageFields
      }
      total
    }
  }
`;

const GET_SENT = gql`
  ${TASK_MESSAGE_FIELDS}
  query TaskMessageSent($page: Int, $limit: Int) {
    taskMessageSent(page: $page, limit: $limit) {
      items {
        ...TaskMessageFields
      }
      total
    }
  }
`;

const GET_COMPLETED = gql`
  ${TASK_MESSAGE_FIELDS}
  query TaskMessageCompleted($page: Int, $limit: Int) {
    taskMessageCompleted(page: $page, limit: $limit) {
      items {
        ...TaskMessageFields
      }
      total
    }
  }
`;

const GET_MESSAGE = gql`
  ${TASK_MESSAGE_FIELDS}
  query TaskMessage($id: ID!) {
    taskMessage(id: $id) {
      ...TaskMessageFields
    }
  }
`;

const GET_UNREAD_COUNT = gql`
  query TaskMessageUnreadCount {
    taskMessageUnreadCount
  }
`;

const GET_MY_APP_USER_ID = gql`
  query TaskMessageMyAppUserId {
    taskMessageMyAppUserId
  }
`;

const CREATE_TASK_MESSAGE = gql`
  mutation CreateTaskMessage($input: CreateTaskMessageInput!) {
    createTaskMessage(input: $input) {
      messageId
      status
    }
  }
`;

const UPDATE_TASK_MESSAGE = gql`
  mutation UpdateTaskMessage($messageId: String!, $input: UpdateTaskMessageInput!) {
    updateTaskMessage(messageId: $messageId, input: $input)
  }
`;

const DELETE_TASK_MESSAGE = gql`
  mutation DeleteTaskMessage($messageId: String!) {
    deleteTaskMessage(messageId: $messageId)
  }
`;

const MARK_AS_READ = gql`
  mutation MarkTaskMessageAsRead($messageId: String!) {
    markTaskMessageAsRead(messageId: $messageId)
  }
`;

const COMPLETE_TASK_MESSAGE = gql`
  mutation CompleteTaskMessage($messageId: String!) {
    completeTaskMessage(messageId: $messageId)
  }
`;

// ─── Service ────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TaskMessageService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  // ─── Queries ──────────────────────────────────────────────────

  getInbox(page = 1, limit = 20): Observable<TaskMessagePage> {
    return this.query<{ taskMessageInbox: TaskMessagePage }>(
      GET_INBOX,
      { page, limit },
    ).pipe(map((r) => r.taskMessageInbox));
  }

  getSent(page = 1, limit = 20): Observable<TaskMessagePage> {
    return this.query<{ taskMessageSent: TaskMessagePage }>(
      GET_SENT,
      { page, limit },
    ).pipe(map((r) => r.taskMessageSent));
  }

  getCompleted(page = 1, limit = 20): Observable<TaskMessagePage> {
    return this.query<{ taskMessageCompleted: TaskMessagePage }>(
      GET_COMPLETED,
      { page, limit },
    ).pipe(map((r) => r.taskMessageCompleted));
  }

  getMessage(id: string): Observable<TaskMessage | null> {
    return this.query<{ taskMessage: TaskMessage | null }>(
      GET_MESSAGE,
      { id },
    ).pipe(map((r) => r.taskMessage));
  }

  getUnreadCount(): Observable<number> {
    return this.query<{ taskMessageUnreadCount: number }>(
      GET_UNREAD_COUNT,
    ).pipe(map((r) => r.taskMessageUnreadCount));
  }

  getMyAppUserId(): Observable<string | null> {
    return this.query<{ taskMessageMyAppUserId: string | null }>(
      GET_MY_APP_USER_ID,
    ).pipe(map((r) => r.taskMessageMyAppUserId));
  }

  // ─── Mutations ────────────────────────────────────────────────

  createMessage(input: CreateTaskMessageInput): Observable<TaskMessageResult> {
    return this.mutate<{ createTaskMessage: TaskMessageResult }>(
      CREATE_TASK_MESSAGE,
      { input },
    ).pipe(map((r) => r.createTaskMessage));
  }

  updateMessage(messageId: string, input: UpdateTaskMessageInput): Observable<boolean> {
    return this.mutate<{ updateTaskMessage: boolean }>(
      UPDATE_TASK_MESSAGE,
      { messageId, input },
    ).pipe(map((r) => r.updateTaskMessage));
  }

  deleteMessage(messageId: string): Observable<boolean> {
    return this.mutate<{ deleteTaskMessage: boolean }>(
      DELETE_TASK_MESSAGE,
      { messageId },
    ).pipe(map((r) => r.deleteTaskMessage));
  }

  markAsRead(messageId: string): Observable<boolean> {
    return this.mutate<{ markTaskMessageAsRead: boolean }>(
      MARK_AS_READ,
      { messageId },
    ).pipe(map((r) => r.markTaskMessageAsRead));
  }

  completeMessage(messageId: string): Observable<boolean> {
    return this.mutate<{ completeTaskMessage: boolean }>(
      COMPLETE_TASK_MESSAGE,
      { messageId },
    ).pipe(map((r) => r.completeTaskMessage));
  }
}
