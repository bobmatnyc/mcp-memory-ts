#!/usr/bin/env node
/**
 * Analyze Broken Entity References in Memories
 *
 * Investigates why 155 memories have entity_ids that reference non-existent entities
 * and determines the best cleanup approach.
 */

import { config } from 'dotenv';
import { createClient } from '@libsql/client';

config();

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

interface Memory {
  id: string;
  content: string;
  entity_ids: string | null;
  created_at: string;
  user_id: string;
}

interface Entity {
  id: string;
  name: string;
  entity_type: string;
}

async function analyzeBreakage() {
  console.log('🔍 Analyzing Broken Entity References\n');
  console.log('=' .repeat(80));

  try {
    // Step 1: Get all memories with entity_ids
    const memoriesResult = await db.execute(
      'SELECT id, content, entity_ids, created_at, user_id FROM memories WHERE entity_ids IS NOT NULL'
    );
    const memories = memoriesResult.rows as unknown as Memory[];

    console.log(`\n📊 Found ${memories.length} memories with entity_ids`);

    // Step 2: Get all existing entities
    const entitiesResult = await db.execute(
      'SELECT id, name, entity_type FROM entities'
    );
    const entities = entitiesResult.rows as unknown as Entity[];
    const entityIdSet = new Set(entities.map(e => e.id));

    console.log(`📊 Found ${entities.length} existing entities`);

    // Step 3: Analyze broken references
    let brokenCount = 0;
    let validCount = 0;
    const brokenEntityIds = new Map<string, number>(); // entity_id -> count
    const brokenMemories: Array<{id: string, entityIds: string[], content: string}> = [];

    for (const memory of memories) {
      if (!memory.entity_ids) continue;

      // Parse entity_ids (JSON array of strings)
      let entityIds: string[] = [];
      try {
        entityIds = JSON.parse(memory.entity_ids);
      } catch {
        // Try comma-separated format
        entityIds = memory.entity_ids.split(',').map(id => id.trim());
      }

      const missingIds = entityIds.filter(id => !entityIdSet.has(id));

      if (missingIds.length > 0) {
        brokenCount++;
        brokenMemories.push({
          id: memory.id,
          entityIds: missingIds,
          content: memory.content.substring(0, 100)
        });

        missingIds.forEach(id => {
          brokenEntityIds.set(id, (brokenEntityIds.get(id) || 0) + 1);
        });
      } else {
        validCount++;
      }
    }

    console.log(`\n✅ Valid references: ${validCount}`);
    console.log(`❌ Broken references: ${brokenCount}`);

    // Step 4: Analyze patterns in broken entity IDs
    console.log('\n' + '='.repeat(80));
    console.log('📈 Top 10 Missing Entity IDs (by frequency):');
    console.log('='.repeat(80));

    const sortedBroken = Array.from(brokenEntityIds.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [entityId, count] of sortedBroken) {
      console.log(`  ${entityId}: ${count} memories`);
    }

    // Step 5: Sample broken memories
    console.log('\n' + '='.repeat(80));
    console.log('📝 Sample Broken Memories (first 5):');
    console.log('='.repeat(80));

    for (const broken of brokenMemories.slice(0, 5)) {
      console.log(`\nMemory ID: ${broken.id}`);
      console.log(`Missing Entity IDs: ${broken.entityIds.join(', ')}`);
      console.log(`Content: ${broken.content}...`);
    }

    // Step 6: Check if any broken IDs match entity names (case-insensitive)
    console.log('\n' + '='.repeat(80));
    console.log('🔗 Checking for Potential Re-linking Opportunities:');
    console.log('='.repeat(80));

    const entityNameMap = new Map(entities.map(e => [e.name.toLowerCase(), e]));
    let potentialMatches = 0;

    for (const [brokenId] of sortedBroken.slice(0, 10)) {
      const matchingEntity = entityNameMap.get(brokenId.toLowerCase());
      if (matchingEntity) {
        console.log(`  ✓ "${brokenId}" could link to entity: ${matchingEntity.id} (${matchingEntity.name})`);
        potentialMatches++;
      }
    }

    if (potentialMatches === 0) {
      console.log('  ✗ No obvious re-linking opportunities found');
    }

    // Step 7: Analyze entity_ids format
    console.log('\n' + '='.repeat(80));
    console.log('🔍 Entity IDs Format Analysis:');
    console.log('='.repeat(80));

    const entityIdFormats = {
      uuid: 0,
      numeric: 0,
      string: 0,
      other: 0
    };

    for (const [entityId] of brokenEntityIds) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)) {
        entityIdFormats.uuid++;
      } else if (/^\d+$/.test(entityId)) {
        entityIdFormats.numeric++;
      } else if (typeof entityId === 'string' && entityId.length > 0) {
        entityIdFormats.string++;
      } else {
        entityIdFormats.other++;
      }
    }

    console.log(`  UUIDs: ${entityIdFormats.uuid}`);
    console.log(`  Numeric: ${entityIdFormats.numeric}`);
    console.log(`  String: ${entityIdFormats.string}`);
    console.log(`  Other: ${entityIdFormats.other}`);

    // Step 8: Root cause analysis
    console.log('\n' + '='.repeat(80));
    console.log('🎯 ROOT CAUSE ANALYSIS:');
    console.log('='.repeat(80));

    console.log('\nLikely causes:');
    if (brokenCount > 100) {
      console.log('  1. ✅ Mass entity deletion during cleanup (875→159 entities)');
      console.log('     - Memory cleanup preserved entity_ids but deleted entities');
      console.log('     - Cascading deletes not configured for entity references');
    }

    if (entityIdFormats.string > entityIdFormats.uuid) {
      console.log('  2. ⚠️  Entity names stored instead of IDs');
      console.log('     - entity_ids field may contain names, not actual IDs');
      console.log('     - Schema migration or data import issue');
    }

    if (potentialMatches > 0) {
      console.log(`  3. 🔗 Some references could be re-linked (${potentialMatches} potential matches)`);
    }

    // Step 9: Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('💡 RECOMMENDATIONS:');
    console.log('='.repeat(80));

    if (potentialMatches > 3) {
      console.log('\n✅ OPTION A: Attempt Re-linking (Partial Fix)');
      console.log('  - Re-link the entity IDs that match entity names');
      console.log('  - Clear remaining broken references');
      console.log(`  - Would fix ~${potentialMatches} out of ${brokenCount} broken memories`);
    }

    console.log('\n✅ OPTION B: Clear All Broken References (Recommended)');
    console.log('  - Safest approach given mass entity deletion');
    console.log(`  - Clears entity_ids for ${brokenCount} memories`);
    console.log('  - Preserves memory content intact');
    console.log('  - Prevents future integrity issues');

    // Step 10: Generate cleanup SQL
    console.log('\n' + '='.repeat(80));
    console.log('📋 CLEANUP SCRIPT:');
    console.log('='.repeat(80));

    console.log('\n-- Step 1: Create backup table');
    console.log('CREATE TABLE IF NOT EXISTS memories_entity_backup_20251014 AS');
    console.log('SELECT id, entity_ids, created_at FROM memories WHERE entity_ids IS NOT NULL;');

    console.log('\n-- Step 2: Verify backup');
    console.log('SELECT COUNT(*) as backed_up_count FROM memories_entity_backup_20251014;');

    console.log('\n-- Step 3: Clear broken references');
    console.log('UPDATE memories');
    console.log('SET entity_ids = NULL');
    console.log('WHERE entity_ids IS NOT NULL');
    console.log(`  AND id IN (${brokenMemories.slice(0, 5).map(m => `'${m.id}'`).join(', ')}, ...);`);

    console.log('\n-- Step 4: Verify cleanup');
    console.log('SELECT COUNT(*) as remaining_refs FROM memories WHERE entity_ids IS NOT NULL;');

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`  Total memories with entity_ids: ${memories.length}`);
    console.log(`  Broken references: ${brokenCount}`);
    console.log(`  Valid references: ${validCount}`);
    console.log(`  Unique missing entity IDs: ${brokenEntityIds.size}`);
    console.log(`  Potential re-linking opportunities: ${potentialMatches}`);
    console.log(`\n  Recommendation: ${potentialMatches > 3 ? 'Attempt re-linking then clear remaining' : 'Clear all broken references'}`);

  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run analysis
analyzeBreakage()
  .then(() => {
    console.log('\n✅ Analysis complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });
