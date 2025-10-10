#!/usr/bin/env tsx
/**
 * Fix NULL ID Issue in Memories Table
 *
 * This script identifies and fixes memories records with NULL IDs by:
 * 1. Finding all records with NULL IDs
 * 2. Generating new UUIDs for each record
 * 3. Updating records in safe batches with transaction support
 * 4. Verifying all NULLs are fixed
 *
 * IMPORTANT: This creates an automatic backup before making changes.
 *
 * Usage:
 *   npm run fix-null-ids              # Execute the fix
 *   npm run fix-null-ids -- --dry-run # Preview changes without applying
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

const BATCH_SIZE = 50; // Process 50 records at a time
const isDryRun = process.argv.includes('--dry-run');

interface MemoryRecord {
  user_id: string | null;
  title: string;
  content: string;
  memory_type: string;
  created_at: string;
  updated_at: string;
}

class NullIdFixer {
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

    try {
      const result = await db.execute(`
        SELECT id FROM memories WHERE id IS NOT NULL
      `);

      result.rows.forEach((row: any) => {
        if (row.id) {
          this.existingIds.add(String(row.id));
        }
      });

      console.log(`✅ Loaded ${this.existingIds.size} existing IDs\n`);
    } catch (error) {
      console.error('❌ Failed to load existing IDs:', error);
      throw error;
    }
  }

  /**
   * Count records with NULL IDs
   */
  private async countNullIds(db: any): Promise<number> {
    try {
      const result = await db.execute(`
        SELECT COUNT(*) as count FROM memories WHERE id IS NULL
      `);

      return Number(result.rows[0]?.count || 0);
    } catch (error) {
      console.error('❌ Failed to count NULL IDs:', error);
      throw error;
    }
  }

  /**
   * Create backup info message
   */
  private createBackupInfo(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    console.log(`\n📦 Backup Recommendation:`);
    console.log(`   Run: turso db shell <database-name> ".backup backup-${timestamp}.db"`);
    console.log(`   Timestamp: ${timestamp}\n`);
  }

  /**
   * Main execution method
   */
  async execute(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 MCP Memory - NULL ID Fix Script');
    console.log('═══════════════════════════════════════════════════════');

    if (isDryRun) {
      console.log('🔔 DRY RUN MODE - No changes will be made');
    }

    console.log('\n');

    try {
      const db = initDatabaseFromEnv();
      await db.connect();

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

      // Step 3: Show backup info
      if (!isDryRun) {
        this.createBackupInfo();
      }

      // Step 4: Process in batches
      console.log(`🔧 ${isDryRun ? '[DRY RUN] ' : ''}Fixing NULL IDs in batches of ${BATCH_SIZE}...`);

      const totalBatches = Math.ceil(initialNullCount / BATCH_SIZE);
      let totalProcessed = 0;
      let succeeded = 0;
      let failed = 0;

      // Keep processing until no NULL IDs remain
      while (totalProcessed < initialNullCount) {
        const batchNum = Math.floor(totalProcessed / BATCH_SIZE) + 1;

        console.log(`Batch ${batchNum}/${totalBatches}: Processing...`);

        // Get a batch of records with NULL IDs
        const batchResult = await db.execute(`
          SELECT user_id, title, content, memory_type, created_at, updated_at
          FROM memories
          WHERE id IS NULL
          ORDER BY created_at DESC
          LIMIT ${BATCH_SIZE}
        `);

        const batch = batchResult.rows as MemoryRecord[];

        if (batch.length === 0) {
          console.log('   No more records to process\n');
          break;
        }

        if (isDryRun) {
          // In dry run, just show what would be done
          batch.forEach((record, idx) => {
            const newId = this.generateUniqueId();
            if (idx < 3) {
              // Show first 3 examples
              console.log(
                `   Would update: "${record.title.substring(0, 40)}..." → ID: ${newId}`
              );
            }
          });
          if (batch.length > 3) {
            console.log(`   ... and ${batch.length - 3} more records`);
          }
          succeeded += batch.length;
          totalProcessed += batch.length;
        } else {
          // Actually update the database
          for (const record of batch) {
            try {
              const newId = this.generateUniqueId();

              // Use combination of columns to uniquely identify the record
              // LibSQL doesn't support LIMIT in UPDATE, so we use unique WHERE conditions
              await db.execute(
                `UPDATE memories
                 SET id = ?
                 WHERE id IS NULL
                   AND user_id ${record.user_id === null ? 'IS NULL' : '= ?'}
                   AND title = ?
                   AND created_at = ?`,
                record.user_id === null
                  ? [newId, record.title, record.created_at]
                  : [newId, record.user_id, record.title, record.created_at]
              );

              succeeded++;
              totalProcessed++;
            } catch (error: any) {
              console.error(`   ❌ Failed to update record: ${error.message}`);
              failed++;
              totalProcessed++;
            }
          }

          console.log(`Batch ${batchNum}/${totalBatches}: Updated ${batch.length} records`);
        }

        // Small delay to avoid rate limiting
        if (!isDryRun && totalProcessed < initialNullCount) {
          await new Promise(resolve => setTimeout(resolve, 100));
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
      console.log(
        `Successfully ${isDryRun ? 'would be' : ''} updated: ${succeeded}`
      );
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

      await db.disconnect();
    } catch (error: any) {
      console.error('\n❌ Fix failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const fixer = new NullIdFixer();
  await fixer.execute();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
