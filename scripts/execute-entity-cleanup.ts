#!/usr/bin/env tsx
/**
 * Entity Database Cleanup Script
 *
 * Executes cleanup operations on entities table:
 * 1. Create backup
 * 2. Remove test entities
 * 3. Remove duplicates (keep oldest)
 * 4. Remove low-quality person entities with no contact info
 *
 * Safety: Creates automatic backup before any deletions
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TURSO_URL = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('Error: TURSO_URL and TURSO_AUTH_TOKEN must be set in .env');
  process.exit(1);
}

const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

interface CleanupStats {
  beforeCount: number;
  backupCount: number;
  testEntitiesDeleted: number;
  duplicatesDeleted: number;
  lowQualityDeleted: number;
  afterCount: number;
  reductionPercent: number;
}

async function executeCleanup(dryRun: boolean = false): Promise<CleanupStats> {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('T', '').slice(0, 14);
  const backupTableName = `entities_cleanup_backup_${timestamp}`;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`ENTITY DATABASE CLEANUP - ${dryRun ? 'DRY RUN MODE' : 'EXECUTION MODE'}`);
  console.log(`${'='.repeat(80)}\n`);

  const stats: CleanupStats = {
    beforeCount: 0,
    backupCount: 0,
    testEntitiesDeleted: 0,
    duplicatesDeleted: 0,
    lowQualityDeleted: 0,
    afterCount: 0,
    reductionPercent: 0,
  };

  // Step 1: Get initial count
  console.log('Step 1: Getting initial entity count...');
  const beforeResult = await db.execute('SELECT COUNT(*) as count FROM entities');
  stats.beforeCount = beforeResult.rows[0].count as number;
  console.log(`✓ Initial count: ${stats.beforeCount} entities\n`);

  // Step 2: Create backup
  console.log(`Step 2: Creating backup table: ${backupTableName}...`);
  if (!dryRun) {
    await db.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM entities`);
    const backupResult = await db.execute(`SELECT COUNT(*) as count FROM ${backupTableName}`);
    stats.backupCount = backupResult.rows[0].count as number;
    console.log(`✓ Backup created: ${stats.backupCount} entities backed up\n`);
  } else {
    console.log(`[DRY RUN] Would create backup table: ${backupTableName}\n`);
    stats.backupCount = stats.beforeCount;
  }

  // Step 3: Identify and delete test entities
  console.log('Step 3: Identifying test entities...');

  // Find test entities
  const testEntitiesQuery = `
    SELECT id, name, user_id, entity_type, created_at
    FROM entities
    WHERE LOWER(name) LIKE '%test%'
       OR LOWER(name) LIKE '%integration%'
       OR user_id IN (
         SELECT DISTINCT user_id
         FROM entities
         WHERE LOWER(user_id) LIKE '%test%'
       )
    ORDER BY created_at DESC
  `;

  const testEntitiesResult = await db.execute(testEntitiesQuery);
  const testEntitiesCount = testEntitiesResult.rows.length;

  console.log(`Found ${testEntitiesCount} test entities:`);
  if (testEntitiesCount > 0) {
    console.log('\nSample test entities:');
    testEntitiesResult.rows.slice(0, 10).forEach((row: any) => {
      console.log(`  - ${row.name} (${row.entity_type}) | User: ${row.user_id} | Created: ${row.created_at}`);
    });
    if (testEntitiesCount > 10) {
      console.log(`  ... and ${testEntitiesCount - 10} more`);
    }
  }

  if (!dryRun && testEntitiesCount > 0) {
    console.log(`\nDeleting ${testEntitiesCount} test entities...`);
    console.log('  Step 1: Collecting entity IDs to delete...');

    // Get list of entity IDs to delete
    const entityIds = testEntitiesResult.rows.map(row => `'${row.id}'`).join(',');

    console.log('  Step 2: Deleting relationships...');
    await db.execute(`
      DELETE FROM relationships
      WHERE from_entity_id IN (${entityIds}) OR to_entity_id IN (${entityIds})
    `);

    console.log('  Step 3: Deleting entity embeddings...');
    await db.execute(`
      DELETE FROM entity_embeddings
      WHERE entity_id IN (${entityIds})
    `);

    console.log('  Step 4: Clearing entity_id in memories...');
    await db.execute(`
      UPDATE memories
      SET entity_id = NULL
      WHERE entity_id IN (${entityIds})
    `);

    console.log('  Step 5: Deleting related interactions...');
    // Delete interactions that reference these entities
    await db.execute(`
      DELETE FROM interactions
      WHERE entity_id IN (${entityIds})
    `);

    console.log('  Step 6: Clearing ALL client_id references...');
    // Clear ALL self-referencing foreign keys (both directions)
    // First, clear references FROM entities being deleted
    await db.execute(`
      UPDATE entities
      SET client_id = NULL
      WHERE id IN (${entityIds})
    `);

    // Then, clear references TO entities being deleted
    await db.execute(`
      UPDATE entities
      SET client_id = NULL
      WHERE client_id IN (${entityIds})
    `);

    console.log('  Step 7: Deleting test entities...');
    // Now safe to delete entities
    await db.execute(`
      DELETE FROM entities
      WHERE id IN (${entityIds})
    `);

    stats.testEntitiesDeleted = testEntitiesCount;
    console.log(`✓ Deleted ${stats.testEntitiesDeleted} test entities\n`);
  } else if (dryRun) {
    console.log(`[DRY RUN] Would delete ${testEntitiesCount} test entities\n`);
  }

  // Step 4: Identify and delete duplicates
  console.log('Step 4: Identifying duplicate entities...');

  // Find duplicates (same name + user_id)
  const duplicatesQuery = `
    SELECT name, user_id, COUNT(*) as count,
           GROUP_CONCAT(id) as ids,
           MIN(created_at) as oldest_date,
           MAX(created_at) as newest_date
    FROM entities
    WHERE user_id IS NOT NULL
    GROUP BY LOWER(name), user_id
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  const duplicatesResult = await db.execute(duplicatesQuery);
  const duplicateGroups = duplicatesResult.rows;

  let totalDuplicatesToDelete = 0;
  duplicateGroups.forEach((row: any) => {
    totalDuplicatesToDelete += (row.count - 1); // Keep oldest, delete rest
  });

  console.log(`Found ${duplicateGroups.length} duplicate groups (${totalDuplicatesToDelete} entities to delete):`);
  if (duplicateGroups.length > 0) {
    console.log('\nTop duplicate groups:');
    duplicateGroups.slice(0, 10).forEach((row: any) => {
      console.log(`  - "${row.name}" x${row.count} | User: ${row.user_id} | ${row.oldest_date} → ${row.newest_date}`);
    });
    if (duplicateGroups.length > 10) {
      console.log(`  ... and ${duplicateGroups.length - 10} more groups`);
    }
  }

  if (!dryRun && totalDuplicatesToDelete > 0) {
    console.log(`\nDeleting ${totalDuplicatesToDelete} duplicate entities (keeping oldest)...`);

    console.log('  Step 1: Identifying duplicate entity IDs to delete...');
    // Get duplicate IDs (newer ones, keep oldest)
    const dupIds = await db.execute(`
      SELECT e2.id
      FROM entities e1
      INNER JOIN entities e2
        ON LOWER(e1.name) = LOWER(e2.name)
        AND e1.user_id = e2.user_id
        AND e1.user_id IS NOT NULL
        AND e1.created_at < e2.created_at
    `);

    const duplicateIds = dupIds.rows.map(row => `'${row.id}'`).join(',');

    console.log('  Step 2: Deleting relationships...');
    await db.execute(`
      DELETE FROM relationships
      WHERE from_entity_id IN (${duplicateIds}) OR to_entity_id IN (${duplicateIds})
    `);

    console.log('  Step 3: Deleting entity embeddings for duplicate entities...');
    await db.execute(`
      DELETE FROM entity_embeddings
      WHERE entity_id IN (${duplicateIds})
    `);

    console.log('  Step 4: Clearing entity_id in memories...');
    await db.execute(`
      UPDATE memories
      SET entity_id = NULL
      WHERE entity_id IN (${duplicateIds})
    `);

    console.log('  Step 5: Deleting interactions for duplicate entities...');
    await db.execute(`
      DELETE FROM interactions
      WHERE entity_id IN (${duplicateIds})
    `);

    console.log('  Step 6: Clearing ALL client_id references...');
    // Clear references FROM entities being deleted
    await db.execute(`
      UPDATE entities
      SET client_id = NULL
      WHERE id IN (${duplicateIds})
    `);
    // Clear references TO entities being deleted
    await db.execute(`
      UPDATE entities
      SET client_id = NULL
      WHERE client_id IN (${duplicateIds})
    `);

    console.log('  Step 7: Deleting duplicate entities...');
    await db.execute(`
      DELETE FROM entities
      WHERE id IN (${duplicateIds})
    `);

    stats.duplicatesDeleted = totalDuplicatesToDelete;
    console.log(`✓ Deleted ${stats.duplicatesDeleted} duplicate entities\n`);
  } else if (dryRun) {
    console.log(`[DRY RUN] Would delete ${totalDuplicatesToDelete} duplicate entities\n`);
  }

  // Step 5: Identify and delete low-quality person entities
  console.log('Step 5: Identifying low-quality person entities...');

  // Find person entities with no contact info
  const lowQualityQuery = `
    SELECT id, name, user_id, contact_info, created_at
    FROM entities
    WHERE entity_type = 'person'
      AND (
        contact_info IS NULL
        OR contact_info = '{}'
        OR contact_info = ''
        OR contact_info = 'null'
      )
    ORDER BY created_at DESC
  `;

  const lowQualityResult = await db.execute(lowQualityQuery);
  const lowQualityCount = lowQualityResult.rows.length;

  console.log(`Found ${lowQualityCount} low-quality person entities (no contact info):`);
  if (lowQualityCount > 0) {
    console.log('\nSample low-quality entities:');
    lowQualityResult.rows.slice(0, 10).forEach((row: any) => {
      console.log(`  - ${row.name} | User: ${row.user_id} | Created: ${row.created_at}`);
    });
    if (lowQualityCount > 10) {
      console.log(`  ... and ${lowQualityCount - 10} more`);
    }
  }

  if (!dryRun && lowQualityCount > 0) {
    console.log(`\nDeleting ${lowQualityCount} low-quality person entities...`);

    console.log('  Step 1: Collecting low-quality entity IDs...');
    const lowQualityIds = lowQualityResult.rows.map(row => `'${row.id}'`).join(',');

    console.log('  Step 2: Deleting relationships...');
    await db.execute(`
      DELETE FROM relationships
      WHERE from_entity_id IN (${lowQualityIds}) OR to_entity_id IN (${lowQualityIds})
    `);

    console.log('  Step 3: Deleting entity embeddings...');
    await db.execute(`
      DELETE FROM entity_embeddings
      WHERE entity_id IN (${lowQualityIds})
    `);

    console.log('  Step 4: Clearing entity_id in memories...');
    await db.execute(`
      UPDATE memories
      SET entity_id = NULL
      WHERE entity_id IN (${lowQualityIds})
    `);

    console.log('  Step 5: Deleting interactions for low-quality entities...');
    await db.execute(`
      DELETE FROM interactions
      WHERE entity_id IN (${lowQualityIds})
    `);

    console.log('  Step 6: Clearing ALL client_id references...');
    // Clear references FROM entities being deleted
    await db.execute(`
      UPDATE entities
      SET client_id = NULL
      WHERE id IN (${lowQualityIds})
    `);
    // Clear references TO entities being deleted
    await db.execute(`
      UPDATE entities
      SET client_id = NULL
      WHERE client_id IN (${lowQualityIds})
    `);

    console.log('  Step 7: Deleting low-quality entities...');
    await db.execute(`
      DELETE FROM entities
      WHERE id IN (${lowQualityIds})
    `);

    stats.lowQualityDeleted = lowQualityCount;
    console.log(`✓ Deleted ${stats.lowQualityDeleted} low-quality entities\n`);
  } else if (dryRun) {
    console.log(`[DRY RUN] Would delete ${lowQualityCount} low-quality entities\n`);
  }

  // Step 6: Get final count and calculate stats
  console.log('Step 6: Calculating final statistics...');
  if (!dryRun) {
    const afterResult = await db.execute('SELECT COUNT(*) as count FROM entities');
    stats.afterCount = afterResult.rows[0].count as number;
  } else {
    stats.afterCount = stats.beforeCount - testEntitiesCount - totalDuplicatesToDelete - lowQualityCount;
  }

  stats.reductionPercent = ((stats.beforeCount - stats.afterCount) / stats.beforeCount) * 100;

  console.log(`\n${'='.repeat(80)}`);
  console.log('CLEANUP SUMMARY');
  console.log(`${'='.repeat(80)}`);
  console.log(`Initial count:              ${stats.beforeCount.toLocaleString()} entities`);
  console.log(`Backup created:             ${stats.backupCount.toLocaleString()} entities`);
  console.log(`Test entities deleted:      ${stats.testEntitiesDeleted.toLocaleString()} entities`);
  console.log(`Duplicates deleted:         ${stats.duplicatesDeleted.toLocaleString()} entities`);
  console.log(`Low-quality deleted:        ${stats.lowQualityDeleted.toLocaleString()} entities`);
  console.log(`─`.repeat(80));
  console.log(`Total deleted:              ${(stats.testEntitiesDeleted + stats.duplicatesDeleted + stats.lowQualityDeleted).toLocaleString()} entities`);
  console.log(`Final count:                ${stats.afterCount.toLocaleString()} entities`);
  console.log(`Reduction:                  ${stats.reductionPercent.toFixed(1)}%`);
  console.log(`${'='.repeat(80)}\n`);

  if (!dryRun) {
    console.log(`✓ Cleanup completed successfully!`);
    console.log(`\nBackup table: ${backupTableName}`);
    console.log(`\nRollback instructions (if needed):`);
    console.log(`  DROP TABLE entities;`);
    console.log(`  ALTER TABLE ${backupTableName} RENAME TO entities;`);
  } else {
    console.log(`[DRY RUN] No changes were made to the database.`);
    console.log(`\nTo execute cleanup, run: npm run execute:entity-cleanup`);
  }

  return stats;
}

// Verify cleanup results
async function verifyCleanup(): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log('VERIFICATION CHECKS');
  console.log(`${'='.repeat(80)}\n`);

  // Check for remaining test entities
  const testCheck = await db.execute(`
    SELECT COUNT(*) as count
    FROM entities
    WHERE LOWER(name) LIKE '%test%'
       OR LOWER(name) LIKE '%integration%'
  `);
  const remainingTests = testCheck.rows[0].count as number;
  console.log(`Remaining test entities:    ${remainingTests}`);
  if (remainingTests === 0) {
    console.log('✓ All test entities removed\n');
  } else {
    console.log(`⚠ Warning: ${remainingTests} test entities still present\n`);
  }

  // Check for remaining duplicates
  const dupCheck = await db.execute(`
    SELECT COUNT(*) as groups
    FROM (
      SELECT name, user_id, COUNT(*) as count
      FROM entities
      WHERE user_id IS NOT NULL
      GROUP BY LOWER(name), user_id
      HAVING COUNT(*) > 1
    )
  `);
  const remainingDuplicates = dupCheck.rows[0].groups as number;
  console.log(`Remaining duplicate groups: ${remainingDuplicates}`);
  if (remainingDuplicates === 0) {
    console.log('✓ All duplicates removed\n');
  } else {
    console.log(`⚠ Warning: ${remainingDuplicates} duplicate groups still present\n`);
  }

  // Check entity type distribution
  const typeDistribution = await db.execute(`
    SELECT entity_type, COUNT(*) as count
    FROM entities
    GROUP BY entity_type
    ORDER BY count DESC
  `);
  console.log('Entity type distribution:');
  typeDistribution.rows.forEach((row: any) => {
    console.log(`  ${row.entity_type}: ${row.count}`);
  });
  console.log();

  // Check data quality metrics
  const qualityMetrics = await db.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN contact_info IS NOT NULL AND contact_info != '{}' AND contact_info != '' THEN 1 ELSE 0 END) as with_contact,
      SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END) as with_description,
      SUM(CASE WHEN metadata IS NOT NULL AND metadata != '{}' AND metadata != '' THEN 1 ELSE 0 END) as with_metadata
    FROM entities
    WHERE entity_type = 'person'
  `);

  const metrics = qualityMetrics.rows[0] as any;
  console.log('Data quality metrics (person entities):');
  console.log(`  Total:           ${metrics.total}`);
  console.log(`  With contact:    ${metrics.with_contact} (${((metrics.with_contact / metrics.total) * 100).toFixed(1)}%)`);
  console.log(`  With description: ${metrics.with_description} (${((metrics.with_description / metrics.total) * 100).toFixed(1)}%)`);
  console.log(`  With metadata:   ${metrics.with_metadata} (${((metrics.with_metadata / metrics.total) * 100).toFixed(1)}%)`);

  console.log(`\n${'='.repeat(80)}\n`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    const stats = await executeCleanup(dryRun);

    if (!dryRun) {
      await verifyCleanup();
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

main();
