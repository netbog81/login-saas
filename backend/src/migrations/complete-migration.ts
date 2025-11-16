import { DataSource } from 'typeorm';

async function completeMigration() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'calendar_db',
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('Database connected\n');

    // Step 1: Migrate data from old columns to new columns
    console.log('Step 1: Migrating data from old columns to new columns...');
    await dataSource.query(`
      UPDATE services
      SET
        "defaultDuration" = COALESCE("defaultDuration", duration),
        "bufferTimeBefore" = COALESCE("bufferTimeBefore", "bufferTime"),
        "defaultPrice" = COALESCE("defaultPrice", 0),
        "bufferTimeAfter" = COALESCE("bufferTimeAfter", 0)
    `);
    console.log('✓ Data migrated');

    // Step 2: Make new columns NOT NULL
    console.log('\nStep 2: Making new columns NOT NULL...');
    await dataSource.query('ALTER TABLE services ALTER COLUMN "defaultDuration" SET NOT NULL');
    await dataSource.query('ALTER TABLE services ALTER COLUMN "defaultPrice" SET NOT NULL');
    await dataSource.query('ALTER TABLE services ALTER COLUMN "bufferTimeBefore" SET NOT NULL');
    await dataSource.query('ALTER TABLE services ALTER COLUMN "bufferTimeAfter" SET NOT NULL');
    console.log('✓ Constraints added');

    // Step 3: Drop old columns
    console.log('\nStep 3: Dropping old columns...');
    await dataSource.query('ALTER TABLE services DROP COLUMN IF EXISTS duration');
    await dataSource.query('ALTER TABLE services DROP COLUMN IF EXISTS "bufferTime"');
    console.log('✓ Old columns removed');

    console.log('\n✅ Migration completed successfully!');
    console.log('The services table has been fully updated to the new structure.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

completeMigration();