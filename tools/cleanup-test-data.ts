#!/usr/bin/env tsx
/**
 * Cleanup Test Data
 *
 * This script removes test users and all their associated data (memories, entities, interactions).
 * It identifies test users by email patterns (test@*, example@*, etc.) and data patterns.
 *
 * Usage:
 *   npx tsx tools/cleanup-test-data.ts --dry-run
 *   npx tsx tools/cleanup-test-data.ts
 */

import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

// Test email patterns to identify test users
const TEST_EMAIL_PATTERNS = [
  /^test@/i,
  /^example@/i,
  /^demo@/i,
  /^sample@/i,
  /@test\./i,
  /@example\./i,
  /dummy@/i,
  /foo@/i,
  /bar@/i,
];

// Test content keywords
const TEST_KEYWORDS = [
  'test',
  'example',
  'lorem ipsum',
  'dummy',
  'sample',
  'placeholder',
  'foo',
  'bar',
  'baz',
  'demo',
];

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface DataCounts {
  memories: number;
  entities: number;
  interactions: number;
}

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Error: TURSO_URL and TURSO_AUTH_TOKEN must be set');
  process.exit(1);
}

const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

function isTestEmail(email: string): boolean {
  return TEST_EMAIL_PATTERNS.some(pattern => pattern.test(email));
}

async function getDataCounts(userId: string): Promise<DataCounts> {
  const [memoriesResult, entitiesResult, interactionsResult] = await Promise.all([
    db.execute('SELECT COUNT(*) as count FROM memories WHERE user_id = ?', [userId]),
    db.execute('SELECT COUNT(*) as count FROM entities WHERE user_id = ?', [userId]),
    db.execute('SELECT COUNT(*) as count FROM interactions WHERE user_id = ?', [userId]),
  ]);

  return {
    memories: Number((memoriesResult.rows[0] as any).count),
    entities: Number((entitiesResult.rows[0] as any).count),
    interactions: Number((interactionsResult.rows[0] as any).count),
  };
}

async function cleanupTestData(dryRun: boolean = true) {
  console.log('🔍 Cleaning Up Test Data');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
  console.log('');

  try {
    // Step 1: Find all users
    console.log('📊 Step 1: Fetching all users...');
    const usersResult = await db.execute('SELECT id, email, name FROM users');
    const allUsers = usersResult.rows as unknown as User[];
    console.log(`   Found ${allUsers.length} total users`);
    console.log('');

    // Step 2: Identify test users
    console.log('📊 Step 2: Identifying test users...');
    const testUsers: User[] = [];
    const productionUsers: User[] = [];

    allUsers.forEach(user => {
      if (isTestEmail(user.email)) {
        testUsers.push(user);
      } else {
        productionUsers.push(user);
      }
    });

    console.log(`   Test users: ${testUsers.length}`);
    console.log(`   Production users: ${productionUsers.length}`);
    console.log('');

    if (testUsers.length === 0) {
      console.log('✅ No test users found!');
      return;
    }

    // Step 3: Get data counts for test users
    console.log('📊 Step 3: Analyzing test user data...');
    const userDataMap = new Map<string, DataCounts>();

    for (const user of testUsers) {
      const counts = await getDataCounts(user.id);
      userDataMap.set(user.id, counts);
    }

    console.log('');

    // Step 4: Display test users and their data
    console.log('📋 Test Users to be Removed:');
    console.log('-'.repeat(80));

    let totalMemories = 0;
    let totalEntities = 0;
    let totalInteractions = 0;

    testUsers.forEach((user, idx) => {
      const counts = userDataMap.get(user.id)!;
      totalMemories += counts.memories;
      totalEntities += counts.entities;
      totalInteractions += counts.interactions;

      console.log(`${idx + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Data:`);
      console.log(`     - Memories: ${counts.memories}`);
      console.log(`     - Entities: ${counts.entities}`);
      console.log(`     - Interactions: ${counts.interactions}`);
      console.log('');
    });

    console.log('-'.repeat(80));
    console.log(`Total to be deleted:`);
    console.log(`  - Users: ${testUsers.length}`);
    console.log(`  - Memories: ${totalMemories}`);
    console.log(`  - Entities: ${totalEntities}`);
    console.log(`  - Interactions: ${totalInteractions}`);
    console.log('');

    // Step 5: Also check for orphaned test memories (no valid user_id)
    console.log('📊 Step 5: Checking for orphaned test memories...');
    const orphanedTestMemories = await db.execute(`
      SELECT id, title, content
      FROM memories
      WHERE (user_id IS NULL OR user_id = 'system-internal')
      AND (
        LOWER(title) LIKE '%test%' OR
        LOWER(title) LIKE '%example%' OR
        LOWER(content) LIKE '%test%' OR
        LOWER(content) LIKE '%example%' OR
        LOWER(content) LIKE '%lorem%' OR
        LOWER(content) LIKE '%dummy%'
      )
    `);

    console.log(`   Found ${orphanedTestMemories.rows.length} orphaned test memories`);
    console.log('');

    if (orphanedTestMemories.rows.length > 0) {
      console.log('📋 Orphaned Test Memories:');
      console.log('-'.repeat(80));
      orphanedTestMemories.rows.forEach((row: any, idx) => {
        console.log(`${idx + 1}. ID: ${row.id}`);
        console.log(`   Title: ${row.title}`);
        console.log(`   Content: ${row.content.substring(0, 60)}...`);
        console.log('');
      });
    }

    // Step 6: Execute deletions (if not dry run)
    if (!dryRun) {
      console.log('');
      console.log('🔧 Step 6: Executing deletions...');
      console.log('');

      // Delete in correct order (due to foreign key constraints)
      for (const user of testUsers) {
        console.log(`   Deleting data for ${user.email}...`);

        // Delete interactions first
        await db.execute('DELETE FROM interactions WHERE user_id = ?', [user.id]);

        // Delete memories
        await db.execute('DELETE FROM memories WHERE user_id = ?', [user.id]);

        // Delete entities
        await db.execute('DELETE FROM entities WHERE user_id = ?', [user.id]);

        // Delete user
        await db.execute('DELETE FROM users WHERE id = ?', [user.id]);

        console.log(`     ✅ Deleted user and all associated data`);
      }

      // Delete orphaned test memories
      if (orphanedTestMemories.rows.length > 0) {
        console.log(`   Deleting ${orphanedTestMemories.rows.length} orphaned test memories...`);
        for (const row of orphanedTestMemories.rows) {
          await db.execute('DELETE FROM memories WHERE id = ?', [(row as any).id]);
        }
        console.log(`     ✅ Deleted orphaned test memories`);
      }

      console.log('');
      console.log('   ✅ All test data deleted successfully!');
    }

    // Summary
    console.log('');
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    console.log(`Test users: ${testUsers.length} ${!dryRun ? '(DELETED)' : '(to be deleted)'}`);
    console.log(`  - Memories: ${totalMemories}`);
    console.log(`  - Entities: ${totalEntities}`);
    console.log(`  - Interactions: ${totalInteractions}`);
    console.log(`Orphaned test memories: ${orphanedTestMemories.rows.length} ${!dryRun ? '(DELETED)' : '(to be deleted)'}`);
    console.log('');

    if (dryRun) {
      console.log('ℹ️  This was a DRY RUN. No changes were made.');
      console.log('   Run without --dry-run to execute the deletions:');
      console.log('   npx tsx tools/cleanup-test-data.ts');
      console.log('');
      console.log('⚠️  WARNING: This will permanently delete all test users and their data!');
    } else {
      console.log('✅ Test data cleanup completed successfully!');
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

cleanupTestData(dryRun);
