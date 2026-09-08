import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { TreatmentStatus } from '../entities/treatment-enums';

/**
 * Riga dell'allarme "sconto FE da incassare" nella cartella paziente.
 *
 * Un trattamento con `scontoFE = true` il cui incasso non è mai stato
 * registrato (`isPaid = false`). Il pagamento degli sconto FE vive SOLO nel
 * clinico (contanti o voucher FE): nessun evento verso accounting, nessuna
 * fattura che lo solleciti — per questo serve un allarme dedicato.
 *
 * Il perimetro comprende sia i trattamenti di fisioterapia sia quelli di
 * palestra (istruttori): sono record `treatments` identici, cambia solo il
 * tipo dell'appuntamento collegato (`isGym`).
 */
@ObjectType()
export class PendingFeCollectionItem {
  @Field(() => ID)
  treatmentId: string;

  /** Data/ora di inizio del trattamento (ISO). */
  @Field()
  startedAt: string;

  @Field(() => TreatmentStatus)
  status: TreatmentStatus;

  /** Operatore che ha eseguito il trattamento (fisioterapista o istruttore). */
  @Field(() => ID)
  operatorId: string;

  @Field()
  operatorName: string;

  /** AppUser dell'operatore: è la chiave con cui si decide l'ownership. */
  @Field(() => ID, { nullable: true })
  operatorAppUserId?: string | null;

  /** True se il trattamento nasce da un appuntamento di palestra. */
  @Field()
  isGym: boolean;

  /**
   * Importo da incassare: `treatment.price` se valorizzato, altrimenti la
   * somma delle righe servizio (i trattamenti ancora in corso hanno price 0
   * finché non vengono completati).
   */
  @Field(() => Float)
  amount: number;

  /** Elenco dei servizi della seduta, per riconoscere il trattamento. */
  @Field({ nullable: true })
  servicesDescription?: string | null;

  /** Percorso terapeutico di appartenenza (se noto). */
  @Field({ nullable: true })
  therapeuticPathName?: string | null;

  /**
   * True se l'utente corrente può registrare l'incasso di QUESTA riga.
   * Calcolato server-side: segreteria/admin sempre; operatore solo se
   * abilitato all'incasso (canCollectPayment) e se il trattamento è suo
   * oppure l'impostazione "tutti possono incassare sconto FE" è attiva.
   */
  @Field()
  canCollect: boolean;

  /** Motivo per cui `canCollect` è false (tooltip UI). */
  @Field({ nullable: true })
  cannotCollectReason?: string | null;
}

/**
 * Riepilogo degli sconto FE non incassati di un paziente.
 * `count = 0` ⇒ il badge di allarme resta spento.
 */
@ObjectType()
export class PendingFeCollections {
  @Field(() => Int)
  count: number;

  @Field(() => Float)
  totalAmount: number;

  /** Valore corrente di `payments.scontoFeCollectAnyOperator`. */
  @Field()
  allowAnyOperatorCollect: boolean;

  /** True se il chiamante opera da segreteria/admin (incassa sempre tutto). */
  @Field()
  callerIsSecretary: boolean;

  @Field(() => [PendingFeCollectionItem])
  items: PendingFeCollectionItem[];
}
