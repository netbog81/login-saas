/**
 * Whatsapp Diagnostics Service
 * Layer 3: business logic + GraphQL
 */

import { Injectable, Injector } from '@angular/core';
import { gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { ResendOutcome, WhatsappDiagnostics } from '../models/whatsapp-diagnostics.model';

const GET_DIAGNOSTICS = gql`
  query WhatsappDiagnostics($windowDays: Int) {
    whatsappDiagnostics(windowDays: $windowDays) {
      generatedAt
      windowDays
      uncoveredCategories
      totals {
        neverNotified
        staleInfo
        cancelledNotNotified
        stuck
        patients
        outsideWindow
        unreachable
        unreachableUnpaid
      }
      phoneIssues {
        patientName
        clientPhone
        appointments
        patientId
        registryPhone
        registryPhoneDirty
        hasRegistryFallback
      }
      groups {
        patientId
        patientName
        phoneNumber
        contactState
        appointments {
          appointmentId
          appointmentDate
          startTime
          bookedAt
          cancelledAt
          kind
          announcedFor
          lastMessageStatus
          lastMessageAt
          unreachable
        }
      }
    }
  }
`;

const RESEND_MISSING = gql`
  mutation ResendMissingNotifications($appointmentIds: [ID!]!) {
    resendMissingNotifications(appointmentIds: $appointmentIds) {
      requested
      dispatched
      skipped
      errors
    }
  }
`;

const APPLY_REGISTRY_PHONE = gql`
  mutation ApplyRegistryPhone($clientPhone: String!) {
    applyRegistryPhone(clientPhone: $clientPhone)
  }
`;

@Injectable({ providedIn: 'root' })
export class WhatsappDiagnosticsService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /** Mai dalla cache: la pagina si apre proprio quando si sospetta un guasto. */
  diagnose(windowDays: number): Observable<WhatsappDiagnostics> {
    return this.query<{ whatsappDiagnostics: WhatsappDiagnostics }>(
      GET_DIAGNOSTICS,
      { windowDays },
      'no-cache',
    ).pipe(map(r => r.whatsappDiagnostics));
  }

  /** Scrive il numero dell'anagrafica sugli appuntamenti futuri. */
  applyRegistryPhone(clientPhone: string): Observable<number> {
    return this.mutate<{ applyRegistryPhone: number }>(
      APPLY_REGISTRY_PHONE,
      { clientPhone },
    ).pipe(map(r => r.applyRegistryPhone));
  }

  resend(appointmentIds: string[]): Observable<ResendOutcome> {
    return this.mutate<{ resendMissingNotifications: ResendOutcome }>(
      RESEND_MISSING,
      { appointmentIds },
    ).pipe(map(r => r.resendMissingNotifications));
  }
}
