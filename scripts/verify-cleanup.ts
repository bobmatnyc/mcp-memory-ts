#!/usr/bin/env node

/**
 * Verify Data Quality Cleanup Results
 *
 * This script verifies the cleanup was successful and provides
 * detailed statistics about the database state.
 */

import { initDatabaseFromEnv } from '../src/database/connection.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function verifyCleanup() {
  console.log('='.repeat(70));
  console.log('MCP MEMORY DATABASE VERIFICATION');
  console.log('='.repeat(70));
  console.log();

  let db;
  try {
    // Initialize database connection
    console.log('📡 Connecting to database...');
    db = initDatabaseFromEnv();
    await db.connect();
    console.log('✅ Connected successfully\n');

    // Check backup exists
    console.log('BACKUP VERIFICATION');
    console.log('-'.repeat(70));
    try {
      const backupResult = await db.execute(
        'SELECT COUNT(*) as count FROM memories_backup_20251014'
      );
      const backupCount = backupResult.rows[0]?.count || 0;
      console.log(`✅ Backup table exists with ${backupCount} records`);
    } catch (error) {
      console.log('⚠️  Backup table not found (may have been dropped)');
    }
    console.log();

    // Overall statistics
    console.log('DATABASE STATISTICS');
    console.log('-'.repeat(70));
    const statsResult = await db.execute(
      `SELECT
         COUNT(*) as total_memories,
         COUNT(CASE WHEN content IS NULL OR TRIM(content) = '' THEN 1 END) as empty_content,
         COUNT(CASE WHEN embedding IS NULL OR embedding = '[]' THEN 1 END) as missing_embeddings,
         COUNT(DISTINCT user_id) as unique_users,
         COUNT(DISTINCT content || user_id) as unique_memories
       FROM memories`
    );

    const stats = statsResult.rows[0];
    const totalMemories = stats?.total_memories || 0;
    const emptyContent = stats?.empty_content || 0;
    const missingEmbeddings = stats?.missing_embeddings || 0;
    const uniqueUsers = stats?.unique_users || 0;
    const uniqueMemories = stats?.unique_memories || 0;
    const remainingDuplicates = totalMemories - uniqueMemories;

    console.log(`Total memories: ${totalMemories}`);
    console.log(`Empty content: ${emptyContent}`);
    console.log(`Missing embeddings: ${missingEmbeddings} (${((missingEmbeddings/totalMemories)*100).toFixed(1)}%)`);
    console.log(`Unique users: ${uniqueUsers}`);
    console.log(`Unique memories: ${uniqueMemories}`);
    console.log(`Remaining duplicates: ${remainingDuplicates}`);
    console.log();

    // Data quality checks
    console.log('DATA QUALITY CHECKS');
    console.log('-'.repeat(70));

    let allChecksPassed = true;

    // Check 1: No empty content
    if (emptyContent === 0) {
      console.log('✅ No empty content records');
    } else {
      console.log(`❌ Found ${emptyContent} empty content records`);
      allChecksPassed = false;
    }

    // Check 2: No duplicates
    if (remainingDuplicates === 0) {
      console.log('✅ No duplicate records');
    } else {
      console.log(`❌ Found ${remainingDuplicates} duplicate records`);
      allChecksPassed = false;
    }

    // Check 3: All records have IDs
    const nullIdResult = await db.execute(
      'SELECT COUNT(*) as count FROM memories WHERE id IS NULL'
    );
    const nullIds = nullIdResult.rows[0]?.count || 0;

    if (nullIds === 0) {
      console.log('✅ All records have valid IDs');
    } else {
      console.log(`❌ Found ${nullIds} records with NULL IDs`);
      allChecksPassed = false;
    }

    // Check 4: All records have user_id
    const nullUserResult = await db.execute(
      'SELECT COUNT(*) as count FROM memories WHERE user_id IS NULL'
    );
    const nullUsers = nullUserResult.rows[0]?.count || 0;

    if (nullUsers === 0) {
      console.log('✅ All records have user_id');
    } else {
      console.log(`❌ Found ${nullUsers} records with NULL user_id`);
      allChecksPassed = false;
    }

    console.log();

    // Memory type breakdown
    console.log('MEMORY TYPE BREAKDOWN');
    console.log('-'.repeat(70));
    const typeResult = await db.execute(
      `SELECT
         memory_type,
         COUNT(*) as count
       FROM memories
       GROUP BY memory_type
       ORDER BY count DESC`
    );

    for (const row of typeResult.rows) {
      const type = row.memory_type || 'NULL';
      const count = row.count || 0;
      console.log(`${type}: ${count}`);
    }
    console.log();

    // User breakdown
    console.log('USER BREAKDOWN');
    console.log('-'.repeat(70));
    const userResult = await db.execute(
      `SELECT
         user_id,
         COUNT(*) as count
       FROM memories
       GROUP BY user_id
       ORDER BY count DESC`
    );

    for (const row of userResult.rows) {
      const userId = row.user_id || 'NULL';
      const count = row.count || 0;
      console.log(`${userId}: ${count} memories`);
    }
    console.log();

    // Sample of memories
    console.log('SAMPLE MEMORIES (First 5)');
    console.log('-'.repeat(70));
    const sampleResult = await db.execute(
      `SELECT
         id,
         memory_type,
         SUBSTR(content, 1, 50) as content_preview,
         created_at
       FROM memories
       ORDER BY created_at DESC
       LIMIT 5`
    );

    for (const row of sampleResult.rows) {
      console.log(`ID: ${row.id}`);
      console.log(`Type: ${row.memory_type}`);
      console.log(`Content: ${row.content_preview}...`);
      console.log(`Created: ${row.created_at}`);
      console.log();
    }

    // Final result
    console.log('='.repeat(70));
    if (allChecksPassed) {
      console.log('✅ ALL DATA QUALITY CHECKS PASSED');
      console.log('='.repeat(70));
      console.log();
      console.log('Database is clean and ready for production use.');
      console.log();
      console.log('Next steps:');
      console.log('1. Drop backup table if no longer needed:');
      console.log('   DROP TABLE memories_backup_20251014;');
      console.log();
      console.log('2. Consider generating embeddings for records missing them:');
      console.log('   npm run backfill-embeddings');
    } else {
      console.log('⚠️  SOME DATA QUALITY CHECKS FAILED');
      console.log('='.repeat(70));
      console.log();
      console.log('Review the issues above and take corrective action.');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (db && db.isConnected()) {
      await db.disconnect();
    }
  }
}

// Execute verification
verifyCleanup().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
