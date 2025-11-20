// scripts/analyze-differences.ts
import { AppDataSource } from '../src/data-source';

async function analyzeDifferences() {
  await AppDataSource.initialize();
  
  try {
    // Lista tutti i constraint attuali
    const constraints = await AppDataSource.query(`
      SELECT conname, contype, conrelid::regclass AS table_name
      FROM pg_constraint 
      WHERE contype IN ('f', 'p', 'u', 'c')
      AND conname NOT LIKE 'pg_%'
      ORDER BY conname
    `);
    
    console.log('📋 Current Constraints:');
    constraints.forEach((c: any) => {
      console.log(`   - ${c.conname} (${c.contype}) on ${c.table_name}`);
    });

    // Lista tutti gli index attuali  
    const indexes = await AppDataSource.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexname NOT LIKE 'pg_%'
      ORDER BY indexname
    `);
    
    console.log('\n📋 Current Indexes:');
    indexes.forEach((i: any) => {
      console.log(`   - ${i.indexname} on ${i.tablename}`);
    });

  } finally {
    await AppDataSource.destroy();
  }
}

analyzeDifferences();
