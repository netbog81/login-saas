// scripts/final-cleanup.ts
import { AppDataSource } from '../src/data-source';

async function finalCleanup() {
  await AppDataSource.initialize();
  
  try {
    console.log('🧹 FINAL CLEANUP - REMOVING EVERYTHING TYPEORM WANTS TO RECREATE\n');

    // 1. RIMUOVI CHECK CONSTRAINTS (definitivamente)
    console.log('🗑️  REMOVING CHECK CONSTRAINTS...');
    const checksToRemove = [
      'CHK_1234567890', 'CHK_1234567891', 'CHK_1234567892'
    ];

    for (const checkName of checksToRemove) {
      try {
        await AppDataSource.query(`ALTER TABLE availability_templates DROP CONSTRAINT IF EXISTS "${checkName}"`);
        await AppDataSource.query(`ALTER TABLE availability_appointments DROP CONSTRAINT IF EXISTS "${checkName}"`);
        console.log(`✅ REMOVED CHECK: ${checkName}`);
      } catch (error: any) {
        console.log(`⚠️  CHECK ${checkName}: ${error.message}`);
      }
    }

    // 2. RIMUOVI FOREIGN KEYS problematica
    console.log('\n🔗 REMOVING PROBLEMATIC FOREIGN KEYS...');
    const fksToRemove = [
      { name: 'FK_31f3e4250baf4c991f4ae0fedb3', table: 'availability_exceptions' },
      { name: 'FK_02a9f063ab63eb1622f79d78c77', table: 'group_exception_operators' },
      { name: 'FK_306b38a87ea02a8e72e1775481b', table: 'group_exception_operators' }
    ];

    for (const fk of fksToRemove) {
      try {
        await AppDataSource.query(`ALTER TABLE "${fk.table}" DROP CONSTRAINT IF EXISTS "${fk.name}"`);
        console.log(`✅ REMOVED FK: ${fk.name} from ${fk.table}`);
      } catch (error: any) {
        console.log(`⚠️  FK ${fk.name}: ${error.message}`);
      }
    }

    console.log('\n🎉 CLEANUP COMPLETED!');
    console.log('💡 TypeORM will now recreate these with exact specifications');
    console.log('🔍 Run: npm run schema:log');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

finalCleanup();
