import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * Tipo di documento generabile da template. Per ora solo l'attestato di
 * presenza; l'enum è pensato per crescere (es. consenso informato,
 * relazione clinica) e per essere riusato quando il template-editor
 * verrà portato in accounting.
 */
export enum DocumentTemplateType {
  ATTENDANCE_CERTIFICATE = 'ATTENDANCE_CERTIFICATE',
}

registerEnumType(DocumentTemplateType, {
  name: 'DocumentTemplateType',
  description: 'Tipo di documento generabile da template',
});

/**
 * Template di documento personalizzabile dall'utente (sessione template
 * documenti, 2026-07-06).
 *
 * `content` è il documento TipTap/ProseMirror in formato JSON: i merge
 * field (es. paziente.nomeCompleto) sono nodi atomici con attributo
 * `field`, sostituiti coi dati reali al momento della generazione. Il
 * rendering HTML avviene interamente lato frontend (stesso HTML per
 * anteprima editor e stampa → fedeltà garantita).
 *
 * `pageSettings` è un JSON con le impostazioni di pagina (logo in
 * data-URL, colori, font, margini). Il logo viaggia dentro il template:
 * scelta deliberata per non dipendere da uno storage file (quando
 * arriverà lo storage S3/MicroCeph si potrà spostare dietro un
 * FileStorageService senza toccare questo modello).
 */
@ObjectType('DocumentTemplate')
@Entity('document_templates')
export class DocumentTemplate {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field(() => DocumentTemplateType)
  @Column({
    type: 'varchar',
    length: 50,
    default: DocumentTemplateType.ATTENDANCE_CERTIFICATE,
  })
  type: DocumentTemplateType;

  /** Documento TipTap JSON (doc ProseMirror con nodi merge-field). */
  @Field(() => GraphQLJSON)
  @Column({ type: 'jsonb' })
  content: Record<string, unknown>;

  /** Impostazioni pagina: logo data-URL, colori, font, margini. */
  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  pageSettings?: Record<string, unknown>;

  /**
   * Template usato dall'azione rapida "Genera attestato" quando per il
   * tipo esistono più template. Al massimo uno per tipo (enforced dal
   * service, non da constraint DB).
   */
  @Field()
  @Column({ default: false })
  isDefault: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
