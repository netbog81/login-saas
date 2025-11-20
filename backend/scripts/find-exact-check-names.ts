// scripts/find-exact-check-names.ts
import { AppDataSource } from '../src/data-source';

async function findExactCheckNames() {
  await AppDataSource.initialize();
  
  try {
    console.log('🔍 FINDING EXACT CHECK CONSTRAINT NAMES...\n');

    // I check constraint attuali
    const currentChecks = await AppDataSource.query(`
      SELECT conname, conrelid::regclass as table_name, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE contype = 'c' 
      AND conname LIKE 'CHK_%'
      ORDER BY table_name, conname
    `);

    console.log('📋 CURRENT CHECK CONSTRAINTS:');
    currentChecks.forEach((chk: any) => {
      console.log(`   ${chk.conname} on ${chk.table_name}`);
      console.log(`   Definition: ${chk.definition}`);
      console.log('   ---');
    });

    // Ora generiamo una migration temporanea per vedere cosa vuole TypeORM
    console.log('\n💡 Solution: Add exact names to your entities:');
    console.log('   @Check("CHK_exact_name_that_typeorm_wants", \'your_condition\')');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

findExactCheckNames();
