#!/usr/bin/env tsx
/**
 * Quick NULL ID Checker
 * Use this to verify the current state of NULL IDs in the database before running recovery
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Missing required environment variables: TURSO_URL, TURSO_AUTH_TOKEN');
  process.exit(1);
}

async function checkNullIds() {
  const db = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  try {
    console.log('🔍 Checking for NULL IDs in database...\n');

    // Check memories table
    const memoriesResult = await db.execute(`
      SELECT COUNT(*) as count
      FROM memories
      WHERE id IS NULL
    `);
    const memoriesNullCount = Number(memoriesResult.rows[0]?.count || 0);

    // Check entities table
    const entitiesResult = await db.execute(`
      SELECT COUNT(*) as count
      FROM entities
      WHERE id IS NULL
    `);
    const entitiesNullCount = Number(entitiesResult.rows[0]?.count || 0);

    // Check interactions table
    const interactionsResult = await db.execute(`
      SELECT COUNT(*) as count
      FROM interactions
      WHERE id IS NULL
    `);
    const interactionsNullCount = Number(interactionsResult.rows[0]?.count || 0);

    // Total counts
    const totalMemories = Number((await db.execute('SELECT COUNT(*) as count FROM memories')).rows[0]?.count || 0);
    const totalEntities = Number((await db.execute('SELECT COUNT(*) as count FROM entities')).rows[0]?.count || 0);
    const totalInteractions = Number((await db.execute('SELECT COUNT(*) as count FROM interactions')).rows[0]?.count || 0);

    // Print results
    console.log('📊 Database NULL ID Status:');
    console.log('─'.repeat(60));
    console.log(`Memories:      ${memoriesNullCount.toString().padStart(6)} NULL IDs / ${totalMemories} total`);
    console.log(`Entities:      ${entitiesNullCount.toString().padStart(6)} NULL IDs / ${totalEntities} total`);
    console.log(`Interactions:  ${interactionsNullCount.toString().padStart(6)} NULL IDs / ${totalInteractions} total`);
    console.log('─'.repeat(60));

    const totalNullIds = memoriesNullCount + entitiesNullCount + interactionsNullCount;
    console.log(`Total NULL IDs: ${totalNullIds}\n`);

    // Additional stats for memories if NULL IDs exist
    if (memoriesNullCount > 0) {
      console.log('📋 Memory NULL ID Details:');

      // Count memories with empty embeddings
      const emptyEmbResult = await db.execute(`
        SELECT COUNT(*) as count FROM memories WHERE id IS NULL AND embedding = '[]'
      `);
      console.log(`  - With empty embeddings: ${emptyEmbResult.rows[0]?.count || 0}`);

      // Sample records
      console.log('\n📝 Sample NULL ID records:');
      const sampleResult = await db.execute(`
        SELECT rowid, title, content, user_id
        FROM memories
        WHERE id IS NULL
        LIMIT 3
      `);

      for (const row of sampleResult.rows as any[]) {
        console.log(`\n  Record (rowid: ${row.rowid}):`);
        console.log(`    Title: ${row.title}`);
        console.log(`    Content: ${row.content?.substring(0, 60)}...`);
        console.log(`    User: ${row.user_id}`);
      }
      console.log('');
    }

    // Final status
    if (totalNullIds === 0) {
      console.log('✅ Database is clean - no NULL IDs found!');
    } else {
      console.log('⚠️  NULL IDs detected - recovery recommended');
      console.log('\n💡 Next steps:');
      if (memoriesNullCount > 0) {
        console.log('   1. Review NULL_ID_RECOVERY_GUIDE.md');
        console.log('   2. Run recovery: npm run recover-null-ids');
      }
    }

  } catch (error) {
    console.error('❌ Error checking database:', error);
    throw error;
  } finally {
    db.close();
  }
}

checkNullIds();
