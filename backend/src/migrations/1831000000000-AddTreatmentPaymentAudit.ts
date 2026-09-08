import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit dell'incasso: CHI ha registrato l'operazione e con quale ruolo.
 *
 * `collectedBy` dice a chi è ATTRIBUITO l'incasso (chi ha materialmente preso
 * i soldi) e non basta per due domande che le statistiche sugli sconto FE
 * dovranno porre:
 *
 *  - "quale utente ha registrato l'operazione a sistema?" — quando la
 *    segreteria spunta "incassato dall'operatore" nel dialog di modifica,
 *    `collectedBy` è l'operatore e della segretaria non resta traccia;
 *  - "chi ha incassato lo ha fatto da operatore o da segreteria?" — oggi si
 *    potrebbe solo dedurre dai ruoli ATTUALI dell'utente, che cambiano nel
 *    tempo e sono ambigui per chi è insieme operatore e amministratore
 *    (es. un medico con ruolo admin).
 *
 * Entrambe si scrivono solo all'atto dell'incasso: a posteriori non sono
 * ricostruibili, per questo le colonne arrivano prima della pagina
 * statistiche. Nullable e nulle per tutto lo storico — le righe già incassate
 * non possono dire chi le ha registrate, e dedurlo produrrebbe numeri falsi.
 *
 * `paymentCollectorRole` è il ruolo derivato SERVER-SIDE dal JWT
 * (`TreatmentResolver.derivePaymentRole`): 'operator' | 'secretary'. Varchar
 * e non enum: è uno snapshot di audit, non una macchina a stati, e un enum
 * Postgres andrebbe migrato a ogni ruolo nuovo.
 */
export class AddTreatmentPaymentAudit1831000000000 implements MigrationInterface {
  name = 'AddTreatmentPaymentAudit1831000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE treatments
      ADD COLUMN IF NOT EXISTS "paymentRecordedByUserId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE treatments
      ADD COLUMN IF NOT EXISTS "paymentCollectorRole" varchar(20)
    `);

    // Le statistiche partono sempre da "gli incassi sconto FE del periodo":
    // indice parziale sui soli trattamenti incassati, che sono la minoranza
    // delle righe e l'unica su cui queste due colonne sono valorizzate.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_treatments_payment_recorded_by"
      ON treatments ("paymentRecordedByUserId")
      WHERE "paymentRecordedByUserId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_treatments_payment_recorded_by"
    `);
    await queryRunner.query(`
      ALTER TABLE treatments DROP COLUMN IF EXISTS "paymentCollectorRole"
    `);
    await queryRunner.query(`
      ALTER TABLE treatments DROP COLUMN IF EXISTS "paymentRecordedByUserId"
    `);
  }
}
