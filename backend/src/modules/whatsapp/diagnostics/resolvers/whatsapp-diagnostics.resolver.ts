import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { WhatsappDiagnosticsService } from '../services/whatsapp-diagnostics.service';
import {
  ResendOutcome,
  WhatsappDiagnostics,
} from '../dto/whatsapp-diagnostics.output';

@Resolver(() => WhatsappDiagnostics)
export class WhatsappDiagnosticsResolver {
  constructor(private readonly service: WhatsappDiagnosticsService) {}

  /**
   * Lo stato di salute delle notifiche, calcolato al momento.
   *
   * Non memorizzato: una fotografia vecchia di un'ora, su una pagina che si
   * apre proprio quando si sospetta un guasto, è peggio di nessuna.
   */
  @Query(() => WhatsappDiagnostics, { name: 'whatsappDiagnostics' })
  async diagnostics(
    @Args('windowDays', { type: () => Int, nullable: true, defaultValue: 7 })
    windowDays: number,
  ): Promise<WhatsappDiagnostics> {
    // Un tetto: la finestra decide quante righe si classificano in memoria, e
    // un numero arbitrario dal client diventerebbe una scansione dell'intero
    // storico a ogni apertura della pagina.
    return this.service.diagnose(Math.min(Math.max(windowDays ?? 7, 1), 365));
  }

  /**
   * Rimanda le conferme degli appuntamenti indicati.
   *
   * Gli id arrivano dal client e non si ricalcolano qui: chi guarda la pagina
   * deve poter scegliere chi riavvisare — magari a qualcuno l'ha già detto al
   * telefono — e un reinvio "tutti quelli scoperti adesso" ignorerebbe la
   * scelta appena fatta.
   */
  @Mutation(() => ResendOutcome, { name: 'resendMissingNotifications' })
  async resend(
    @Args('appointmentIds', { type: () => [ID] }) appointmentIds: string[],
  ): Promise<ResendOutcome> {
    return this.service.resend(appointmentIds);
  }

  /**
   * Riscrive un telefono sbagliato col numero vero dell'anagrafica.
   *
   * Si passa il VALORE del campo e non gli id: l'errore e' uno solo, copiato
   * su tutta una ricorrenza, e chi lo corregge sta riparando quello — non
   * trentacinque appuntamenti scelti a mano.
   */
  @Mutation(() => Int, { name: 'applyRegistryPhone' })
  async applyRegistryPhone(
    @Args('clientPhone') clientPhone: string,
  ): Promise<number> {
    return this.service.applyRegistryPhone(clientPhone);
  }
}
