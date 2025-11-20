// scripts/simple-constraint-rename.ts
import { AppDataSource } from '../src/data-source';

async function simpleConstraintRename() {
  await AppDataSource.initialize();
  
  try {
    console.log('🔧 SIMPLE CONSTRAINT RENAME STARTED...\n');
    console.log('📝 This will rename constraints to match TypeORM expectations\n');

    const renames = [
      // FOREIGN KEYS
      { type: 'FK', old: 'FK_availability_templates_operator', new: 'FK_6a837a58662795648489a4b00b2' },
      { type: 'FK', old: 'FK_availability_exceptions_operator', new: 'FK_25a5bf7a2c537001025441543e8' },
      { type: 'FK', old: 'FK_availability_exceptions_group', new: 'FK_31f3e4250baf4c991f4ae0fedb3' },
      { type: 'FK', old: 'FK_operator_services_operator', new: 'FK_ff81248e9409885facfa2469ac0' },
      { type: 'FK', old: 'FK_operator_services_service', new: 'FK_43c4c1380201e0f7e44add24dfa' },
      { type: 'FK', old: 'FK_availability_appointments_operator', new: 'FK_18f0c83cad918228c7e5c8744bb' },
      { type: 'FK', old: 'FK_availability_appointments_service', new: 'FK_b2253cfad22d2828de4173013f5' },
      { type: 'FK', old: 'FK_template_assignments_operator', new: 'FK_2bd9bce5e3f9dc9b8240e300de8' },
      { type: 'FK', old: 'FK_template_assignments_pattern', new: 'FK_a6c7d8c752f01bef612089e6c7a' },
      { type: 'FK', old: 'FK_availability_cache_operator', new: 'FK_79e846140b3e6ece0a4d12fdd8c' },
      { type: 'FK', old: 'FK_group_exception_operators_group', new: 'FK_02a9f063ab63eb1622f79d78c77' },
      { type: 'FK', old: 'FK_group_exception_operators_operator', new: 'FK_306b38a87ea02a8e72e1775481b' },
      
      // INDEXES
      { type: 'IDX', old: 'IDX_availability_templates_operator_current', new: 'IDX_9bd0d69454e5241114fc838892' },
      { type: 'IDX', old: 'IDX_availability_templates_date_range', new: 'IDX_9eec370230efdd95bef9b08f98' },
      { type: 'IDX', old: 'IDX_availability_exceptions_operator_date', new: 'IDX_9fc193c0c9a0141a46175ab91c' },
      { type: 'IDX', old: 'IDX_availability_appointments_operator_date', new: 'IDX_07d6c761ba9b5a3da515a1c909' },
      { type: 'IDX', old: 'IDX_availability_appointments_date_time', new: 'IDX_d56a473d5a543083b104f41033' },
      { type: 'IDX', old: 'IDX_availability_appointments_status', new: 'IDX_2ed2edc46c1de2ac23457389c1' },
      { type: 'IDX', old: 'IDX_availability_cache_date_range', new: 'IDX_d725703578e0626694bdc6b67e' },
      { type: 'IDX', old: 'IDX_availability_cache_lookup', new: 'IDX_27e9b90da3514d3fffad4f3a6f' },
      { type: 'IDX', old: 'IDX_template_assignments_operator_current', new: 'IDX_ae93f27aede9f9eb5f8734ab0d' },
      { type: 'IDX', old: 'IDX_template_assignments_validity', new: 'IDX_71860755fad0e250833179807c' },
      { type: 'IDX', old: 'IDX_template_patterns_name', new: 'IDX_2d195a091aaf4522a303cc7d88' },
      
      // UNIQUE CONSTRAINTS
      { type: 'UQ', old: 'UQ_availability_exceptions_operator_date', new: 'UQ_9fc193c0c9a0141a46175ab91c6' },
      { type: 'UQ', old: 'UQ_availability_cache_operator_date_time', new: 'UQ_941caae8b5de3e258c8b625eb8b' }
    ];

    let successCount = 0;
    let skipCount = 0;

    for (const rename of renames) {
      try {
        if (rename.type === 'FK') {
          await AppDataSource.query(`ALTER TABLE ${rename.old.split('_')[1]} RENAME CONSTRAINT "${rename.old}" TO "${rename.new}"`);
        } else if (rename.type === 'IDX') {
          await AppDataSource.query(`ALTER INDEX "${rename.old}" RENAME TO "${rename.new}"`);
        } else if (rename.type === 'UQ') {
          await AppDataSource.query(`ALTER TABLE ${rename.old.split('_')[1]} RENAME CONSTRAINT "${rename.old}" TO "${rename.new}"`);
        }
        console.log(`✅ ${rename.type}: ${rename.old} → ${rename.new}`);
        successCount++;
      } catch (error: any) {
        if (error.message.includes('does not exist') || error.message.includes('already exists')) {
          console.log(`⚠️  ${rename.type}: ${rename.old} - ${error.message.split('\n')[0]}`);
          skipCount++;
        } else {
          console.log(`❌ ${rename.type}: ${rename.old} - ${error.message}`);
        }
      }
    }

    console.log(`\n🎉 RENAME COMPLETED!`);
    console.log(`   ✅ Renamed: ${successCount} constraints/indexes`);
    console.log(`   ⏭️  Skipped: ${skipCount} constraints/indexes`);
    console.log(`\n🔍 Run 'npm run schema:log' to verify`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

simpleConstraintRename();
