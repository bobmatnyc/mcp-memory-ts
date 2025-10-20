#!/usr/bin/env tsx
/**
 * Fix NULL ID Issue in Memories Table - Version 2
 *
 * Improved version that uses ROWID for precise record targeting
 * to avoid UNIQUE constraint violations.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { initDatabaseFromEnv } from '../src/database/index.js';

const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
}

const isDryRun = process.argv.includes('--dry-run');

interface NullRecord {
  rowid: number;
  title: string;
  user_id: string | null;
}

class NullIdFixerV2 {
  private existingIds = new Set<string>();

  /**
   * Generate a unique UUID that doesn't conflict with existing IDs
   */
  private generateUniqueId(): string {
    let newId: string;
    do {
      newId = randomUUID();
    } while (this.existingIds.has(newId));

    this.existingIds.add(newId);
    return newId;
  }

  /**
   * Load all existing IDs to avoid duplicates
   */
  private async loadExistingIds(db: any): Promise<void> {
    console.log('📋 Loading existing IDs to prevent duplicates...');

    const result = await db.execute(`
      SELECT id FROM memories WHERE id IS NOT NULL
    `);

    result.rows.forEach((row: any) => {
      if (row.id) {
        this.existingIds.add(String(row.id));
      }
    });

    console.log(`✅ Loaded ${this.existingIds.size} existing IDs\n`);
  }

  /**
   * Count records with NULL IDs
   */
  private async countNullIds(db: any): Promise<number> {
    const result = await db.execute(`
      SELECT COUNT(*) as count FROM memories WHERE id IS NULL
    `);

    return Number(result.rows[0]?.count || 0);
  }

  /**
   * Main execution method
   */
  async execute(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 MCP Memory - NULL ID Fix Script V2');
    console.log('═══════════════════════════════════════════════════════');

    if (isDryRun) {
      console.log('🔔 DRY RUN MODE - No changes will be made');
    }

    console.log('\n');

    const db = initDatabaseFromEnv();
    await db.connect();

    try {
      // Step 1: Check initial state
      console.log('🔍 Checking for NULL IDs...');
      const initialNullCount = await this.countNullIds(db);

      if (initialNullCount === 0) {
        console.log('✅ No NULL IDs found! Database is clean.\n');
        await db.disconnect();
        return;
      }

      console.log(`Found ${initialNullCount} memories with NULL IDs\n`);

      // Step 2: Load existing IDs
      await this.loadExistingIds(db);

      // Step 3: Get all NULL records using ROWID
      console.log('🔍 Fetching NULL records using ROWID...');
      const nullRecords = await db.execute(`
        SELECT rowid, title, user_id
        FROM memories
        WHERE id IS NULL
        ORDER BY rowid
      `);

      const records = nullRecords.rows as NullRecord[];
      console.log(`Found ${records.length} records to fix\n`);

      if (!isDryRun) {
        console.log('📦 Backup Recommendation:');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        console.log(`   Run: turso db shell <database-name> ".backup backup-${timestamp}.db"`);
        console.log(`   Timestamp: ${timestamp}\n`);
      }

      // Step 4: Process each record using ROWID
      console.log(`🔧 ${isDryRun ? '[DRY RUN] ' : ''}Fixing NULL IDs using ROWID targeting...`);

      let succeeded = 0;
      let failed = 0;

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const newId = this.generateUniqueId();

        if (isDryRun) {
          if (i < 5) {
            // Show first 5 examples
            console.log(
              `   [${i + 1}/${records.length}] ROWID ${record.rowid} → ID: ${newId} ("${record.title.substring(0, 40)}...")`
            );
          } else if (i === 5) {
            console.log(`   ... and ${records.length - 5} more records`);
          }
          succeeded++;
        } else {
          try {
            // Use ROWID for precise targeting - this is guaranteed unique
            await db.execute(
              `UPDATE memories SET id = ? WHERE rowid = ? AND id IS NULL`,
              [newId, record.rowid]
            );

            if ((i + 1) % 5 === 0 || i === records.length - 1) {
              console.log(`   Progress: ${i + 1}/${records.length} records updated`);
            }

            succeeded++;
          } catch (error: any) {
            console.error(`   ❌ Failed to update ROWID ${record.rowid}: ${error.message}`);
            failed++;
          }
        }
      }

      // Step 5: Verify the fix
      console.log('\n🔍 Verifying fix...');
      const finalNullCount = await this.countNullIds(db);

      // Step 6: Report results
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📊 Fix Summary');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`Total NULL IDs found:           ${initialNullCount}`);
      console.log(`Successfully ${isDryRun ? 'would be ' : ''}updated:  ${succeeded}`);
      console.log(`Failed:                         ${failed}`);
      console.log(`Remaining NULLs:                ${finalNullCount}`);
      console.log('═══════════════════════════════════════════════════════\n');

      if (finalNullCount === 0 && !isDryRun) {
        console.log('✅ Fix complete! All NULL IDs have been resolved.\n');
      } else if (isDryRun) {
        console.log('ℹ️  This was a dry run. Run without --dry-run to apply changes.\n');
      } else if (finalNullCount > 0) {
        console.log(
          `⚠️  Warning: ${finalNullCount} NULL IDs still remain. Please investigate.\n`
        );
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
  const fixer = new NullIdFixerV2();
  await fixer.execute();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
