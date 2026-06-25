import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sposta i dati di "anamnesi patologica remota" da `patient_evaluations`
 * (dove vivevano duplicati) verso `patient_anamnesis`, che diventa la fonte
 * unica dell'anamnesi remota (rinominata "Anamnesi Remota" lato UI), e poi
 * DROPpa le 4 colonne ormai morte dalla tabella valutazioni.
 *
 * Campi spostati (camelCase su patient_evaluations → snake_case su
 * patient_anamnesis):
 *   patologiePregresse    → patologie_pregresse
 *   interventiChirurgici  → interventi_chirurgici
 *   traumi                → traumi
 *   terapiaFarmacologica  → terapia_farmacologica
 *
 * Collegamento al paziente:
 *   patient_evaluations.therapeuticPathId
 *     → therapeutic_paths.patientId
 *       → patient_anamnesis.subject_id   (1:1 col subject del registry)
 *
 * STRATEGIA "migra poi DROP", non distruttiva sui dati:
 *  1. INSERT: crea una riga patient_anamnesis per i pazienti che hanno
 *     dati remoti in una valutazione ma NON hanno ancora un'anamnesi.
 *  2. UPDATE: per i pazienti che hanno già un'anamnesi, riempie SOLO i
 *     campi remoti attualmente vuoti (COALESCE), senza mai sovrascrivere
 *     dati già presenti nella tabella anamnesi.
 *  3. DROP delle 4 colonne da patient_evaluations.
 *
 * Se più valutazioni dello stesso paziente hanno dati remoti diversi, si
 * usa la valutazione più recente (ORDER BY created_at DESC) come sorgente —
 * coerente con "l'anamnesi remota è un dato del paziente, non della singola
 * valutazione".
 *
 * Idempotente: il punto 3 usa DROP COLUMN IF EXISTS; se rieseguita dopo il
 * drop, i passi 1/2 trovano le colonne assenti e falliscono — per questo
 * sono guardati da un check di esistenza colonna (no-op se già droppate).
 *
 * SCOPE: DB-per-tenant, schema unico `public`. Nessuna guard su tenant
 * specifico (vedi 1788000000000-AddMissingUuidDefaults, stesso stile
 * post-containerizzazione).
 */
export class MoveRemoteAnamnesisToPatientAnamnesis1789000000000
  implements MigrationInterface
{
  name = 'MoveRemoteAnamnesisToPatientAnamnesis1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard idempotenza: se le colonne sorgente non esistono più (migration
    // già applicata), salta la fase dati ed esce.
    const srcCols: Array<{ exists: boolean }> = await queryRunner.query(`
      SELECT true AS exists
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'patient_evaluations'
        AND column_name = 'patologiePregresse'
    `);
    if (srcCols.length === 0) {
      return;
    }

    // Sorgente: per ogni paziente, la valutazione più recente che abbia
    // almeno un campo remoto valorizzato. DISTINCT ON tiene una riga per
    // paziente.
    const sourceCte = `
      WITH src AS (
        SELECT DISTINCT ON (tp."patientId")
          tp."patientId"                AS patient_id,
          e."patologiePregresse"        AS patologie_pregresse,
          e."interventiChirurgici"      AS interventi_chirurgici,
          e."traumi"                    AS traumi,
          e."terapiaFarmacologica"      AS terapia_farmacologica
        FROM patient_evaluations e
        JOIN therapeutic_paths tp ON tp.id = e."therapeuticPathId"
        WHERE tp."patientId" IS NOT NULL
          AND (
            e."patologiePregresse"   IS NOT NULL
            OR e."interventiChirurgici" IS NOT NULL
            OR e."traumi"               IS NOT NULL
            OR (e."terapiaFarmacologica" IS NOT NULL
                AND array_length(e."terapiaFarmacologica", 1) > 0)
          )
        ORDER BY tp."patientId", e."createdAt" DESC NULLS LAST
      )
    `;

    // 1. INSERT per pazienti senza anamnesi esistente.
    await queryRunner.query(`
      ${sourceCte}
      INSERT INTO patient_anamnesis
        (subject_id, patologie_pregresse, interventi_chirurgici, traumi, terapia_farmacologica)
      SELECT
        src.patient_id,
        src.patologie_pregresse,
        src.interventi_chirurgici,
        src.traumi,
        COALESCE(src.terapia_farmacologica, '{}')
      FROM src
      WHERE NOT EXISTS (
        SELECT 1 FROM patient_anamnesis pa WHERE pa.subject_id = src.patient_id
      )
    `);

    // 2. UPDATE per pazienti con anamnesi esistente: riempi solo i buchi.
    //    Per gli array, riempi solo se l'array attuale è vuoto/null.
    await queryRunner.query(`
      ${sourceCte}
      UPDATE patient_anamnesis pa
      SET
        patologie_pregresse   = COALESCE(pa.patologie_pregresse, src.patologie_pregresse),
        interventi_chirurgici = COALESCE(pa.interventi_chirurgici, src.interventi_chirurgici),
        traumi                = COALESCE(pa.traumi, src.traumi),
        terapia_farmacologica = CASE
          WHEN pa.terapia_farmacologica IS NULL
            OR array_length(pa.terapia_farmacologica, 1) IS NULL
          THEN COALESCE(src.terapia_farmacologica, pa.terapia_farmacologica)
          ELSE pa.terapia_farmacologica
        END,
        updated_at = now()
      FROM src
      WHERE pa.subject_id = src.patient_id
    `);

    // 3. DROP delle 4 colonne ormai morte da patient_evaluations.
    await queryRunner.query(`
      ALTER TABLE "patient_evaluations"
      DROP COLUMN IF EXISTS "patologiePregresse",
      DROP COLUMN IF EXISTS "interventiChirurgici",
      DROP COLUMN IF EXISTS "traumi",
      DROP COLUMN IF EXISTS "terapiaFarmacologica"
    `);
  }

  /**
   * Down: ricrea le colonne (vuote). Il dato resta in patient_anamnesis —
   * NON viene ricopiato indietro perché dopo lo spostamento la tabella
   * anamnesi è la fonte autorevole e una copia all'indietro creerebbe di
   * nuovo divergenza. Le colonne tornano nullable come in origine.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_evaluations"
      ADD COLUMN IF NOT EXISTS "patologiePregresse"   text,
      ADD COLUMN IF NOT EXISTS "interventiChirurgici" text,
      ADD COLUMN IF NOT EXISTS "traumi"               text,
      ADD COLUMN IF NOT EXISTS "terapiaFarmacologica" character varying[] DEFAULT '{}'
    `);
  }
}
