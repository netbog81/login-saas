import { Injectable, Injector } from '@angular/core';
import { gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  WhatsappConfig,
  WhatsappConfigInput,
  WhatsappTemplate,
  WhatsappTemplateInput,
  WhatsappTemplateType,
  WhatsappMessageLog,
  WhatsappLogFilter,
  WhatsappMessageLogPage,
  WhatsappTestResult,
  WhatsappRetentionStats,
  WhatsappLogManagementResult,
} from '../models/whatsapp.models';

// ==================== QUERIES ====================

const GET_WHATSAPP_CONFIG = gql`
  query GetWhatsappConfig {
    whatsappConfig {
      id
      gatewayUrl
      tenantApiId
      maskedApiKey
      isActive
      sendCancelNotification
      retentionDays
      createdAt
      updatedAt
    }
  }
`;

const GET_WHATSAPP_TEMPLATES = gql`
  query GetWhatsappTemplates {
    whatsappTemplates {
      id
      templateType
      bodyTemplate
      footerTemplate
      isActive
      createdAt
      updatedAt
    }
  }
`;

const GET_WHATSAPP_TEMPLATE = gql`
  query GetWhatsappTemplate($type: WhatsappTemplateType!) {
    whatsappTemplate(type: $type) {
      id
      templateType
      bodyTemplate
      footerTemplate
      isActive
      updatedAt
    }
  }
`;

const GET_WHATSAPP_MESSAGE_LOGS = gql`
  query GetWhatsappMessageLogs($filters: WhatsappLogFilterInput!) {
    whatsappMessageLogs(filters: $filters) {
      items {
        id
        appointmentId
        patientId
        patientName
        phoneNumber
        messageType
        status
        correlationId
        evolutionMessageId
        messageBody
        errorMessage
        sentAt
        deliveredAt
        readAt
        isAnonymized
        anonymizedAt
        createdAt
        updatedAt
      }
      total
    }
  }
`;

const GET_WHATSAPP_MESSAGE_LOG = gql`
  query GetWhatsappMessageLog($id: ID!) {
    whatsappMessageLog(id: $id) {
      id
      appointmentId
      patientId
      patientName
      phoneNumber
      messageType
      status
      correlationId
      evolutionMessageId
      messageBody
      errorMessage
      sentAt
      deliveredAt
      readAt
      isAnonymized
      anonymizedAt
      createdAt
      updatedAt
    }
  }
`;

// ==================== LOG MANAGEMENT QUERIES ====================

const GET_RETENTION_STATS = gql`
  query GetWhatsappRetentionStats {
    whatsappRetentionStats {
      totalLogs
      expiredLogs
      anonymizedLogs
      retentionDays
      retentionCutoffDate
    }
  }
`;

const GET_EXPIRED_LOGS = gql`
  query GetWhatsappExpiredLogs($page: Int!, $limit: Int!) {
    whatsappExpiredLogs(page: $page, limit: $limit) {
      items {
        id
        appointmentId
        patientId
        patientName
        phoneNumber
        messageType
        status
        correlationId
        messageBody
        sentAt
        deliveredAt
        readAt
        isAnonymized
        anonymizedAt
        createdAt
        updatedAt
      }
      total
    }
  }
`;

// ==================== LOG MANAGEMENT MUTATIONS ====================

const ANONYMIZE_LOGS = gql`
  mutation AnonymizeWhatsappLogs($input: WhatsappBulkLogIdsInput!) {
    anonymizeWhatsappLogs(input: $input) {
      success
      affectedCount
      message
    }
  }
`;

const ANONYMIZE_EXPIRED_LOGS = gql`
  mutation AnonymizeExpiredWhatsappLogs {
    anonymizeExpiredWhatsappLogs {
      success
      affectedCount
      message
    }
  }
`;

const DELETE_LOGS = gql`
  mutation DeleteWhatsappLogs($input: WhatsappBulkLogIdsInput!) {
    deleteWhatsappLogs(input: $input) {
      success
      affectedCount
      message
    }
  }
`;

const DELETE_EXPIRED_LOGS = gql`
  mutation DeleteExpiredWhatsappLogs {
    deleteExpiredWhatsappLogs {
      success
      affectedCount
      message
    }
  }
`;

// ==================== MUTATIONS ====================

const UPSERT_WHATSAPP_CONFIG = gql`
  mutation UpsertWhatsappConfig($input: WhatsappConfigInput!) {
    upsertWhatsappConfig(input: $input) {
      id
      gatewayUrl
      tenantApiId
      maskedApiKey
      isActive
      sendCancelNotification
      retentionDays
      createdAt
      updatedAt
    }
  }
`;

const TEST_WHATSAPP_CONNECTION = gql`
  mutation TestWhatsappConnection {
    testWhatsappConnection
  }
`;

const TEST_WHATSAPP_DIRECT = gql`
  mutation TestWhatsappDirect($phone: String!, $name: String!, $message: String) {
    testWhatsappDirect(phone: $phone, name: $name, message: $message) {
      success
      message
      data
    }
  }
`;

const TEST_WHATSAPP_RECAP = gql`
  mutation TestWhatsappRecap($phone: String!, $name: String!) {
    testWhatsappRecap(phone: $phone, name: $name) {
      success
      message
      data
    }
  }
`;

const TEST_WHATSAPP_FULL_FLOW = gql`
  mutation TestWhatsappFullFlow($phone: String!, $name: String!) {
    testWhatsappFullFlow(phone: $phone, name: $name) {
      success
      message
      data
    }
  }
`;

