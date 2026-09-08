import { ObjectType, Field, ID } from '@nestjs/graphql';
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Come lo studio vuole che il calendario esterno rispecchi il gestionale.
 *
 * ATTENZIONE — riguarda SOLO cio' che finisce su Google Calendar e nel feed
 * ICS. Gli appuntamenti nel gestionale non vengono mai toccati da queste
 * impostazioni: restano tutti, passati e futuri, perche' sono lo storico
 * clinico e fiscale dello studio.
 *
 * Una riga sola per tenant (DB-per-tenant).
 */
@ObjectType()
@Entity('calendar_sync_settings')
export class CalendarSyncSetting {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Se il calendario esterno debba conservare gli appuntamenti gia' passati.
   *
   * `true`  — restano visibili da quando l'operatore si e' collegato in poi.
   *           Utile a chi consulta il proprio storico dal telefono.
   * `false` — il calendario mostra solo da oggi in avanti, e gli appuntamenti
   *           passati vengono rimossi da Google. Utile a chi vuole un'agenda
   *           pulita, e a chi non vuole nomi di pazienti fermi sul telefono
   *           piu' del necessario.
   *
   * In entrambi i casi il gestionale conserva tutto.
   */
  @Field()
  @Column({ default: true })
  keepPastAppointments: boolean;

  /**
   * Se il calendario creato su Google debba sopravvivere allo scollegamento.
   *
   * `true`  — resta all'operatore come copia ferma dei suoi appuntamenti.
   * `false` — viene cancellato da Google insieme al collegamento.
   *
   * Vale solo per lo scollegamento volontario: a permesso SCADUTO non
   * abbiamo piu' modo di parlare con Google, quindi il calendario resta
   * comunque dov'e'. Non e' una scelta, e' un limite.
   */
  @Field()
  @Column({ default: true })
  keepCalendarOnDisconnect: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
