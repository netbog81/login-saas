import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Un accesso negato dall'AuthorizationGuard.
 *
 * Prima esisteva solo come riga di log del container: spariva a ogni restart,
 * e per sapere se un utente stava sbattendo contro un permesso mancante
 * bisognava saperlo già e andare a cercarlo con grep. Qui resta, e la domanda
 * «da quanto va avanti?» ha una risposta.
 *
 * Registra il TENTATIVO, non il dato: nessun contenuto della richiesta, solo
 * chi ha chiesto cosa e quando. La retention la applica
 * PermissionDenialService, non serve tenerli per sempre.
 */
@ObjectType()
@Entity('permission_denials')
@Index('IDX_permission_denials_occurred', ['occurredAt'])
export class PermissionDenial {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Utente applicativo, quando c'è. È nullo nel caso `user_not_found`: il JWT
   * era valido ma in questo tenant quella persona non ha un app_user, e senza
   * riga non c'è id da scrivere.
   */
  @Field(() => ID, { nullable: true })
  @Column({ name: 'app_user_id', type: 'uuid', nullable: true })
  appUserId?: string;

  /** Sempre presente: viene dal token, ed è l'unico aggancio nel caso senza app_user. */
  @Field({ nullable: true })
  @Column({ name: 'keycloak_id', length: 100, nullable: true })
  keycloakId?: string;

  /** Copia dell'indirizzo al momento del rifiuto, per leggere l'elenco senza join. */
  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  email?: string;

  /**
   * Il permesso che mancava. Una riga per permesso: se un'operazione ne
   * chiedeva due e mancavano entrambi, sono due righe — così il conteggio per
   * permesso è un GROUP BY e non un parsing.
   */
  @Field()
  @Index('IDX_permission_denials_permission')
  @Column({ length: 100 })
  permission: string;

  /**
   * Cosa stava chiedendo: nome del campo GraphQL (`operatorGoogleCalendar`)
   * oppure `METODO /path` per le rotte REST. È la parte che dice DOVE nella
   * UI l'utente ha trovato il muro.
   */
  @Field({ nullable: true })
  @Column({ length: 200, nullable: true })
  operation?: string;

  /**
   * `missing_permission` — l'utente c'è ma il suo ruolo non porta il permesso.
   * `user_not_found`     — nessun app_user per quel keycloak_id in questo tenant.
   *
   * Distinzione che cambia la cura: il primo si risolve dalla matrice dei
   * permessi, il secondo creando o collegando l'utente.
   */
  @Field()
  @Column({ length: 40, default: 'missing_permission' })
  reason: string;

  @Field()
  @Column({ name: 'occurred_at', type: 'timestamp', default: () => 'now()' })
  occurredAt: Date;
}
