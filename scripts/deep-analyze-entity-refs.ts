#!/usr/bin/env node
/**
 * Deep Analysis of Entity References
 *
 * Checks if entity_ids in memories actually reference existing entities
 */

import { config } from 'dotenv';
import { createClient } from '@libsql/client';

config();

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function deepAnalyze() {
  console.log('🔍 Deep Analysis of Entity References\n');
  console.log('='.repeat(80));

  try {
    // Get all memories with entity_ids
    const memoriesResult = await db.execute(
      'SELECT id, content, entity_ids, user_id FROM memories WHERE entity_ids IS NOT NULL AND entity_ids != "[]" AND entity_ids != ""'
    );
    const memories = memoriesResult.rows as any[];

    console.log(`\n📊 Found ${memories.length} memories with entity_ids`);

    // Get all existing entity IDs
    const entitiesResult = await db.execute('SELECT id FROM entities');
    const entityIds = new Set(entitiesResult.rows.map((row: any) => row.id));

    console.log(`📊 Found ${entityIds.size} existing entities\n`);

    // Analyze each memory
    let totalBroken = 0;
    let totalValid = 0;
    const brokenMemories: any[] = [];
    const missingEntityIds = new Map<string, number>();

    for (const memory of memories) {
      let entityIdArray: string[] = [];

      try {
        // Parse entity_ids (could be JSON array or comma-separated)
        if (memory.entity_ids.startsWith('[')) {
          entityIdArray = JSON.parse(memory.entity_ids);
        } else {
          entityIdArray = memory.entity_ids.split(',').map((id: string) => id.trim());
        }
      } catch (e) {
        console.log(`⚠️  Failed to parse entity_ids for memory ${memory.id}: ${memory.entity_ids}`);
        continue;
      }

      // Check if any entity IDs are missing
      const missingIds = entityIdArray.filter(id => !entityIds.has(id));

      if (missingIds.length > 0) {
        totalBroken++;
        brokenMemories.push({
          memoryId: memory.id,
          userId: memory.user_id,
          entityIds: entityIdArray,
          missingIds: missingIds,
          content: memory.content.substring(0, 80)
        });

        // Track missing entity IDs
        missingIds.forEach(id => {
          missingEntityIds.set(id, (missingEntityIds.get(id) || 0) + 1);
        });
      } else {
        totalValid++;
      }
    }

    console.log('='.repeat(80));
    console.log('📊 RESULTS:');
    console.log('='.repeat(80));
    console.log(`✅ Valid references: ${totalValid}`);
    console.log(`❌ Broken references: ${totalBroken}\n`);

    if (totalBroken > 0) {
      console.log('='.repeat(80));
      console.log(`📋 Top 10 Missing Entity IDs:`);
      console.log('='.repeat(80));

      const sortedMissing = Array.from(missingEntityIds.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      for (const [entityId, count] of sortedMissing) {
        console.log(`  ${entityId}: ${count} memories`);
      }

      console.log('\n' + '='.repeat(80));
      console.log('📝 Sample Broken Memories (first 5):');
      console.log('='.repeat(80));

      for (const broken of brokenMemories.slice(0, 5)) {
        console.log(`\nMemory ID: ${broken.memoryId}`);
        console.log(`User ID: ${broken.userId}`);
        console.log(`Entity IDs: ${broken.entityIds.join(', ')}`);
        console.log(`Missing IDs: ${broken.missingIds.join(', ')}`);
        console.log(`Content: ${broken.content}...`);
      }

      console.log('\n' + '='.repeat(80));
      console.log('🎯 ROOT CAUSE:');
      console.log('='.repeat(80));
      console.log('  - Memory cleanup (875→159) preserved memories with entity_ids');
      console.log('  - But the referenced entities were likely deleted');
      console.log('  - entity_ids are foreign keys without database-level constraints');
      console.log('  - No cascading updates when entities are deleted\n');

      console.log('='.repeat(80));
      console.log('💡 RECOMMENDATION:');
      console.log('='.repeat(80));
      console.log('  ✅ Clear all broken entity_ids (set to NULL)');
      console.log('  ✅ Preserve memory content (intact)');
      console.log(`  ✅ Affects ${totalBroken} memories`);
      console.log('  ✅ Low risk - entity associations are broken anyway\n');
    }

    // Generate cleanup IDs
    if (totalBroken > 0) {
      console.log('='.repeat(80));
      console.log('📋 CLEANUP SCRIPT:');
      console.log('='.repeat(80));
      console.log('\n-- Affected memory IDs:');
      const idList = brokenMemories.map(m => `'${m.memoryId}'`).join(',\n  ');
      console.log(`-- Total: ${totalBroken} memories\n`);
      console.log('-- Step 1: Backup');
      console.log('CREATE TABLE IF NOT EXISTS memories_entity_backup_20251014 AS');
      console.log('SELECT id, entity_ids, created_at FROM memories WHERE entity_ids IS NOT NULL;\n');
      console.log('-- Step 2: Clear broken references');
      console.log('UPDATE memories');
      console.log('SET entity_ids = NULL');
      console.log(`WHERE id IN (\n  ${idList.substring(0, 500)}...\n);\n`);
      console.log('-- Step 3: Verify');
      console.log('SELECT COUNT(*) FROM memories WHERE entity_ids IS NOT NULL;');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    db.close();
  }
}

deepAnalyze()
  .then(() => {
    console.log('\n✅ Analysis complete\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
