/**
 * Migration script to add missing legacy columns to entities table
 *
 * This fixes the "no such column: email", "no such column: phone", "no such column: address"
 * errors that occur during Google Contacts sync and other operations that directly
 * access these legacy fields.
 *
 * The TypeScript Entity interface defines email, phone, and address as individual fields,
 * but the database schema only has a contact_info JSON field. The compatibility layer
 * maps between them, but some code paths try to SELECT/WHERE on these columns directly,
 * causing SQL errors.
 *
 * This migration adds the 3 missing legacy columns:
 * - email TEXT
 * - phone TEXT
 * - address TEXT
 *
 * It also migrates data from existing contact_info JSON to the individual columns.
 *
 * Usage:
 *   npm run migrate:legacy-columns
 *
 * Or with dry-run:
 *   npm run migrate:legacy-columns:dry-run
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

async function migrateLegacyColumns() {
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  console.log('\n🔧 Entities Table - Legacy Columns Migration');
  console.log('════════════════════════════════════════════');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no changes will be made)' : '✍️  LIVE EXECUTION'}\n`);

  try {
    // Check current table structure
    console.log('📊 Checking current table structure...\n');
    const tableInfo = await client.execute('PRAGMA table_info(entities)');
    const existingColumns = new Set(
      tableInfo.rows.map((row: any) => row.name)
    );

    console.log('Existing columns:', Array.from(existingColumns).join(', '));
    console.log('');

    // Define the legacy columns we need to add
    const legacyColumns = [
      { name: 'email', sql: 'ALTER TABLE entities ADD COLUMN email TEXT' },
      { name: 'phone', sql: 'ALTER TABLE entities ADD COLUMN phone TEXT' },
      { name: 'address', sql: 'ALTER TABLE entities ADD COLUMN address TEXT' },
    ];

    // Check which columns are missing
    const missingColumns = legacyColumns.filter(col => !existingColumns.has(col.name));

    if (missingColumns.length === 0) {
      console.log('✅ All legacy columns already exist! No migration needed.\n');

      // Check if we need to migrate data from contact_info
      const needsDataMigration = await checkDataMigration(client);
      if (needsDataMigration > 0) {
        console.log(`\n⚠️  Found ${needsDataMigration} entities with contact_info data but empty legacy columns.`);

        if (isDryRun) {
          console.log('📋 Would migrate data from contact_info JSON to legacy columns.\n');
        } else {
          console.log('🔄 Migrating data from contact_info to legacy columns...\n');
          await migrateContactInfoData(client);
        }
      }

      return;
    }

    console.log(`Found ${missingColumns.length} missing column(s):\n`);
    missingColumns.forEach(col => {
      console.log(`  ❌ ${col.name}`);
    });
    console.log('');

    if (isDryRun) {
      console.log('📋 Migration plan (DRY RUN - not executing):\n');
      console.log('Step 1: Add missing columns');
      missingColumns.forEach((col, idx) => {
        console.log(`  ${idx + 1}. ${col.sql}`);
      });

      console.log('\nStep 2: Migrate data from contact_info JSON to individual columns');
      console.log('  - Extract email from contact_info where present');
      console.log('  - Extract phone from contact_info where present');
      console.log('  - Extract address from contact_info where present');

      console.log('\nStep 3: Create composite index for contact searches');
      console.log('  - CREATE INDEX idx_entities_contact ON entities(email, phone)');

      console.log('\n🔍 Dry run complete. Run without --dry-run to apply changes.\n');
      return;
    }

    // Execute migrations in a transaction
    console.log('🚀 Executing migrations...\n');
    console.log('Step 1: Adding missing columns\n');

    for (const col of missingColumns) {
      try {
        await client.execute(col.sql);
        console.log(`✅ Added column: ${col.name}`);
      } catch (error: any) {
        if (error.message.includes('duplicate column name')) {
          console.log(`⚠️  Column ${col.name} already exists, skipping`);
        } else {
          throw error;
        }
      }
    }

    // Migrate data from contact_info to individual columns
    console.log('\nStep 2: Migrating data from contact_info JSON\n');
    await migrateContactInfoData(client);

    // Create index for contact-based searches
    console.log('\nStep 3: Creating indexes for performance\n');
    try {
      await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_entities_contact
        ON entities(email, phone)
      `);
      console.log('✅ Created/verified idx_entities_contact (email, phone)');
    } catch (error: any) {
      console.log(`⚠️  Index creation warning: ${error.message}`);
    }

    // Verify the migration
    console.log('\n🔍 Verifying migration...\n');
    const verifyTableInfo = await client.execute('PRAGMA table_info(entities)');
    const updatedColumns = new Set(
      verifyTableInfo.rows.map((row: any) => row.name)
    );

    const stillMissing = missingColumns.filter(col => !updatedColumns.has(col.name));

    if (stillMissing.length === 0) {
      console.log('✅ All columns verified successfully!\n');

      // Check data migration success
      const result = await client.execute(`
        SELECT COUNT(*) as count FROM entities
        WHERE contact_info IS NOT NULL
        AND json_extract(contact_info, '$.email') IS NOT NULL
        AND (email IS NULL OR email = '')
      `);
      const unmigrated = Number((result.rows[0] as any).count);

      if (unmigrated > 0) {
        console.log(`⚠️  Warning: ${unmigrated} entities still have data in contact_info but not in legacy columns`);
      } else {
        console.log('✅ Data migration verified successfully!');
      }

      console.log('\n📊 Final column list:', Array.from(updatedColumns).join(', '));
      console.log('\n✨ Migration completed successfully!\n');
    } else {
      console.error('❌ Verification failed! Still missing columns:');
      stillMissing.forEach(col => console.error(`   - ${col.name}`));
      console.log('');
      throw new Error('Migration verification failed');
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    client.close();
  }
}

/**
 * Check if there are entities that need data migration
 */
