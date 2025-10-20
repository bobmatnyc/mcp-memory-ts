#!/usr/bin/env tsx
/**
 * Fix NULL user_id Security Issue in Entities Table
 *
 * SECURITY CRITICAL: Multi-tenant isolation breach
 * Assigns all NULL user_id entities to bob@matsuoka.com
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { initDatabaseFromEnv } from '../src/database/index.js';

const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
}

const isDryRun = process.argv.includes('--dry-run');
const TARGET_USER_ID = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75'; // bob@matsuoka.com

class NullUserIdFixer {
  /**
   * Count entities with NULL user_id
   */
  private async countNullUserIds(db: any): Promise<number> {
    const result = await db.execute(`
      SELECT COUNT(*) as count FROM entities WHERE user_id IS NULL
    `);
    return Number(result.rows[0]?.count || 0);
  }

  /**
   * Get total count for a specific user
   */
  private async getUserEntityCount(db: any, userId: string): Promise<number> {
    const result = await db.execute(
      `SELECT COUNT(*) as count FROM entities WHERE user_id = ?`,
      [userId]
    );
    return Number(result.rows[0]?.count || 0);
  }

  /**
   * Get total entity count
   */
  private async getTotalEntityCount(db: any): Promise<number> {
    const result = await db.execute(`SELECT COUNT(*) as count FROM entities`);
    return Number(result.rows[0]?.count || 0);
  }

  /**
   * Create backup table
   */
  private async createBackup(db: any): Promise<void> {
    const timestamp = '20251014';
    const backupName = `entities_backup_${timestamp}`;

    console.log(`📦 Creating backup table: ${backupName}`);

    await db.execute(`CREATE TABLE ${backupName} AS SELECT * FROM entities`);

    const backupCount = await db.execute(
      `SELECT COUNT(*) as count FROM ${backupName}`
    );

    console.log(`✅ Backup created with ${backupCount.rows[0].count} records\n`);
  }

  /**
   * Main execution method
   */
  async execute(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔐 SECURITY FIX - NULL user_id in Entities Table');
    console.log('═══════════════════════════════════════════════════════');

    if (isDryRun) {
      console.log('🔔 DRY RUN MODE - No changes will be made');
    }

    console.log(`🎯 Target User ID: ${TARGET_USER_ID}`);
    console.log('   (bob@matsuoka.com)\n');

    const db = initDatabaseFromEnv();
    await db.connect();

    try {
      // Step 1: Get initial counts
      console.log('🔍 Analyzing current state...');
      const totalEntities = await this.getTotalEntityCount(db);
      const nullUserIdCount = await this.countNullUserIds(db);
      const bobEntityCount = await this.getUserEntityCount(db, TARGET_USER_ID);

      console.log(`   Total entities: ${totalEntities}`);
      console.log(`   Entities with NULL user_id: ${nullUserIdCount} (${((nullUserIdCount / totalEntities) * 100).toFixed(1)}%)`);
      console.log(`   Bob's current entities: ${bobEntityCount}\n`);

      if (nullUserIdCount === 0) {
        console.log('✅ No NULL user_ids found! Database is secure.\n');
        await db.disconnect();
        return;
      }

      // Step 2: Create backup (only in non-dry-run mode)
      if (!isDryRun) {
        await this.createBackup(db);
      } else {
        console.log('📦 [DRY RUN] Would create backup: entities_backup_20251014\n');
      }

      // Step 3: Show sample of affected entities
      console.log('📋 Sample of affected entities (first 5):');
      const sampleResult = await db.execute(`
        SELECT id, name, entity_type, created_at
        FROM entities
        WHERE user_id IS NULL
        LIMIT 5
      `);

      sampleResult.rows.forEach((row: any, i: number) => {
        console.log(`   ${i + 1}. ${row.name} (${row.entity_type}) - ID: ${row.id}`);
      });
      console.log('');

      // Step 4: Execute the fix
      if (!isDryRun) {
        console.log('🔧 Updating NULL user_ids...');
        const updateResult = await db.execute(
          `UPDATE entities SET user_id = ? WHERE user_id IS NULL`,
          [TARGET_USER_ID]
        );
        console.log(`✅ Updated ${updateResult.rowsAffected || nullUserIdCount} records\n`);
      } else {
        console.log(`🔧 [DRY RUN] Would update ${nullUserIdCount} records\n`);
      }

      // Step 5: Verify the fix
      console.log('🔍 Verifying fix...');
      const finalNullCount = await this.countNullUserIds(db);
      const finalBobCount = await this.getUserEntityCount(db, TARGET_USER_ID);

      // Step 6: Report results
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📊 Security Fix Summary');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`Before:`);
      console.log(`  NULL user_ids:          ${nullUserIdCount}`);
      console.log(`  Bob's entities:         ${bobEntityCount}`);
      console.log(``);
      console.log(`After:`);
      console.log(`  NULL user_ids:          ${finalNullCount}`);
      console.log(`  Bob's entities:         ${finalBobCount}`);
      console.log(`  Entities ${isDryRun ? 'to be ' : ''}assigned: ${isDryRun ? nullUserIdCount : finalBobCount - bobEntityCount}`);
      console.log('═══════════════════════════════════════════════════════\n');

      if (finalNullCount === 0 && !isDryRun) {
        console.log('✅ Security fix complete! All entities now have proper user_id.\n');
        console.log('🔐 Multi-tenant isolation restored.\n');
      } else if (isDryRun) {
        console.log('ℹ️  This was a dry run. Run without --dry-run to apply changes.\n');
      } else if (finalNullCount > 0) {
        console.log(`⚠️  Warning: ${finalNullCount} NULL user_ids still remain. Please investigate.\n`);
      }

    } catch (error: any) {
      console.error('\n❌ Fix failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await db.disconnect();
    }
  }
}

// Main execution
async function main() {
  const fixer = new NullUserIdFixer();
  await fixer.execute();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
