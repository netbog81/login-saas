// scripts/fix-foreign-keys.ts
import { AppDataSource } from '../src/data-source';

async function fixForeignKeys() {
  await AppDataSource.initialize();
  
  try {
    console.log('🔧 FIXING FOREIGN KEY NAMES...\n');

    // Mappatura corretta: { oldName, table }
    const fkMappings = [
      { old: 'FK_availability_templates_operator', table: 'availability_templates', new: 'FK_6a837a58662795648489a4b00b2' },
      { old: 'FK_availability_exceptions_operator', table: 'availability_exceptions', new: 'FK_25a5bf7a2c537001025441543e8' },
      { old: 'FK_availability_exceptions_group', table: 'availability_exceptions', new: 'FK_31f3e4250baf4c991f4ae0fedb3' },
      { old: 'FK_operator_services_operator', table: 'operator_services', new: 'FK_ff81248e9409885facfa2469ac0' },
      { old: 'FK_operator_services_service', table: 'operator_services', new: 'FK_43c4c1380201e0f7e44add24dfa' },
      { old: 'FK_availability_appointments_operator', table: 'availability_appointments', new: 'FK_18f0c83cad918228c7e5c8744bb' },
      { old: 'FK_availability_appointments_service', table: 'availability_appointments', new: 'FK_b2253cfad22d2828de4173013f5' },
      { old: 'FK_template_assignments_operator', table: 'template_assignments', new: 'FK_2bd9bce5e3f9dc9b8240e300de8' },
      { old: 'FK_template_assignments_pattern', table: 'template_assignments', new: 'FK_a6c7d8c752f01bef612089e6c7a' },
      { old: 'FK_availability_cache_operator', table: 'availability_cache', new: 'FK_79e846140b3e6ece0a4d12fdd8c' },
      { old: 'FK_group_exception_operators_group', table: 'group_exception_operators', new: 'FK_02a9f063ab63eb1622f79d78c77' },
      { old: 'FK_group_exception_operators_operator', table: 'group_exception_operators', new: 'FK_306b38a87ea02a8e72e1775481b' }
    ];

    const uniqueMappings = [
      { old: 'UQ_availability_exceptions_operator_date', table: 'availability_exceptions', new: 'UQ_9fc193c0c9a0141a46175ab91c6' },
      { old: 'UQ_availability_cache_operator_date_time', table: 'availability_cache', new: 'UQ_941caae8b5de3e258c8b625eb8b' }
    ];

    let successCount = 0;
    let skipCount = 0;

    console.log('🔗 PROCESSING FOREIGN KEYS...');
    for (const mapping of fkMappings) {
      try {
        await AppDataSource.query(`ALTER TABLE "${mapping.table}" RENAME CONSTRAINT "${mapping.old}" TO "${mapping.new}"`);
        console.log(`✅ FK: ${mapping.old} → ${mapping.new}`);
        successCount++;
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log(`⚠️  FK: ${mapping.old} - not found`);
          skipCount++;
        } else {
          console.log(`❌ FK: ${mapping.old} - ${error.message}`);
        }
      }
    }

    console.log('\n🔐 PROCESSING UNIQUE CONSTRAINTS...');
    for (const mapping of uniqueMappings) {
      try {
        await AppDataSource.query(`ALTER TABLE "${mapping.table}" RENAME CONSTRAINT "${mapping.old}" TO "${mapping.new}"`);
        console.log(`✅ UQ: ${mapping.old} → ${mapping.new}`);
        successCount++;
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log(`⚠️  UQ: ${mapping.old} - not found`);
          skipCount++;
        } else {
          console.log(`❌ UQ: ${mapping.old} - ${error.message}`);
        }
      }
    }

    console.log(`\n🎉 FOREIGN KEYS FIXED!`);
    console.log(`   ✅ Renamed: ${successCount} constraints`);
    console.log(`   ⏭️  Skipped: ${skipCount} constraints`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

fixForeignKeys();
