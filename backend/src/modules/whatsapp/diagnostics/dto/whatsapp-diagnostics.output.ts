import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';

/**
 * Perché un appuntamento compare fra i problemi.
 *
 * Categorie e non un testo libero perché ognuna si ripara in modo diverso, e
 * il pulsante da mostrare dipende da quale delle quattro è.
 */
export enum NotificationIssueKind {
  /**
   * Nessun messaggio ha mai nominato questo appuntamento. È il caso del
   * blackout: `dispatchBooking` esce prima di scrivere il log, quindi non
   * resta traccia da nessuna parte se non confrontando con gli appuntamenti.
   */
  NEVER_NOTIFIED = 'never_notified',
  /**
   * Un messaggio è partito, ma annunciava un'altra data: l'appuntamento è
   * stato spostato e il paziente ha in mano l'orario vecchio.
   */
  STALE_INFO = 'stale_info',
  /** Disdetto, ma nessuno gliel'ha detto. Si presenterà. */
  CANCELLED_NOT_NOTIFIED = 'cancelled_not_notified',
  /** Il messaggio è stato accodato e non è mai arrivato a destinazione. */
  STUCK = 'stuck',
}

registerEnumType(NotificationIssueKind, { name: 'NotificationIssueKind' });

/**
 * Se e come si puo' raggiungere una persona.
 *
 * Nasce da una verifica, non da un indizio: il recapito viene chiesto al
 * registry. La versione precedente lo deduceva dall'assenza di messaggi
 * passati, ed era sbagliata nel caso piu' comune — un paziente nuovo, o uno
 * rimasto senza notifiche per un guasto, non ha messaggi alle spalle pur
 * avendo un numero perfettamente valido.
 */
export enum ContactState {
  /** Un numero utilizzabile c'e': sull'appuntamento o in anagrafica. */
  USABLE = 'usable',
  /** Telefono compilato male e nessuna anagrafica dietro: non parte nulla. */
  INVALID = 'invalid',
  /** L'anagrafica esiste ma non ha ne' cellulare ne' telefono. */
  NO_CONTACT = 'no_contact',
  /** Non verificabile ora: il registry non ha risposto. */
  UNKNOWN = 'unknown',
}

registerEnumType(ContactState, { name: 'ContactState' });

@ObjectType()
export class AppointmentNotificationIssue {
  @Field(() => ID)
  appointmentId: string;

  /** Data del calendario dello studio, `YYYY-MM-DD`. */
  @Field()
  appointmentDate: string;

  @Field()
  startTime: string;

  /**
   * Quando l'appuntamento e' stato fissato, in ora dello studio.
   *
   * Serve a riconoscerlo: chi guarda l'elenco si ricorda della telefonata di
   * venerdi' pomeriggio, non dell'identificativo. Ed e' anche il modo di
   * capire a colpo d'occhio se una segnalazione appartiene a un guasto
   * recente o e' una vecchia conoscenza.
   */
  @Field()
  bookedAt: string;

  /**
   * Quando la disdetta e' stata registrata, in ora dello studio.
   *
   * Valorizzato solo sugli appuntamenti disdetti. Dice da quanto tempo il
   * paziente sta ignorando di non avere piu' quell'appuntamento: una disdetta
   * di tre settimane fa e una di stamattina si riparano con la stessa
   * telefonata, ma non con la stessa urgenza.
   */
  @Field({ nullable: true })
  cancelledAt?: string;

  @Field(() => NotificationIssueKind)
  kind: NotificationIssueKind;

  /** La data che il paziente ha ricevuto, quando è diversa da quella vera. */
  @Field({ nullable: true })
  announcedFor?: string;

  /** Stato dell'ultimo messaggio che nominava l'appuntamento, se c'è. */
  @Field({ nullable: true })
  lastMessageStatus?: string;

  @Field({ nullable: true })
  lastMessageAt?: Date;

  /**
   * Nessun modo di raggiungere il paziente: né anagrafica né telefono sulla
   * riga. Il reinvio automatico non può farci niente, va sistemato a mano.
   */
  @Field()
  unreachable: boolean;
}

@ObjectType()
export class PatientNotificationIssues {
  /** Nullo per gli appuntamenti senza anagrafica collegata. */
  @Field(() => ID, { nullable: true })
  patientId?: string;

  @Field({ nullable: true })
  patientName?: string;

  @Field({ nullable: true })
  phoneNumber?: string;

  /**
   * Tutti gli appuntamenti scoperti di questa persona, insieme.
   *
   * Raggruppati e non in elenco piatto perché è così che vanno riparati: un
   * paziente con cinque appuntamenti scoperti deve ricevere UN riepilogo con
   * cinque righe, non cinque messaggi. È anche il motivo per cui il reinvio
   * passa dal buffer del gateway invece di spedire subito.
   */
  /**
   * Se questa persona si puo' raggiungere, e altrimenti perche' no.
   *
   * `INVALID` e `UNKNOWN` si riparano in posti diversi — l'appuntamento e
   * l'anagrafica — e confonderli manda a cercare il problema dalla parte
   * sbagliata. `UNKNOWN` resta un indizio: il numero sta cifrato nel registry
   * e da qui non si legge.
   */
  @Field(() => ContactState)
  contactState: ContactState;

