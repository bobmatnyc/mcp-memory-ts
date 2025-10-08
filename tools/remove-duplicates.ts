#!/usr/bin/env tsx
/**
 * Remove Duplicate Memories
 *
 * This script finds and removes duplicate memories based on matching user_id, title, and content.
 * It keeps the oldest record (earliest created_at) for each duplicate set.
 *
 * Usage:
 *   npx tsx tools/remove-duplicates.ts --dry-run
 *   npx tsx tools/remove-duplicates.ts
 */

import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

interface Memory {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
}

interface DuplicateGroup {
  key: string;
  memories: Memory[];
  keepId: string;
  removeIds: string[];
}

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Error: TURSO_URL and TURSO_AUTH_TOKEN must be set');
  process.exit(1);
}

const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

async function removeDuplicates(dryRun: boolean = true) {
  console.log('🔍 Finding and Removing Duplicate Memories');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
  console.log('');

  try {
    // Step 1: Fetch all memories
    console.log('📊 Step 1: Fetching all memories...');
    const result = await db.execute(`
      SELECT id, user_id, title, content, created_at
      FROM memories
      ORDER BY user_id, title, created_at
    `);
    const memories = result.rows as unknown as Memory[];
    console.log(`   Found ${memories.length} total memories`);
    console.log('');

    // Step 2: Group memories by user_id + title + content
    console.log('📊 Step 2: Identifying duplicate groups...');
    const groupMap = new Map<string, Memory[]>();

    memories.forEach(memory => {
      // Create a unique key for each memory based on user_id, title, and content
      const key = `${memory.user_id || 'NULL'}|${memory.title}|${memory.content}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(memory);
    });

    // Filter to only duplicate groups (more than 1 memory)
    const duplicateGroups: DuplicateGroup[] = [];

    groupMap.forEach((memories, key) => {
      if (memories.length > 1) {
        // Sort by created_at to find the oldest
        memories.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        const keepId = memories[0].id; // Keep the oldest
        const removeIds = memories.slice(1).map(m => m.id); // Remove the rest

        duplicateGroups.push({
          key,
          memories,
          keepId,
          removeIds,
        });
      }
    });

    console.log(`   Found ${duplicateGroups.length} duplicate groups`);
    console.log(`   Total duplicates to remove: ${duplicateGroups.reduce((sum, g) => sum + g.removeIds.length, 0)}`);
    console.log('');

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate memories found!');
      return;
    }

    // Step 3: Display duplicate groups
    console.log('📋 Duplicate Groups:');
    console.log('-'.repeat(80));

    duplicateGroups.forEach((group, idx) => {
      console.log(`Group ${idx + 1}:`);
      console.log(`  Title: ${group.memories[0].title}`);
      console.log(`  User ID: ${group.memories[0].user_id || 'NULL'}`);
      console.log(`  Count: ${group.memories.length} duplicates`);
      console.log('');

      group.memories.forEach((memory, memIdx) => {
        const status = memIdx === 0 ? '✅ KEEP' : '❌ REMOVE';
        console.log(`    ${status} - ID: ${memory.id}`);
        console.log(`           Created: ${memory.created_at}`);
        console.log(`           Content: ${memory.content.substring(0, 60)}${memory.content.length > 60 ? '...' : ''}`);
        console.log('');
      });
      console.log('-'.repeat(80));
    });

    // Step 4: Execute deletions (if not dry run)
    if (!dryRun) {
      console.log('');
      console.log('🔧 Step 4: Executing deletions...');
      console.log('');

      let totalDeleted = 0;

      for (const group of duplicateGroups) {
        console.log(`   Deleting ${group.removeIds.length} duplicates for: "${group.memories[0].title}"`);

        for (const id of group.removeIds) {
          await db.execute('DELETE FROM memories WHERE id = ?', [id]);
          totalDeleted++;
        }
      }

      console.log('');
      console.log(`   ✅ Deleted ${totalDeleted} duplicate memories`);
    }

    // Summary
    console.log('');
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    console.log(`Total memories: ${memories.length}`);
    console.log(`Duplicate groups: ${duplicateGroups.length}`);
    console.log(`Memories to keep: ${duplicateGroups.length}`);
    console.log(`Memories to remove: ${duplicateGroups.reduce((sum, g) => sum + g.removeIds.length, 0)} ${!dryRun ? '(DELETED)' : '(to be deleted)'}`);
    console.log('');

    if (dryRun) {
      console.log('ℹ️  This was a DRY RUN. No changes were made.');
      console.log('   Run without --dry-run to execute the deletions:');
      console.log('   npx tsx tools/remove-duplicates.ts');
    } else {
      console.log('✅ Duplicates removed successfully!');
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

removeDuplicates(dryRun);
