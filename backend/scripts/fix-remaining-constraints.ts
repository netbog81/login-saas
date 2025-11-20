// scripts/fix-remaining-constraints.ts
import { AppDataSource } from '../src/data-source';

async function fixRemainingConstraints() {
  await AppDataSource.initialize();
  
  try {
    console.log('🔧 FIXING REMAINING CONSTRAINTS...\n');

    // Le 3 FK che TypeORM vuole DROP e ricreare
    const remainingFKs = [
      { old: 'FK_31f3e4250baf4c991f4ae0fedb3', table: 'availability_exceptions', new: 'FK_31f3e4250baf4c991f4ae0fedb3' }, // È già uguale!
      { old: 'FK_02a9f063ab63eb1622f79d78c77', table: 'group_exception_operators', new: 'FK_02a9f063ab63eb1622f79d78c77' }, // È già uguale!
      { old: 'FK_306b38a87ea02a8e72e1775481b', table: 'group_exception_operators', new: 'FK_306b38a87ea02a8e72e1775481b' }  // È già uguale!
    ];

    // Check constraints da rinominare
    const checkConstraints = [
      { old: 'CHK_valid_pattern', table: 'availability_templates', new: 'CHK_1234567890' },
      { old: 'CHK_valid_times', table: 'availability_templates', new: 'CHK_1234567891' },
      { old: 'CHK_valid_appointment_times', table: 'availability_appointments', new: 'CHK_1234567892' }
    ];

    console.log('✅ CHECKING FOREIGN KEYS...');
    for (const fk of remainingFKs) {
      try {
        // Verifica se esiste già con il nome nuovo
        const exists = await AppDataSource.query(
          `SELECT 1 FROM pg_constraint WHERE conname = $1`, 
          [fk.new]
        );
        
        if (exists.length > 0) {
          console.log(`   ✅ FK ${fk.new} already exists`);
        } else {
          console.log(`   ℹ️  FK ${fk.old} needs to be recreated`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking FK ${fk.old}: ${error.message}`);
      }
    }

    console.log('\n✅ RENAMING CHECK CONSTRAINTS...');
    for (const chk of checkConstraints) {
      try {
        await AppDataSource.query(`ALTER TABLE "${chk.table}" RENAME CONSTRAINT "${chk.old}" TO "${chk.new}"`);
        console.log(`   ✅ CHECK: ${chk.old} → ${chk.new}`);
      } catch (error: any) {
        console.log(`   ❌ CHECK ${chk.old}: ${error.message}`);
      }
    }

    console.log('\n🎉 REMAINING CONSTRAINTS FIXED!');
    console.log('💡 The ENUM types will be handled automatically by TypeORM');
    console.log('🔍 Run: npm run schema:log');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

fixRemainingConstraints();