  @Field(() => [AppointmentNotificationIssue])
  appointments: AppointmentNotificationIssue[];
}

@ObjectType()
export class NotificationIssueTotals {
  @Field(() => Int) neverNotified: number;
  @Field(() => Int) staleInfo: number;
  @Field(() => Int) cancelledNotNotified: number;
  @Field(() => Int) stuck: number;
  /** Persone coinvolte: quanti messaggi servono davvero per rimediare. */
  @Field(() => Int) patients: number;

  /**
   * Appuntamenti scoperti prenotati PRIMA della finestra scelta.
   *
   * Contati e mostrati, mai nascosti in silenzio: una pagina che ne elenca
   * novanta senza dire che altri trecento sono fuori vista si legge come
   * "abbiamo trovato tutto", ed è il modo piu' rapido per non accorgersi di
   * un guasto vecchio.
   */
  @Field(() => Int) outsideWindow: number;

  /**
   * Appuntamenti futuri senza anagrafica NE' telefono.
   *
   * Non sono un problema di notifica — non c'e' nessuno da avvisare — ma
   * vanno detti: quasi sempre sono posti liberi di una ricorrenza, e se il
   * numero cresce all'improvviso significa che qualcosa sta creando
   * appuntamenti senza paziente.
   */
  @Field(() => Int) unreachable: number;

  /**
   * Quanti degli irraggiungibili sono segnati non retribuiti.
   *
   * Quando i due numeri coincidono — ed e' il caso oggi — sono tutti posti
   * interni e la pagina puo' dirlo senza girarci intorno. Quando divergono,
   * la differenza sono appuntamenti che qualcuno si aspetta di vedere onorati
   * ma che non hanno modo di essere comunicati: quelli vanno guardati.
   */
  @Field(() => Int) unreachableUnpaid: number;
}

/**
 * Un numero di telefono scritto sull'appuntamento che numero non e'.
 *
 * Sta in un elenco suo e non fra i problemi di notifica perche' le due cose
 * non coincidono piu': da quando il dispatch ripiega sull'anagrafica, un
 * campo compilato male non impedisce necessariamente il messaggio. Resta pero'
 * un dato sporco che nessuno vedrebbe mai — e che torna a mordere il giorno in
 * cui quel paziente non ha piu' un'anagrafica dietro.
 */
@ObjectType()
export class PhoneNumberIssue {
  @Field({ nullable: true })
  patientName?: string;

  /** Il contenuto vero del campo, da mostrare com'e': e' l'errore. */
  @Field()
  clientPhone: string;

  @Field(() => Int)
  appointments: number;

  @Field(() => ID, { nullable: true })
  patientId?: string;

  /**
   * Il numero come sta scritto in anagrafica, se ce n'e' uno valido.
   *
   * Si mostra in chiaro e non mascherato perche' serve a decidere: chi guarda
   * deve poter confrontare quello che c'e' sull'appuntamento con quello che
   * c'e' in anagrafica prima di sostituirlo. Nullo significa che in anagrafica
   * non c'e' niente di utilizzabile, e allora non c'e' nemmeno niente da
   * proporre.
   */
  @Field({ nullable: true })
  registryPhone?: string;

  /**
   * Cosa c'e' in anagrafica quando NON e' un numero utilizzabile.
   *
   * Serve a non proporre di sostituire sporco con sporco, e soprattutto a
   * dire dove sta il guasto: se anche l'anagrafica ha del testo dentro il
   * campo, la riparazione comincia da li' e non dagli appuntamenti.
   */
  @Field({ nullable: true })
  registryPhoneDirty?: string;

  /**
   * C'e' un'anagrafica dietro da cui pescare il numero.
   *
   * Falso significa che i messaggi per questa persona non partono affatto:
   * non c'e' nessun ripiego possibile.
   */
  @Field()
  hasRegistryFallback: boolean;
}

@ObjectType()
export class WhatsappDiagnostics {
  @Field()
  generatedAt: Date;

  /** Ampiezza della finestra, in giorni sulla data di prenotazione. */
  @Field(() => Int)
  windowDays: number;

  /**
   * Categorie che oggi nessun canale acceso porta.
   *
   * Sta qui e non solo nella pagina impostazioni perché è la causa a monte:
   * finché una categoria è scoperta, riparare i singoli appuntamenti è
   * inutile — il reinvio verrebbe scartato esattamente come l'invio originale.
   */
  @Field(() => [String])
  uncoveredCategories: string[];

  @Field(() => NotificationIssueTotals)
  totals: NotificationIssueTotals;

  @Field(() => [PatientNotificationIssues])
  groups: PatientNotificationIssues[];

  /**
   * Numeri di telefono da correggere, a prescindere dalle notifiche.
   *
   * Elenco separato di proposito: sono dati sporchi, non messaggi mancati, e
   * si riparano aprendo l'appuntamento invece che premendo "rimanda".
   */
  @Field(() => [PhoneNumberIssue])
  phoneIssues: PhoneNumberIssue[];
}

@ObjectType()
export class ResendOutcome {
  @Field(() => Int) requested: number;
  @Field(() => Int) dispatched: number;
  @Field(() => Int) skipped: number;
  @Field(() => [String]) errors: string[];
}