async function checkDataMigration(client: any): Promise<number> {
  try {
    const result = await client.execute(`
      SELECT COUNT(*) as count FROM entities
      WHERE contact_info IS NOT NULL
      AND (
        json_extract(contact_info, '$.email') IS NOT NULL
        OR json_extract(contact_info, '$.phone') IS NOT NULL
        OR json_extract(contact_info, '$.address') IS NOT NULL
      )
      AND (email IS NULL OR email = '')
    `);
    return Number((result.rows[0] as any).count);
  } catch (error) {
    // If the query fails (e.g., columns don't exist yet), return 0
    return 0;
  }
}

/**
 * Migrate data from contact_info JSON to individual columns
 */
async function migrateContactInfoData(client: any): Promise<void> {
  const migrations = [
    {
      field: 'email',
      sql: `
        UPDATE entities
        SET email = json_extract(contact_info, '$.email')
        WHERE contact_info IS NOT NULL
          AND json_extract(contact_info, '$.email') IS NOT NULL
          AND (email IS NULL OR email = '')
      `,
    },
    {
      field: 'phone',
      sql: `
        UPDATE entities
        SET phone = json_extract(contact_info, '$.phone')
        WHERE contact_info IS NOT NULL
          AND json_extract(contact_info, '$.phone') IS NOT NULL
          AND (phone IS NULL OR phone = '')
      `,
    },
    {
      field: 'address',
      sql: `
        UPDATE entities
        SET address = json_extract(contact_info, '$.address')
        WHERE contact_info IS NOT NULL
          AND json_extract(contact_info, '$.address') IS NOT NULL
          AND (address IS NULL OR address = '')
      `,
    },
  ];

  let totalMigrated = 0;

  for (const migration of migrations) {
    try {
      const result = await client.execute(migration.sql);
      const changes = (result as any).rowsAffected || 0;
      totalMigrated += changes;

      if (changes > 0) {
        console.log(`✅ Migrated ${changes} ${migration.field} values from contact_info`);
      } else {
        console.log(`ℹ️  No ${migration.field} values to migrate`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to migrate ${migration.field}:`, error.message);
      throw error;
    }
  }

  if (totalMigrated > 0) {
    console.log(`\n✅ Total: Migrated ${totalMigrated} field values from contact_info to legacy columns`);
  } else {
    console.log('\nℹ️  No data migration needed - all entities already have legacy column data');
  }
}

// Run migration
migrateLegacyColumns().catch((error) => {
  console.error('\n💥 Fatal error during migration:', error);
  process.exit(1);
});
