// Migration: Create Pazienti (Patients) Tables
// This migration creates all tables for the patient management module

import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePazientiTables1760800000000 implements MigrationInterface {
  name = 'CreatePazientiTables1760800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== CREATE PATIENTS TABLE ====================
    await queryRunner.createTable(
      new Table({
        name: 'patients',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          // Dati anagrafici
          {
            name: 'name',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'surname',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'codice_fiscale',
            type: 'varchar',
            length: '16',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'data_nascita',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'comune_nascita',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'nazione_nascita',
            type: 'varchar',
            length: '50',
            isNullable: true,
            default: "'Italia'",
          },
          {
            name: 'luogo_nascita_estero',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'genere',
            type: 'varchar',
            length: '1',
            isNullable: false,
          },
          {
            name: 'stato_civile',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'tipo_paziente',
            type: 'varchar',
            length: '30',
            isNullable: false,
            default: "'adulto_autonomo'",
          },
          // Contatti
          {
            name: 'phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'cellulare',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '100',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'pec',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          // Residenza
          {
            name: 'indirizzo_residenza',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'comune_residenza',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'provincia_residenza',
            type: 'varchar',
            length: '2',
            isNullable: true,
          },
          {
            name: 'cap',
            type: 'varchar',
            length: '5',
            isNullable: true,
          },
          // Dati sanitari
          {
            name: 'tessera_sanitaria',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'medico_curante',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'allergie',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'farmaci',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'patologie_croniche',
            type: 'text',
            isNullable: true,
          },
          // Dati fiscali
          {
            name: 'nome_fatturazione',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'indirizzo_fatturazione',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'partita_iva',
            type: 'varchar',
            length: '11',
            isNullable: true,
          },
          {
            name: 'codice_fiscale_fatturazione',
            type: 'varchar',
            length: '16',
            isNullable: true,
          },
          {
            name: 'codice_sdi',
            type: 'varchar',
            length: '7',
            isNullable: true,
          },
          {
            name: 'assicurazione',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'numero_polizza_assicurativa',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          // Workflow states
          {
            name: 'stato_anagrafica',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'bozza'",
          },
          {
            name: 'stato_privacy',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'non_acquisita'",
          },
          {
            name: 'origine',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          // Privacy & GDPR
          {
            name: 'consenso_gdpr',
            type: 'boolean',
            default: false,
          },
          {
            name: 'data_consenso_gdpr',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'consenso_marketing',
            type: 'boolean',
            default: false,
          },
          {
            name: 'data_consenso_marketing',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'consenso_comunicazione_terzi',
            type: 'boolean',
            default: false,
          },
          {
            name: 'data_consenso_terzi',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'documenti_privacy',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'data_ultima_modifica_privacy',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'richiesta_cancellazione',
            type: 'boolean',
            default: false,
          },
          {
            name: 'data_richiesta_cancellazione',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'data_anonimizzazione',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'conservazione_fino',
            type: 'date',
            isNullable: true,
          },
          // Tracking fields (from agendatest)
          {
            name: 'cancellationsByYear',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'noShowsByYear',
            type: 'jsonb',
            default: "'{}'",
          },
          // Timestamps
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for patients table
    await queryRunner.createIndex(
      'patients',
      new TableIndex({
        name: 'IDX_patients_codice_fiscale',
        columnNames: ['codice_fiscale'],
      }),
    );

    await queryRunner.createIndex(
      'patients',
      new TableIndex({
        name: 'IDX_patients_email',
        columnNames: ['email'],
      }),
    );

    await queryRunner.createIndex(
      'patients',
      new TableIndex({
        name: 'IDX_patients_phone',
        columnNames: ['phone'],
      }),
    );

    await queryRunner.createIndex(
      'patients',
      new TableIndex({
        name: 'IDX_patients_data_nascita',
        columnNames: ['data_nascita'],
      }),
    );

    await queryRunner.createIndex(
      'patients',
      new TableIndex({
        name: 'IDX_patients_stato_anagrafica',
        columnNames: ['stato_anagrafica'],
      }),
    );

    await queryRunner.createIndex(
      'patients',
      new TableIndex({
        name: 'IDX_patients_stato_privacy',
        columnNames: ['stato_privacy'],
      }),
    );

    await queryRunner.createIndex(
      'patients',
      new TableIndex({
        name: 'IDX_patients_surname_name',
        columnNames: ['surname', 'name'],
      }),
    );

    // ==================== CREATE PERSONE_RIFERIMENTO TABLE ====================
    // NOTE: This table is part of the complete patient module but may need adaptation
    // based on your specific requirements. Uncomment if you need reference persons management.

    /*
    await queryRunner.createTable(
      new Table({
        name: 'persone_riferimento',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'paziente_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'tipo_riferimento',
            type: 'varchar',
            length: '30',
            isNullable: false,
          },
          {
            name: 'nome',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'cognome',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'codice_fiscale',
            type: 'varchar',
            length: '16',
            isNullable: true,
          },
          {
            name: 'telefono',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'persone_riferimento',
      new TableForeignKey({
        columnNames: ['paziente_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'patients',
        onDelete: 'CASCADE',
      }),
    );
    */
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop persone_riferimento table if created
    // await queryRunner.dropTable('persone_riferimento', true);

    // Drop patients table
    await queryRunner.dropTable('patients', true);
  }
}