const UPSERT_WHATSAPP_TEMPLATE = gql`
  mutation UpsertWhatsappTemplate($input: WhatsappTemplateInput!) {
    upsertWhatsappTemplate(input: $input) {
      id
      templateType
      bodyTemplate
      footerTemplate
      isActive
      updatedAt
    }
  }
`;

@Injectable({
  providedIn: 'root',
})
export class WhatsappService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getConfig(): Observable<WhatsappConfig | null> {
    return this.query<{ whatsappConfig: WhatsappConfig | null }>(
      GET_WHATSAPP_CONFIG,
    ).pipe(map((result) => result.whatsappConfig ?? null));
  }

  upsertConfig(input: WhatsappConfigInput): Observable<WhatsappConfig> {
    return this.mutate<{ upsertWhatsappConfig: WhatsappConfig }>(
      UPSERT_WHATSAPP_CONFIG,
      { input },
    ).pipe(map((result) => result.upsertWhatsappConfig));
  }

  testConnection(): Observable<boolean> {
    return this.mutate<{ testWhatsappConnection: boolean }>(
      TEST_WHATSAPP_CONNECTION,
    ).pipe(map((result) => result.testWhatsappConnection));
  }

  testDirect(phone: string, name: string, message?: string): Observable<WhatsappTestResult> {
    return this.mutate<{ testWhatsappDirect: WhatsappTestResult }>(
      TEST_WHATSAPP_DIRECT,
      { phone, name, message },
    ).pipe(map((result) => result.testWhatsappDirect));
  }

  testRecap(phone: string, name: string): Observable<WhatsappTestResult> {
    return this.mutate<{ testWhatsappRecap: WhatsappTestResult }>(
      TEST_WHATSAPP_RECAP,
      { phone, name },
    ).pipe(map((result) => result.testWhatsappRecap));
  }

  testFullFlow(phone: string, name: string): Observable<WhatsappTestResult> {
    return this.mutate<{ testWhatsappFullFlow: WhatsappTestResult }>(
      TEST_WHATSAPP_FULL_FLOW,
      { phone, name },
    ).pipe(map((result) => result.testWhatsappFullFlow));
  }

  getTemplates(): Observable<WhatsappTemplate[]> {
    return this.query<{ whatsappTemplates: WhatsappTemplate[] }>(
      GET_WHATSAPP_TEMPLATES,
    ).pipe(map((result) => result.whatsappTemplates ?? []));
  }

  getTemplate(type: WhatsappTemplateType): Observable<WhatsappTemplate | null> {
    return this.query<{ whatsappTemplate: WhatsappTemplate | null }>(
      GET_WHATSAPP_TEMPLATE,
      { type },
    ).pipe(map((result) => result.whatsappTemplate ?? null));
  }

  upsertTemplate(input: WhatsappTemplateInput): Observable<WhatsappTemplate> {
    return this.mutate<{ upsertWhatsappTemplate: WhatsappTemplate }>(
      UPSERT_WHATSAPP_TEMPLATE,
      { input },
    ).pipe(map((result) => result.upsertWhatsappTemplate));
  }

  getMessageLogs(filters: WhatsappLogFilter): Observable<WhatsappMessageLogPage> {
    return this.query<{ whatsappMessageLogs: WhatsappMessageLogPage }>(
      GET_WHATSAPP_MESSAGE_LOGS,
      { filters },
    ).pipe(
      map((result) => result.whatsappMessageLogs ?? { items: [], total: 0 }),
    );
  }

  getMessageLog(id: string): Observable<WhatsappMessageLog | null> {
    return this.query<{ whatsappMessageLog: WhatsappMessageLog | null }>(
      GET_WHATSAPP_MESSAGE_LOG,
      { id },
    ).pipe(map((result) => result.whatsappMessageLog ?? null));
  }

  // ── Log Management ──

  getRetentionStats(): Observable<WhatsappRetentionStats> {
    return this.query<{ whatsappRetentionStats: WhatsappRetentionStats }>(
      GET_RETENTION_STATS,
    ).pipe(map((result) => result.whatsappRetentionStats));
  }

  getExpiredLogs(page: number, limit: number): Observable<WhatsappMessageLogPage> {
    return this.query<{ whatsappExpiredLogs: WhatsappMessageLogPage }>(
      GET_EXPIRED_LOGS,
      { page, limit },
    ).pipe(map((result) => result.whatsappExpiredLogs ?? { items: [], total: 0 }));
  }

  anonymizeLogs(logIds: string[]): Observable<WhatsappLogManagementResult> {
    return this.mutate<{ anonymizeWhatsappLogs: WhatsappLogManagementResult }>(
      ANONYMIZE_LOGS,
      { input: { logIds } },
    ).pipe(map((result) => result.anonymizeWhatsappLogs));
  }

  anonymizeExpiredLogs(): Observable<WhatsappLogManagementResult> {
    return this.mutate<{ anonymizeExpiredWhatsappLogs: WhatsappLogManagementResult }>(
      ANONYMIZE_EXPIRED_LOGS,
    ).pipe(map((result) => result.anonymizeExpiredWhatsappLogs));
  }

  deleteLogs(logIds: string[]): Observable<WhatsappLogManagementResult> {
    return this.mutate<{ deleteWhatsappLogs: WhatsappLogManagementResult }>(
      DELETE_LOGS,
      { input: { logIds } },
    ).pipe(map((result) => result.deleteWhatsappLogs));
  }

  deleteExpiredLogs(): Observable<WhatsappLogManagementResult> {
    return this.mutate<{ deleteExpiredWhatsappLogs: WhatsappLogManagementResult }>(
      DELETE_EXPIRED_LOGS,
    ).pipe(map((result) => result.deleteExpiredWhatsappLogs));
  }
}
