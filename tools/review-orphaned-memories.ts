#!/usr/bin/env tsx
/**
 * Review and Associate Orphaned Memories
 *
 * This script identifies memories with NULL user_id or invalid user_id references,
 * determines if they are test data or real data, and optionally associates them
 * with the correct user (bob@matsuoka.com).
 *
 * Usage:
 *   npx tsx tools/review-orphaned-memories.ts --dry-run
 *   npx tsx tools/review-orphaned-memories.ts
 */

import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;
const BOB_USER_ID = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75';

// Test data keywords to identify test memories
const TEST_KEYWORDS = [
  'test',
  'example',
  'lorem',
  'dummy',
  'sample',
  'placeholder',
  'foo',
  'bar',
  'baz',
  'demo',
];

interface OrphanedMemory {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  created_at: string;
  is_test_data: boolean;
}

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Error: TURSO_URL and TURSO_AUTH_TOKEN must be set');
  process.exit(1);
}

const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

function isTestData(memory: OrphanedMemory): boolean {
  const searchText = `${memory.title} ${memory.content}`.toLowerCase();
  return TEST_KEYWORDS.some(keyword => searchText.includes(keyword));
}

async function reviewOrphanedMemories(dryRun: boolean = true) {
  console.log('🔍 Reviewing Orphaned Memories');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
  console.log('');

  try {
    // Step 1: Get all valid user IDs
    console.log('📊 Step 1: Fetching valid user IDs...');
    const usersResult = await db.execute('SELECT id, email FROM users');
    const validUserIds = new Set(usersResult.rows.map(row => row.id));
    console.log(`   Found ${validUserIds.size} valid users`);
    console.log('');

    // Step 2: Find orphaned memories (NULL user_id OR user_id not in users table)
    console.log('📊 Step 2: Finding orphaned memories...');
    const orphanedQuery = `
      SELECT id, user_id, title, content, created_at
      FROM memories
      WHERE user_id IS NULL OR user_id NOT IN (SELECT id FROM users)
      ORDER BY created_at DESC
    `;
    const orphanedResult = await db.execute(orphanedQuery);
    const orphanedMemories = orphanedResult.rows as unknown as OrphanedMemory[];

    console.log(`   Found ${orphanedMemories.length} orphaned memories`);
    console.log('');

    if (orphanedMemories.length === 0) {
      console.log('✅ No orphaned memories found!');
      return;
    }

    // Step 3: Classify memories as test data or real data
    console.log('📊 Step 3: Classifying memories...');
    const realMemories: OrphanedMemory[] = [];
    const testMemories: OrphanedMemory[] = [];

    orphanedMemories.forEach(memory => {
      if (isTestData(memory)) {
        testMemories.push(memory);
      } else {
        realMemories.push(memory);
      }
    });

    console.log(`   Real memories: ${realMemories.length}`);
    console.log(`   Test memories: ${testMemories.length}`);
    console.log('');

    // Step 4: Display real memories for review
    if (realMemories.length > 0) {
      console.log('📋 Real Memories (to be associated with Bob):');
      console.log('-'.repeat(80));
      realMemories.forEach((memory, idx) => {
        console.log(`${idx + 1}. ID: ${memory.id}`);
        console.log(`   Current User ID: ${memory.user_id || 'NULL'}`);
        console.log(`   Title: ${memory.title}`);
        console.log(`   Content: ${memory.content.substring(0, 100)}${memory.content.length > 100 ? '...' : ''}`);
        console.log(`   Created: ${memory.created_at}`);
        console.log('');
      });
    }

    // Step 5: Display test memories
    if (testMemories.length > 0) {
      console.log('📋 Test Memories (flagged for deletion):');
      console.log('-'.repeat(80));
      testMemories.forEach((memory, idx) => {
        console.log(`${idx + 1}. ID: ${memory.id}`);
        console.log(`   Title: ${memory.title}`);
        console.log(`   Content: ${memory.content.substring(0, 80)}${memory.content.length > 80 ? '...' : ''}`);
        console.log('');
      });
    }

    // Step 6: Execute updates (if not dry run)
    if (!dryRun) {
      console.log('🔧 Step 6: Executing updates...');
      console.log('');

      // Associate real memories with Bob
      if (realMemories.length > 0) {
        console.log(`📝 Associating ${realMemories.length} real memories with Bob...`);
        for (const memory of realMemories) {
          await db.execute('UPDATE memories SET user_id = ? WHERE id = ?', [
            BOB_USER_ID,
            memory.id,
          ]);
        }
        console.log(`   ✅ Associated ${realMemories.length} memories`);
      }

      // Mark test memories for deletion (we'll just report them here)
      if (testMemories.length > 0) {
        console.log(`   ⚠️  ${testMemories.length} test memories flagged for deletion`);
        console.log(`   Run cleanup-test-data.ts to remove them`);
      }

      console.log('');
    }

    // Summary
    console.log('');
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    console.log(`Total orphaned memories: ${orphanedMemories.length}`);
    console.log(`  - Real memories: ${realMemories.length} ${!dryRun ? '(ASSOCIATED with Bob)' : '(to be associated)'}`);
    console.log(`  - Test memories: ${testMemories.length} ${!dryRun ? '(FLAGGED for deletion)' : '(to be flagged)'}`);
    console.log('');

    if (dryRun) {
      console.log('ℹ️  This was a DRY RUN. No changes were made.');
      console.log('   Run without --dry-run to execute the updates:');
      console.log('   npx tsx tools/review-orphaned-memories.ts');
    } else {
      console.log('✅ Updates completed successfully!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

reviewOrphanedMemories(dryRun);
