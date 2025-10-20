#!/usr/bin/env node

/**
 * Execute Data Quality Cleanup for MCP Memory Database
 *
 * This script executes the cleanup operation step-by-step:
 * 1. Create backup table
 * 2. Delete empty content records (20 expected)
 * 3. Delete duplicate records (696 expected)
 * 4. Final verification
 *
 * SAFETY: Each step includes verification and can be rolled back
 */

import { initDatabaseFromEnv } from '../src/database/connection.js';
import { config } from 'dotenv';

// Load environment variables
config();

interface CleanupStats {
  step: string;
  before: number;
  after: number;
  deleted: number;
  success: boolean;
  message: string;
}

async function executeCleanup() {
  const stats: CleanupStats[] = [];

  console.log('='.repeat(70));
  console.log('MCP MEMORY DATA QUALITY CLEANUP');
  console.log('='.repeat(70));
  console.log();

  let db;
  try {
    // Initialize database connection
    console.log('📡 Connecting to database...');
    db = initDatabaseFromEnv();
    await db.connect();
    console.log('✅ Connected successfully\n');

    // ====================================================================
    // STEP 1: CREATE BACKUP
    // ====================================================================
    console.log('STEP 1: CREATE BACKUP');
    console.log('-'.repeat(70));

    try {
      // Drop existing backup if it exists
      await db.execute('DROP TABLE IF EXISTS memories_backup_20251014');

      // Create backup
      await db.execute('CREATE TABLE memories_backup_20251014 AS SELECT * FROM memories');

      // Verify backup
      const backupResult = await db.execute('SELECT COUNT(*) as count FROM memories_backup_20251014');
      const backupCount = backupResult.rows[0]?.count || 0;

      const originalResult = await db.execute('SELECT COUNT(*) as count FROM memories');
      const originalCount = originalResult.rows[0]?.count || 0;

      console.log(`✅ Backup created: memories_backup_20251014`);
      console.log(`   Original table: ${originalCount} records`);
      console.log(`   Backup table: ${backupCount} records`);

      if (backupCount !== originalCount) {
        throw new Error('Backup count mismatch! Aborting cleanup.');
      }

      stats.push({
        step: 'Backup',
        before: originalCount,
        after: backupCount,
        deleted: 0,
        success: true,
        message: `Backup created with ${backupCount} records`
      });

      console.log();
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      throw error;
    }

    // ====================================================================
    // STEP 2: DELETE EMPTY CONTENT RECORDS
    // ====================================================================
    console.log('STEP 2: DELETE EMPTY CONTENT RECORDS');
    console.log('-'.repeat(70));

    try {
      // Count before
      const beforeEmptyResult = await db.execute(
        "SELECT COUNT(*) as count FROM memories WHERE content IS NULL OR TRIM(content) = ''"
      );
      const emptyBefore = beforeEmptyResult.rows[0]?.count || 0;

      const beforeTotalResult = await db.execute('SELECT COUNT(*) as count FROM memories');
      const totalBefore = beforeTotalResult.rows[0]?.count || 0;

      console.log(`📊 Before deletion:`);
      console.log(`   Total memories: ${totalBefore}`);
      console.log(`   Empty content records: ${emptyBefore}`);

      // Execute deletion
      const deleteEmptyResult = await db.execute(
        "DELETE FROM memories WHERE content IS NULL OR TRIM(content) = ''"
      );

      // Count after
      const afterEmptyResult = await db.execute(
        "SELECT COUNT(*) as count FROM memories WHERE content IS NULL OR TRIM(content) = ''"
      );
      const emptyAfter = afterEmptyResult.rows[0]?.count || 0;

      const afterTotalResult = await db.execute('SELECT COUNT(*) as count FROM memories');
      const totalAfter = afterTotalResult.rows[0]?.count || 0;

      const deleted = totalBefore - totalAfter;

      console.log(`📊 After deletion:`);
      console.log(`   Total memories: ${totalAfter}`);
      console.log(`   Empty content records: ${emptyAfter}`);
      console.log(`   Records deleted: ${deleted}`);

      if (emptyAfter > 0) {
        console.warn(`⚠️  WARNING: Still have ${emptyAfter} empty content records`);
      } else {
        console.log('✅ All empty content records deleted');
      }

      stats.push({
        step: 'Delete Empty Content',
        before: totalBefore,
        after: totalAfter,
        deleted: deleted,
        success: emptyAfter === 0,
        message: `Deleted ${deleted} empty content records`
      });

      console.log();
    } catch (error) {
      console.error('❌ Empty content deletion failed:', error);
      throw error;
    }

    // ====================================================================
    // STEP 3: DELETE DUPLICATES (KEEP OLDEST)
    // ====================================================================
    console.log('STEP 3: DELETE DUPLICATES (KEEP OLDEST)');
    console.log('-'.repeat(70));

    try {
      // Count before
      const beforeDuplicatesResult = await db.execute(
        `SELECT COUNT(*) as count FROM memories m2
         WHERE EXISTS (
           SELECT 1 FROM memories m1
           WHERE m1.content = m2.content
             AND m1.user_id = m2.user_id
             AND m1.content IS NOT NULL
             AND TRIM(m1.content) != ''
             AND m1.created_at < m2.created_at
         )`
      );
      const duplicatesBefore = beforeDuplicatesResult.rows[0]?.count || 0;

      const beforeTotalResult = await db.execute('SELECT COUNT(*) as count FROM memories');
      const totalBefore = beforeTotalResult.rows[0]?.count || 0;

      console.log(`📊 Before deduplication:`);
      console.log(`   Total memories: ${totalBefore}`);
      console.log(`   Duplicate records: ${duplicatesBefore}`);

      // Execute deduplication
      const deleteDuplicatesResult = await db.execute(
        `DELETE FROM memories
         WHERE id IN (
           SELECT m2.id
           FROM memories m1
           INNER JOIN memories m2
             ON m1.content = m2.content
             AND m1.user_id = m2.user_id
             AND m1.created_at < m2.created_at
           WHERE m1.content IS NOT NULL
             AND TRIM(m1.content) != ''
         )`
      );

      // Count after
      const afterDuplicatesResult = await db.execute(
        `SELECT COUNT(*) as count FROM memories m2
         WHERE EXISTS (
           SELECT 1 FROM memories m1
           WHERE m1.content = m2.content
             AND m1.user_id = m2.user_id
             AND m1.content IS NOT NULL
             AND TRIM(m1.content) != ''
             AND m1.created_at < m2.created_at
         )`
      );
      const duplicatesAfter = afterDuplicatesResult.rows[0]?.count || 0;

      const afterTotalResult = await db.execute('SELECT COUNT(*) as count FROM memories');
      const totalAfter = afterTotalResult.rows[0]?.count || 0;

      const deleted = totalBefore - totalAfter;

      console.log(`📊 After deduplication:`);
      console.log(`   Total memories: ${totalAfter}`);
      console.log(`   Duplicate records: ${duplicatesAfter}`);
      console.log(`   Records deleted: ${deleted}`);

      if (duplicatesAfter > 0) {
        console.warn(`⚠️  WARNING: Still have ${duplicatesAfter} duplicate records`);
      } else {
        console.log('✅ All duplicate records removed');
      }

      stats.push({
        step: 'Delete Duplicates',
        before: totalBefore,
        after: totalAfter,
        deleted: deleted,
        success: duplicatesAfter === 0,
        message: `Deleted ${deleted} duplicate records`
      });

      console.log();
    } catch (error) {
      console.error('❌ Deduplication failed:', error);
      throw error;
    }

    // ====================================================================
    // STEP 4: FINAL VERIFICATION
    // ====================================================================
    console.log('STEP 4: FINAL VERIFICATION');
    console.log('-'.repeat(70));

    try {
      // Overall statistics
      const finalResult = await db.execute(
        `SELECT
           COUNT(*) as total_memories,
           COUNT(CASE WHEN content IS NULL OR TRIM(content) = '' THEN 1 END) as empty_content,
           COUNT(CASE WHEN embedding IS NULL OR embedding = '[]' THEN 1 END) as missing_embeddings,
           COUNT(DISTINCT content || user_id) as unique_memories
         FROM memories`
      );

      const finalStats = finalResult.rows[0];
      const totalMemories = finalStats?.total_memories || 0;
      const emptyContent = finalStats?.empty_content || 0;
      const missingEmbeddings = finalStats?.missing_embeddings || 0;
      const uniqueMemories = finalStats?.unique_memories || 0;
      const remainingDuplicates = totalMemories - uniqueMemories;

      console.log('📊 Final Database Statistics:');
      console.log(`   Total memories: ${totalMemories}`);
      console.log(`   Empty content: ${emptyContent}`);
      console.log(`   Missing embeddings: ${missingEmbeddings}`);
      console.log(`   Unique memories: ${uniqueMemories}`);
      console.log(`   Remaining duplicates: ${remainingDuplicates}`);
      console.log();

      // Health check
      let healthStatus = 'OK: Clean database';
      if (emptyContent > 0) {
        healthStatus = 'WARN: Still has empty content';
      } else if (remainingDuplicates > 0) {
        healthStatus = 'WARN: Still has duplicates';
      }

      console.log(`🏥 Health Status: ${healthStatus}`);
      console.log();

      stats.push({
        step: 'Final Verification',
        before: 0,
        after: totalMemories,
        deleted: 0,
        success: emptyContent === 0 && remainingDuplicates === 0,
        message: healthStatus
      });

    } catch (error) {
      console.error('❌ Final verification failed:', error);
      throw error;
    }

    // ====================================================================
    // SUMMARY
    // ====================================================================
    console.log('='.repeat(70));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(70));
    console.log();

    let allSuccess = true;
    for (const stat of stats) {
      const icon = stat.success ? '✅' : '⚠️ ';
      console.log(`${icon} ${stat.step}: ${stat.message}`);
      if (stat.deleted > 0) {
        console.log(`   Records deleted: ${stat.deleted} (${stat.before} → ${stat.after})`);
      }
      if (!stat.success) {
        allSuccess = false;
      }
    }

    console.log();
    console.log('='.repeat(70));

    if (allSuccess) {
      console.log('✅ CLEANUP COMPLETED SUCCESSFULLY');
    } else {
      console.log('⚠️  CLEANUP COMPLETED WITH WARNINGS');
    }

    console.log('='.repeat(70));
    console.log();

    // Rollback instructions
    console.log('📋 ROLLBACK INSTRUCTIONS (if needed):');
    console.log('   To restore from backup, run:');
    console.log('   1. DELETE FROM memories;');
    console.log('   2. INSERT INTO memories SELECT * FROM memories_backup_20251014;');
    console.log('   3. SELECT COUNT(*) FROM memories; -- Verify restoration');
    console.log();
    console.log('   To remove backup after confirming everything is OK:');
    console.log('   DROP TABLE memories_backup_20251014;');
    console.log();

  } catch (error) {
    console.error('❌ CLEANUP FAILED:', error);
    console.error();
    console.error('📋 Database state may be inconsistent. Consider rollback:');
    console.error('   DELETE FROM memories;');
    console.error('   INSERT INTO memories SELECT * FROM memories_backup_20251014;');
    process.exit(1);
  } finally {
    // Close database connection
    if (db && db.isConnected()) {
      await db.disconnect();
    }
  }
}

// Execute cleanup
executeCleanup().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
